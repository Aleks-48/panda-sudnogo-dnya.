import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.CQA_PUBLIC_URL||'https://cqa-quality-control.restfulrhubarb1.chatgpt.site';
let cookie='';
async function call(path,data){const r=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json',Origin:new URL(base).origin}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(200000)});if(!cookie)cookie=r.headers.get('set-cookie')?.split(';')[0]||'';const value=await r.json();if(!r.ok)throw Error(value.error||String(r.status));return value;}
const manualOnly=process.argv.includes('--manual-only');
const report={scope:manualOnly?'manual-cloud-workflow':'automatic-cloud-workflow',createdAt:new Date().toISOString(),url:base,syntheticInput:true,checks:[]};
try{
 const initial=await call('state');report.checks.push({name:'clean-workspace',passed:initial.conversations.length===0});
 const id='qa-'+Date.now();
 await call('import',{payload:[{conversation_id:id,channel:'agent chat',language:'RU',transcript:[{speaker:'client',timestamp:'00:00',text:'Где посмотреть текущий тариф?'},{speaker:'operator',timestamp:'00:15',text:'Здравствуйте! Меня зовут Алина. Откройте раздел «Кабинет»: текущий тариф указан под вашим именем.'},{speaker:'client',timestamp:'00:25',text:'Нашёл, спасибо.'},{speaker:'operator',timestamp:'00:35',text:'Итак, тариф находится в «Кабинете». Если появятся вопросы, обращайтесь. Всего доброго!'}]}]});
 const results=initial.checklists[0].criteria.map(c=>({criterionId:c.id,value:['c2','c3'].includes(c.id)?null:c.id==='c4'?20:c.id==='c6'?10:c.id==='c8'?false:true,explanation:['c2','c3'].includes(c.id)?'Для общего вопроса дополнительные сведения не требуются.':'Подтверждено репликами оператора.',evidence:['c2','c3','c8'].includes(c.id)?[]:[c.id==='c7'?'m3':'m1'],checkedRange:['m0','m3']}));
 const e=await call('evaluate',{conversationId:id,checklistId:initial.activeChecklistId,...(manualOnly?{results}:{})});report.checks.push({name:manualOnly?'manual-evaluation':'real-automatic-evaluation',passed:e.results.length===8&&(manualOnly?e.model==='manual':e.model!=='manual'),model:e.model,criteria:e.results.length,total:e.finalScore.total});
 const checklist={...initial.checklists[0],name:'Проверка новой версии',criteria:[...initial.checklists[0].criteria,{id:'qa-followup',title:'Предложение дальнейшей помощи',instruction:'Да — оператор предложил обратиться при новых вопросах.',type:'boolean',weight:5,min:0,max:1,allowNA:false}]};
 const version=await call('checklists',checklist);
 const manual=await call('evaluate',{conversationId:id,checklistId:version.id,results:[...e.results,{criterionId:'qa-followup',value:true,explanation:'В m3 оператор предложил обратиться с новыми вопросами.',evidence:['m3'],checkedRange:null}]});
 report.checks.push({name:'changed-criteria-without-code-edit',passed:manual.results.length===9});
 const appeal=await call('appeals',{evaluationId:e.id,criterionId:'c1',comment:'Проверка подтверждения исходной оценки по приветствию.'});
 await call('review',{appealId:appeal.id,action:'confirm',reason:'Проверено по реплике m1 оператора.'});
 const after=await call('state');const kept=after.evaluations.find(x=>x.id===e.id);
 report.checks.push({name:'persistent-history-and-review',passed:after.appeals[0].status==='resolved'&&kept.checklist.criteria.length===8&&kept.originalScore.total===e.originalScore.total});
 const exported=await call('export');report.checks.push({name:'full-export',passed:exported.evaluations.length===2&&exported.checklists.length===2});
 report.ok=report.checks.every(c=>c.passed);
}catch(e){report.ok=false;report.error=e.message;}
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/hosted-workflow-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
