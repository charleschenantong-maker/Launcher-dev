export const archiveData=window.appStore?window.appStore.read()||{version:1,keys:{}}:JSON.parse(localStorage.getItem('hotswap-save')||'null')||{version:1,keys:{}};
export function saveArchive(){if(window.appStore)window.appStore.write(archiveData);else localStorage.setItem('hotswap-save',JSON.stringify(archiveData));}
export const archive={getItem:key=>archiveData.keys?.[key]??null,setItem:(key,value)=>{archiveData.keys??={};archiveData.keys[key]=String(value);saveArchive();}};
