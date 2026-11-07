import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starter,score,validateResults,validateChecklist} from '../core.mjs';
import {modelConfig,evaluateModel} from '../llm.mjs';
import {readFileSync} from 'node:fs';
const conversation={transcript:[{id:'m0',speaker:'operator',timestamp:'00:00',text:'Здравствуйте!'}]};
const full=()=>starter.criteria.map(c=>({criterionId:c.id,value:c.type==='boolean'?c.id!=='c8':c.max,explanation:'Контрольная фикстура арифметики, не оценка модели',evidence:['m0']}));
test('начальная конфигурация содержит все 8 критериев и веса 100',()=>{
 assert.equal(starter.criteria.length,8);assert.equal(starter.criteria.reduce((s,c)=>s+c.weight,0),100);
 assert.deepEqual(starter.criteria.find(c=>c.id==='c4').allowedValues,[0,5,10,15,20]);
 assert.deepEqual(starter.criteria.find(c=>c.id==='c6').allowedValues,[0,4,7,10]);
 assert.equal(score(starter,validateResults(starter,conversation,full())).total,100);
});
test('произвольные промежуточные баллы отклоняются',()=>{
 for(const [id,value] of [['c4',7],['c6',5]]){const results=full();results.find(r=>r.criterionId===id).value=value;assert.throws(()=>validateResults(starter,conversation,results),/ступени/);}
 assert.throws(()=>validateChecklist({...starter,criteria:starter.criteria.map(c=>c.id==='c4'?{...c,allowedValues:[99]}:c)}));
});
test('грубая ошибка — да, не обнуляет итог; пересмотр снимает флаг',()=>{
 const results=full();results.find(r=>r.criterionId==='c8').value=true;
 const assessed=validateResults(starter,conversation,results);assert.equal(score(starter,assessed).grossError,true);assert.equal(score(starter,assessed).total,100);
 assessed.find(r=>r.criterionId==='c8').value=false;assert.equal(score(starter,assessed).grossError,false);
 results.find(r=>r.criterionId==='c8').value=false;results[0].grossError=true;assert.equal(validateResults(starter,conversation,results)[0].grossError,false);
});
test('N/A перераспределяет веса; грубая ошибка с нулевым весом не меняет знаменатель',()=>{
 const results=full();results.find(r=>r.criterionId==='c2').value=null;results.find(r=>r.criterionId==='c3').value=null;results.find(r=>r.criterionId==='c4').value=10;
 const s=score(starter,validateResults(starter,conversation,results));assert.equal(s.total,84.62);assert.equal(s.rows.find(r=>r.criterionId==='c4').effectiveWeight,20/65*100);
});
test('локальная модель работает без ключа; удалённой модели нужен ключ',()=>{
 assert.equal(modelConfig({LLM_URL:'http://127.0.0.1:11434/v1/chat/completions',LLM_MODEL:'local-model'}).configured,true);
 assert.equal(modelConfig({LLM_URL:'https://example.com/chat',LLM_MODEL:'model'}).configured,false);
 assert.equal(modelConfig({LLM_PROVIDER:'gemini',GEMINI_MODEL:'test',GEMINI_API_KEY:'dummy'}).configured,true);
});
test('ручная контрольная выборка RU/KZ/EN имеет доказательства и проверенный итог',()=>{
 const refs=JSON.parse(readFileSync(new URL('../examples/manual-review.json',import.meta.url),'utf8'));
 const records=JSON.parse(readFileSync(new URL('../data/dev.json',import.meta.url),'utf8')).data.records;
 assert.deepEqual(refs.map(r=>r.language),['RU','KZ','EN']);
 for(const ref of refs){const c=records.find(c=>c.conversation_id===ref.conversationId);c.transcript=c.transcript.map((m,i)=>({...m,id:'m'+i}));const results=validateResults(starter,c,ref.results);assert.equal(score(starter,results).total,ref.expectedTotal);assert.equal(results.find(r=>r.criterionId==='c7').value,false);}
});
test('адаптер Gemini учитывает все выходные токены и не передаёт аудиоссылку',async()=>{
 const keys=['LLM_PROVIDER','LLM_MODEL','GEMINI_API_KEY','INPUT_PRICE_PER_MILLION','OUTPUT_PRICE_PER_MILLION'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
 Object.assign(process.env,{LLM_PROVIDER:'gemini',LLM_MODEL:'test-model',GEMINI_API_KEY:'test-only',INPUT_PRICE_PER_MILLION:'1',OUTPUT_PRICE_PER_MILLION:'2'});
 try{globalThis.fetch=async(url,options)=>{
  assert.match(url,/test-model:generateContent$/);assert.equal(options.headers['x-goog-api-key'],'test-only');
  const payload=JSON.parse(options.body);assert.ok(payload.system_instruction.parts[0].text.includes('недоверенные данные'));assert.equal(JSON.parse(payload.contents[0].parts[0].text).conversation.audio_url,undefined);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({results:full()})}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50,thoughtsTokenCount:50}}),{status:200});
 };
 const assessed=await evaluateModel({...conversation,audio_url:'https://example.com/private-audio'},starter);assert.equal(assessed.usage.completion_tokens,100);assert.equal(assessed.costUSD,0.0003);assert.equal(assessed.results.length,8);
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
