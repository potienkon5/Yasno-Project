import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const android=path.join(root,'android');
const pkg='kz/yasno/classroom';
const main=path.join(android,'app/src/main/java',pkg,'MainActivity.java');
const dest=path.join(android,'app/src/main/java',pkg,'YasnoUpdaterPlugin.java');
const manifest=path.join(android,'app/src/main/AndroidManifest.xml');
const paths=path.join(android,'app/src/main/res/xml/update_paths.xml');
if(!fs.existsSync(main))throw Error('Сначала выполните npm run android:add. Ожидается MainActivity.java по пути '+main);
fs.copyFileSync(path.join(root,'native/java/YasnoUpdaterPlugin.java'),dest);
fs.mkdirSync(path.dirname(paths),{recursive:true});
fs.copyFileSync(path.join(root,'native/xml/update_paths.xml'),paths);
let src=fs.readFileSync(main,'utf8');
if(!src.includes('registerPlugin(YasnoUpdaterPlugin.class)')){
  src=src.replace(/public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/,x=>`${x}\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(YasnoUpdaterPlugin.class);\n        super.onCreate(savedInstanceState);\n        // Clear only the WebView HTTP cache. Keep cookies, login session and app data.\n        getBridge().getWebView().clearCache(true);\n        getBridge().getWebView().getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);\n    }`);
  if(!src.includes('registerPlugin(YasnoUpdaterPlugin.class)'))throw Error('Не удалось зарегистрировать плагин в MainActivity');
  fs.writeFileSync(main,src);
}
let m=fs.readFileSync(manifest,'utf8');
if(!m.includes('android.permission.REQUEST_INSTALL_PACKAGES'))m=m.replace('<application', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application');
if(!m.includes('android.permission.SCHEDULE_EXACT_ALARM'))m=m.replace('<application', '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />\n    <application');
// Capacitor's Android template already registers ${applicationId}.fileprovider
// with @xml/file_paths (including a cache-path). Reuse it instead of
// registering a second provider with the same Java class name.
if(!m.includes('${applicationId}.fileprovider'))throw Error('В AndroidManifest.xml отсутствует стандартный FileProvider Capacitor (.fileprovider)');
const bundledPaths=path.join(android,'app/src/main/res/xml/file_paths.xml');
if(!fs.existsSync(bundledPaths)||!fs.readFileSync(bundledPaths,'utf8').includes('<cache-path'))throw Error('file_paths.xml должен разрешать cache-path для APK в cache/updates');
fs.writeFileSync(manifest,m);
console.log('YasnoUpdater: Java-плагин, FileProvider, AndroidManifest и MainActivity подготовлены.');
