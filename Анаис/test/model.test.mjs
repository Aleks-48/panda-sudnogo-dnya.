import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
test('адаптер модели: структурированный ответ, usage, стоимость и отбраковка выдуманной реплики',async()=>{
 let invalid=false;
 const mock=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const payload=JSON.parse(raw);assert.ok(payload.messages[0].content.includes('недоверенные данные'));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({results:[{criterionId:'greeting',value:true,explanation:'Есть приветствие',evidence:[invalid?'fake':'m0']},{criterionId:'resolution',value:1,explanation:'Частичное решение',evidence:['m0']}]})}}],usage:{prompt_tokens:100,completion_tokens:50}}));});
 await new Promise(r=>mock.listen(3101,'127.0.0.1',r));
 const dir=join(process.cwd(),'tmp','model-test-'+Date.now());await mkdir(dir,{recursive:true});
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3102',DATA_DIR:dir,LLM_API_KEY:'test-only',LLM_MODEL:'mock-model',LLM_URL:'http://127.0.0.1:3101',INPUT_PRICE_PER_MILLION:'1',OUTPUT_PRICE_PER_MILLION:'2'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
 const call=async(path,body)=>{const r=await fetch('http://127.0.0.1:3102/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 await call('import',{payload:[{conversation_id:'model-test',language:'EN',channel:'agent chat',transcript:[{speaker:'operator',timestamp:'00:00',text:'Hello, please open Settings.'}]}]});
 const good=await call('evaluate',{conversationId:'model-test',checklistId:'starter'});assert.equal(good.status,200);assert.equal(good.body.originalScore.total,75);assert.equal(good.body.model,'mock-model');assert.equal(good.body.costUSD,0.0002);
 invalid=true;const bad=await call('evaluate',{conversationId:'model-test',checklistId:'starter'});assert.equal(bad.status,400);assert.match(bad.body.error,/доказательство/);
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
