import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
test('адаптер модели: структурированный ответ, usage, стоимость и отбраковка выдуманной реплики',async()=>{
 let invalid=false,errorResponse=false;
 const mock=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const payload=JSON.parse(raw);assert.ok(payload.messages[0].content.includes('недоверенные данные'));
  if(errorResponse){res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'billing_not_active',message:'do not echo provider content'}}));return;}
  const results=JSON.parse(payload.messages[1].content).checklist.criteria.map(c=>({criterionId:c.id,value:c.type==='boolean'?c.id!=='c8':c.id==='c4'?10:4,explanation:'Тестовый ответ локального имитатора',evidence:[invalid?'fake':'m0']}));
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({results})}}],usage:{prompt_tokens:100,completion_tokens:50}}));
 });
 await new Promise(r=>mock.listen(3101,'127.0.0.1',r));
 const dir=join(process.cwd(),'tmp','model-test-'+Date.now());await mkdir(dir,{recursive:true});
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3102',DATA_DIR:dir,LLM_API_KEY:'test-only',LLM_MODEL:'mock-model',LLM_URL:'http://127.0.0.1:3101',INPUT_PRICE_PER_MILLION:'1',OUTPUT_PRICE_PER_MILLION:'2'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
 const call=async(path,body)=>{const r=await fetch('http://127.0.0.1:3102/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 await call('import',{payload:[{conversation_id:'model-test',language:'EN',channel:'agent chat',transcript:[{speaker:'operator',timestamp:'00:00',text:'Hello, please open Settings.'}]}]});
 const good=await call('evaluate',{conversationId:'model-test',checklistId:'official-v1'});assert.equal(good.status,200);assert.equal(good.body.originalScore.total,81);assert.equal(good.body.model,'mock-model');assert.equal(good.body.costUSD,0.0002);
 invalid=true;const bad=await call('evaluate',{conversationId:'model-test',checklistId:'official-v1'});assert.equal(bad.status,400);assert.match(bad.body.error,/доказательство/);
 invalid=false;const check=await call('model/check',{});assert.equal(check.body.ok,true);
 errorResponse=true;const billing=await call('model/check',{});assert.equal(billing.body.ok,false);assert.match(billing.body.message,/Оплата/);assert.ok(!billing.body.message.includes('provider content'));
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
