// Внешние push-уведомления без Firebase. Edge Function вызывается Webhook и Cron.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const secret=Deno.env.get('YASNO_WEBHOOK_SECRET')!;
const publicKey=Deno.env.get('YASNO_VAPID_PUBLIC')!;
const privateKey=Deno.env.get('YASNO_VAPID_PRIVATE')!;
const sb=createClient(url,serviceKey,{auth:{persistSession:false}});
webpush.setVapidDetails('mailto:admin@example.com',publicKey,privateKey); // замените email владельца

async function send(userIds:string[],title:string,body:string){
 if(!userIds.length)return {delivered:0};
 const {data,error}=await sb.from('push_subscriptions').select('user_id,endpoint,subscription').in('user_id',userIds);
 if(error)throw error;
 let delivered=0;
 for(const sub of data||[]){
  try{
   await webpush.sendNotification(sub.subscription,JSON.stringify({title,body}),{TTL:60*60});
   delivered++;
  }catch(e){
   const status=(e as {statusCode?:number}).statusCode;
   if(status===404||status===410)await sb.from('push_subscriptions').delete().eq('user_id',sub.user_id).eq('endpoint',sub.endpoint);
   else console.error('Push delivery error',status);
  }
 }
 return {delivered};
}
function localDate(offset=0){
 const d=new Date(Date.now()+offset*86400000);
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
Deno.serve(async(req)=>{
 if(req.headers.get('x-yasno-secret')!==secret)return new Response('Unauthorized',{status:401});
 try{
  const body=await req.json();
  if(body.mode==='reminder'){
   const evening=body.period==='evening';
   const target=localDate(evening?1:0);
   const {data:members,error:merr}=await sb.from('members').select('user_id,class_code,family_id');
   if(merr)throw merr;
   const {data:items,error:ierr}=await sb.from('class_items').select('class_code,kind,payload').in('kind',['tasks','homework','funds']);
   if(ierr)throw ierr;
   const relevant=new Set<string>();
   for(const member of members||[]){
    if((items||[]).some(i=>i.class_code===member.class_code&&((i.kind==='funds'&&!i.payload?.paid?.[member.family_id])||(i.payload?.date===target&&(i.kind==='tasks'?!i.payload?.done:!(i.payload?.doneBy||[]).includes(member.family_id))))))relevant.add(member.user_id);
   }
   return Response.json(await send([...relevant],evening?'Ясно · На завтра':'Ясно · На сегодня','Проверьте домашние задания, дела и сборы в приложении'));
  }
  const record=body.record;
  if(!record||!['tasks','homework','funds'].includes(record.kind)||!record.class_code)return Response.json({ignored:true});
  const {data:members,error}=await sb.from('members').select('user_id').eq('class_code',record.class_code);
  if(error)throw error;
  const text=record.kind==='tasks'?'Новое дело':record.kind==='homework'?'Новое домашнее задание':'Новый денежный сбор';
  return Response.json(await send((members||[]).map(m=>m.user_id),`Ясно · ${text}`,'Откройте приложение, чтобы посмотреть подробности'));
 }catch(e){console.error(e);return Response.json({error:'Notification failed'},{status:500})}
});
