# 本地应用

每个应用独立放在一个子目录，文件夹名使用小写英文、数字、连字符，例如 `my-game`。

```text
apps/my-game/
  app.json
  cover.png             可选
  hub.html              可选介绍页，可链接到 project/index.html
  project/
    index.html
    assets/
    vendor/             本地依赖
```

`app.json` 最小示例：

```json
{
  "name": "My Game",
  "category": "Games",
  "description": "我的离线游戏",
  "entry": "project/index.html",
  "cover": "cover.png"
}
```

没有封面时删除 `cover` 字段。若需要先显示介绍页，将 `entry` 改为 `hub.html`。单文件 HTML 可以直接放在应用目录，将 `entry` 指向它。

启动台打开时及重新获得焦点时扫描目录。有效应用自动加入 Explore、分类和搜索；无效配置会提示，不影响其他应用。修改应用内容后关闭并重新打开其窗口。

所有应用复用 `app-host/` 窗口，无需单独创建窗口控制页面。应用通过稳定的 `aether-app://文件夹名/` 本机地址运行，支持 ES modules、fetch、本地存储；不是互联网服务，不开放 TCP 端口。每个应用独立存储且无 Node 或启动台接口权限。

运行时禁止外网请求。请将 CDN 脚本、字体、图片、WASM 等依赖放入项目并改成本地引用；系统不会自动下载或转换依赖。React/Vue/Vite 项目需要先构建，把静态产物放入 `project/`，构建使用相对资源路径（如 Vite 的 `base: './'`），入口指向产物 HTML。当前不启动 Node/Python 后端，也不提供 SPA history 回退；SPA 使用 hash 路由。

此目录保留了 `offline-demo`，可直接运行并作为新增应用的参考。已撤销的 HOTSWAP 实验不会自动恢复。
