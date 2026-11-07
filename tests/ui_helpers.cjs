const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({document:{addEventListener(){}},window:{},console,fetch:async()=>({ok:false,statusText:'Unavailable',json:async()=>({detail:'Validation failed'})})});
vm.runInContext(fs.readFileSync('static/app.js','utf8'),context);
assert.equal(vm.runInContext(`escapeHtml('<img onerror="x">')`,context),'&lt;img onerror=&quot;x&quot;&gt;');
assert.equal(vm.runInContext(`encodeText("O'Reilly")`,context),'O%27Reilly');
assert.equal(vm.runInContext(`decodeURIComponent(encodeText("O'Reilly"))`,context),"O'Reilly");
(async()=>{await assert.rejects(vm.runInContext('checkedFetch("/api/test")',context),/Validation failed/);console.log('PASS: HTML escaping, inline handler apostrophes, round-trip and HTTP failure');})();
