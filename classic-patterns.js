/* Classic crossword pattern search: bank-aware, no reference templates copied. */
(function(){
"use strict";
function rand(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function runs(mask){
 const n=mask.length,result=[];
 for(const vertical of [false,true])for(let line=0;line<n;line++){
  let start=0;
  for(let pos=0;pos<=n;pos++){
   const black=pos===n||(vertical?mask[pos][line]:mask[line][pos]);
   if(black){if(pos>start)result.push({length:pos-start,vertical,line,start});start=pos+1;}
  }
 }
 return result;
}
function counts(mask){const n=mask.length,rows=mask.map(r=>r.filter(Boolean).length),cols=Array.from({length:n},(_,c)=>mask.filter(row=>row[c]).length);return {rows,cols};}
function evaluate(mask,available,maxLen=12){
 const n=mask.length,{rows,cols}=counts(mask),segments=runs(mask);
 const blacks=rows.reduce((a,b)=>a+b,0);
 let cost=0;
 for(const num of [...rows,...cols]){
  if(num===0)cost+=850;
  if(num>=n)cost+=100000;
  if(num>Math.ceil(n*.32))cost+=(num-n*.32)*140;
 }
 for(const run of segments){
  const length=run.length;
  if(length===1)cost+=7000;
  else if(length>maxLen)cost+=5000+(length-maxLen)*1200;
  else if(available && (available.get(length)||0)===0)cost+=9000;
  else if(available && (available.get(length)||0)<15)cost+=420;
 }
 const target=Math.round(n*n*.18);
 cost+=Math.abs(blacks-target)*12;
 // Spread blocks across the grid, avoiding monotonous stripes.
 for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++)
  if(mask[r][c]&&mask[r+1][c]&&mask[r][c+1]&&mask[r+1][c+1])cost+=270;
 return cost;
}
function valid(mask){
 const n=mask.length,{rows,cols}=counts(mask),blacks=rows.reduce((a,b)=>a+b,0);
 if(![10,15,20].includes(n)||blacks<Math.floor(n*n*.08)||blacks>Math.ceil(n*n*.29))return false;
 if([...rows,...cols].some(x=>x<1||x>=n))return false;
 return runs(mask).every(x=>x.length>=2);
}
function uniqueLengthCounts(bank){
 const wordsByLength=new Map();
 for(const e of bank){
  const w=String(e?.answer||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک")
   .replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,"");
  if(!w)continue;
  if(!wordsByLength.has(w.length))wordsByLength.set(w.length,new Set());
  wordsByLength.get(w.length).add(w);
 }
 return new Map([...wordsByLength].map(([len,words])=>[len,words.size]));
}
function build(n,seed,count=8,bank=[]){
 if(![10,15,20].includes(n))return [];
 const frequency=uniqueLengthCounts(bank);
 // A length with many repeated clues but few distinct answers is not
 // well-supported: each distinct solution may appear only once in a puzzle.
 const coverageThreshold=Math.max(15,Math.floor(bank.length*.01));
 const maxAvailable=[...frequency.keys()].filter(len=>(frequency.get(len)||0)>=coverageThreshold).sort((a,b)=>b-a)[0]||12;
 const maxLen=Math.min(maxAvailable,12);
 const random=rand(seed),out=[],seen=new Set();
 for(let trial=0;trial<Math.max(6,count*3);trial++){
  const mask=Array.from({length:n},()=>Array.from({length:n},()=>random()<.18));
  let cost=evaluate(mask,frequency.size?frequency:null,maxLen);
  let best=cost,bestMask=mask.map(row=>row.slice());
  // Simulated annealing: flip black cells while penalizing one-letter
  // runs, missing columns/rows, and lengths unavailable in the bank.
  for(let step=0;step<Math.max(1400,n*145);step++){
   const r=Math.floor(random()*n),c=Math.floor(random()*n);
   mask[r][c]=!mask[r][c];
   const next=evaluate(mask,frequency.size?frequency:null,maxLen);
   const temperature=12+220*(1-step/Math.max(1400,n*145));
   if(next<=cost||random()<Math.exp((cost-next)/temperature)){
    cost=next;
    if(next<best){best=next;bestMask=mask.map(row=>row.slice());}
   }else mask[r][c]=!mask[r][c];
   if(best===0)break;
  }
  if(!valid(bestMask))continue;
  const key=bestMask.map(row=>row.map(c=>c?"#":".").join("")).join("/");
  if(seen.has(key))continue;
  seen.add(key);out.push({mask:bestMask,score:best});
 }
 return out.sort((a,b)=>a.score-b.score).slice(0,count).map(x=>x.mask);
}
function assess(mask,bank){
 const frequency=uniqueLengthCounts(bank);
 const segments=runs(mask);
 const missing=[...new Set(segments.map(s=>s.length).filter(len=>(frequency.get(len)||0)===0))].sort((a,b)=>a-b);
 const scarce=[...new Set(segments.map(s=>s.length).filter(len=>(frequency.get(len)||0)>0&&(frequency.get(len)||0)<15))].sort((a,b)=>a-b);
 return {blackCells:mask.flat().filter(Boolean).length,slots:segments.length,missingLengths:missing,scarceLengths:scarce,longestRequired:Math.max(...segments.map(s=>s.length)),score:evaluate(mask,frequency,12)};
}
window.JadvalClassic={build,valid,slots:runs,assess};
})();