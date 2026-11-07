 if(req.method==='POST'&&url.pathname.startsWith('/api/')){
 if(req.headers.origin&&req.headers.origin!==url.origin)return reply(403,{error:'Недопустимый источник запроса'});
 if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'Ожидается application/json'});
 const b=await body(request);let result;
 if(url.pathname==='/api/model/check'||(url.pathname==='/api/evaluate'&&!b.results))await reserveModelCall(env.DB,sessionId);
 if(url.pathname==='/api/demo'){
 if(env.ENABLE_DEMO!=='true')return reply(404,{error:'Раздел недоступен'});
 result=seedDemo(db,b.newRun===true);
 }else if(url.pathname==='/api/restore'){
 result=mergeBackup(db,b.payload);
 }else if(url.pathname==='/api/model/check'){
 const config=modelConfig(env);
 try{
  const checklist={name:'Проверка подключения',precision:2,criteria:[{id:'connection',title:'Приветствие',instruction:'Оператор приветствует клиента и представляет себя.',type:'boolean',weight:1,allowNA:false}]};
  const conversation={conversation_id:'connection-check',language:'RU',channel:'agent chat',transcript:[{id:'m0',speaker:'operator',timestamp:'00:00',text:'Здравствуйте! Я Алина, оператор поддержки.'}]};
  const assessed=await evaluateModel(conversation,checklist,env);
  db.integrationCheck={ok:true,model:config.model,checkedAt:new Date().toISOString(),message:'Реальный запрос к модели выполнен',elapsedMs:assessed.elapsedMs};
 }catch(e){db.integrationCheck={ok:false,model:config.model||null,checkedAt:new Date().toISOString(),message:e.message};}
 result=db.integrationCheck;
 }else if(url.pathname==='/api/import'){
 let payload=b.payload;
 if(b.groupId){if(!env.DATASET_URL)throw Error('Задайте DATASET_URL на сервере');const target=new URL(env.DATASET_URL);target.searchParams.set('group_id',b.groupId);const r=await fetch(target,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`API набора: HTTP ${r.status}`);payload=await r.json();}
 const rows=normalizeRecords(payload);for(const row of rows){const old=db.conversations.find(x=>x.conversation_id===row.conversation_id);if(old&&(old.language!==row.language||old.channel!==row.channel||JSON.stringify(old.transcript)!==JSON.stringify(row.transcript)))throw Error('Импорт изменяет существующий диалог. Используйте новый conversation_id.');}
 for(const row of rows){const old=db.conversations.find(x=>x.conversation_id===row.conversation_id);if(old)Object.assign(old,row);}
 db.conversations.push(...rows.filter(r=>!db.conversations.some(x=>x.conversation_id===r.conversation_id)));result={count:rows.length};
 }else if(url.pathname==='/api/checklists'){const c=validateChecklist(b);result={...c,id:uid(),createdAt:new Date().toISOString()};db.checklists.push(result);db.activeChecklistId=result.id;
 }else if(url.pathname==='/api/evaluate'){
 const conversation=db.conversations.find(x=>x.conversation_id===b.conversationId),checklist=db.checklists.find(x=>x.id===b.checklistId);if(!conversation||!checklist)throw Error('Выберите диалог и чек-лист');
 const assessed=b.results?{results:validateResults(checklist,conversation,b.results),model:'manual',costUSD:0}:await evaluateModel(conversation,checklist,env);
 result={id:uid(),conversationId:conversation.conversation_id,checklistId:checklist.id,checklist:structuredClone(checklist),createdAt:new Date().toISOString(),...assessed};result.originalScore=score(checklist,result.results);result.finalResults=structuredClone(result.results);result.finalScore=result.originalScore;db.evaluations.push(result);
 }else if(url.pathname==='/api/appeals'){
 const e=getEvaluation(b.evaluationId);if(!e.results.some(r=>r.criterionId===b.criterionId)||!b.comment?.trim())throw Error('Выберите критерий и введите комментарий');if(db.appeals.some(a=>a.evaluationId===e.id&&a.criterionId===b.criterionId&&a.status==='open'))throw Error('По критерию уже есть открытая апелляция');result={id:uid(),evaluationId:e.id,criterionId:b.criterionId,comment:b.comment.trim(),status:'open',createdAt:new Date().toISOString(),disputedResult:structuredClone(e.finalResults.find(r=>r.criterionId===b.criterionId))};db.appeals.push(result);
 }else if(url.pathname==='/api/review'){
 const a=db.appeals.find(x=>x.id===b.appealId);if(!a||a.status!=='open'||!b.reason?.trim())throw Error('Нужны открытая апелляция и причина');if(!['confirm','change'].includes(b.action))throw Error('Неизвестное решение');const e=getEvaluation(a.evaluationId);let updated=e.finalResults.map(r=>r.criterionId===a.criterionId&&b.action==='change'?{...r,value:b.value,explanation:b.reason.trim(),evidence:b.evidence??r.evidence,checkedRange:b.checkedRange??r.checkedRange}:r);updated=validateResults(e.checklist,db.conversations.find(c=>c.conversation_id===e.conversationId),updated);e.finalResults=updated;e.finalScore=score(e.checklist,updated);Object.assign(a,{status:'resolved',action:b.action,reason:b.reason.trim(),resolvedAt:new Date().toISOString(),finalValue:e.finalResults.find(r=>r.criterionId===a.criterionId).value});result=a;
 }else return reply(404,{error:'Не найдено'});
 await save();return reply(200,result);
 }
