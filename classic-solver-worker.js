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
     if(cells.length<2)return null;
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
     if(cells.length<2)return null;
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
function solve(mask,entries,{limitMs=9000,limitNodes=140000,seed=0}={}){
 const slots=slotsFor(mask);
 if(!slots)return {status:'invalid-mask',bestDepth:0,slotCount:0,nodes:0};
 const pools=buildPool(entries,slots),domains=slots.map(s=>(pools.get(s.cells.length)||[]));
 const missingLengths=[...new Set(slots.filter(s=>!domains[s.id].length).map(s=>s.cells.length))].sort((a,b)=>a-b);
 if(missingLengths.length)return {status:'missing-lengths',missingLengths,bestDepth:0,slotCount:slots.length,nodes:0};
 const assigned=Array(slots.length).fill(null),used=new Set(),start=Date.now();
 let nodes=0,bestDepth=0,stop=false;
 // Per-position support maps for cheap forward checks.
 const index=domains.map((arr,id)=>{
  const byPosition=Array.from({length:slots[id].cells.length},()=>new Map());
  for(const candidate of arr)for(let p=0;p<candidate.word.length;p++){
   const key=candidate.word[p],list=byPosition[p].get(key)||[];
   list.push(candidate);byPosition[p].set(key,list);
  }
  return byPosition;
 });
 // Calculate a candidate's compatibility with already assigned intersections.
 function fits(id,item){
  if(used.has(item.word))return false;
  for(const [pos,other,q] of slots[id].cross){
   const fixed=assigned[other];if(fixed&&item.word[pos]!==fixed.word[q])return false;
  }
  return true;
 }
 function options(id,stopAfter=Infinity){
  let narrow=null;
  for(const [pos,other,q] of slots[id].cross){
   const fixed=assigned[other];if(!fixed)continue;
   const list=index[id][pos].get(fixed.word[q])||[];
   if(narrow===null||list.length<narrow.length)narrow=list;
  }
  const arr=narrow||domains[id],out=[];
  for(const item of arr){if(fits(id,item))out.push(item);if(out.length>=stopAfter)break;}
  return out;
 }
 function dfs(depth){
  if(depth>bestDepth)bestDepth=depth;
  if(depth===slots.length)return true;
  if(++nodes%128===0&&(Date.now()-start>limitMs||nodes>limitNodes)){stop=true;return false;}
  let chosen=-1,candidates=null;
  for(const slot of slots){
   if(assigned[slot.id])continue;
   const opt=options(slot.id,candidates?candidates.length:Infinity);
   if(!opt.length)return false;
   if(chosen<0||opt.length<candidates.length){
    chosen=slot.id;candidates=opt;
    if(opt.length===1)break;
   }
  }
  const id=chosen;
  // Favor frequent cross-compatible characters; vary tie-breaks with seed.
  if(candidates.length>1){
   candidates.sort((a,b)=>{
    let sa=0,sb=0;
    for(const [p,other,q] of slots[id].cross){
     if(assigned[other])continue;
     sa+=(index[other][q].get(a.word[p])||[]).length;
     sb+=(index[other][q].get(b.word[p])||[]).length;
    }
    if(sa!==sb)return sb-sa;
    return ((a.word.charCodeAt(0)+seed)%103)-((b.word.charCodeAt(0)+seed)%103);
   });
  }
  for(const entry of candidates){
   assigned[id]=entry;used.add(entry.word);
   let viable=true;
   for(const [p,other,q] of slots[id].cross){
    if(!assigned[other]&&!options(other,1).length){viable=false;break;}
   }
   if(viable&&dfs(depth+1))return true;
   assigned[id]=null;used.delete(entry.word);
   if(stop)return false;
  }
  return false;
 }
 const success=dfs(0),base={slotCount:slots.length,bestDepth,nodes,elapsedMs:Date.now()-start};
 if(!success)return {status:stop?'budget-exhausted':'inconsistent',...base};
 const n=mask.length,grid=mask.map(row=>row.map(v=>v?'':''));
 const clues={horizontal:{},vertical:{}};
 for(const slot of slots){
  const entry=assigned[slot.id],key=String(slot.group);
  slot.cells.forEach(([r,c],i)=>{grid[r][c]=entry.word[i];});
  (clues[slot.dir][key]??=[]).push(entry.clue);
 }
 if(grid.some((row,r)=>row.some((value,c)=>!mask[r][c]&&!value)))return {status:'invalid-output',...base};
 return {status:'solved',...base,puzzle:{version:3,grid,clues,meta:{
  title:'جدول کلاسیک ۱۵×۱۵',status:'draft',size:{rows:n,cols:n},direction:'rtl',language:'fa',method:'classic-csp-v3'}},mask};
}
function tryMasks(masks,entries,opts={}){
 const budget=opts.totalMs||12000,start=Date.now(),reports=[];
 for(let i=0;i<masks.length;i++){
  const remaining=budget-(Date.now()-start);if(remaining<=0)break;
  const r=solve(masks[i],entries,{limitMs:Math.min(4000,remaining),limitNodes:100000,seed:(opts.seed||0)+i});
  reports.push({status:r.status,slotCount:r.slotCount,bestDepth:r.bestDepth,nodes:r.nodes,
                missingLengths:r.missingLengths||[],elapsedMs:r.elapsedMs||0});
  if(r.status==='solved')return {status:'solved',result:r,reports};
 }
 return {status:'unsolved',reports};
}
root.JadvalWorkerEngine={solve,tryMasks,slotsFor};
if(typeof root.addEventListener==='function'&&typeof root.postMessage==='function'){
 root.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.action!=='solve')return;
  try{root.postMessage({id:data.id,...tryMasks(data.masks||[],data.entries||[],data.options||{})});}
  catch(err){root.postMessage({id:data.id,status:'error',message:String(err.message||err)});}
 });
}
})(typeof self!=='undefined'?self:globalThis);
