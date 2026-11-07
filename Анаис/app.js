const publicDemo = location.protocol === 'https:' && location.hostname !== 'localhost';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy = v => JSON.parse(JSON.stringify(v));
const storageKey='anais.workspace.v1';
let db, serverVersion=null, writes=Promise.resolve(), syncFailed=false;
try { db=JSON.parse(localStorage.getItem(storageKey)); } catch {}
db ||= {records:copy(window.demoRecords), criteria:copy(CQA.defaults), runs:{}, appeals:[]};
let current=db.records[0].conversation_id, page='list', focus=0;
const record=()=>db.records.find(r=>r.conversation_id===current);
const run=()=>db.runs[current];
const names={client:'Клиент',operator:'Оператор',system:'Система',bot:'Бот'};
const tabs={list:'Очередь',library:'Учебная база',calls:'Звонки',risk:'Грубые нарушения',saved:'На разбор',rules:'Чек-лист',appeals:'Апелляции',stats:'Аналитика',bench:'Контрольная выборка',guide:'Как начать'};
const icons={list:'▤',rules:'☑',appeals:'⚖',stats:'▥'};
const num=n=>n==null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:2});
function save(){
 if(serverVersion!==null){
   const snapshot=JSON.stringify(db);
   writes=writes.then(async()=>{
     if(syncFailed)return;
     const response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"version":'+serverVersion+',"workspace":'+snapshot+'}'});
     const data=await response.json();
     if(!response.ok)throw Error(data.error||'Ошибка сохранения.');
     serverVersion=data.version;
   }).catch(err=>{syncFailed=true;document.body.inert=true;alert('Изменение не сохранено. '+err.message);location.reload()});
   return;
 }
 try{localStorage.setItem(storageKey,JSON.stringify(db))}catch{alert('Хранилище браузера заполнено. Изменения доступны только в этой вкладке.')}}
function analyze(){const criteria=copy(db.criteria), original=CQA.evaluate(record(),criteria); db.runs[current]={criteria,original,results:copy(original),version:Date.now()};save()}

function openPage(p){page=p;render()}
function openRecord(id){current=id;focus=0;page='analysis';render()}
function pop(html){$('body').innerHTML=html;$('modal').showModal()}
function closePop(){$('modal').close()}
function intro(k,title,sub,actions=''){return '<div class="intro"><div><div class="eyebrow">'+k+'</div><h1>'+title+'</h1><p class="muted">'+sub+'</p></div><div class="actions">'+actions+'</div></div>'}
function stamp(t){return /^\d{4}-/.test(t)?t.slice(11,19):t}
function render(){
 $('nav').innerHTML=Object.entries(tabs).map(([k,v])=>'<button data-page="'+k+'" class="'+((page===k||page==='analysis'&&k==='list')?'active':'')+'">'+v+'</button>').join('');
 $('app').innerHTML=page==='analysis'?analysis():page==='list'?list():page==='rules'?rules():page==='appeals'?appeals():page==='bench'?benchPage():page==='stats'?stats():extraPage();
}
let localRecording;
function callAudio(r,url){
 if(r.channel!=='voice call')return '';
 const embedded=window.demoRecords.find(item=>item.conversation_id===r.conversation_id && item.audio_url?.endsWith('.wav') && JSON.stringify(item.transcript)===JSON.stringify(r.transcript));
 if(embedded)return '<section class="panel bench"><h2>Запись звонка</h2><p>Учебная озвучка · '+r.transcript.length+' реплик</p><audio id="player" controls preload="metadata" src="'+esc(embedded.audio_url)+'"></audio></section>';
 const direct=url&&/\.(mp3|wav|ogg|m4a|aac|webm)(?:[?#]|$)/i.test(url);
 return '<section class="panel bench"><h2>Запись звонка</h2><p>Расшифровка организаторов · '+r.transcript.length+' реплик</p>'+(url?'<p><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Открыть запись в плеере организаторов ↗</a></p>':'')+'<label>Выбрать аудиофайл этого звонка <input id="callFile" type="file" accept="audio/*"></label><audio id="player" controls preload="metadata" '+(direct?'src="'+esc(url)+'"':'hidden')+'></audio></section>';
}
document.addEventListener('change',e=>{
 if(e.target.id!=='callFile'||!e.target.files[0])return;
 if(localRecording)URL.revokeObjectURL(localRecording);
 localRecording=URL.createObjectURL(e.target.files[0]);
 const player=$('player');player.src=localRecording;player.hidden=false;
});
function analysis(){
 const r=record(), a=run(), messages=r.transcript;
 const transcript=messages.map((m,i)=>'<div class="message '+esc(m.speaker)+(i===focus?' selected':'')+'" id="msg-'+i+'"><div class="meta"><b>'+esc(names[m.speaker]||m.speaker)+'</b>　'+esc(stamp(m.timestamp))+'</div><div class="bubble">'+esc(m.text)+'</div></div>').join('');
 const s=a&&CQA.summarize(a.results,a.criteria);
 const score=a?'<div class="result-head"><strong>'+num(s.total)+'</strong> / 100<p>'+esc(a.model||'Локальные правила')+' · '+(s.gross?'Есть грубая ошибка':'Без грубых ошибок')+'</p></div>'+a.criteria.map((c,i)=>'<div class="criterion"><button data-criterion="'+i+'"><span>'+esc(c.title)+'</span><b class="status">'+esc(a.results[i].value) +'　›</b></button></div>').join('')+'<details class="section-scores"><summary>Результаты разделов</summary>'+Object.entries(s.sections).map(([k,v])=>'<p>'+esc(k)+' · '+num(v)+' / 100</p>').join('')+'</details>':'<p>Запустите оценку по текущему чек-листу.</p>';
 const audioURL=/^https?:\/\//i.test(r.audio_url||'')?r.audio_url:null;
 return intro('ПРОВЕРКА ОБРАЩЕНИЯ','Анализ диалога',esc(r.title||(r.channel==='voice call'?'Звонок':'Чат'))+'　·　'+esc(r.conversation_id)+'　·　'+esc(r.language),'<button data-control="bookmark">'+((db.bookmarks||[]).includes(current)?'Убрать из разбора':'На разбор')+'</button><button data-act="evaluate">Локальная оценка</button>'+(publicDemo ? '' : '<button data-act="model">Оценить через OpenAI</button>'))+
 callAudio(r,audioURL)+'<div class="columns"><article class="panel"><div class="panel-head"><h2>Расшифровка</h2><small>'+esc(r.language)+'</small></div><div class="transcript">'+transcript+'</div></article><article class="panel"><div class="panel-head"><h2>Оценка качества</h2></div>'+score+'</article></div>';
}
function jump(i){focus=i;closeIfOpen();document.querySelectorAll('.message').forEach(el=>el.classList.remove('selected'));const el=$('msg-'+i);if(el){el.classList.add('selected');el.scrollIntoView({block:'center',behavior:'smooth'})}const player=$('player'), r=record();if(player&&player.readyState>=1&&r.transcript[i]){const offset=(Date.parse(r.transcript[i].timestamp)-Date.parse(r.transcript[0].timestamp))/1000;if(Number.isFinite(offset))player.currentTime=Math.max(0,offset)}}
function closeIfOpen(){if($('modal').open)closePop()}
function detail(i){const a=run(),c=a.criteria[i],v=a.results[i],m=record().transcript[v.evidence],s=CQA.summarize(a.results,a.criteria);
 pop('<div class="eyebrow">КРИТЕРИЙ '+(i+1)+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.description)+'</p><b>'+esc(v.value)+'　·　Вес '+c.weight+'　·　Баллы '+num(s.points[c.id])+'</b><p>'+esc(v.reason)+'</p>'+(m?'<blockquote>'+esc(m.text)+'</blockquote><button data-msg="'+v.evidence+'">К реплике '+esc(stamp(m.timestamp))+'</button>':'')+'<hr><p>Исходная оценка　<b>'+esc(a.original[i].value)+'</b></p>'+db.appeals.filter(x=>x.id===current&&x.version===a.version&&x.i===i&&x.decision).map(x=>'<p>Решение　'+esc(x.decision)+' · '+esc(x.reason)+'</p>').join('')+'<form id="appealForm"><label>Причина апелляции<textarea required name="comment"></textarea></label><button>Оспорить оценку</button></form>');
 $('appealForm').onsubmit=e=>{e.preventDefault();const comment=e.target.comment.value.trim();if(!comment)return;db.appeals.push({id:current,version:a.version,i,title:c.title,old:v.value,comment,proof:m?.text||'',time:new Date().toISOString()});save();closePop();openPage('appeals')};
}
function list(){return queuePage()}
function rules(){return intro('МЕТОДИКА','Чек-лист','Изменения применяются при следующей оценке.','<button data-rule="-1">Добавить критерий</button>')+'<article class="panel">'+db.criteria.map((c,i)=>'<div class="criterion"><button data-rule="'+i+'"><span>'+esc(c.title)+'</span><b>Вес '+c.weight+'　›</b></button></div>').join('')+'</article>'}
function editRule(i){const c=db.criteria[i]||{id:'custom-'+Date.now(),title:'',description:'',section:'',weight:10,type:'binary',allowNA:false,scale:[0,10],keywords:''};const field=(title,key,value,type='text')=>'<label>'+title+'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'"></label>';
 pop('<h2>Настройка критерия</h2><form id="ruleform">'+field('Название','title',c.title)+field('Формулировка','description',c.description)+field('Раздел','section',c.section)+field('Вес','weight',c.weight,'number')+'<label>Тип ответа<select name="type">'+['binary','scale','flag'].map((t,j)=>'<option value="'+t+'" '+(c.type===t?'selected':'')+'>'+['Да / Нет','Шкала','Флаг нарушения'][j]+'</option>').join('')+'</select></label>'+field('Ступени шкалы через запятую','scale',(c.scale||[]).join(', '))+field('Фразы для автоматической проверки через запятую','keywords',c.keywords||'')+'<label><input type="checkbox" name="na" '+(c.allowNA?'checked':'')+'> Разрешить N/A</label><button>Сохранить критерий</button></form>');
 $('ruleform').onsubmit=e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));const scale=d.scale.split(',').map(x=>Number(x.trim()));if(!d.title.trim()||!Number.isFinite(+d.weight)||+d.weight<0||d.type==='scale'&&(scale.length<2||scale.some(x=>!Number.isFinite(x)||x<0)||Math.max(...scale)<=0))return alert('Проверьте название, вес и ступени шкалы.');const next={...c,...d,weight:d.type==='flag'?0:+d.weight,allowNA:f.na.checked,scale:[...new Set(scale)].sort((a,b)=>a-b)};if(i<0)db.criteria.push(next);else db.criteria[i]=next;save();closePop();render()};
}
function appeals(){return intro('ПЕРЕСМОТР','Апелляции','Комментарий и спорный фрагмент сохраняются вместе с оценкой.')+'<article class="panel">'+(db.appeals.length?db.appeals.map((x,j)=>'<div class="criterion"><button data-review="'+j+'"><span>'+esc(x.title)+'<br><small>'+esc(x.id)+'</small></span><b>'+ (x.decision?'Рассмотрена':'На проверке')+'　›</b></button></div>').reverse().join(''):'<div class="panel-head">Обращений пока нет. Откройте критерий в карточке диалога, чтобы подать апелляцию.</div>')+'</article>'}
function review(j){const x=db.appeals[j],a=db.runs[x.id],active=a?.version===x.version,c=a?.criteria[x.i];const values=c?.type==='scale'?[...c.scale]:['Да','Нет'];if(c?.allowNA)values.push('N/A');
 pop('<h2>'+esc(x.title)+'</h2><p>'+esc(x.id)+'　·　Спорная оценка　'+esc(x.old)+'</p><blockquote>'+esc(x.proof)+'</blockquote><p>'+esc(x.comment)+'</p>'+(x.decision?'<b>Решение　'+esc(x.decision)+'</b><p>'+esc(x.reason)+'</p>':!active?'<p>Сохранена новая версия оценки.</p>':'<form id="decision"><label>Финальная оценка<select name="value">'+values.map(v=>'<option '+(String(v)===String(x.old)?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><label>Основание решения<textarea required name="reason"></textarea></label><button>Сохранить решение</button></form>'));
 if($('decision'))$('decision').onsubmit=e=>{e.preventDefault();const f=e.target;if(!f.reason.value.trim())return;const v=c.type==='scale'&&f.value.value!=='N/A'?Number(f.value.value):f.value.value;x.decision=String(v);x.reason=f.reason.value.trim();a.results[x.i]={...a.results[x.i],value:v,reason:x.reason};save();closePop();render()};
}
function stats(){const rows=Object.values(db.runs),scores=rows.map(a=>CQA.summarize(a.results,a.criteria)).filter(s=>s.total!=null);return intro('ОБЗОР','Аналитика','Показатели по последним оценкам рабочего пространства.')+'<article class="panel">'+[['Оценено диалогов',rows.length],['Средний балл',scores.length?num(scores.reduce((n,s)=>n+s.total,0)/scores.length):'—'],['С грубой ошибкой',scores.filter(s=>s.gross).length],['Открытых апелляций',db.appeals.filter(x=>!x.decision&&db.runs[x.id]?.version===x.version).length]].map(([label,v])=>'<div class="panel-head"><h2>'+label+'</h2><b>'+v+'</b></div>').join('')+'</article>'}
function importer(){pop('<h2>Загрузить диалоги</h2><label>Файл JSON<input type="file" id="file" accept=".json,application/json"></label>'+(publicDemo ? '' : '<hr><label>Группа организаторов<input id="group" value="DEV"></label><button id="fetchGroup">Получить по API</button>')+'<p id="feedback" role="status"></p>');const load=async reader=>{try{const data=await reader(), records=data.data?.records??data.records??(Array.isArray(data)?data:[data]);if(!records.length||records.some(r=>typeof r.conversation_id!=='string'||!r.conversation_id.trim()||r.conversation_id in Object.prototype||!Array.isArray(r.transcript)||!r.transcript.length||r.transcript.some(m=>!m||typeof m.text!=='string'||typeof m.timestamp!=='string'||!Object.hasOwn(names,m.speaker))))throw Error('Проверьте формат записей и реплик.');let n=0;for(const r of records)if(!db.records.some(k=>k.conversation_id===r.conversation_id)){db.records.push(r);n++}save();render();$('feedback').textContent='Добавлено диалогов: '+n+'. Повторные ID пропущены.'}catch(err){$('feedback').textContent='Ошибка загрузки. '+err.message}};$('file').onchange=e=>load(async()=>JSON.parse(await e.target.files[0].text()));if($('fetchGroup')) $('fetchGroup').onclick=()=>load(async()=>{const res=await fetch('/api/dataset?group_id='+encodeURIComponent($('group').value));if(!res.ok)throw Error('Проверьте настройки локального сервера.');return res.json()})}
function filterQueue(){
 const query=$('search').value.trim().toLowerCase(), status=$('queueStatus').value;
 document.querySelectorAll('[data-search]').forEach(el=>el.hidden=!el.dataset.search.includes(query)||!el.dataset.state.includes(status));
}
document.addEventListener('input',e=>{if(['search','queueStatus'].includes(e.target.id))filterQueue()});
function batchLocal(){
 const pending=db.records.filter(r=>!db.runs[r.conversation_id]);
 if(!pending.length){pop('<h2>Очередь проверена</h2><p>Все диалоги уже имеют оценку.</p>');return}
 const criteria=copy(db.criteria);
 for(const r of pending){
   const results=CQA.evaluate(r,criteria);
   db.runs[r.conversation_id]={criteria,original:results,results:copy(results),version:Date.now()};
 }
 save();render();pop('<h2>Проверка завершена</h2><p>Новых локальных оценок: '+pending.length+'. Откройте карточку, чтобы проверить доказательства.</p>');
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-page],[data-act],[data-record],[data-rule],[data-review],[data-msg],[data-criterion]');if(!el)return;const d=el.dataset;if(d.page)openPage(d.page);else if(d.record!=null)openRecord(db.records[+d.record].conversation_id);else if(d.rule!=null)editRule(+d.rule);else if(d.review!=null)review(+d.review);else if(d.msg!=null)jump(+d.msg);else if(d.criterion!=null)detail(+d.criterion);else if(d.act==='batch')batchLocal();else if(d.act==='model')modelDialog();else if(d.act==='import')importer();else if(d.act==='evaluate'){if(run()&&!confirm('Начать новую оценку по сохранённому чек-листу? Предыдущие апелляции останутся в журнале.'))return;analyze();render()}});
async function startWorkspace(){
 if(location.protocol==='http:' && location.hostname==='127.0.0.1'){
   try{
     const res=await fetch('/api/workspace',{cache:'no-store'});
     if(!res.ok)throw Error();
     const data=await res.json();
     serverVersion=data.version;
     if(data.workspace){db=data.workspace;current=db.records[0].conversation_id}
     else save();
   }catch{
     $('app').textContent='Не удалось открыть базу. Перезапустите приложение через Запустить.cmd и обновите страницу.';
     return;
   }
 }
 const missing=window.demoRecords.filter(r=>!db.records.some(x=>x.conversation_id===r.conversation_id));
 if(missing.length){db.records.push(...copy(missing));save()}
 if(!run())analyze();
 render();
}
startWorkspace();
function modelDialog() {
 if(location.protocol==='file:'){
   pop('<h2>Серверная оценка</h2><p>Откройте файл «Запустить.cmd» из папки «Анаис». Он запустит приложение и откроет страницу с подключением к OpenAI.</p>');
   return;
 }
 const selected=record(), id=selected.conversation_id;
 pop('<h2>Оценка через OpenAI</h2><p>В OpenAI будут переданы реплики диалога '+esc(id)+' и текущий чек-лист. Используйте этот режим для синтетических данных или диалогов, передачу которых одобрил банк.</p><p>Успешная оценка станет текущей версией. Расход токенов учитывается в проекте OpenAI.</p><button id="modelStart">Отправить выбранный диалог</button><p id="modelState" role="status"></p>');
 $('modelStart').onclick=async e=>{
   const button=e.target, state=$('modelState'), criteria=copy(db.criteria);
   button.disabled=true;state.textContent='Идёт оценка…';
   try{
     const res=await fetch('/api/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record:{transcript:selected.transcript},criteria})});
     const out=await res.json();if(!res.ok)throw Error(out.error);
     db.runs[id]={criteria,original:out.results,results:copy(out.results),model:out.model,usage:out.usage,version:Date.now()};
     save();if(button.isConnected)closeIfOpen();render();
   }catch(err){state.textContent=err.message;button.disabled=false}
 };
}







