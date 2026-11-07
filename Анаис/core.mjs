import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export const uid=()=>randomUUID();
export function validateChecklist(c){
 if(!c?.name?.trim()||!Array.isArray(c.criteria)||!c.criteria.length)throw Error('Нужны название и хотя бы один критерий');
 const ids=new Set();
 for(const x of c.criteria){if(!x.id||ids.has(x.id))throw Error('ID критериев должны быть уникальными');ids.add(x.id);if(!x.title?.trim()||!x.instruction?.trim())throw Error('Заполните название и инструкцию критерия');if(!Number.isFinite(x.weight)||x.weight<0)throw Error('Вес должен быть неотрицательным числом');if(!['boolean','numeric'].includes(x.type))throw Error('Неизвестный тип');if(x.type==='numeric'&&(!Number.isFinite(x.min)||!Number.isFinite(x.max)||x.max<=x.min))throw Error('Некорректная шкала');}
 for(const x of c.criteria){if(x.allowedValues!=null&&(!Array.isArray(x.allowedValues)||!x.allowedValues.length||new Set(x.allowedValues).size!==x.allowedValues.length||x.type!=='numeric'||x.allowedValues.some(v=>!Number.isFinite(v)||v<x.min||v>x.max)))throw Error('Недопустимые ступени шкалы');if(x.grossErrorWhen!=null&&(x.type==='boolean'?typeof x.grossErrorWhen!=='boolean':(!Number.isFinite(x.grossErrorWhen)||x.grossErrorWhen<x.min||x.grossErrorWhen>x.max||(x.allowedValues&&!x.allowedValues.includes(x.grossErrorWhen)))))throw Error('Некорректное условие грубой ошибки');}
 if(!c.criteria.some(x=>x.weight>0))throw Error('Сумма весов должна быть больше нуля');
 if(!Number.isInteger(c.precision)||c.precision<0||c.precision>4)throw Error('Округление: от 0 до 4 знаков');
 return c;
}
export function normalizeRecords(payload){
 if(payload?.isSuccess===false)throw Error('API сообщил об ошибке');
 const records=Array.isArray(payload)?payload:payload?.data?.records??payload?.records;
 if(!Array.isArray(records)||!records.length)throw Error('Не найден массив диалогов');
 const ids=new Set();
 return records.map(r=>{if(!r.conversation_id||ids.has(r.conversation_id)||!Array.isArray(r.transcript)||!r.transcript.length)throw Error('Некорректный или повторный ID / пустой транскрипт');ids.add(r.conversation_id);if(!['RU','KZ','EN'].includes(r.language))throw Error('Неизвестный язык');return {...r,transcript:r.transcript.map((m,i)=>{if(!['operator','client','bot','system'].includes(m.speaker)||typeof m.text!=='string'||typeof m.timestamp!=='string')throw Error('Некорректная реплика');return {...m,id:`m${i}`};})};});
}
export function validateResults(checklist,conversation,results){
 if(!Array.isArray(results)||results.length!==checklist.criteria.length)throw Error('Неполный ответ оценщика');
 const messages=new Map(conversation.transcript.map(m=>[m.id,m]));
 return checklist.criteria.map(c=>{const matches=results.filter(r=>r.criterionId===c.id);if(matches.length!==1)throw Error('Повторный или отсутствующий критерий');const r=matches[0];if(typeof r.explanation!=='string'||!r.explanation.trim())throw Error('Нет объяснения');
 if(r.value===null){if(!c.allowNA)throw Error('N/A не разрешён');}else if(c.type==='boolean'){if(typeof r.value!=='boolean')throw Error('Ожидается да/нет');}else if(!Number.isFinite(r.value)||r.value<c.min||r.value>c.max)throw Error('Оценка за пределами шкалы');
 if(r.value!==null&&c.allowedValues&&!c.allowedValues.includes(r.value))throw Error('Оценка должна соответствовать допустимой ступени шкалы');
 if(!Array.isArray(r.evidence)||r.evidence.some(id=>!messages.has(id)))throw Error('Недействительная ссылка на доказательство');
 const validRange=Array.isArray(r.checkedRange)&&r.checkedRange.length===2&&r.checkedRange.every(id=>messages.has(id))&&Number(r.checkedRange[0].slice(1))<=Number(r.checkedRange[1].slice(1));
 if((r.checkedRange!=null&&!validRange)||(!r.evidence.length&&!validRange))throw Error('Нужны доказательства или корректный проверенный диапазон');
 return {criterionId:c.id,value:r.value,explanation:r.explanation,evidence:r.evidence,checkedRange:r.checkedRange??null,grossError:c.grossErrorWhen!=null&&r.value!==null&&r.value===c.grossErrorWhen};});
}
export function score(checklist,results){
 const applicable=checklist.criteria.filter(c=>results.find(r=>r.criterionId===c.id)?.value!=null);
 const totalWeight=applicable.reduce((s,c)=>s+c.weight,0);
 const rows=checklist.criteria.map(c=>{const r=results.find(x=>x.criterionId===c.id);const norm=r?.value==null?null:c.type==='boolean'?(r.value?1:0):(r.value-c.min)/(c.max-c.min);return {...r,title:c.title,section:c.section||'Общее',weight:c.weight,normalized:norm,effectiveWeight:norm===null||!totalWeight?0:c.weight/totalWeight*100,points:norm===null||!totalWeight?0:norm*c.weight/totalWeight*100};});
 const round=n=>Number(n.toFixed(checklist.precision));
 const sections=[...new Set(rows.map(r=>r.section))].map(name=>{const rs=rows.filter(r=>r.section===name&&r.normalized!==null);const w=rs.reduce((s,r)=>s+r.weight,0);return {name,total:w?round(rs.reduce((s,r)=>s+r.normalized*r.weight,0)/w*100):null};});
 return {total:totalWeight?round(rows.reduce((s,r)=>s+r.points,0)):null,rows,sections,grossError:checklist.criteria.some(c=>c.grossErrorWhen!=null&&results.some(r=>r.criterionId===c.id&&r.value!==null&&r.value===c.grossErrorWhen))};
}
export const starter=validateChecklist(JSON.parse(readFileSync(new URL('./checklist.official.json',import.meta.url),'utf8')));
