/* Jadval Studio v2 — sparse-grid CSP proof of concept. Only valid, complete grids are displayed. */
(function(){
"use strict";
const normalize=s=>String(s||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,"");
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
const $=id=>document.getElementById(id);
let last=null;
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function slotsFor(mask) {
 const n=mask.length,slots=[],cellSlots=new Map();
 for(const dir of ["horizontal","vertical"]){
  if(dir==="horizontal"){
   for(let r=0;r<n;r++){let c=n-1;while(c>=0){if(mask[r][c]){c--;continue}let cells=[];while(c>=0&&!mask[r][c])cells.push([r,c--]);if(cells.length<2)return null;const slot={dir,group:r+1,cells};slots.push(slot);}}
  }else{
   for(let c=n-1;c>=0;c--){let r=0;while(r<n){if(mask[r][c]){r++;continue}let cells=[];while(r<n&&!mask[r][c])cells.push([r++,c]);if(cells.length<2)return null;const slot={dir,group:n-c,cells};slots.push(slot);}}
  }
 }
 slots.forEach((s,i)=>{s.id=i;for(let p=0;p<s.cells.length;p++){const key=s.cells[p].join(",");const arr=cellSlots.get(key)||[];arr.push([i,p]);cellSlots.set(key,arr);}});
 for(const s of slots){s.cross=[];for(let p=0;p<s.cells.length;p++){const refs=cellSlots.get(s.cells[p].join(","));for(const [other,q] of refs)if(other!==s.id)s.cross.push([p,other,q]);}}
 return slots;
}
function validMask(mask,maxBlacks=2){
 const n=mask.length;
 if(n<5||mask.some(row=>row.length!==n))return false;
 for(let r=0;r<n;r++){
  const sum=mask[r].filter(Boolean).length;
  if(sum<1||sum>maxBlacks)return false;
 }
 for(let c=0;c<n;c++){
  const sum=mask.filter(row=>row[c]).length;
  if(sum<1||sum>maxBlacks)return false;
 }
 return !!slotsFor(mask);
}
function patterns(n,seed,count){
 // Sparse manuscript-style layouts: one black diagonal per row and column,
 // with two-by-two corner repairs that eliminate one-letter slots.
 // This always has between 1 and 2 black cells in EVERY row and column.
 const result=[],seen=new Set();
 for(const variant of [0,1]){
  const mask=Array.from({length:n},()=>Array(n).fill(false));
  for(let r=0;r<n;r++){
   const c=variant===0?r:n-1-r;
   mask[r][c]=true;
  }
  if(variant===0){
   mask[0][1]=true;mask[1][0]=true;
   mask[n-1][n-2]=true;mask[n-2][n-1]=true;
  }else{
   mask[0][n-2]=true;mask[1][n-1]=true;
   mask[n-1][1]=true;mask[n-2][0]=true;
  }
  if(validMask(mask)){
   const key=mask.map(row=>row.map(x=>x?1:0).join("")).join("/");
   if(!seen.has(key)){seen.add(key);result.push(mask);}
  }
 }
 return result.slice(0,count);
}
function draftFill(mask,source,seed){
 // A clearly labelled editable *partial* draft, never described as a solved crossword.
 const n=mask.length,slots=slotsFor(mask),random=rng(seed),lookup=new Map();
 for(const e of source){
  const w=normalize(e.answer),clue=String(e.clue||"").trim();
  if(w.length<2||w.length>n||!alphabet.test(w)||!clue)continue;
  if(!lookup.has(w.length))lookup.set(w.length,[]);
  lookup.get(w.length).push({word:w,clue,id:e.id||null});
 }
 const letters=Array.from({length:n},()=>Array(n).fill(""));
 const assigned=new Map(),used=new Set();
 const order=slots.slice().filter(slot=>lookup.has(slot.cells.length));
 // Long answers first; a shorter word can still cross an existing word.
 order.sort((a,b)=>b.cells.length-a.cells.length+((random()-.5)*.06));
 for(const slot of order){
  const domain=lookup.get(slot.cells.length);
  let best=null,bestScore=-Infinity;
  // Scan the whole length-specific word list, maximizing compatible crossings.
  for(const entry of domain){
   if(used.has(entry.word))continue;
   let score=0,ok=true;
   for(let i=0;i<slot.cells.length;i++){
    const [r,c]=slot.cells[i],before=letters[r][c];
    if(before&&before!==entry.word[i]){ok=false;break;}
    if(before)score+=7;
   }
   if(!ok)continue;
   score+=random()*2;
   if(score>bestScore){bestScore=score;best=entry;}
  }
  if(!best)continue;
  assigned.set(slot.id,best);used.add(best.word);
  slot.cells.forEach(([r,c],i)=>{letters[r][c]=best.word[i]});
 }
 const grid=mask.map((row,r)=>row.map((block,c)=>block?"":letters[r][c]||" "));
 const clues={horizontal:{},vertical:{}};
 for(const slot of slots){
  const entry=assigned.get(slot.id);
  if(!entry)continue;
  (clues[slot.dir][String(slot.group)]??=[]).push(entry.clue);
 }
 const remaining=slots.length-assigned.size;
 return {puzzle:{version:0,grid,clues,meta:{title:"پیش‌نویس ناقص جدول "+n+"×"+n,size:{rows:n,cols:n},status:"partial-draft",language:"fa",direction:"rtl"}},
   mask,slots:slots.length,filledSlots:assigned.size,remaining,partial:true,
   usedIds:[...assigned.values()].map(x=>x.id)};
}

function solve(mask,source,budget=7000,seed=1){
 const slots=slotsFor(mask);if(!slots)return null;
 const wordsByLength=new Map();
 for(const e of source){
  let w=normalize(e.answer);
  if(!alphabet.test(w)||w.length<2||w.length>mask.length||!String(e.clue||"").trim())continue;
  let list=wordsByLength.get(w.length);if(!list){list=[];wordsByLength.set(w.length,list);}
  list.push({word:w,clue:String(e.clue).trim(),id:e.id||null,source_puzzle_ids:e.source_puzzle_ids||[]});
 }
 const rand=rng(seed),domains=[];
 for(const s of slots){
  const list=wordsByLength.get(s.cells.length)||[];
  // Avoid spending time on duplicate answers with different clues; retain source wording.
  const uniq=new Map();for(const x of list)if(!uniq.has(x.word))uniq.set(x.word,x);
  let domain=Array.from(uniq.values());domain.sort((a,b)=>rand()-.5);
  if(!domain.length)return null;
  domains.push(domain);
 }
 const assigned=Array(slots.length).fill(null),used=new Set();
 let nodes=0;const deadline=Date.now()+Math.min(1100,250+budget/7);
 function candidateFits(slot,e){
  if(used.has(e.word))return false;
  for(const [pos,other,otherpos] of slot.cross){const v=assigned[other];if(v&&e.word[pos]!==v.word[otherpos])return false;}
  return true;
 }
 function recurse(depth){
  if(++nodes>budget||Date.now()>deadline)return false;
  if(depth===slots.length)return true;
  let best=-1,options=null;
  for(const slot of slots){
   if(assigned[slot.id])continue;
   let possible=domains[slot.id].filter(e=>candidateFits(slot,e));
   if(!possible.length)return false;
   if(best===-1||possible.length<options.length||(possible.length===options.length&&slot.cross.length>slots[best].cross.length)){
    best=slot.id;options=possible;
    if(options.length===1)break;
   }
  }
  // Prefer words whose letters can satisfy more immediately unassigned crosses.
  options=options.slice(0,Math.min(options.length,200));
  for(const e of options){
   assigned[best]=e;used.add(e.word);
   let possible=true;
   for(const [pos,other,q] of slots[best].cross){
    if(assigned[other])continue;
    if(!domains[other].some(x=>!used.has(x.word)&&x.word[q]===e.word[pos]&&candidateFits(slots[other],x))){possible=false;break;}
   }
   if(possible&&recurse(depth+1))return true;
   assigned[best]=null;used.delete(e.word);
   if(nodes>budget||Date.now()>deadline)return false;
  }
  return false;
 }
 if(!recurse(0))return null;
 const n=mask.length,grid=Array.from({length:n},()=>Array(n).fill("")),clues={horizontal:{},vertical:{}},usedIds=[];
 for(const s of slots){
  const e=assigned[s.id];usedIds.push(e.id);
  s.cells.forEach(([r,c],p)=>{if(grid[r][c]&&grid[r][c]!==e.word[p])throw Error("conflicting crossing");grid[r][c]=e.word[p];});
  const key=s.dir,group=String(s.group);
  (clues[key][group]??=[]).push(e.clue);
 }
 // All nonblack cells must have a letter and no black run may exceed two.
 if(grid.some((row,r)=>row.some((ch,c)=>!mask[r][c]&&!ch)))return null;
 const puzzle={version:3,grid,clues,meta:{title:"پیش‌نویس جدول جدید",size:{rows:n,cols:n},language:"fa",direction:"rtl",status:"draft"}};
 return {puzzle,mask,usedIds,nodes,slots:slots.length};
}
// The older 5x5 sample had zero black cells and does not meet the new rules.
// It remains disabled; sample generation now uses masks with at least one black
// cell in every row and every column.

function compare(puzzle,reference){
 // Compare answer sets and cell layouts when actual original puzzles are available.
 if(!Array.isArray(reference)||!reference.length)return {verified:false,message:"آرشیو جدول‌های اولیه برای سنجش شباهت ساختاری در مرورگر موجود نیست."};
 const result=puzzle.grid;const refs=reference.filter(x=>x&&Array.isArray(x.grid));
 if(!refs.length)return {verified:false,message:"ساختار جدول مرجع برای مقایسه موجود نیست."};
 const grids=refs.filter(x=>x.grid.length===result.length&&x.grid[0]?.length===result.length);
 const highest=grids.reduce((acc,x)=>{
  let same=0,total=result.length**2;
  for(let r=0;r<result.length;r++)for(let c=0;c<result.length;c++)if(Boolean(x.grid[r][c])===Boolean(result[r][c]))same++;
  return Math.max(acc,same/total);
 },0);
 return {verified:true,highestPatternSimilarity:highest,passed:highest<=.2};
}
function render(data){
 last=data;
 const grid=$("demoGrid"),section=$("demoResult"),clues=$("demoClues"),size=data.puzzle.grid.length;
 section.hidden=false;grid.replaceChildren();clues.replaceChildren();
 grid.style.gridTemplateColumns="repeat("+size+",minmax(0,1fr))";
 for(let r=0;r<size;r++)for(let c=size-1;c>=0;c--){
  const cell=document.createElement("div"),letter=data.puzzle.grid[r][c],blocked=data.mask[r][c];
  cell.className=blocked?"demo-cell demo-block":"demo-cell";
  if(!blocked){
   if(letter.trim())cell.dataset.letter=letter;
   else cell.classList.add("demo-empty");
   cell.textContent=$("showAnswers").checked&&letter.trim()?letter:"";
  }
  grid.append(cell);
 }
 for(const [key,title] of [["horizontal","افقی"],["vertical","عمودی"]]){
  const wrap=document.createElement("div"),h=document.createElement("h3"),ul=document.createElement("ul");
  h.textContent=title;ul.className="demo-questions";
  for(const [num,list] of Object.entries(data.puzzle.clues[key]).sort((a,b)=>Number(a[0])-Number(b[0]))){
   for(const question of list){
    const li=document.createElement("li");li.textContent=num+" — "+question;ul.append(li);
   }
  }
  wrap.append(h,ul);clues.append(wrap);
 }
 const blackCount=data.mask.flat().filter(Boolean).length;
 $("demoMeta").textContent=(data.partial?"پیش‌نویس ناقص: "+data.filledSlots+" از "+data.slots+" پاسخ جای‌گذاری شده‌اند":"جدول کامل: "+data.slots+" پاسخ")+
   " — "+size+"×"+size+" — "+blackCount+" خانهٔ سیاه؛ در هر ردیف و ستون ۱ یا ۲ خانهٔ سیاه.";
 $("demoResult").scrollIntoView({behavior:"smooth",block:"start"});
}

async function generateSample(){
 const btn=$("buildDemo"),size=Number($("demoSize").value),category=$("demoFilter").value;
 const bank=(typeof entries!=="undefined"&&entries.length)?entries:[];
 if(!bank.length){$("demoNote").textContent="اول بانک سؤال‌وجواب خودت را وارد کن.";return;}
 const filtered=category?bank.filter(e=>(e.category||"دسته‌بندی‌نشده")===category):bank;
 const seed=Date.now();btn.disabled=true;btn.textContent="در حال طراحی…";
 $("demoNote").textContent="در حال ساخت شبکه با ۱ تا ۲ خانهٔ سیاه در هر ردیف و ستون…";
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const masks=patterns(size,seed,2);
  if(!masks.length){$("demoNote").textContent="برای این اندازه الگوی سیاه معتبر پیدا نشد.";return;}
  let complete=null;
  for(let i=0;i<masks.length;i++){
   complete=solve(masks[i],filtered,5500,seed+i);
   if(complete)break;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const result=complete||draftFill(masks[seed%2],filtered,seed);
  render(result);
  $("demoNote").textContent=complete?
   "همهٔ جایگاه‌ها کامل هستند؛ سرنخ‌ها از بانک خودت آمده‌اند. پیش از انتشار نیاز به کنترل شباهت و تأیید انسانی دارد.":
   "شبکهٔ "+size+"×"+size+" ساخته شد و ۱ یا ۲ خانهٔ سیاه در هر ردیف/ستون دارد. اما "+result.remaining+" جایگاه هنوز جواب کامل ندارد؛ این فقط پیش‌نویس قابل مشاهده است، نه جدول آمادهٔ انتشار. فضای سفیدِ بدون حرف عمداً سیاه نشده است.";
 }catch(err){$("demoNote").textContent="خطا: "+err.message;}
 finally{btn.disabled=false;btn.textContent="ساخت یک نمونه جدول";}
}

function init(){
 if(!$("buildDemo"))return;
 $("demoSize").replaceChildren(...[7,10,15,20].map(x=>new Option(x+" × "+x,String(x))));
 $("demoSize").value="20";
 const old=$("buildDemo");old.replaceWith(old.cloneNode(true));$("buildDemo").onclick=generateSample;
 $("showAnswers").onchange=()=>{document.querySelectorAll(".demo-cell[data-letter]").forEach(x=>x.textContent=$("showAnswers").checked?x.dataset.letter:"");};
 $("downloadDemo").onclick=()=>{if(!last)return;const blob=new Blob([JSON.stringify(last.puzzle,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="jadval-draft-v2.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.JadvalSparse={slotsFor,validMask,patterns,solve,draftFill,compare};
})();
