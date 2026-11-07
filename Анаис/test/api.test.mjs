import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
test('импорт → версия → оценка → апелляция → решение → сохранение',async()=>{
 const dir=join(process.cwd(),'tmp','test-'+Date.now());await mkdir(dir,{recursive:true});
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3099',DATA_DIR:dir,LLM_API_KEY:'',LLM_MODEL:''},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{if(code)reject(Error('Server exited '+code));});});
 const call=async(path,data)=>{const response=await fetch('http://127.0.0.1:3099/api/'+path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 assert.equal((await call('state')).body.configured,false);
 const payload=[{conversation_id:'integration',language:'KZ',channel:'agent chat',transcript:[{speaker:'operator',timestamp:'00:01',text:'Сәлеметсіз бе!'}],audio_url:null}];
 assert.equal((await call('import',{payload})).status,200);
 const c=(await call('checklists',{name:'Проверка',precision:2,criteria:[{id:'hello',title:'Приветствие',instruction:'Приветствует',type:'boolean',weight:1,allowNA:false}]})).body;
 const e=(await call('evaluate',{conversationId:'integration',checklistId:c.id,results:[{criterionId:'hello',value:false,explanation:'Начальная оценка',evidence:['m0']}]})).body;
 assert.equal(e.originalScore.total,0);
 const a=(await call('appeals',{evaluationId:e.id,criterionId:'hello',comment:'Приветствие присутствует'})).body;
 assert.equal((await call('review',{appealId:a.id,action:'change',value:true,reason:'Проверено по реплике m0'})).status,200);
 const state=(await call('state')).body;assert.equal(state.evaluations[0].originalScore.total,0);assert.equal(state.evaluations[0].finalScore.total,100);assert.equal(state.appeals[0].status,'resolved');
 assert.equal((await call('review',{appealId:a.id,action:'change',value:false,reason:'Повтор'})).status,400);
 const saved=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.equal(saved.evaluations[0].finalScore.total,100);
 }finally{child.kill();}
});
