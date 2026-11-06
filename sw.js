/* Ясно PWA: статика офлайн, Push API без Firebase */
const CACHE='yasno-supabase-v1';
const STATIC=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./supabase-config.js','./privacy.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return; // Auth & Supabase всегда через сеть
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)))}return response;
 }).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>{
 let payload={title:'Ясно',body:'Новое событие в классе'};
 try{payload={...payload,...event.data.json()}}catch(e){}
 event.waitUntil(self.registration.showNotification(String(payload.title||'Ясно'),{
  body:String(payload.body||''),icon:'./icon-192.png',badge:'./icon-192.png',tag:String(payload.tag||'yasno-update'),data:{url:'./'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const url=new URL('./',self.location.href).href;
  for(const client of clients){if(client.url.startsWith(new URL('./',self.location.href).origin)){await client.focus();return}}
  return self.clients.openWindow(url);
 }));
});
