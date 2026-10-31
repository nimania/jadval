/* Classic dispersed black-cell layouts, inspired by the general newspaper-grid genre.
   Produces geometry only; the CSP engine must fill every open slot before publication. */
(function(){
"use strict";
function rand(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function slots(mask){
 const n=mask.length,runs=[];
 for(const vertical of [false,true]){
  for(let line=0;line<n;line++){
   let start=0;
   for(let pos=0;pos<=n;pos++){
    const blocked=pos===n||(vertical?mask[pos][line]:mask[line][pos]);
    if(blocked){if(pos>start)runs.push({length:pos-start,vertical,line,start});start=pos+1;}
   }
  }
 }
 return runs;
}
function valid(mask){
 const n=mask.length;
 if(!n||mask.some(row=>row.length!==n))return false;
 const count=mask.flat().filter(Boolean).length;
 if(count<Math.floor(n*n*.055)||count>Math.ceil(n*n*.22))return false;
 if(mask.some(row=>row.every(Boolean)||row.every(x=>!x)))return false;
 for(let c=0;c<n;c++)if(mask.every(row=>row[c])||mask.every(row=>!row[c]))return false;
 const segments=slots(mask);
 return segments.every(s=>s.length>=2);
}
function build(size,seed,count=8){
 if(![10,15,20].includes(size))return [];
 const random=rand(seed),out=[],seen=new Set();
 for(let attempt=0;attempt<count*125&&out.length<count;attempt++){
  const mask=Array.from({length:size},()=>Array(size).fill(false));
  // Two slanted bands, jittered independently row by row; not a copy of a reference grid.
  let p=2+Math.floor(random()*(size-4)),q=size-3-Math.floor(random()*3);
  for(let r=0;r<size;r++){
   p=Math.max(1,Math.min(size-2,p+(Math.floor(random()*3)-1)));
   q=Math.max(1,Math.min(size-2,q+(Math.floor(random()*3)-1)));
   if(Math.abs(p-q)<3)q=(q+Math.ceil(size/2))%size;
   mask[r][p]=true;
   if(size>=15&&random()<.72)mask[r][q]=true;
  }
  // Repair one-letter slots: remove a nearby black cell. Never create a blocker.
  for(let step=0;step<size*5;step++){
   let changed=false;
   for(const s of slots(mask)){
    if(s.length!==1)continue;
    const pos=s.start,line=s.line;
    const options=[pos-1,pos+1].filter(k=>k>=0&&k<size&&(s.vertical?mask[k][line]:mask[line][k]));
    if(!options.length)continue;
    const target=options[Math.floor(random()*options.length)];
    if(s.vertical)mask[target][line]=false;else mask[line][target]=false;
    changed=true;
   }
   if(!changed)break;
  }
  // Populate empty rows and cols gently, only when doing so keeps all runs >=2.
  for(let row=0;row<size;row++)if(mask[row].every(x=>!x)){
   for(let tries=0;tries<size;tries++){
    const c=2+Math.floor(random()*(size-4));mask[row][c]=true;
    if(slots(mask).every(s=>s.length>=2))break;
    mask[row][c]=false;
   }
  }
  for(let col=0;col<size;col++)if(mask.every(row=>!row[col])){
   for(let tries=0;tries<size;tries++){
    const r=2+Math.floor(random()*(size-4));mask[r][col]=true;
    if(slots(mask).every(s=>s.length>=2))break;
    mask[r][col]=false;
   }
  }
  if(!valid(mask))continue;
  const key=mask.map(row=>row.map(Boolean).map(v=>v?"#":".").join("")).join("/");
  if(seen.has(key))continue;
  seen.add(key);out.push(mask);
 }
 return out;
}
function assess(mask,bank){
 const normal=s=>String(s||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\s\u200c\u200d\-]/g,"");
 const lengths=new Map();
 for(const e of bank){
  const len=[...normal(e.answer)].length;
  lengths.set(len,(lengths.get(len)||0)+1);
 }
 const runLengths=slots(mask).map(s=>s.length);
 const missing=[...new Set(runLengths.filter(n=>!lengths.get(n)))].sort((a,b)=>a-b);
 return {blackCells:mask.flat().filter(Boolean).length,slots:runLengths.length,missingLengths:missing,
  longestRequired:Math.max(...runLengths)};
}
window.JadvalClassic={build,valid,slots,assess};
})();