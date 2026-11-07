import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
test('существующий учебный чек-лист и история сохраняются при добавлении восьми критериев',async()=>{
 const dir=join(process.cwd(),'tmp','migration-'+Date.now());await mkdir(dir,{recursive:true});
 const old={id:'starter',name:'Старая конфигурация',precision:2,criteria:[{id:'old',title:'Old',instruction:'Old',type:'boolean',weight:1,allowNA:false}]};
 const snapshot={id:'history',checklist:structuredClone(old),originalScore:{total:50},finalScore:{total:75}};
 await writeFile(join(dir,'state.json'),JSON.stringify({checklists:[old],conversations:[],evaluations:[snapshot],appeals:[]}));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3103',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
 const state=await (await fetch('http://127.0.0.1:3103/api/state')).json();assert.equal(state.checklists[0].criteria.length,8);assert.equal(state.checklists[1].id,'starter');assert.deepEqual(state.evaluations[0],snapshot);
 const disk=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.equal(disk.checklists.length,2);
 }finally{child.kill();}
});
