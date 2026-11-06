// Ясно: GitHub Releases -> нативный Android Package Installer.
// Укажите публичный репозиторий; для приватного репозитория этот способ НЕ подходит.
export const GITHUB_OWNER = 'potienkon5';
export const GITHUB_REPO = 'Yasno-Project';
const APK_NAME = 'yasno-release.apk';
export const apkDiagnostics=()=>`Источник APK: ${GITHUB_OWNER}/${GITHUB_REPO} · сборка ${document.querySelector('meta[name="yasno-build"]')?.content||'неизвестна'} · модуль v2`;
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
  if(!/^[a-zA-Z0-9-]{1,39}$/.test(GITHUB_OWNER)||!/^[a-zA-Z0-9_.-]+$/.test(GITHUB_REPO))throw Error('Неверные данные GitHub: '+apkDiagnostics());
  const current=await native().getVersion();
  const api=`https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/releases/latest`;
  const res=await fetch(api,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if(!res.ok)throw Error(res.status===404?'GitHub Release не найден: опубликуйте стабильный релиз с APK':`GitHub API: HTTP ${res.status}`);
  const release=await res.json();
  const asset=(release.assets||[]).find(a=>a.name===APK_NAME);
  if(!asset)throw Error(`В последнем релизе нет файла ${APK_NAME}`);
  if(!release.tag_name||!/^v?\d+(\.\d+){1,3}$/i.test(release.tag_name))throw Error('Тег релиза должен быть вида v1.0.1');
  let sha256=/^sha256:[a-f0-9]{64}$/i.test(asset.digest||'')?asset.digest.slice(7):null;
  if(!sha256){
    const sumAsset=(release.assets||[]).find(a=>a.name==='SHA256SUMS.txt');
    if(!sumAsset)throw Error('В GitHub Release отсутствуют SHA-256 и SHA256SUMS.txt');
    const response=await fetch(sumAsset.browser_download_url,{cache:'no-store'});
    if(!response.ok)throw Error('Не удалось скачать SHA256SUMS.txt: HTTP '+response.status);
    const sums=await response.text();
    const line=sums.split(/\r?\n/).find(s=>/\byasno-release\.apk\s*$/.test(s));
    const matched=line?.match(/^([a-f0-9]{64})\s+/i);
    if(!matched)throw Error('В SHA256SUMS.txt не найдена корректная сумма yasno-release.apk');
    sha256=matched[1];
  }
  const data={supported:true,updateAvailable:isNewer(release.tag_name,current.versionName),installed:current.versionName,latest:release.tag_name.replace(/^v/i,''),notes:release.body||'',url:asset.browser_download_url,sha256,bytes:asset.size};
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
