import {seedDemo,demoScenarios} from './demo.mjs';
import {evaluateModel,modelConfig} from './llm.mjs';
import {uid,starter,validateChecklist,normalizeRecords,validateResults,score} from './core.mjs';
import initial from './seed.json' with {type:'json'};
import assets from './assets.json' with {type:'json'};
const kinds=['checklists','conversations','evaluations','appeals'];
const recordId=(kind,item)=>kind==='conversations'?item.conversation_id:item.id;
const initialMap=new Map(kinds.flatMap(k=>initial[k].map(v=>[k+':'+recordId(k,v),JSON.stringify(v)])));
export async function reserveModelCall(DB,id){
 const day=new Date().toISOString().slice(0,10);
 for(const [name,limit] of [[`session:${id}:${day}`,100],[`global:${day}`,1000]]){
  const row=await DB.prepare('INSERT INTO quotas (name,count) VALUES (?,1) ON CONFLICT(name) DO UPDATE SET count=count+1 RETURNING count').bind(name).first();
  if(row.count>limit)throw Object.assign(Error('Дневной лимит запросов к модели исчерпан. Демонстрационные сценарии и ручная оценка доступны.'),{status:429});
 }
}
async function body(request){if(Number(request.headers.get('content-length'))>1000000)throw Error('Максимальный размер импорта — 1 МБ');const t=await request.text();if(new TextEncoder().encode(t).length>1000000)throw Error('Максимальный размер импорта — 1 МБ');return JSON.parse(t||'{}');}
export default {async fetch(request,env){
 const url=new URL(request.url);
 const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'};
 if(url.pathname==='/admin/presentation'&&request.method==='PUT'){
  if(!env.UPLOAD_TOKEN||request.headers.get('authorization')!==`Bearer ${env.UPLOAD_TOKEN}`)return new Response('Forbidden',{status:403});
  if(Number(request.headers.get('content-length'))>22000000)return new Response('Too large',{status:413});
  await env.BUCKET.put('presentation.pptx',request.body,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}});return Response.json({ok:true});
 }
 if(url.pathname==='/presentation.pptx'){
  const f=await env.BUCKET.get('presentation.pptx');if(!f)return new Response('Презентация готовится',{status:503});
  return new Response(f.body,{headers:{...security,'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':'attachment; filename="Pandy_sudnogo_dnya_CQA.pptx"'}});
 }
 if(!url.pathname.startsWith('/api/')){
  const a=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!a)return new Response('Not found',{status:404,headers:security});
  const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{...security,'Content-Type':a.type,'Cache-Control':a.type.startsWith('image/')?'public, max-age=86400':'no-cache'}});
 }
 let sessionId;
 const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)cqa_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
 sessionId=cookie||crypto.randomUUID();
 const headers={...security,'Cache-Control':'no-store','Set-Cookie':`cqa_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`};
 const reply=(status,value)=>Response.json(value,{status,headers});
 try{
  if(!env.DB)return reply(503,{error:'База данных пока недоступна'});
  const req={method:request.method,headers:Object.fromEntries(request.headers)};
  const db=structuredClone(initial);
  const session=await env.DB.prepare('SELECT version,payload FROM sessions WHERE id=?').bind(sessionId).first();
  const version=session?.version||0;
  if(session?.payload)Object.assign(db,JSON.parse(session.payload));
  const stored=await env.DB.prepare('SELECT kind,id,payload FROM records WHERE owner=?').bind(sessionId).all();
  const before=new Map(initialMap);
  for(const row of stored.results){const item=JSON.parse(row.payload);before.set(row.kind+':'+row.id,row.payload);const a=db[row.kind];if(!a)continue;const i=a.findIndex(x=>recordId(row.kind,x)===row.id);if(i<0)a.push(item);else a[i]=item;}
  async function save(){
   const token=crypto.randomUUID();
   const meta=JSON.stringify({activeChecklistId:db.activeChecklistId,integrationCheck:db.integrationCheck});
   const changes=[];
   for(const kind of kinds)for(const item of db[kind]){const id=recordId(kind,item),payload=JSON.stringify(item);if(before.get(kind+':'+id)!==payload){if(new TextEncoder().encode(payload).length>900000)throw Error('Одна запись слишком большая');changes.push({kind,id,payload});}}
   if(changes.length>500)throw Error('За один импорт можно сохранить не более 500 записей');
   const statements=[env.DB.prepare('INSERT INTO sessions (id,version,payload,write_token) VALUES (?,1,?,?) ON CONFLICT(id) DO UPDATE SET version=version+1,payload=excluded.payload,write_token=excluded.write_token WHERE sessions.version=? RETURNING version').bind(sessionId,meta,token,version)];
   for(const c of changes)statements.push(env.DB.prepare('INSERT INTO records (owner,kind,id,payload) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND write_token=?) ON CONFLICT(owner,kind,id) DO UPDATE SET payload=excluded.payload').bind(sessionId,c.kind,c.id,c.payload,sessionId,token));
   const result=await env.DB.batch(statements);if(!result[0].results.length)throw Object.assign(Error('Данные изменились в другой вкладке. Обновите страницу и повторите действие.'),{status:409});
  }
  function getEvaluation(id){const e=db.evaluations.find(x=>x.id===id);if(!e)throw Error('Оценка не найдена');return e;}
  if(req.method==='GET'&&url.pathname==='/api/state')return reply(200,{...db,configured:modelConfig(env).configured,modelStatus:{provider:modelConfig(env).provider,model:modelConfig(env).model||null},demoScenarios:demoScenarios()});
  if(req.method==='GET'&&url.pathname==='/api/export')return new Response(JSON.stringify(db),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="cqa-export.json"'}});
  if(req.method==='GET'&&url.pathname==='/api/export.csv'){
   const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
   const rows=[['Диалог','Язык','Модель','Тип','Исходный балл','Финальный балл','Грубая ошибка','Дата'],...db.evaluations.map(e=>[e.conversationId,db.conversations.find(c=>c.conversation_id===e.conversationId)?.language,e.model,e.demo?'Учебная фикстура':e.model==='manual'?'Ручная':'API',e.originalScore.total,e.finalScore.total,e.finalScore.grossError?'Да':'Нет',e.createdAt])];
   return new Response('\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cqa-results.csv"'}});
  }
  /* API_ROUTES */
  return reply(404,{error:'Не найдено'});
 }catch(e){return reply(e.status||400,{error:e.message});}
}};
