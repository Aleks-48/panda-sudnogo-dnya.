import {normalizeRecords,validateChecklist,validateResults,score} from './core.mjs';
export function productState(db){const conversations=db.conversations.filter(c=>!c.demo),ids=new Set(conversations.map(c=>c.conversation_id)),evaluations=db.evaluations.filter(e=>!e.demo),scores=new Set(evaluations.map(e=>e.id));return {...db,conversations,evaluations,appeals:db.appeals.filter(a=>scores.has(a.evaluationId))};}
export function mergeBackup(db,payload){
 if(!payload||!['conversations','checklists','evaluations','appeals'].every(k=>Array.isArray(payload[k])))throw Error('Неверный формат резервной копии');
 const next=structuredClone(db),counts={conversations:0,checklists:0,evaluations:0,appeals:0};
 function add(kind,items,idKey='id'){
  const ids=new Set();for(const item of items){const id=item?.[idKey];if(typeof id!=='string'||!id||ids.has(id))throw Error('Повторный или пустой идентификатор в резервной копии');ids.add(id);const existing=next[kind].find(x=>x[idKey]===id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(item))throw Error(`Запись ${id} уже существует с другими данными. Импорт остановлен без изменений.`);}else{next[kind].push(item);counts[kind]++;}}
 }
 add('checklists',payload.checklists.map(c=>structuredClone(validateChecklist(c))));
 add('conversations',payload.conversations.length?normalizeRecords(payload.conversations):[],'conversation_id');
 const evaluations=payload.evaluations.map(e=>{
  const c=next.conversations.find(c=>c.conversation_id===e.conversationId);if(!c||!next.checklists.some(k=>k.id===e.checklistId))throw Error('В резервной копии отсутствует диалог или версия чек-листа оценки');
  const checklist=validateChecklist(e.checklist);if(checklist.id!==e.checklistId)throw Error('Версия правил оценки не совпадает');
  const results=validateResults(checklist,c,e.results),finalResults=validateResults(checklist,c,e.finalResults||e.results);
  return {...structuredClone(e),checklist,results,finalResults,originalScore:score(checklist,results),finalScore:score(checklist,finalResults)};
 });
 add('evaluations',evaluations);
 add('appeals',payload.appeals.map(a=>{const e=next.evaluations.find(e=>e.id===a.evaluationId);if(!e||!e.results.some(r=>r.criterionId===a.criterionId)||typeof a.comment!=='string'||!a.comment.trim()||!['open','resolved'].includes(a.status))throw Error('Некорректная апелляция в резервной копии');if(a.status==='resolved'&&(!['confirm','change'].includes(a.action)||typeof a.reason!=='string'||!a.reason.trim()))throw Error('Нет решения или причины пересмотра');return structuredClone(a);}));
 if(!next.activeChecklistId&&next.checklists.some(c=>c.id===payload.activeChecklistId))next.activeChecklistId=payload.activeChecklistId;
 Object.assign(db,next);return counts;
}
