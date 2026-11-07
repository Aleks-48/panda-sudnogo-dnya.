const assert = require('node:assert/strict');
require('./engine.js');
const cases=[
 ['RU','contact','Да','client|Сколько стоит выпуск?','operator|Здравствуйте! Меня зовут Ольга. Выпуск бесплатный.'],
 ['EN','contact','Нет','client|Hello','operator|Hello!'],
 ['KZ','contact','Да','client|Сәлем','operator|Сәлеметсіз бе! Менің атым Айдана.'],
 ['EN','identity','Нет','client|What is my balance?','operator|Your balance is 100.','system|Identity verified'],
 ['EN','identity','Да','client|What is my balance?','system|Identity verified','operator|Your balance is 100.'],
 ['RU','identity','N/A','client|Как мне заблокировать мою карту самостоятельно?','operator|Откройте приложение.'],
 ['RU','gross','Нет','client|Вы идиот!','operator|Давайте проверим.'],
 ['RU','gross','Да','client|Нужна помощь.','operator|Переведите мне на личную карту для консультации.'],
 ['KZ','closing','N/A','client|Сәлем','system|Байланыс үзілді'],
 ['RU','closing','Да','client|Спасибо!','operator|Если появятся вопросы, напишите нам. До свидания!']
];
for(const [language,key,expected,...lines] of cases){
 const transcript=lines.map((line,i)=>{const [speaker,text]=line.split('|');return {speaker,text,timestamp:'00:0'+i}});
 const r=CQA.evaluate({language,transcript}).find(x=>x.id===key);
 assert.equal(r.value,expected,key+' '+language);assert.ok(transcript[r.evidence]);
}
console.log('10 independent targeted checks passed');
