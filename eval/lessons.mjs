import fs from 'node:fs';
import { saveResult } from './record.mjs';
const base = process.argv[2] || 'http://127.0.0.1:8791';
const model = process.argv[3] || 'qwen3.5:4b';
const results=[];
for(const [level,volumeId] of [['HSK1-2','tam-so-cap'],['HSK3-4','tam-trung-cap'],['HSK5-6','tam-cao-cap']]) {
  const started=Date.now();
  const response=await fetch(`${base}/api/lesson-content`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'ollama',model,level,volumeId,lessonNo:2,day:1}),signal:AbortSignal.timeout(480000)});
  const raw=await response.json();
  results.push({level,volumeId,status:response.status,elapsedMs:Date.now()-started,...(response.ok?{words:raw.vocab.length,patterns:raw.patterns.length}:{error:raw.error})});
  if(response.ok){fs.mkdirSync('lessons/drafts',{recursive:true});fs.writeFileSync(`lessons/drafts/${volumeId}-2-d1.json`,JSON.stringify({...raw,reviewed:false,draft:true},null,2)+'\n');}
  console.log(results.at(-1));
}
saveResult('lessons',{model},results);
if(results.some((r)=>r.status!==200))process.exitCode=1;
