import {createHash} from 'node:crypto';
import {evaluateModel,modelConfig} from './llm.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {uid,starter,validateChecklist,normalizeRecords,validateResults,score} from './core.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const dataDir=resolve(process.env.DATA_DIR||join(root,'data'));
await mkdir(dataDir,{recursive:true});
const dbPath=join(dataDir,'state.json');
let db;try{db=JSON.parse(await readFile(dbPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;db={checklists:[starter],conversations:[],evaluations:[],appeals:[]};try{db.conversations=normalizeRecords(JSON.parse(await readFile(join(dataDir,'dev.json'),'utf8')));}catch(e){if(e.code!=='ENOENT')console.error('DEV import:',e.message);}}
let saving=Promise.resolve();
function save(){const snapshot=JSON.stringify(db,null,2);saving=saving.catch(()=>{}).then(async()=>{await writeFile(join(dataDir,'state.tmp'),snapshot);await rename(join(dataDir,'state.tmp'),dbPath);});return saving;}
if(!db.checklists.some(c=>c.id===starter.id)){db.checklists.unshift(structuredClone(starter));await save();}
// Reference reviews are explicitly manual and only attached to matching bundled transcripts.
try{
 const refs=JSON.parse(await readFile(new URL('./examples/manual-review.json',import.meta.url),'utf8'));
 for(const ref of refs){
  const id='manual-reference-'+ref.conversationId;
  if(db.evaluations.some(e=>e.id===id))continue;
  const conversation=db.conversations.find(c=>c.conversation_id===ref.conversationId);if(!conversation)continue;
  const hash=createHash('sha256').update(conversation.transcript.map(m=>[m.speaker,m.timestamp,m.text].join('\0')).join('\n')).digest('hex');if(hash!==ref.transcriptHash)continue;
  const results=validateResults(starter,conversation,ref.results);
  const originalScore=score(starter,results);
  db.evaluations.push({id,conversationId:ref.conversationId,checklistId:starter.id,checklist:structuredClone(starter),createdAt:new Date().toISOString(),results,finalResults:structuredClone(results),originalScore,finalScore:structuredClone(originalScore),model:'manual',reviewNote:ref.note,costUSD:null,costConfigured:false});
 }
 await save();
}catch(e){if(e.code!=='ENOENT')throw e;}
if(!db.activeChecklistId||!db.checklists.some(c=>c.id===db.activeChecklistId)){db.activeChecklistId=starter.id;await save();}
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>10_000_000)throw Error('Размер запроса превышает 10 MB');}return JSON.parse(text||'{}');}
function getEvaluation(id){const e=db.evaluations.find(x=>x.id===id);if(!e)throw Error('Оценка не найдена');return e;}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,{...db,configured:modelConfig().configured,modelStatus:{provider:modelConfig().provider,model:modelConfig().model||null}});
 if(req.method==='GET'&&url.pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="cqa-export.json"');return json(res,200,db);}
 if(req.method==='POST'&&url.pathname.startsWith('/api/')){
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Недопустимый источник запроса'});
 if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Ожидается application/json'});
 const b=await body(req);let result;
 if(url.pathname==='/api/import'){
 let payload=b.payload;
 if(b.groupId){if(!process.env.DATASET_URL)throw Error('Задайте DATASET_URL на сервере');const target=new URL(process.env.DATASET_URL);target.searchParams.set('group_id',b.groupId);const r=await fetch(target,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`API набора: HTTP ${r.status}`);payload=await r.json();}
 const rows=normalizeRecords(payload);for(const row of rows){const old=db.conversations.find(x=>x.conversation_id===row.conversation_id);if(old&&(old.language!==row.language||old.channel!==row.channel||JSON.stringify(old.transcript)!==JSON.stringify(row.transcript)))throw Error('Импорт изменяет существующий диалог. Используйте новый conversation_id.');}
 for(const row of rows){const old=db.conversations.find(x=>x.conversation_id===row.conversation_id);if(old)Object.assign(old,row);}
 db.conversations.push(...rows.filter(r=>!db.conversations.some(x=>x.conversation_id===r.conversation_id)));result={count:rows.length};
 }else if(url.pathname==='/api/checklists'){const c=validateChecklist(b);result={...c,id:uid(),createdAt:new Date().toISOString()};db.checklists.push(result);db.activeChecklistId=result.id;
 }else if(url.pathname==='/api/evaluate'){
 const conversation=db.conversations.find(x=>x.conversation_id===b.conversationId),checklist=db.checklists.find(x=>x.id===b.checklistId);if(!conversation||!checklist)throw Error('Выберите диалог и чек-лист');
 const assessed=b.results?{results:validateResults(checklist,conversation,b.results),model:'manual',costUSD:0}:await evaluateModel(conversation,checklist);
 result={id:uid(),conversationId:conversation.conversation_id,checklistId:checklist.id,checklist:structuredClone(checklist),createdAt:new Date().toISOString(),...assessed};result.originalScore=score(checklist,result.results);result.finalResults=structuredClone(result.results);result.finalScore=result.originalScore;db.evaluations.push(result);
 }else if(url.pathname==='/api/appeals'){
 const e=getEvaluation(b.evaluationId);if(!e.results.some(r=>r.criterionId===b.criterionId)||!b.comment?.trim())throw Error('Выберите критерий и введите комментарий');if(db.appeals.some(a=>a.evaluationId===e.id&&a.criterionId===b.criterionId&&a.status==='open'))throw Error('По критерию уже есть открытая апелляция');result={id:uid(),evaluationId:e.id,criterionId:b.criterionId,comment:b.comment.trim(),status:'open',createdAt:new Date().toISOString(),disputedResult:structuredClone(e.finalResults.find(r=>r.criterionId===b.criterionId))};db.appeals.push(result);
 }else if(url.pathname==='/api/review'){
 const a=db.appeals.find(x=>x.id===b.appealId);if(!a||a.status!=='open'||!b.reason?.trim())throw Error('Нужны открытая апелляция и причина');if(!['confirm','change'].includes(b.action))throw Error('Неизвестное решение');const e=getEvaluation(a.evaluationId);let updated=e.finalResults.map(r=>r.criterionId===a.criterionId&&b.action==='change'?{...r,value:b.value,explanation:b.reason.trim(),evidence:b.evidence??r.evidence,checkedRange:b.checkedRange??r.checkedRange}:r);updated=validateResults(e.checklist,db.conversations.find(c=>c.conversation_id===e.conversationId),updated);e.finalResults=updated;e.finalScore=score(e.checklist,updated);Object.assign(a,{status:'resolved',action:b.action,reason:b.reason.trim(),resolvedAt:new Date().toISOString(),finalValue:e.finalResults.find(r=>r.criterionId===a.criterionId).value});result=a;
 }else return json(res,404,{error:'Не найдено'});
 await save();return json(res,200,result);
 }
 if(req.method==='GET'){
 const files={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css']};const f=files[url.pathname];if(f){res.writeHead(200,{'Content-Type':`${f[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff'});return res.end(await readFile(root+f[0]));}
 }
 json(res,404,{error:'Не найдено'});
 }catch(e){console.error(e.message);json(res,400,{error:e.message});}});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`CQA: http://127.0.0.1:${Number(process.env.PORT)||3000}`));
