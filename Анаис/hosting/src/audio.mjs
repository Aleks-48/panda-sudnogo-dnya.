const defaults=['ec88f21f1accecf38e20095a9fe175.a5.environment.api.powerplatform.com','freedomholdingcorporation.crm11.dynamics.com'];
const fail=message=>Object.assign(Error(message),{status:502});
export async function openAudioStream(source,{range,allowedHosts=''}={}){
 const hosts=new Set([...defaults,...allowedHosts.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)]);
 function checked(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!hosts.has(u.hostname.toLowerCase()))throw fail('Источник записи не разрешён. Используйте ссылку на исходный плеер.');return u.href;}
 async function get(value){let url=checked(value);for(let i=0;i<4;i++){const r=await fetch(url,{headers:{...(range?{Range:range}:{}),'User-Agent':'Mozilla/5.0'},redirect:'manual',signal:AbortSignal.timeout(30000)});if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw fail('Не удалось открыть запись');url=checked(new URL(location,url).href);continue;}return r;}throw fail('Слишком много перенаправлений аудио');}
 let r=await get(source);
 if((r.headers.get('content-type')||'').includes('text/html')){
  if(Number(r.headers.get('content-length'))>262144){await r.body?.cancel();throw fail('Страница плеера слишком большая');}
  const html=await r.text();if(html.length>262144)throw fail('Страница плеера слишком большая');
  const raw=html.match(/<(?:audio|source)\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];if(!raw)throw fail('Ссылка не содержит доступной аудиозаписи');
  const src=raw.replaceAll('&amp;','&').replaceAll('&#38;','&');r=await get(new URL(src,source).href);
 }
 if(!r.ok||!/^(audio\/|application\/octet-stream)/i.test(r.headers.get('content-type')||'')){await r.body?.cancel();throw fail('Аудиозапись недоступна. Проверьте срок действия исходной ссылки.');}
 const headers={'Content-Type':r.headers.get('content-type'),'Cache-Control':'private, no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 for(const name of ['content-length','content-range'])if(r.headers.has(name))headers[name]=r.headers.get(name);
 return new Response(r.body,{status:r.status,headers});
}
