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
  src=src.replace(/public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/,x=>`${x}\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(YasnoUpdaterPlugin.class);\n        super.onCreate(savedInstanceState);\n    }`);
  if(!src.includes('registerPlugin(YasnoUpdaterPlugin.class)'))throw Error('Не удалось зарегистрировать плагин в MainActivity');
  fs.writeFileSync(main,src);
}
let m=fs.readFileSync(manifest,'utf8');
if(!m.includes('android.permission.REQUEST_INSTALL_PACKAGES'))m=m.replace('<application', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application');
if(!m.includes('androidx.core.content.FileProvider'))m=m.replace('</application>',`    <provider\n        android:name="androidx.core.content.FileProvider"\n        android:authorities="\${applicationId}.updateprovider"\n        android:exported="false"\n        android:grantUriPermissions="true">\n        <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/update_paths" />\n    </provider>\n  </application>`);
fs.writeFileSync(manifest,m);
console.log('YasnoUpdater: Java-плагин, FileProvider, AndroidManifest и MainActivity подготовлены.');
