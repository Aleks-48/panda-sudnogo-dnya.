import fs from 'node:fs/promises';
import {seedDemo} from '../../../demo.mjs';
import {starter,normalizeRecords} from '../../../core.mjs';
await fs.mkdir('src',{recursive:true});await fs.mkdir('public/assets',{recursive:true});
for(const f of ['index.html','app.js','style.css'])await fs.copyFile('../../public/'+f,'public/'+f);
let core=await fs.readFile('../../core.mjs','utf8');core=core.replace("import {readFileSync} from 'node:fs';", "import starterData from './checklist.json' with {type:'json'};").replace("import {randomUUID} from 'node:crypto';",'').replace('()=>randomUUID()','()=>crypto.randomUUID()').replace("JSON.parse(readFileSync(new URL('./checklist.official.json',import.meta.url),'utf8'))",'starterData');
await fs.writeFile('src/core.mjs',core);await fs.copyFile('../../checklist.official.json','src/checklist.json');
await fs.copyFile('../../demo.mjs','src/demo.mjs');
await fs.copyFile('../../backup.mjs','src/backup.mjs');
await fs.copyFile('../../audio.mjs','src/audio.mjs');
let llm=await fs.readFile('../../llm.mjs','utf8');llm=llm.replace('evaluateModel(conversation,checklist){','evaluateModel(conversation,checklist,env=process.env){').replace('const config=modelConfig();','const config=modelConfig(env);').replaceAll('process.env.LLM_', 'env.LLM_').replaceAll('process.env.INPUT_PRICE_', 'env.INPUT_PRICE_').replaceAll('process.env.OUTPUT_PRICE_', 'env.OUTPUT_PRICE_');await fs.writeFile('src/llm.mjs',llm);
// Public deployment contains only authored fictional fixtures, never local working records.
const initial={checklists:[{...starter,name:'Стандарт качества обслуживания'}],conversations:[],evaluations:[],appeals:[],activeChecklistId:starter.id};await fs.writeFile('src/seed.json',JSON.stringify(initial));
let server=await fs.readFile('../../server.mjs','utf8');
let routes=server.slice(server.indexOf(" if(req.method==='POST'&&url.pathname.startsWith('/api/')){"),server.indexOf(" if(req.method==='GET'){"));
routes=routes.replaceAll('json(res,','reply(').replace('`http://${req.headers.host}`','url.origin').replace('modelConfig()','modelConfig(env)').replaceAll('process.env.DATASET_URL','env.DATASET_URL').replaceAll('process.env.ENABLE_DEMO','env.ENABLE_DEMO').replaceAll('evaluateModel(conversation,checklist)','evaluateModel(conversation,checklist,env)').replaceAll('await evaluateModel(conversation,checklist);','await evaluateModel(conversation,checklist,env);');
routes=routes.replace(' const b=await body(req);let result;',' const b=await body(request);let result;\n if(url.pathname===\'/api/model/check\'||(url.pathname===\'/api/evaluate\'&&!b.results))await reserveModelCall(env.DB,sessionId);');
await fs.writeFile('src/routes.inc',routes);
console.log({conversations:initial.conversations.length,demoEvaluations:initial.evaluations.length});
