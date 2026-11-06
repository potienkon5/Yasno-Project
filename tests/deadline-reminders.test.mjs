import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../capacitor/www/deadline-reminders.js',import.meta.url),'utf8');
const scheduled=[],cancelled=[];
const fakePlugin={
  async schedule({notifications}){scheduled.push(...notifications)},
  async cancel({notifications}){cancelled.push(...notifications.map(x=>x.id))}
};
const map=new Map();
globalThis.window={Capacitor:{Plugins:{LocalNotifications:fakePlugin}}};
globalThis.localStorage={
  yasnoNativeReminders:'1',
  getItem:key=>map.get(key)||null,
  setItem:(key,value)=>map.set(key,value),
  removeItem:key=>map.delete(key)
};
const {syncDeadlineReminders,clearDeadlineReminders}=await import('data:text/javascript,'+encodeURIComponent(source));
function dayAhead(days){
 const x=new Date();x.setDate(x.getDate()+days);
 return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');
}
test('plans task, homework and unpaid fund at their own due times',async()=>{
 const date=dayAhead(4);
 const result=await syncDeadlineReminders({
  userId:'user1',classCode:'ABCDE2',familyId:'family1',
  tasks:[{id:'t1',title:'Принести альбом',date,time:'16:45',done:false},{id:'t2',title:'Готово',date,done:true}],
  homework:[{id:'h1',subj:'Русский',text:'Упражнение',date,time:'12:30',doneBy:[]},{id:'h2',date,doneBy:['family1']}],
  funds:[{id:'f1',title:'На экскурсию',amount:2000,date,time:'18:15',paid:{}},{id:'f2',title:'Оплачено',date,paid:{family1:true}}]
 });
 assert.equal(result.scheduled,3);
 assert.equal(scheduled.length,3);
 assert.ok(scheduled.some(x=>x.title==='Ясно · Дело'&&x.schedule.at.getHours()===16&&x.schedule.at.getMinutes()===45));
 assert.ok(scheduled.some(x=>x.title==='Ясно · Домашнее задание'&&x.schedule.at.getHours()===12&&x.schedule.at.getMinutes()===30));
 assert.ok(scheduled.some(x=>x.title==='Ясно · Срок сбора'&&x.body.includes('2 000')&&x.schedule.at.getHours()===18));
 assert.ok(!scheduled.some(x=>x.body.includes('Оплачено')));
});
test('cancel reminders when task becomes completed and fund is paid',async()=>{
 const date=dayAhead(4);
 const firstIds=scheduled.map(x=>x.id);
 scheduled.length=0;
 const r=await syncDeadlineReminders({
  userId:'user1',classCode:'ABCDE2',familyId:'family1',
  tasks:[{id:'t1',date,done:true}],
  homework:[],
  funds:[{id:'f1',date,paid:{family1:true}}]
 });
 assert.equal(r.scheduled,0);
 assert.ok(firstIds.every(id=>cancelled.includes(id)));
});
test('clearing reminders cancels old daily notifications too',async()=>{
 await clearDeadlineReminders();
 assert.ok(cancelled.includes(730)&&cancelled.includes(1800));
});
