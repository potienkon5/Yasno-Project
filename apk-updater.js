// Ясно: GitHub Releases -> нативный Android Package Installer.
// Укажите публичный репозиторий; для приватного репозитория этот способ НЕ подходит.
export const GITHUB_OWNER = 'REPLACE_WITH_GITHUB_USERNAME';
export const GITHUB_REPO = 'yasno-app';
const APK_NAME = 'yasno-release.apk';
const native = () => window.Capacitor?.Plugins?.YasnoUpdater || null;
const versionParts = s => String(s||'').replace(/^v/i,'').split('.').map(x=>Number(x));
function isNewer(candidate,current){
  const a=versionParts(candidate), b=versionParts(current);
  if(a.some(n=>!Number.isInteger(n))||b.some(n=>!Number.isInteger(n)))return false;
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if((a[i]||0)>(b[i]||0))return true;
    if((a[i]||0)<(b[i]||0))return false;
  }
  return false;
}
export const isAndroidApk = () => !!window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.()==='android';
export async function checkApkUpdate(){
  if(!isAndroidApk())return {supported:false,reason:'Обновления APK доступны только внутри Android-приложения'};
  if(!native())throw Error('Нативный модуль обновлений не найден. Выполните npm run android:prepare и пересоберите APK.');
  if(GITHUB_OWNER==='REPLACE_WITH_GITHUB_USERNAME')throw Error('Укажите GITHUB_OWNER в www/apk-updater.js');
  const current=await native().getVersion();
  const api=`https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/releases/latest`;
  const res=await fetch(api,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if(!res.ok)throw Error(res.status===404?'GitHub Release не найден: опубликуйте стабильный релиз с APK':`GitHub API: HTTP ${res.status}`);
  const release=await res.json();
  const asset=(release.assets||[]).find(a=>a.name===APK_NAME);
  if(!asset)throw Error(`В последнем релизе нет файла ${APK_NAME}`);
  if(!release.tag_name||!/^v?\d+(\.\d+){1,3}$/i.test(release.tag_name))throw Error('Тег релиза должен быть вида v1.0.1');
  if(!asset.digest||!/^sha256:[a-f0-9]{64}$/i.test(asset.digest))throw Error('GitHub не сообщил SHA-256 APK. Обновление заблокировано.');
  const data={supported:true,updateAvailable:isNewer(release.tag_name,current.versionName),installed:current.versionName,latest:release.tag_name.replace(/^v/i,''),notes:release.body||'',url:asset.browser_download_url,sha256:asset.digest.slice(7),bytes:asset.size};
  if(!data.url.startsWith('https://github.com/'))throw Error('Неверный URL APK');
  return data;
}
export async function installApkUpdate(info,onProgress){
  if(!native())throw Error('Нет Android-модуля');
  let listener=null;
  try{
    if(onProgress)listener=await native().addListener('progress',onProgress);
    return await native().downloadAndInstall({url:info.url,sha256:info.sha256});
  }finally{if(listener)await listener.remove()}
}
