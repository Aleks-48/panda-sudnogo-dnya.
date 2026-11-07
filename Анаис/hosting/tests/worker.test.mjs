import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../src/worker.mjs';
function environment(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_medical_tyrannus.sql','utf8'));
 const prepared=(query,params=[])=>({query,params,bind(...args){return prepared(query,args)},async first(){return sql.prepare(query).get(...params)||null},async all(){return {results:sql.prepare(query).all(...params)}}});
 const DB={prepare:q=>prepared(q),async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>({results:sql.prepare(s.query).all(...s.params)}));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {DB,sql,ENABLE_DEMO:'true'};
}
const call=(env,path,body,cookie,origin='https://demo.example')=>worker.fetch(new Request('https://demo.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined}),env);
test('public UI and per-visitor state persist separately',async()=>{
 const env=environment();assert.equal((await call(env,'/')).status,200);
 const first=await call(env,'/api/state');const cookie=first.headers.get('set-cookie').split(';')[0];const state=await first.json();assert.equal(state.conversations.length,4);assert.equal(state.evaluations.length,4);
 assert(state.conversations.every(c=>c.conversation_id.startsWith('demo-')));assert(state.evaluations.every(e=>e.demo&&e.model==='manual'));
 const checklist={...state.checklists[0],name:'Проверка сохранения'};
 const saved=await call(env,'/api/checklists',checklist,cookie);assert.equal(saved.status,200);const created=await saved.json();
 const again=await (await call(env,'/api/state',null,cookie)).json();assert.equal(again.activeChecklistId,created.id);assert(again.checklists.some(x=>x.name==='Проверка сохранения'));
 const other=await (await call(env,'/api/state')).json();assert(!other.checklists.some(x=>x.id===created.id));
 const bad=await call(env,'/api/demo',{},cookie,'https://evil.example');assert.equal(bad.status,403);
 const prod=environment();delete prod.ENABLE_DEMO;
 const cleanResponse=await call(prod,'/api/state');const prodCookie=cleanResponse.headers.get('set-cookie').split(';')[0];const clean=await cleanResponse.json();assert.equal(clean.conversations.length,0);assert.equal(clean.evaluations.length,0);assert.equal((await call(prod,'/api/demo',{},prodCookie)).status,404);
 const c=structuredClone(state.conversations[0]);delete c.demo;c.conversation_id='work-record';const e=structuredClone(state.evaluations[0]);delete e.demo;delete e.reviewNote;e.id='work-score';e.conversationId=c.conversation_id;
 const restored=await call(prod,'/api/restore',{payload:{checklists:state.checklists,conversations:[c],evaluations:[e],appeals:[]}},prodCookie);assert.equal(restored.status,200);
 const persisted=await (await call(prod,'/api/state',null,prodCookie)).json();assert.equal(persisted.conversations.length,1);assert.equal(persisted.evaluations[0].finalScore.total,92.31);
 const shared=await (await call(prod,'/api/workspace-link',null,prodCookie)).json();const opened=await worker.fetch(new Request(shared.url),prod);assert.equal(opened.status,303);const sharedCookie=opened.headers.get('set-cookie').split(';')[0];const otherBrowser=await (await call(prod,'/api/state',null,sharedCookie)).json();assert.equal(otherBrowser.conversations[0].conversation_id,'work-record');assert.equal((await call(prod,'/api/audio/work-record',null,prodCookie)).status,404);prod.sql.close();
 env.sql.close();
});
test('appeal changes score and preserves original result after reload',async()=>{
 const env=environment();const first=await call(env,'/api/state');const cookie=first.headers.get('set-cookie').split(';')[0];
 const opened=await call(env,'/api/appeals',{evaluationId:'fixture-demo-appeal-ru',criterionId:'c7',comment:'В m3 есть итог и прощание'},cookie);assert.equal(opened.status,200);const appeal=await opened.json();
 const reviewed=await call(env,'/api/review',{appealId:appeal.id,action:'change',value:true,reason:'Подтверждено репликой m3',evidence:['m3']},cookie);assert.equal(reviewed.status,200);
 const state=await (await call(env,'/api/state',null,cookie)).json();const e=state.evaluations.find(x=>x.id==='fixture-demo-appeal-ru');assert.equal(e.originalScore.total,92.31);assert.equal(e.finalScore.total,100);assert.equal(state.appeals[0].status,'resolved');env.sql.close();
});
test('invalid import and unavailable model do not create a fake evaluation',async()=>{
 const env=environment();const first=await call(env,'/api/state');const cookie=first.headers.get('set-cookie').split(';')[0];const state=await first.json();
 const response=await call(env,'/api/evaluate',{conversationId:'demo-appeal-ru',checklistId:state.checklists[0].id},cookie);assert.equal(response.status,400);
 const invalid=await call(env,'/api/import',{payload:[{conversation_id:'x'}]},cookie);assert.equal(invalid.status,400);
 const after=await (await call(env,'/api/state',null,cookie)).json();assert.equal(after.evaluations.length,4);env.sql.close();
});
