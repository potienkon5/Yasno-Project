// Ясно: локальные напоминания о конкретных сроках.
const KEY='yasnoDeadlineRemindersV1';
const MAX_REMINDERS=40;
const plugin=()=>window.Capacitor?.Plugins?.LocalNotifications || null;
let queue=Promise.resolve();
const stableId=(value)=>{
  let h=2166136261;
  for(let i=0;i<value.length;i++){h=Math.imul(h^value.charCodeAt(i),16777619)}
  return 100000+(h>>>0)%1900000000;
};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s||''));
function dueAt(item){
  if(!validDate(item.date))return null;
  const extracted=String(item.when||'').match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
  const time=validTime(item.time)?item.time:(extracted?extracted[0]:'09:00');
  const date=new Date(item.date+'T'+time+':00');
  if(!Number.isFinite(date.getTime())||date.getFullYear()!==Number(item.date.slice(0,4))||date.getMonth()+1!==Number(item.date.slice(5,7))||date.getDate()!==Number(item.date.slice(8,10)))return null;
  return date;
}
function readPrevious(){
  try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}
}
function cancelNotifications(p,ids){
  return ids?.length?p.cancel({notifications:ids.map(id=>({id}))}):Promise.resolve();
}
async function doClear(){
  const p=plugin();if(!p)return;
  const prev=readPrevious();
  await cancelNotifications(p,prev.ids||[]);
  // Предыдущие версии создавали общие напоминания 07:30 и 18:00.
  await cancelNotifications(p,[730,1800]);
  localStorage.removeItem(KEY);
}
export function clearDeadlineReminders(){
  queue=queue.catch(()=>{}).then(doClear);
  return queue;
}
export function syncDeadlineReminders(data){
  queue=queue.catch(e=>console.warn('Yasno reminders previous error',e)).then(()=>doSync(data));
  return queue;
}
async function doSync({userId,classCode,familyId,tasks=[],homework=[],funds=[]}){
  const p=plugin();
  if(!p||!localStorage.yasnoNativeReminders||!userId||!classCode||!familyId)return {scheduled:0};
  const now=Date.now()+3000, planned=[];
  function add(kind,items,predicate,title,describe){
    for(const item of items){
      if(!predicate(item))continue;
      const at=dueAt(item);if(!at||at.getTime()<=now)continue;
      const token=classCode+':'+userId+':'+kind+':'+item.id;
      planned.push({
        id:stableId(token),title:title,body:describe(item),
        schedule:{at,allowWhileIdle:true},
        extra:{kind,itemId:String(item.id||'')}
      });
    }
  }
  add('task',tasks,x=>!x.done,'Ясно · Дело',x=>x.title||'Пора выполнить дело');
  add('homework',homework,x=>!(x.doneBy||[]).includes(familyId),'Ясно · Домашнее задание',x=>[x.subj,x.text].filter(Boolean).join(': ').slice(0,180)||'Срок домашнего задания');
  add('fund',funds,x=>!(x.paid||{})[familyId],'Ясно · Срок сбора',x=>[x.title,Number.isFinite(+x.amount)?Number(x.amount).toLocaleString('ru-RU')+' ₸':''].filter(Boolean).join(' · ').slice(0,180));
  planned.sort((a,b)=>a.schedule.at-b.schedule.at);
  const chosen=planned.slice(0,MAX_REMINDERS);
  const signature=JSON.stringify({userId,classCode,familyId,items:chosen.map(x=>[x.id,x.title,x.body,x.schedule.at.getTime()])});
  const previous=readPrevious();
  if(previous.signature===signature){
    // Android may discard alarms after a permission change or app update.
    // Never trust only the old localStorage signature.
    const pending=await p.getPending();
    const actual=new Set((pending.notifications||[]).map(x=>x.id));
    if(chosen.every(x=>actual.has(x.id)))return {scheduled:chosen.length};
  }
  await cancelNotifications(p,previous.ids||[]);
  await cancelNotifications(p,[730,1800]);
  localStorage.removeItem(KEY);
  if(chosen.length){
    let exact={value:'granted'};
    try{exact=await p.checkExactNotificationSetting()}catch(e){console.warn('Exact alarm setting:',e)}
    if(exact.value!=='granted'){
      // On Android 12+ this allows less precise reminders instead of losing all alarms.
      chosen.forEach(x=>x.schedule.allowWhileIdle=false);
    }
    await p.schedule({notifications:chosen});
  }
  localStorage.setItem(KEY,JSON.stringify({signature,ids:chosen.map(x=>x.id)}));
  return {scheduled:chosen.length,limitReached:planned.length>MAX_REMINDERS};
}

// Visible diagnostics for the Android app Settings screen.
export async function getReminderDiagnostics(){
 const p=plugin();if(!p)return {supported:false,scheduled:0,exact:'unknown'};
 const [perm,pending,exact]=await Promise.all([
   p.checkPermissions(),
   p.getPending(),
   p.checkExactNotificationSetting().catch(()=>({value:'unknown'}))
 ]);
 return {supported:true,permission:perm.display,scheduled:(pending.notifications||[]).length,exact:exact.value||'unknown'};
}
export async function testReminder(){
 const p=plugin();if(!p)throw Error('Нативный плагин уведомлений не найден');
 const perm=await p.requestPermissions();if(perm.display!=='granted')throw Error('Разрешите уведомления Android');
 const exact=await p.checkExactNotificationSetting().catch(()=>({value:'unknown'}));
 const at=new Date(Date.now()+10000);
 const alarm={id:1999990000,title:'Ясно · Проверка уведомлений',body:'Тест успешен. Можно планировать задания и сборы.',schedule:{at,allowWhileIdle:exact.value==='granted'}};
 await p.cancel({notifications:[{id:alarm.id}]});
 await p.schedule({notifications:[alarm]});
 const pending=await p.getPending();
 return {scheduled:(pending.notifications||[]).some(x=>x.id===alarm.id),exact:exact.value};
}
export async function requestExactReminderPermission(){
 const p=plugin();if(!p)throw Error('Нативный плагин не найден');
 return p.changeExactNotificationSetting();
}
