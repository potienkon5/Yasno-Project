import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const landing=read('landing/index.html');
const app=read('capacitor/www/index.html');
const manifest=JSON.parse(read('capacitor/www/manifest.webmanifest'));
const callback=read('auth-page/index.html');
const deploy=read('.github/workflows/publish-auth-page.yml');

test('landing has both actual install routes and real product information',()=>{
 assert.match(landing,/lang="ru"/);
 assert.match(landing,/meta name="viewport"/);
 assert.match(landing,/id="android-download"/);
 assert.match(landing,/https:\/\/github\.com\/potienkon5\/Yasno-Project\/releases\/latest\/download\/yasno-release\.apk/);
 assert.match(landing,/id="ios-open"[^>]+href="\.\/app\/"/);
 assert.match(landing,/Safari/);
 assert.match(landing,/На экран/);
 assert.match(landing,/Домашние задания/);
 assert.match(landing,/Денежные сборы/);
 assert.match(landing,/\.\/app\/privacy\.html/);
 assert.doesNotMatch(landing,/https:\/\/localhost/);
});
test('iOS PWA is installable in principle and uses relative scoped resources',()=>{
 assert.match(app,/apple-mobile-web-app-capable/);
 assert.match(app,/rel="apple-touch-icon"/);
 assert.match(app,/navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./');
 assert.equal(manifest.scope,'./');
 assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
});
test('GitHub Pages deployment keeps auth callback and publishes iOS app at /app/',()=>{
 assert.match(deploy,/cp landing\/index\.html _site\/index\.html/);
 assert.match(deploy,/cp -R capacitor\/www\/\. _site\/app\//);
 assert.match(deploy,/cp auth-page\/index\.html _site\/auth\/index\.html/);
 assert.match(deploy,/cp capacitor\/www\/supabase-config\.js _site\/auth\/supabase-config\.js/);
 assert.match(callback,/auth\.getSession/);
});
test('landing browser-device detection code has valid JavaScript syntax',()=>{
 const code=landing.split('<script>')[1]?.split('</script>')[0];
 assert.ok(code,'landing JavaScript present');
 assert.doesNotThrow(()=>new Function(code));
});
