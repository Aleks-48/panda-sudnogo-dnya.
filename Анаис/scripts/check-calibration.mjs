import {readFile,writeFile} from 'node:fs/promises';
import {starter,normalizeRecords,score} from '../core.mjs';
import {evaluateModel} from '../llm.mjs';
const refs=JSON.parse(await readFile(new URL('../examples/manual-review.json',import.meta.url),'utf8'));
const conversations=normalizeRecords(JSON.parse(await readFile(new URL('../data/dev.json',import.meta.url),'utf8')));
const cases=await Promise.all(refs.map(async ref=>{
 try{const c=conversations.find(c=>c.conversation_id===ref.conversationId);if(!c)throw Error('Reference conversation absent');const assessed=await evaluateModel(c,starter);
 const mismatches=assessed.results.filter(r=>r.value!==ref.results.find(v=>v.criterionId===r.criterionId)?.value).map(r=>r.criterionId);
 return {conversationId:c.conversation_id,success:true,model:assessed.model,score:score(starter,assessed.results).total,referenceScore:score(starter,ref.results).total,criteria:assessed.results.length,matchingCriteria:assessed.results.length-mismatches.length,mismatches,elapsedMs:assessed.elapsedMs,costUSD:assessed.costUSD};
 }catch(e){return {conversationId:ref.conversationId,success:false,error:e.message};}
}));
const report={createdAt:new Date().toISOString(),purpose:'Регрессионная проверка на трёх опорных примерах, использованных при настройке инструкции. Не независимая оценка точности.',cases};
await writeFile(new URL('../output/calibration-test-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(cases.some(c=>!c.success))process.exitCode=1;
