import {writeFile,mkdir} from 'node:fs/promises';
const root='http://127.0.0.1:3000';
async function call(path,data){const r=await fetch(root+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
const liveState=await (await fetch(root+'/api/state')).json();
const report={createdAt:new Date().toISOString(),model:liveState.modelStatus?.model||'unknown',purpose:'Три реальных API-вызова на синтетических диалогах DEV. Проверка интеграции, не оценка точности на полном наборе.',cases:[]};
const diagnostic=await call('model/check',{});report.diagnostic=diagnostic;console.log('API diagnostic:',diagnostic.ok);
if(!diagnostic.ok)throw Error(diagnostic.message);
await call('demo',{});
for(const conversationId of ['p1-ru-001','p1-kz-001','p1-en-001']){
 try{const e=await call('evaluate',{conversationId,checklistId:'official-v1'});const item={conversationId,evaluationId:e.id,success:true,total:e.finalScore.total,criteria:e.results.length,elapsedMs:e.elapsedMs,usage:e.usage,estimatedCostUSD:e.costUSD,results:e.results};report.cases.push(item);console.log(JSON.stringify({conversationId,success:true,total:item.total,criteria:item.criteria,elapsedMs:item.elapsedMs,estimatedCostUSD:item.estimatedCostUSD}));}
 catch(e){report.cases.push({conversationId,success:false,error:e.message});console.log(JSON.stringify({conversationId,success:false,error:e.message}));}
}
report.successCount=report.cases.filter(c=>c.success).length;
report.meanElapsedMs=report.cases.filter(c=>c.success).reduce((s,c)=>s+c.elapsedMs,0)/Math.max(1,report.successCount);
report.estimatedTotalUSD=report.cases.reduce((s,c)=>s+(c.estimatedCostUSD||0),0);
await mkdir('output',{recursive:true});await writeFile('output/live-test-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({successCount:report.successCount,total:report.cases.length,meanElapsedMs:report.meanElapsedMs,estimatedTotalUSD:report.estimatedTotalUSD}));
