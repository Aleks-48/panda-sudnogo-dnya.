import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedDemo} from '../demo.mjs';
test('учебные сценарии отделены от API, повторная загрузка не создаёт дубликатов',()=>{
 const db={conversations:[],evaluations:[]};const first=seedDemo(db);assert.equal(first.added,4);assert.equal(seedDemo(db).added,0);assert.equal(db.evaluations.length,4);
 assert.deepEqual(new Set(db.conversations.map(c=>c.language)),new Set(['RU','KZ','EN']));
 for(const e of db.evaluations){assert.equal(e.demo,true);assert.equal(e.model,'manual');assert.ok(e.reviewNote.includes('фикстура'));}
 assert.equal(db.evaluations.find(e=>e.conversationId==='demo-appeal-ru').originalScore.total,92.31);
 const gross=db.evaluations.find(e=>e.conversationId==='demo-gross-en').originalScore;assert.equal(gross.grossError,true);assert.equal(gross.total,38.46);
 seedDemo(db,true);assert.equal(db.conversations.length,4);assert.equal(db.evaluations.length,8);assert.equal(new Set(db.evaluations.map(e=>e.id)).size,8);
});
