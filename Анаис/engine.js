/* Browser-side, explainable scoring rules for the hackathon checklist. */
(() => {
  'use strict';
  const yes = 'Да', no = 'Нет', na = 'N/A';
  const sections = ['Начало и понимание запроса', 'Безопасность и решение', 'Ведение и завершение диалога', 'Грубые нарушения'];
  function rule(id, title, description, section, weight, type = 'binary', allowNA = false, scale = []) {
    return {id, title, description, section: sections[section], weight, type, allowNA, scale, keywords: ''};
  }
  const defaults = [
    rule('contact','Установление контакта','Приветствие на языке клиента и представление оператора в первом ответе.',0,10),
    rule('need','Выявление потребности','Недостающие детали уточнены до ответа. N/A, если исходных данных достаточно.',0,15,'binary',true),
    rule('identity','Идентификация','Проверка личности подтверждена до защищённого действия. N/A для общих вопросов.',1,20,'binary',true),
    rule('advice','Корректная и полная консультация','Ответ закрывает существенные вопросы или содержит конкретный следующий шаг.',1,20,'scale',true,[0,5,10,15,20]),
    rule('empathy','Эмпатия и клиентоориентированность','Вежливая реакция на конкретную проблему клиента.',2,15),
    rule('clarity','Управление диалогом, скорость и грамотность','Ясный порядок ответов и предупреждение при явном ожидании.',2,15,'scale',false,[0,4,7,10]),
    rule('closing','Завершение','Итог или предложение помощи и прощание. N/A при обрыве диалога.',2,5,'binary',true),
    rule('gross','Грубые ошибки','Оскорбление, частная платная услуга или разглашение конфиденциальных данных.',3,0,'flag')
  ];
  const norm = text => String(text ?? '').toLocaleLowerCase().normalize('NFKC').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  const lex = {
    greet: {RU:/здравств|добр(?:ый|ое|ого) (?:день|вечер|утро|дня)|привет/, KZ:/сәлем|салем|қайырлы|кайырлы/, EN:/\b(?:hello|hi|good morning|good afternoon|good evening|welcome)\b/},
    intro: /меня зовут|мое имя|на связи|оператор[ ,:—-]+[а-яәіңө]|мое имя|менің атым|есімім|атым|операторымын|my name|i(?:’|'| a)m [a-z]+|this is [a-z]+|[a-z]+ speaking/,
    missing:/не работ|не могу|не получ|ошибк|проблем|не прош|не приш|завис|что делать|can't|cannot|unable|error|failed|not working|problem|help me|doesn.t work|қате|мәселе|жұмыс істем|алмай|өтпей/,
    detailed:/код ошибки|ошибка [a-zа-я-]*\d|error (?:code )?[a-z-]*\d|қате коды|на этапе|после того|when i|кезінде/,
    clarify:/уточн|подскажите|како[йем]|когда именно|что видите|в каком|қай|нақтыла|айтыңыз|қандай|which|could you (?:tell|clarify|specify)|what (?:message|device|error)|when did/,
    private:/мо(?:й|его|ем|ю|ей|и) (?:счет|карт|заявк|баланс|договор|перевод)|(?:заблокируйте|разблокируйте|смените|закройте|измените) |my (?:balance|account|card|application|transfer)|block my|change my|менің (?:шот|карт|өтінім|аударым)|картамды|шотым|балансым/,
    verified:/идентификаци[яю] (?:успешно )?(?:пройд|заверш)|личность подтверждена|проверка (?:успешно )?пройдена|клиент (?:успешно )?(?:идентифицирован|авторизован)|identity (?:has been |is )?(?:verified|confirmed)|verification (?:successful|complete|passed)|verified successfully|тұлға(?:ңыз|сы)? расталды|сәйкестендіру.*(?:өтті|аяқталды)|тексеруден өт/,
    protected:/ваш (?:баланс|остаток|номер счета)|(?:карту|счет) (?:заблокировал|закрыл)|ваша заявка одобрена|your (?:balance is|account number is|card has been)|картаны бұғаттадым|шотыңыздағы қалдық/,
    upset:/недоволь|ужас|возмущ|неудоб|пережива|уже .*жду|не работ|проблем|upset|frustrat|inconvenien|disappoint|still waiting|unhappy|алаңдай|ыңғайсыз|нараз|күтіп отыр|мәселе/,
    care:/понимаю|сожале|жаль|извин|понимаем|understand|sorry|apologi|түсінем|кешір|өкініш/,
    rude:/идиот|дебил|туп(?:ой|ая)|заткни|stupid|idiot|shut up|ақымақ|ақыма[қғ]/,
    side:/на (?:мою|личную) карт|мне лично|личн(?:ый|ому) номер.*(?:платн|консультац)|переведите мне|pay me (?:personally|directly)|my personal (?:card|account)|жеке (?:картама|шотыма)|маған ақша аудар/,
    leak:/чуж(?:ой|ого|ая).*(?:иин|баланс|номер счета).*\d|(?:другого клиента|another customer|басқа клиент).*(?:\d{8,}|password|пароль|құпиясөз)/,
    action:/откройте|перейдите|выберите|нажмите|заполните|отправьте|обратитесь|проверьте|можно|доступн|составляет|срок|переда(?:л|м)|зарегистрир|подайте|open |select |tap |click |submit |send |contact |you can|available|business days|will (?:receive|forward)|ашыңыз|таңдаңыз|басыңыз|жолдаңыз|болады|өтініш|жұмыс күн|тексеріңіз/,
    waiting:/подождите|ожидайте|минут.*провер|проверю|понадобится .*минут|please wait|one moment|let me check|take .*minute|күте тұрыңыз|күтіңіз|тексеріп/,
    repeat:/повторите|не понял|не поняла|я спрашивал|еще раз|не ответили|what do you mean|i (?:still )?don.t understand|i asked|түсінбедім|қайта айтыңыз/,
    goodbye:/до свидания|всего доброго|хорошего (?:дня|вечера)|до встречи|доброго дня|goodbye|bye\b|have a (?:nice|good|great) day|сау бол|күніңіз сәтті|сәтті күн/,
    recap:/итак|подвед|обращение (?:принято|зарегистрировано)|мы с вами|еще вопросы|еще чем|могу .*помочь|будут вопросы|обращайтесь|рад[аы]? помочь|дополнительн.*вопрос|anything else|further (?:help|questions)|happy to help|to recap|we.ve|тағы.*(?:сұрақ|көмек)|көмектесе|хабарласыңыз|қорытынды/,
    interrupted:/оборва|прерв|соединение потеряно|клиент (?:покинул|отключился)|disconnected|connection (?:lost|dropped)|client left|байланыс үзіл|клиент шықты/
  };
  const duration = stamp => {
    if (/^\d+:\d{2}$/.test(stamp)) { const [m,s] = stamp.split(':').map(Number); return m*60+s; }
    return Date.parse(stamp)/1000;
  };
  function analyze(record) {
    const all = (record.transcript || []).map((m,i) => ({i, role:norm(m.speaker), text:norm(m.text), time:duration(String(m.timestamp||''))}));
    const ops = all.filter(m => m.role === 'operator'), clients = all.filter(m => m.role === 'client');
    const first = ops[0], last = ops.at(-1), firstClient = clients[0];
    const proof = (value, reason, message) => ({value,reason,evidence:message?.i ?? firstClient?.i ?? first?.i ?? (all.length?0:-1)});
    const by = (rows, regex) => rows.find(m => regex.test(m.text));
    const language = String(record.language || '').toUpperCase().replace('KK','KZ');
    const greeting = lex.greet[language] || /здравств|сәлем|hello/;
    const okContact = first && greeting.test(first.text) && lex.intro.test(first.text);
    const problem = clients.find(m => lex.missing.test(m.text) && !lex.detailed.test(m.text));
    const advice = by(ops,lex.action);
    const clarification = problem && ops.find(m => m.i>problem.i && (!advice || m.i<=advice.i) && lex.clarify.test(m.text));
    const sensitive = by(clients,lex.private), protectedReply = by(ops,lex.protected);
    const verification = all.find(m => ['operator','system','bot'].includes(m.role) && lex.verified.test(m.text) && (!protectedReply || m.i<protectedReply.i));
    const substantive = clients.find(m => m.text.replace(/здравствуйте|добрый день|добрый вечер|привет|спасибо|hello|thanks|good morning|сәлеметсіз бе|рақмет|рахмет|[.!?,\s]/g,'').length>2);
    const repeat = by(clients,lex.repeat);
    const upset = by(clients,lex.upset);
    const care = upset && ops.find(m => m.i>upset.i && lex.care.test(m.text));
    const rude = by(ops,lex.rude), gross = rude || by(ops,lex.side) || by(ops,lex.leak);
    const wait = ops.find(m => {
      const previous = all[m.i-1];
      return previous?.role==='client' && m.time-previous.time>180 && ops.some(o => o.i<previous.i) && !lex.waiting.test(all.slice(0,m.i).filter(o=>o.role==='operator').at(-1)?.text||'');
    });
    const interrupted = by(all.filter(m => m.role==='system'),lex.interrupted);
    const fare = ops.slice(-2).find(m=>lex.goodbye.test(m.text)), recap = ops.slice(-3).find(m=>lex.recap.test(m.text));
    const unresolved = advice && clients.find(m => m.i>advice.i && /\?/.test(m.text) && !ops.some(o=>o.i>m.i && lex.action.test(o.text)));
    const minorDetail = unresolved && /уведомлен|где (?:посмотреть|проверить) статус|notification|track the status|хабарлама|мәртебесін/.test(unresolved.text);
    const adviceLevel = !substantive ? na : !last ? 0 : !advice ? (ops.some(m=>m.text.length>45)?5:0) : minorDetail ? 15 : unresolved || (repeat && repeat.i>advice.i) ? 10 : 20;
    const adviceWhy = {[na]:'Клиент не сформулировал содержательный запрос.',0:'Ответ по существу запроса не найден.',5:'Есть развёрнутый ответ, но конкретный следующий шаг не распознан.',10:'После инструкции остался вопрос или повторное уточнение клиента.',15:'Основной шаг описан. Дополнительный вопрос о статусе или уведомлении остался открытым.',20:'В ответе распознан конкретный шаг или объяснение условий. Фактическую точность проверяет эксперт.'};
    return {
      contact:proof(okContact?yes:no,okContact?'В первом ответе есть приветствие и представление.':'В первом ответе отсутствует приветствие на языке диалога или представление.',first),
      need:proof(problem?(clarification?yes:no):na,problem?(clarification?'Оператор уточнил детали перед инструкцией.':'После описания проблемы уточняющий вопрос не найден.'):'В исходном запросе не обнаружены признаки недостающих деталей.',clarification||problem||substantive),
      identity:proof(sensitive||protectedReply?(verification?yes:no):na,sensitive||protectedReply?(verification?'До защищённого действия найдена отметка проверки.':'Подтверждение проверки личности до защищённого действия не найдено.'):'Признаков запроса персональных данных или защищённого действия не найдено.',verification||protectedReply||sensitive||substantive),
      advice:proof(adviceLevel,adviceWhy[adviceLevel],unresolved||((adviceLevel===10)&&repeat)||advice||last||substantive),
      empathy:proof(last&&!rude&&(!upset||care)?yes:no,rude?'Обнаружена невежливая формулировка.':upset?(care?'После жалобы оператор выразил понимание.':'После жалобы явная реакция на неудобство не найдена.'):last?'Признаков грубости или оставленной без реакции жалобы не найдено.':'Ответ оператора отсутствует.',rude||care||upset||first),
      clarity:proof(!last?0:repeat?4:wait?7:10,!last?'Ответов оператора нет.':repeat?'Клиент просит пояснить или повторить ответ.':wait?'В ходе диалога есть пауза после вопроса без предупреждения.':'Повторных уточнений и явных пауз без предупреждения не обнаружено.',repeat||wait||advice||first),
      closing:proof(interrupted&&!fare?na:fare&&recap?yes:no,interrupted&&!fare?'Системное событие фиксирует обрыв до завершения.':fare&&recap?'Есть завершение консультации и прощание.':'В конце не найдена полная пара «итог или помощь» и «прощание».',interrupted&&!fare?interrupted:fare||last),
      gross:proof(gross?yes:no,gross?'Реплика содержит признак грубого нарушения. Требуется проверка контекста.':'В репликах оператора не найдены признаки трёх грубых нарушений.',gross||last)
    };
  }
  function steps(c) { return [...new Set((Array.isArray(c.scale)?c.scale:[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b); }
  function evaluate(record, criteria = defaults) {
    const baseline = analyze(record), messages = record.transcript || [];
    return criteria.map(c => {
      const original = defaults.find(d=>d.id===c.id);
      let result = baseline[c.id], max = Math.max(...(original?.scale || []),1);
      const terms = String(c.keywords||'').split(/[,;\n]/).map(norm).filter(Boolean);
      if (!result || terms.length || (original && (original.title!==c.title || original.description!==c.description))) {
        const inferred = norm(c.description+' '+c.title).match(/[\p{L}\p{N}]{5,}/gu) || [];
        const lookup = terms.length?terms:inferred;
        const i = messages.findIndex(m=>norm(m.speaker)==='operator' && lookup.some(term=>norm(m.text).includes(term)));
        const fallback = messages.findIndex(m=>norm(m.speaker)==='operator');
        result = {value:i>=0?yes:no,reason:i>=0?'В реплике оператора найдено выражение «'+lookup.find(t=>norm(messages[i].text).includes(t))+'».':'В репликах оператора не найдены выражения настроенного критерия.',evidence:i>=0?i:fallback>=0?fallback:messages.length?0:-1};
        max=1;
      }
      let value = result.value;
      if(value!==na || !c.allowNA) {
        const ratio = typeof value==='number'?value/max:value===yes?1:0;
        if(c.type==='scale') {
          const options=steps(c), target=ratio*(options.at(-1)||0);
          value=options.reduce((best,x)=>Math.abs(x-target)<Math.abs(best-target)?x:best,options[0]||0);
        } else value=ratio>=1?yes:no;
      }
      return {...result,id:c.id,value};
    });
  }
  function summarize(results, criteria = defaults) {
    const points={}, groups={}, sections={};
    let earned=0, applicable=0, gross=false;
    for(const c of criteria) {
      const r=results.find(x=>x.id===c.id);
      if(c.type==='flag') { if(r?.value===yes) gross=true; points[c.id]=null; continue; }
      const group=groups[c.section] ||= {earned:0, weight:0};
      if(!r || r.value===na) {points[c.id]=null;continue;}
      const weight=Math.max(0,Number(c.weight)||0);
      const fraction=c.type==='scale'?Number(r.value)/(steps(c).at(-1)||1):r.value===yes?1:0;
      const amount=weight*Math.max(0,Math.min(1,fraction||0));
      points[c.id]=Math.round(amount*100)/100;
      earned+=amount; applicable+=weight; group.earned+=amount; group.weight+=weight;
    }
    const pct=(earned,weight)=>weight?Math.round(earned/weight*10000)/100:null;
    for(const [key,group] of Object.entries(groups)) sections[key]=pct(group.earned,group.weight);
    return {total:pct(earned,applicable),gross,sections,points};
  }
  globalThis.CQA = {defaults,evaluate,summarize};
})();
