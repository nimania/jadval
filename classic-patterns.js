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
function whiteCoverage(mask){
 const n=mask.length,all=[];
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(!mask[r][c])all.push([r,c]);
 if(!all.length)return 0;
 const seen=new Set([all[0].join(',')]),queue=[all[0]];
 for(let i=0;i<queue.length;i++){
  const [r,c]=queue[i];
  for(const [rr,cc] of [[r+1,c],[r-1,c],[r,c+1],[r,c-1]])
   if(rr>=0&&rr<n&&cc>=0&&cc<n&&!mask[rr][cc]&&!seen.has(rr+','+cc)){
    seen.add(rr+','+cc);queue.push([rr,cc]);
   }
 }
 return all.length-seen.size;
}
function squareCount(mask){
 const n=mask.length;let count=0;
 for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++)
  if(mask[r][c]&&mask[r+1][c]&&mask[r][c+1]&&mask[r+1][c+1])count++;
 return count;
}
function evaluate(mask,available,maxLen=12){
 const n=mask.length,segments=runs(mask),black=mask.flat().filter(Boolean).length;
 let cost=0;
 for(const span of segments){
  const len=span.length;
  if(len<3)cost+=(3-len)*350;
  if(len>maxLen)cost+=Math.pow(len-maxLen,2)*40;
  if(available && len>=3 && (available.get(len)||0)===0)cost+=350;
  else if(available && len>=3 && (available.get(len)||0)<8)cost+=85;
 }
 cost+=squareCount(mask)*800+whiteCoverage(mask)*500;
 // Position-cost prevents ugly block clustering without relaxing hard constraints.
 const rows=counts(mask).rows;
 for(const row of rows)if(row>Math.ceil(n*.33))cost+=(row-Math.ceil(n*.33))*30;
 cost+=Math.abs(black-Math.round(n*n*.145))*25;
 return cost;
}
function valid(mask){
 if(!Array.isArray(mask)||![10,15,20].includes(mask.length))return false;
 const n=mask.length;
 if(mask.some(row=>!Array.isArray(row)||row.length!==n||row.some(v=>typeof v!=='boolean')))return false;
 const black=mask.flat().filter(Boolean).length;
 if(black/(n*n)<.12-1e-9||black/(n*n)>.167+1e-9)return false;
 if(squareCount(mask)||whiteCoverage(mask))return false;
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)
  if(mask[r][c]!==mask[n-1-r][n-1-c])return false;
 const segments=runs(mask);
 if(!segments.length||segments.some(x=>x.length<3))return false;
 // Every non-block cell belongs to exactly one 3+-cell run in both axes.
 for(const dir of [false,true]){
  const cover=new Set();
  for(const span of segments.filter(x=>x.vertical===dir))
   for(let i=0;i<span.length;i++)
    cover.add(dir?(span.start+i)+','+span.line:span.line+','+(span.start+i));
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)
   if(!mask[r][c]&&!cover.has(r+','+c))return false;
 }
 return true;
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
 const maxAvailable=[...frequency.keys()].filter(len=>(frequency.get(len)||0)>=10).sort((a,b)=>b-a)[0]||12;
 const maxLen=Math.min(maxAvailable,12),random=rand(seed),out=[],seen=new Set();
 const pairs=[];
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  if(r*n+c<(n-1-r)*n+n-1-c)pairs.push([[r,c],[n-1-r,n-1-c]]);
 }
 const pairCount=Math.round((n*n*.145)/2);
 const draw=selected=>{
  const mask=Array.from({length:n},()=>Array(n).fill(false));
  for(const i of selected)for(const [r,c] of pairs[i])mask[r][c]=true;
  return mask;
 };
 const attempts=Math.max(5,Math.min(14,count*2)),steps=Math.max(2200,n*160);
 for(let trial=0;trial<attempts;trial++){
  const choices=Array.from({length:pairs.length},(_,i)=>i);
  for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
  let chosen=new Set(choices.slice(0,pairCount));
  let mask=draw(chosen),cost=evaluate(mask,frequency.size?frequency:null,maxLen);
  let best=null,bestCost=Infinity;
  for(let step=0;step<steps;step++){
   if(valid(mask)&&cost<bestCost){bestCost=cost;best=mask.map(row=>row.slice());}
   const inside=[...chosen],a=inside[Math.floor(random()*inside.length)];
   const b=Math.floor(random()*pairs.length);
   if(chosen.has(b)||a===undefined)continue;
   const next=new Set(chosen);next.delete(a);next.add(b);
   const nextMask=draw(next),nextCost=evaluate(nextMask,frequency.size?frequency:null,maxLen);
   const temperature=15+90*Math.pow(1-step/steps,2);
   if(nextCost<=cost||random()<Math.exp((cost-nextCost)/temperature)){
    chosen=next;mask=nextMask;cost=nextCost;
   }
   if(bestCost===0)break;
  }
  if(!best&&valid(mask)){best=mask;bestCost=cost;}
  if(!best)continue;
  const key=best.map(row=>row.map(v=>v?'#':'.').join('')).join('/');
  if(seen.has(key))continue;
  seen.add(key);out.push({mask:best,score:bestCost});
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