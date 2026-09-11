use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use percent_encoding::percent_decode_str;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::{
    http::{header, Request, Response, StatusCode},
    utils::config::BackgroundThrottlingPolicy,
    window::{Effect, EffectsBuilder},
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Theme, Webview, WebviewUrl,
};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Deserialize, Serialize)]
struct Application {
    id: String,
    slug: String,
    name: String,
    detail: String,
    category: String,
    entry: String,
    folder: PathBuf,
    cover: Option<String>,
    icon: &'static str,
    tone: &'static str,
    playable: bool,
    explore: bool,
}

#[derive(Deserialize)]
struct Manifest {
    name: String,
    category: Option<String>,
    description: Option<String>,
    entry: Option<String>,
    cover: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct Track {
    id: String,
    file: PathBuf,
    name: String,
}

struct State {
    theme: Mutex<String>,
    revisions: Mutex<HashMap<String, u64>>,
}

fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn apps_root(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        Ok(project_root().join("apps"))
    } else {
        app.path()
            .resource_dir()
            .map(|path| path.join("apps"))
            .map_err(|e| e.to_string())
    }
}

fn save_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn save_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    Ok(save_dir(app)?.join(format!("{name}.json")))
}

fn read_save(app: &AppHandle, name: &str) -> Result<Value, String> {
    let file = save_path(app, name)?;
    if !file.exists() {
        return Ok(Value::Null);
    }
    let read = |path: &Path| -> Result<Value, String> {
        serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    };
    read(&file).or_else(|error| {
        let backup = PathBuf::from(format!("{}.bak", file.display()));
        if backup.exists() {
            read(&backup)
        } else {
            Err(error)
        }
    })
}

fn write_save(app: &AppHandle, name: &str, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("Save exceeds 4 MB".into());
    }
    let file = save_path(app, name)?;
    let temp = file.with_extension("json.tmp");
    let backup = PathBuf::from(format!("{}.bak", file.display()));
    {
        let mut output = fs::File::create(&temp).map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut output, &bytes).map_err(|e| e.to_string())?;
        output.sync_all().map_err(|e| e.to_string())?;
    }
    if file.exists() {
        fs::copy(&file, &backup).map_err(|e| e.to_string())?;
        fs::remove_file(&file).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, file).map_err(|e| e.to_string())
}

fn checked_file(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() || relative.contains('\\') || relative.contains(':') {
        return Err("入口必须是应用目录内的相对路径".into());
    }
    let decoded = percent_decode_str(relative)
        .decode_utf8()
        .map_err(|e| e.to_string())?;
    if Path::new(decoded.as_ref())
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("文件超出应用目录".into());
    }
    let base = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let file = fs::canonicalize(base.join(decoded.as_ref())).map_err(|e| e.to_string())?;
    if !file.starts_with(&base) || !file.is_file() {
        return Err("文件超出应用目录或不是普通文件".into());
    }
    Ok(file)
}

fn scan_apps(app: &AppHandle) -> Result<(Vec<Application>, Vec<String>), String> {
    let root = apps_root(app)?;
    let mut apps = Vec::new();
    let mut errors = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let slug = entry.file_name().to_string_lossy().to_string();
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() || slug.starts_with('.') {
            continue;
        }
        let result = (|| -> Result<Application, String> {
            if !slug.chars().enumerate().all(|(index, c)| {
                c.is_ascii_lowercase() || c.is_ascii_digit() || (c == '-' && index > 0)
            }) {
                return Err("文件夹名只支持小写字母、数字和连字符".into());
            }
            let folder = entry.path();
            let manifest: Manifest = serde_json::from_slice(
                &fs::read(checked_file(&folder, "app.json")?).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            if manifest.name.trim().is_empty() {
                return Err("app.json 缺少 name".into());
            }
            let app_entry = manifest
                .entry
                .unwrap_or_else(|| "project/index.html".into());
            let target = checked_file(&folder, &app_entry)?;
            if !matches!(
                target.extension().and_then(|v| v.to_str()),
                Some("html" | "htm")
            ) {
                return Err("入口必须是 HTML 文件".into());
            }
            let cover = manifest
                .cover
                .map(|relative| -> Result<String, String> {
                    let file = checked_file(&folder, &relative)?;
                    if fs::metadata(&file).map_err(|e| e.to_string())?.len() > 5 * 1024 * 1024 {
                        return Err("封面须不超过 5 MB".into());
                    }
                    let mime = mime_guess::from_path(&file).first_or_octet_stream();
                    if !matches!(mime.type_().as_str(), "image") {
                        return Err("封面须为图片".into());
                    }
                    Ok(format!(
                        "data:{mime};base64,{}",
                        BASE64.encode(fs::read(file).map_err(|e| e.to_string())?)
                    ))
                })
                .transpose()?;
            let categories = [
                "Games",
                "Tools",
                "Productivity",
                "Study",
                "Finance",
                "Creative",
            ];
            Ok(Application {
                id: format!("local-{slug}"),
                slug: slug.clone(),
                name: manifest.name.chars().take(100).collect(),
                detail: manifest
                    .description
                    .unwrap_or_else(|| "Local app · Offline".into())
                    .chars()
                    .take(200)
                    .collect(),
                category: manifest
                    .category
                    .filter(|v| categories.contains(&v.as_str()))
                    .unwrap_or_else(|| "Tools".into()),
                entry: app_entry,
                folder,
                cover,
                icon: "grid",
                tone: "teal",
                playable: true,
                explore: true,
            })
        })();
        match result {
            Ok(application) => apps.push(application),
            Err(error) => errors.push(format!("{slug}: {error}")),
        }
    }
    apps.sort_by(|a, b| a.slug.cmp(&b.slug));
    Ok((apps, errors))
}

fn caller(webview: &Webview) -> Result<String, String> {
    match webview.label() {
        "main" => Ok("launcher".into()),
        label if label.starts_with("content-") => Ok(format!("app-{}", &label[8..])),
        _ => Err("Invalid caller".into()),
    }
}

fn clone_script_value(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".into())
}

fn allow_host_navigation(url: &tauri::Url) -> bool {
    url.scheme() == "tauri"
        || (matches!(url.scheme(), "http" | "https")
            && matches!(
                url.host_str(),
                Some("127.0.0.1" | "localhost" | "tauri.localhost")
            ))
}

fn app_hostname(slug: &str) -> String {
    let numeric = slug.chars().all(|c| c.is_ascii_digit());
    let hexadecimal = slug
        .strip_prefix("0x")
        .is_some_and(|value| !value.is_empty() && value.chars().all(|c| c.is_ascii_hexdigit()));
    if numeric || hexadecimal {
        format!("app-{slug}")
    } else {
        slug.into()
    }
}

fn allow_app_navigation(url: &tauri::Url, hostname: &str) -> bool {
    (url.scheme() == "aether-app" && url.host_str() == Some(hostname))
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str() == Some(format!("aether-app.{hostname}").as_str()))
}

fn launcher_script(saved: &Value) -> String {
    format!(
        r#"(()=>{{
const invoke=(command,args={{}})=>window.__TAURI_INTERNALS__.invoke(command,args);
const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
let value={},revision=0,writeError;
Object.defineProperty(window,'launcher',{{value:{{
  read:()=>{{if(writeError)throw writeError;return clone(value)}},
  write:next=>{{if(writeError)throw writeError;value=clone(next);invoke('save_write',{{value,revision:++revision}}).catch(error=>writeError=new Error(String(error)))}},
  summary:()=>invoke('hub_summary'),weather:()=>invoke('online_data',{{kind:'weather'}}),
  pickMusic:()=>invoke('music_pick'),listMusic:()=>invoke('music_list'),
  setTheme:theme=>invoke('set_theme',{{theme}}),listApps:()=>invoke('apps_list'),
  openApp:id=>invoke('apps_open',{{id}}),controlWindow:action=>invoke('window_control',{{action}})
}}}});
addEventListener('DOMContentLoaded',()=>{{const bar=document.querySelector('.topbar');bar?.addEventListener('pointerdown',event=>{{if(event.button===0&&!event.target.closest('button,input,a,[role=button]'))invoke('window_control',{{action:'drag'}})}})}});
}})();"#,
        clone_script_value(saved)
    )
}

fn host_script(theme: &str) -> String {
    format!(
        r#"(()=>{{
const invoke=(command,args={{}})=>window.__TAURI_INTERNALS__.invoke(command,args);let theme={},listeners=[];
window.__aetherThemeChanged=next=>{{theme=next;for(const listener of listeners)listener(next)}};
Object.defineProperty(window,'host',{{value:{{theme:()=>theme,onTheme:callback=>listeners.push(callback),control:action=>invoke('window_control',{{action}})}}}});
addEventListener('DOMContentLoaded',()=>document.querySelector('header')?.addEventListener('pointerdown',event=>{{if(event.button===0&&!event.target.closest('button'))invoke('window_control',{{action:'drag'}})}}));
}})();"#,
        serde_json::to_string(theme).unwrap()
    )
}

fn app_script(saved: &Value, theme: &str) -> String {
    let style = serde_json::to_string(include_str!("../../app-host/macos.css")).unwrap();
    format!(
        r#"(()=>{{
const invoke=(command,args={{}})=>window.__TAURI_INTERNALS__.invoke(command,args);const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
let value={},theme={},revision=0,writeError,listeners=[];
window.__aetherThemeChanged=next=>{{theme=next;for(const listener of listeners)listener(next)}};
Object.defineProperty(window,'appStore',{{value:{{theme:()=>theme,onTheme:callback=>listeners.push(callback),read:()=>{{if(writeError)throw writeError;return clone(value)}},write:next=>{{if(writeError)throw writeError;value=clone(next);invoke('save_write',{{value,revision:++revision}}).catch(error=>writeError=new Error(String(error))) }},rates:()=>invoke('online_data',{{kind:'rates'}})}}}});
addEventListener('DOMContentLoaded',()=>{{const style=document.createElement('style');style.textContent={};document.head.append(style)}});
}})();"#,
        clone_script_value(saved),
        serde_json::to_string(theme).unwrap(),
        style
    )
}

#[tauri::command]
fn save_write(
    webview: Webview,
    app: AppHandle,
    state: tauri::State<State>,
    value: Value,
    revision: u64,
) -> Result<(), String> {
    let name = caller(&webview)?;
    let mut revisions = state
        .revisions
        .lock()
        .map_err(|_| "Save lock failed".to_string())?;
    if revision < *revisions.get(&name).unwrap_or(&0) {
        return Ok(());
    }
    write_save(&app, &name, &value)?;
    revisions.insert(name, revision);
    Ok(())
}

#[tauri::command]
fn apps_list(webview: Webview, app: AppHandle) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("Invalid caller".into());
    }
    let (apps, errors) = scan_apps(&app)?;
    Ok(
        json!({"apps": apps.into_iter().map(|mut item| { item.folder=PathBuf::new(); item }).collect::<Vec<_>>(), "errors": errors}),
    )
}

fn record_open(app: &AppHandle, slug: &str) -> Result<(), String> {
    let mut usage = read_save(app, "usage")?
        .as_object()
        .cloned()
        .unwrap_or_default();
    let mut item = usage
        .get(slug)
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    item.insert(
        "opens".into(),
        json!(item.get("opens").and_then(Value::as_u64).unwrap_or(0) + 1),
    );
    item.entry("seconds").or_insert(json!(0));
    item.insert(
        "lastOpened".into(),
        json!(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()),
    );
    usage.insert(slug.into(), Value::Object(item));
    write_save(app, "usage", &Value::Object(usage))
}

fn create_app_window(
    app: &AppHandle,
    application: &Application,
    theme: &str,
) -> Result<(), String> {
    let label = format!("app-{}", application.slug);
    if let Some(window) = app.get_window(&label) {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let effects = EffectsBuilder::new().effect(Effect::Acrylic).build();
    let window = tauri::window::WindowBuilder::new(app, &label)
        .title(format!("{} — Aether Hub", application.name))
        .inner_size(1400.0, 950.0)
        .min_inner_size(800.0, 600.0)
        .decorations(false)
        .transparent(true)
        .effects(effects)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    let inner_size = window.inner_size().map_err(|e| e.to_string())?;
    let header_height = (44.0 * window.scale_factor().map_err(|e| e.to_string())?).round() as u32;
    let host_url = format!(
        "app-host/index.html?name={}&network={}",
        percent_encoding::utf8_percent_encode(
            &application.name,
            percent_encoding::NON_ALPHANUMERIC
        ),
        if application.slug == "currency" {
            "rates"
        } else {
            ""
        }
    );
    let host = tauri::webview::WebviewBuilder::new(
        format!("host-{}", application.slug),
        WebviewUrl::App(host_url.into()),
    )
    .initialization_script(host_script(theme))
    .transparent(true)
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .on_navigation(allow_host_navigation);
    let host = window
        .add_child(host, PhysicalPosition::new(0, 0), inner_size)
        .map_err(|e| e.to_string())?;
    let saved = read_save(app, &format!("app-{}", application.slug))?;
    let hostname = app_hostname(&application.slug);
    let content_url = format!(
        "aether-app://{}/{}",
        hostname,
        application
            .entry
            .split('/')
            .map(|part| percent_encoding::utf8_percent_encode(
                part,
                percent_encoding::NON_ALPHANUMERIC
            )
            .to_string())
            .collect::<Vec<_>>()
            .join("/")
    );
    let expected_hostname = hostname;
    let content = tauri::webview::WebviewBuilder::new(
        format!("content-{}", application.slug),
        WebviewUrl::CustomProtocol(content_url.parse().map_err(|e| format!("{e}"))?),
    )
    .initialization_script(app_script(&saved, theme))
    .transparent(true)
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .incognito(true)
    .on_navigation(move |url| allow_app_navigation(url, &expected_hostname))
    .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny);
    let content = window
        .add_child(
            content,
            PhysicalPosition::new(0, header_height),
            PhysicalSize::new(
                inner_size.width,
                inner_size.height.saturating_sub(header_height),
            ),
        )
        .map_err(|e| e.to_string())?;
    let resized = content.clone();
    let resized_host = host.clone();
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Resized(size) = event {
            let header_height =
                (44.0 * resized.window().scale_factor().unwrap_or(1.0)).round() as u32;
            let _ = resized_host.set_bounds(tauri::Rect {
                position: PhysicalPosition::new(0, 0).into(),
                size: (*size).into(),
            });
            let _ = resized.set_bounds(tauri::Rect {
                position: PhysicalPosition::new(0, header_height).into(),
                size: PhysicalSize::new(size.width, size.height.saturating_sub(header_height))
                    .into(),
            });
        }
        if matches!(event, tauri::WindowEvent::Destroyed) {
            if let Some(main) = app_handle.get_webview_window("main") {
                let _ = main.set_focus();
            }
        }
    });
    record_open(app, &application.slug)?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    content.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
async fn apps_open(
    webview: Webview,
    app: AppHandle,
    state: tauri::State<'_, State>,
    id: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Ok(json!({"error":"Invalid caller"}));
    }
    let application = scan_apps(&app)?
        .0
        .into_iter()
        .find(|item| item.id == id)
        .ok_or("应用不存在或配置无效，请检查 apps 目录。")?;
    let theme = state.theme.lock().map_err(|_| "Theme lock failed")?.clone();
    create_app_window(&app, &application, &theme)
        .map(|_| json!({}))
        .or_else(|error| Ok(json!({"error":error})))
}

#[tauri::command]
fn window_control(webview: Webview, action: String) -> Result<(), String> {
    let window = webview.window();
    match action.as_str() {
        "close" => window.close(),
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "drag" => window.start_dragging(),
        _ => return Ok(()),
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_theme(
    webview: Webview,
    app: AppHandle,
    state: tauri::State<State>,
    theme: String,
) -> Result<bool, String> {
    if webview.label() != "main" || !matches!(theme.as_str(), "dark" | "light") {
        return Ok(false);
    }
    *state.theme.lock().map_err(|_| "Theme lock failed")? = theme.clone();
    let native = if theme == "light" {
        Theme::Light
    } else {
        Theme::Dark
    };
    let script = format!(
        "window.__aetherThemeChanged?.({})",
        serde_json::to_string(&theme).unwrap()
    );
    for window in app.webview_windows().values() {
        let _ = window.set_theme(Some(native));
        let _ = window.eval(&script);
    }
    for webview in app.webviews().values() {
        let _ = webview.window().set_theme(Some(native));
        let _ = webview.eval(&script);
    }
    Ok(true)
}

#[tauri::command]
fn hub_summary(webview: Webview, app: AppHandle) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("Invalid caller".into());
    }
    Ok(
        json!({"usage": read_save(&app,"usage")?, "planner":read_save(&app,"app-planner")?, "habits":read_save(&app,"app-habits")?, "savings":read_save(&app,"app-savings")?, "pomodoro":read_save(&app,"app-pomodoro")?, "directory":save_dir(&app)?}),
    )
}

#[tauri::command]
async fn online_data(webview: Webview, app: AppHandle, kind: String) -> Result<Value, String> {
    let name = caller(&webview)?;
    if !((name == "launcher" && kind == "weather") || (name == "app-currency" && kind == "rates")) {
        return Err("Not allowed".into());
    }
    let key = format!("cache-{kind}");
    let previous = read_save(&app, &key)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let ttl = if kind == "weather" {
        15 * 60 * 1000
    } else {
        60 * 60 * 1000
    };
    if previous
        .get("fetchedAt")
        .and_then(Value::as_u64)
        .is_some_and(|time| now.saturating_sub(time) < ttl)
    {
        let mut cached = previous.as_object().cloned().unwrap();
        cached.insert("cached".into(), Value::Bool(true));
        return Ok(Value::Object(cached));
    }
    let url = if kind == "weather" {
        "https://api.open-meteo.com/v1/forecast?latitude=-36.85&longitude=174.76&current=temperature_2m,weather_code&timezone=Pacific%2FAuckland"
    } else {
        "https://api.frankfurter.dev/v1/latest?base=NZD"
    };
    let fetched = async {
        let response = reqwest::Client::new()
            .get(url)
            .timeout(std::time::Duration::from_secs(12))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        let data: Value = response.json().await.map_err(|e| e.to_string())?;
        let valid = if kind == "weather" {
            data.pointer("/current/temperature_2m")
                .and_then(Value::as_f64)
                .is_some()
        } else {
            data.get("rates")
                .and_then(Value::as_object)
                .is_some_and(|rates| rates.values().all(|v| v.as_f64().is_some_and(|n| n > 0.0)))
        };
        if !valid {
            return Err("Invalid response".into());
        }
        let value = json!({"data":data,"fetchedAt":now});
        write_save(&app, &key, &value)?;
        Ok(value)
    }
    .await;
    fetched.or_else(|error: String| {
        if previous.is_null() {
            Ok(json!({"error":error}))
        } else {
            let mut stale = previous.as_object().cloned().unwrap();
            stale.insert("stale".into(), true.into());
            stale.insert("error".into(), error.into());
            Ok(Value::Object(stale))
        }
    })
}

#[tauri::command]
fn music_pick(webview: Webview, app: AppHandle) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("Invalid caller".into());
    }
    let picked = app
        .dialog()
        .file()
        .add_filter("Audio", &["mp3", "wav", "ogg", "m4a", "flac", "aac"])
        .blocking_pick_files();
    let Some(files) = picked else {
        return Ok(Value::Null);
    };
    let tracks = files
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .map(|file| Track {
            id: uuid::Uuid::new_v4().to_string(),
            name: file
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            file,
        })
        .collect::<Vec<_>>();
    write_save(
        &app,
        "music-files",
        &serde_json::to_value(&tracks).map_err(|e| e.to_string())?,
    )?;
    Ok(Value::Array(
        tracks
            .into_iter()
            .map(|track| json!({"id":track.id,"name":track.name}))
            .collect(),
    ))
}

#[tauri::command]
fn music_list(webview: Webview, app: AppHandle) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("Invalid caller".into());
    }
    Ok(Value::Array(
        serde_json::from_value::<Vec<Track>>(read_save(&app, "music-files")?)
            .unwrap_or_default()
            .into_iter()
            .map(|track| json!({"id":track.id,"name":track.name}))
            .collect(),
    ))
}

fn protocol_error(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(message.as_bytes().to_vec())
        .unwrap()
}

fn app_protocol(
    app: &AppHandle,
    webview_label: &str,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let Some(slug) = webview_label.strip_prefix("content-") else {
        return protocol_error(StatusCode::FORBIDDEN, "Forbidden");
    };
    let uri = request.uri();
    if uri.host().is_some_and(|host| host != app_hostname(slug))
        || !matches!(request.method().as_str(), "GET" | "HEAD")
    {
        return protocol_error(StatusCode::FORBIDDEN, "Forbidden");
    }
    let relative = uri.path().trim_start_matches('/');
    let Ok(root) = apps_root(app).map(|root| root.join(slug)) else {
        return protocol_error(StatusCode::NOT_FOUND, "Not found");
    };
    let Ok(file) = checked_file(
        &root,
        if relative.is_empty() {
            "project/index.html"
        } else {
            relative
        },
    ) else {
        return protocol_error(StatusCode::NOT_FOUND, "Local file not found");
    };
    let Ok(bytes) = fs::read(&file) else {
        return protocol_error(StatusCode::NOT_FOUND, "Local file not found");
    };
    let response = Response::builder().status(StatusCode::OK).header(header::CONTENT_TYPE, mime_guess::from_path(file).first_or_octet_stream().as_ref()).header(header::CONTENT_SECURITY_POLICY,"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'");
    if request.method() == "HEAD" {
        response.body(Vec::new()).unwrap()
    } else {
        response.body(bytes).unwrap()
    }
}

fn media_protocol(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let id = request
        .uri()
        .host()
        .map(str::to_string)
        .unwrap_or_else(|| request.uri().path().trim_matches('/').to_string());
    let tracks =
        serde_json::from_value::<Vec<Track>>(read_save(app, "music-files").unwrap_or(Value::Null))
            .unwrap_or_default();
    let Some(track) = tracks.into_iter().find(|track| track.id == id) else {
        return protocol_error(StatusCode::NOT_FOUND, "Not found");
    };
    let Ok(mut file) = fs::File::open(&track.file) else {
        return protocol_error(StatusCode::NOT_FOUND, "Audio file unavailable");
    };
    let Ok(size) = file.metadata().map(|m| m.len()) else {
        return protocol_error(StatusCode::NOT_FOUND, "Audio file unavailable");
    };
    let range = request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("bytes="))
        .and_then(|v| v.split_once('-'));
    let (start, end, status) = match range {
        Some((a, b)) if !a.is_empty() => {
            let Ok(start) = a.parse::<u64>() else {
                return protocol_error(StatusCode::RANGE_NOT_SATISFIABLE, "Invalid range");
            };
            let end = b
                .parse()
                .unwrap_or(size.saturating_sub(1))
                .min(size.saturating_sub(1));
            (start, end, StatusCode::PARTIAL_CONTENT)
        }
        Some((a, b)) if a.is_empty() && !b.is_empty() => {
            let Ok(last) = b.parse::<u64>() else {
                return protocol_error(StatusCode::RANGE_NOT_SATISFIABLE, "Invalid range");
            };
            (
                size.saturating_sub(last),
                size.saturating_sub(1),
                StatusCode::PARTIAL_CONTENT,
            )
        }
        _ => (0, size.saturating_sub(1), StatusCode::OK),
    };
    if start > end || start >= size {
        return protocol_error(StatusCode::RANGE_NOT_SATISFIABLE, "Invalid range");
    }
    let mut bytes = vec![0; (end - start + 1) as usize];
    if file
        .seek(SeekFrom::Start(start))
        .and_then(|_| file.read_exact(&mut bytes))
        .is_err()
    {
        return protocol_error(StatusCode::NOT_FOUND, "Audio file unavailable");
    }
    let mut response = Response::builder()
        .status(status)
        .header(
            header::CONTENT_TYPE,
            mime_guess::from_path(&track.file)
                .first_or_octet_stream()
                .as_ref(),
        )
        .header(header::CONTENT_LENGTH, bytes.len())
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "no-store");
    if status == StatusCode::PARTIAL_CONTENT {
        response = response.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{size}"));
    }
    response
        .body(if request.method() == "HEAD" {
            Vec::new()
        } else {
            bytes
        })
        .unwrap()
}

fn create_main(app: &AppHandle, theme: &str) -> Result<(), String> {
    let saved = read_save(app, "launcher")?;
    let effects = EffectsBuilder::new().effect(Effect::Acrylic).build();
    tauri::WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Aether Hub")
        .inner_size(1470.0, 950.0)
        .min_inner_size(1000.0, 720.0)
        .decorations(false)
        .transparent(true)
        .effects(effects)
        .visible(false)
        .initialization_script(launcher_script(&saved))
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        .on_page_load(|window, _| {
            let _ = window.show();
        })
        .build()
        .map_err(|e| e.to_string())?;
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_theme(Some(if theme == "light" {
            Theme::Light
        } else {
            Theme::Dark
        }));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("aether-app", |ctx, request| {
            app_protocol(ctx.app_handle(), ctx.webview_label(), request)
        })
        .register_uri_scheme_protocol("aether-media", |ctx, request| {
            media_protocol(ctx.app_handle(), request)
        })
        .setup(|app| {
            let saved = read_save(app.handle(), "launcher").unwrap_or(Value::Null);
            let theme = saved
                .get("aether-theme")
                .and_then(Value::as_str)
                .and_then(|v| serde_json::from_str::<String>(v).ok())
                .filter(|v| v == "light")
                .unwrap_or_else(|| "dark".into());
            app.manage(State {
                theme: Mutex::new(theme.clone()),
                revisions: Mutex::new(HashMap::new()),
            });
            create_main(app.handle(), &theme).map_err(Into::into)
        })
        .invoke_handler(tauri::generate_handler![
            save_write,
            apps_list,
            apps_open,
            window_control,
            set_theme,
            hub_summary,
            online_data,
            music_pick,
            music_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aether Hub");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_parent_paths() {
        assert!(checked_file(Path::new(env!("CARGO_MANIFEST_DIR")), "../package.json").is_err());
    }

    #[test]
    fn accepts_only_local_webview_navigation() {
        assert!(allow_host_navigation(
            &"http://127.0.0.1:1430/app-host/index.html".parse().unwrap()
        ));
        assert!(allow_app_navigation(
            &"http://aether-app.planner/project/index.html"
                .parse()
                .unwrap(),
            "planner"
        ));
        assert!(allow_app_navigation(
            &"http://aether-app.app-2048/project/index.html"
                .parse()
                .unwrap(),
            "app-2048"
        ));
        assert!(!allow_host_navigation(
            &"https://example.com".parse().unwrap()
        ));
        assert!(!allow_app_navigation(
            &"http://aether-app.planner/project/index.html"
                .parse()
                .unwrap(),
            "savings"
        ));
    }

    #[test]
    fn gives_numeric_slugs_valid_hostnames() {
        assert_eq!(app_hostname("2048"), "app-2048");
        assert_eq!(app_hostname("planner"), "planner");
    }
}
