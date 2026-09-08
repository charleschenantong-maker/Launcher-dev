// Keep existing browser saves on first upgrade; subsequent writes are synchronous disk saves.
let hubData,hubStorageError;
try {hubData=window.launcher?window.launcher.read():null;if(hubData===null){hubData={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('aether-'))hubData[key]=localStorage.getItem(key);}window.launcher?.write(hubData);}}catch(error){hubStorageError=error;hubData={};}
const hubStorage={
  getItem:key=>hubData[key]??null,
  setItem:(key,value)=>{if(hubStorageError)throw hubStorageError;const next={...hubData,[key]:String(value)};if(window.launcher)window.launcher.write(next);else localStorage.setItem(key,value);hubData=next;}
};
