/* Jadval classic CSP worker v3. Local-only data, bounded search and honest diagnostics. */
(function(root){
'use strict';
function normalize(s){return String(s||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,'').trim();}
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
function slotsFor(mask){
 const n=mask.length,slots=[],map=new Map();
 for(const dir of ['horizontal','vertical']){
  if(dir==='horizontal'){
   for(let r=0;r<n;r++){
    let c=n-1;
    while(c>=0){
     if(mask[r][c]){c--;continue;}
     const cells=[];
     while(c>=0&&!mask[r][c])cells.push([r,c--]);
     if(!cells.length)return null;
     slots.push({dir,group:r+1,cells});
    }
   }
  }else{
   for(let c=n-1;c>=0;c--){
    let r=0;
    while(r<n){
     if(mask[r][c]){r++;continue;}
     const cells=[];
     while(r<n&&!mask[r][c])cells.push([r++,c]);
     if(!cells.length)return null;
     slots.push({dir,group:n-c,cells});
    }
   }
  }
 }
 slots.forEach((s,id)=>{s.id=id;s.cross=[];s.cells.forEach(([r,c],i)=>{
  const key=r+','+c,refs=map.get(key)||[];
  refs.push([id,i]);map.set(key,refs);
 });});
 for(const s of slots)s.cells.forEach(([r,c],p)=>{
  for(const [other,q] of map.get(r+','+c))if(other!==s.id)s.cross.push([p,other,q]);
 });
 return slots;
}
function buildPool(entries,slots){
 const lens=new Set(slots.map(s=>s.cells.length)),groups=new Map(),seen=new Set();
 for(const item of entries){
  const word=normalize(item.answer),clue=String(item.clue||'').trim();
  if(!lens.has(word.length)||!alphabet.test(word)||!clue||seen.has(word))continue;
  seen.add(word);
  const arr=groups.get(word.length)||[];
  arr.push({word,clue,id:item.id||null});
  groups.set(word.length,arr);
 }
 return groups;
}
function inspect(mask,entries){
 const slots=slotsFor(mask);
 if(!slots)return {status:'invalid-mask',score:Infinity,slotCount:0};
 const pools=buildPool(entries,slots),domains=slots.map(slot=>pools.get(slot.cells.length)||[]);
 const missing=[...new Set(slots.filter(slot=>!domains[slot.id].length).map(slot=>slot.cells.length))];
 if(missing.length)return {status:'missing-lengths',score:Infinity,slotCount:slots.length,missingLengths:missing};
 const support=domains.map((candidates,id)=>{
  const positions=Array.from({length:slots[id].cells.length},()=>new Set());
  for(const entry of candidates)for(let p=0;p<entry.word.length;p++)positions[p].add(entry.word[p]);
  return positions;
 });
 let unsupported=0,weak=0;
 for(const slot of slots)for(const [p,other,q] of slot.cross){
  let overlap=0;
  for(const ch of support[slot.id][p])if(support[other][q].has(ch))overlap++;
  if(!overlap)unsupported++;
  else if(overlap<3)weak++;
 }
 const lengths=slots.map(s=>s.cells.length);
 const longPenalty=lengths.reduce((score,len)=>score+(len>=8?(len-7)*(len-7):0),0);
 // Score independent of arbitrary numbers assigned to grid cells.
 const score=unsupported*100000+weak*15+longPenalty*12+
    domains.reduce((sum,d)=>sum+Math.log1p(d.length),0);
 return {status:unsupported?'unsupported-crossings':'candidate',score,slotCount:slots.length,
         unsupported,weak,longest:Math.max(...lengths)};
}
function solve(mask,entries,{limitMs=9000,limitNodes=140000,seed=0}={}){
 const slots=slotsFor(mask);
 if(!slots)return {status:'invalid-mask',bestDepth:0,slotCount:0,nodes:0};
 const pools=buildPool(entries,slots),domains=slots.map(s=>(pools.get(s.cells.length)||[]));
 const missingLengths=[...new Set(slots.filter(s=>!domains[s.id].length).map(s=>s.cells.length))].sort((a,b)=>a-b);
 if(missingLengths.length)return {status:'missing-lengths',missingLengths,bestDepth:0,slotCount:slots.length,nodes:0};
 const start=Date.now(),deadline=start+limitMs,assigned=Array(slots.length).fill(null),used=new Set();
 let nodes=0,bestDepth=0,stop=false,initialPruned=0;
 function timedOut(){
  if(nodes>limitNodes||Date.now()>deadline){stop=true;return true;}
  return false;
 }
 // Apply global arc consistency (AC-3) before search. For every crossing,
 // remove answers whose crossing letter has no support in the other slot.
 // All candidate strings remain original, source-backed answers.
 const arcs=[];
 for(const slot of slots)for(const [p,other,q] of slot.cross)
  arcs.push([slot.id,other,p,q]);
 let arcChecks=0;
 function pruneArcs(current,initial=false){
  const queue=arcs.slice();
  for(let head=0;head<queue.length;head++){
   if(++arcChecks%1024===0&&Date.now()>deadline){stop=true;return null;}
   const [i,j,p,q]=queue[head],supported=new Set();
   for(const item of current[j])supported.add(item.word[q]);
   const next=current[i].filter(item=>supported.has(item.word[p]));
   if(next.length===current[i].length)continue;
   if(initial)initialPruned+=current[i].length-next.length;
   if(!next.length)return null;
   current[i]=next;
   // Only arcs that *depend* on slot i need to be reconsidered.
   for(const [pos,other,otherPos] of slots[i].cross){
    if(other===j)continue;
    queue.push([other,i,otherPos,pos]);
   }
   if(head>120000){stop=true;return null;}
  }
  return current;
 }
 let base=pruneArcs(domains.map(a=>a.slice()),true);
 if(!base)return {status:stop?'budget-exhausted':'arc-inconsistent',slotCount:slots.length,bestDepth,nodes,
                         initialPruned,elapsedMs:Date.now()-start};
 // The board is filled with unique answer strings; words already assigned are
 // taken out of all other domains. Work on copy-on-write domains per branch.
 function recurse(current,depth){
  if(depth>bestDepth)bestDepth=depth;
  if(depth===slots.length)return true;
  if(++nodes%64===0&&timedOut())return false;
  let chosen=-1,options=null;
  for(let i=0;i<slots.length;i++){
   if(assigned[i])continue;
   const valid=current[i].filter(item=>!used.has(item.word));
   if(!valid.length)return false;
   if(chosen===-1||valid.length<options.length||
      (valid.length===options.length&&slots[i].cross.length>slots[chosen].cross.length)){
    chosen=i;options=valid;
    if(valid.length===1)break;
   }
  }
  // Least-constraining candidate first: prefer letters supported by the
  // remaining crossing domains, with seeded tie-breaking for restarts.
  const neighbors=slots[chosen].cross.filter(([,i])=>!assigned[i]);
  const support=neighbors.map(([p,other,q])=>{
   const freq=new Map();
   for(const word of current[other])if(!used.has(word.word))
    freq.set(word.word[q],(freq.get(word.word[q])||0)+1);
   return [p,freq];
  });
  options.sort((a,b)=>{
   const score=x=>support.reduce((sum,[p,freq])=>sum+Math.log1p(freq.get(x.word[p])||0),0);
   const d=score(b)-score(a);
   if(Math.abs(d)>1e-8)return d;
   // Deterministic variation across attempts: does not change correctness.
   return (hashWord(a.word,seed)%997)-(hashWord(b.word,seed)%997);
  });
  for(const entry of options){
   if(timedOut())return false;
   assigned[chosen]=entry;used.add(entry.word);
   // Forward checking and small-scope AC-3 propagation. Domain copying is
   // intentional: restoring the previous branch cannot leak reductions.
   const next=current.slice(),affected=new Set([chosen]);
   next[chosen]=[entry];
   let consistent=true;
   for(const [p,other,q] of slots[chosen].cross){
    if(assigned[other])continue;
    const narrowed=current[other].filter(word=>word.word!==entry.word&&word.word[q]===entry.word[p]&&!used.has(word.word));
    if(!narrowed.length){consistent=false;break;}
    next[other]=narrowed;affected.add(other);
   }
   if(consistent){
    // Only revise arcs adjacent to changed slots. Propagated changes enqueue
    // their neighbors, which is stronger than the original forward check.
    const queue=[];
    for(const i of affected)for(const [p,other,q] of slots[i].cross)
     if(!assigned[other])queue.push([other,i,q,p]);
    for(let head=0;head<queue.length;head++){
     if(head%1024===0&&Date.now()>deadline){stop=true;consistent=false;break;}
     const [i,j,p,q]=queue[head];
     if(assigned[i])continue;
     const supported=new Set(next[j].map(x=>x.word[q]));
     const narrowed=next[i].filter(x=>!used.has(x.word)&&supported.has(x.word[p]));
     if(!narrowed.length){consistent=false;break;}
     if(narrowed.length===next[i].length)continue;
     next[i]=narrowed;
     for(const [pi,other,qo] of slots[i].cross)
      if(other!==j&&!assigned[other])queue.push([other,i,qo,pi]);
     if(head>40000){consistent=false;break;}
    }
   }
   if(consistent&&recurse(next,depth+1))return true;
   assigned[chosen]=null;used.delete(entry.word);
   if(stop)return false;
  }
  return false;
 }
 function hashWord(word,salt){
  let h=(salt>>>0)||2166136261;
  for(let i=0;i<word.length;i++)h=Math.imul(h^word.charCodeAt(i),16777619);
  return h>>>0;
 }
 const success=recurse(base,0),report={slotCount:slots.length,bestDepth,nodes,initialPruned,arcChecks,
                                      elapsedMs:Date.now()-start};
 if(!success)return {status:stop?'budget-exhausted':'inconsistent',...report};
 const n=mask.length,grid=mask.map(row=>row.map(()=>'')),clues={horizontal:{},vertical:{}};
 for(const slot of slots){
  const word=assigned[slot.id];
  slot.cells.forEach(([r,c],p)=>{grid[r][c]=word.word[p]});
  (clues[slot.dir][String(slot.group)]??=[]).push(word.clue);
 }
 if(grid.some((row,r)=>row.some((v,c)=>!mask[r][c]&&!v)))return {status:'invalid-output',...report};
 return {status:'solved',...report,puzzle:{version:3,grid,clues,meta:{
  title:'جدول کلاسیک '+n+'×'+n,status:'draft',size:{rows:n,cols:n},
  direction:'rtl',language:'fa',method:'classic-csp-ac3'}},mask};
}
function tryMasks(masks,entries,opts={}){
 const requested=Number(opts.totalMs),budget=Number.isFinite(requested)?Math.max(500,Math.min(60000,requested)):12000;
 const start=Date.now(),reports=[];
 // Longer user-selected sessions give promising candidate masks deeper search,
 // without making the default 12-second worker more expensive.
 const perMaskLimit=budget>12000?Math.min(24000,Math.max(4800,Math.floor(budget/4))):4800;
 // Pre-check every candidate grid. A geometrically valid mask can still be
 // useless if the bank does not support one or more crossing positions.
 const ranked=masks.map((mask,index)=>({mask,index,assessment:inspect(mask,entries)}))
   .sort((a,b)=>a.assessment.score-b.assessment.score);
 for(const item of ranked){
  const remaining=budget-(Date.now()-start);if(remaining<=0)break;
  const {mask,index,assessment}=item;
  if(assessment.status!=='candidate'){
   reports.push({status:assessment.status,slotCount:assessment.slotCount,bestDepth:0,nodes:0,
                 score:assessment.score,missingLengths:assessment.missingLengths||[]});
   continue;
  }
  const r=solve(mask,entries,{limitMs:Math.min(perMaskLimit,remaining),limitNodes:120000,seed:(opts.seed||0)+index});
  reports.push({status:r.status,slotCount:r.slotCount,bestDepth:r.bestDepth,nodes:r.nodes,
                initialPruned:r.initialPruned||0,score:assessment.score,
                missingLengths:r.missingLengths||[],elapsedMs:r.elapsedMs||0});
  if(r.status==='solved')return {status:'solved',result:r,reports};
 }
 return {status:'unsolved',reports};
}
root.JadvalWorkerEngine={solve,tryMasks,slotsFor,inspect};
if(typeof root.addEventListener==='function'&&typeof root.postMessage==='function'){
 root.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.action!=='solve')return;
  try{root.postMessage({id:data.id,...tryMasks(data.masks||[],data.entries||[],data.options||{})});}
  catch(err){root.postMessage({id:data.id,status:'error',message:String(err.message||err)});}
 });
}
})(typeof self!=='undefined'?self:globalThis);
