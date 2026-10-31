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
 const n=mask.length,cols=Array(n).fill(0);
 for(const row of mask){if(row.reduce((a,b)=>a+Number(b),0)>maxBlacks)return false;row.forEach((v,c)=>cols[c]+=Number(v));}
 if(!cols.every(v=>v<=maxBlacks))return false;
 // Keep separate black cells distant from each other in each direction.
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(mask[r][c]){
  for(let d=1;d<=2;d++){
   if(c+d<n&&mask[r][c+d])return false;
   if(r+d<n&&mask[r+d][c])return false;
  }
 }
 return !!slotsFor(mask);
}
function patterns(n,seed,count){
 const random=rng(seed),result=[],keys=new Set();
 // Start with two cyclic diagonals (<= 2 blocks per row and per column).
 // Remove problematic cells instead of adding blocks when one-letter slots appear.
 for(let t=0;t<count*32&&result.length<count;t++){
  let shift=2+Math.floor(random()*(n-3));
  let offset=Math.floor(random()*n);
  const mask=Array.from({length:n},()=>Array(n).fill(false));
  for(let r=0;r<n;r++){
   mask[r][(r+offset)%n]=true;
   mask[r][(r+offset+shift)%n]=true;
  }
  for(let pass=0;pass<n*3;pass++){
   let changed=false;
   for(const vertical of [false,true]){
    for(let line=0;line<n;line++){
     let i=0;
     while(i<n){
      const blocked=j=>vertical?mask[j][line]:mask[line][j];
      if(blocked(i)){i++;continue;}
      const from=i;while(i<n&&!blocked(i))i++;
      if(i-from===1){
       const targets=[from-1,i].filter(j=>j>=0&&j<n&&blocked(j));
       if(targets.length){
        const j=targets[Math.floor(random()*targets.length)];
        if(vertical)mask[j][line]=false;else mask[line][j]=false;
        changed=true;
       }
      }
     }
    }
   }
   if(!changed)break;
  }
  // Remove clustered blacks; never add any new black cells.
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(mask[r][c]){
   if((c>0&&mask[r][c-1])||(c>1&&mask[r][c-2])||
      (r>0&&mask[r-1][c])||(r>1&&mask[r-2][c]))mask[r][c]=false;
  }
  if(!validMask(mask))continue;
  const key=mask.map(row=>row.map(x=>x?1:0).join("")).join("/");
  if(!keys.has(key)){keys.add(key);result.push(mask);}
 }
 return result;
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
 last=data;const grid=$("demoGrid"),section=$("demoResult"),clues=$("demoClues"),size=data.puzzle.grid.length;
 section.hidden=false;grid.replaceChildren();clues.replaceChildren();grid.style.gridTemplateColumns="repeat("+size+",minmax(0,1fr))";
 for(let r=0;r<size;r++)for(let c=size-1;c>=0;c--){
  const cell=document.createElement("div"),letter=data.puzzle.grid[r][c];
  cell.className=letter?"demo-cell":"demo-cell demo-block";cell.dataset.letter=letter;
  cell.textContent=$("showAnswers").checked?letter:"";grid.append(cell);
 }
 for(const [key,title] of [["horizontal","افقی"],["vertical","عمودی"]]){
  const wrap=document.createElement("div"),h=document.createElement("h3"),ul=document.createElement("ul");
  h.textContent=title;ul.className="demo-questions";
  for(const [num,list] of Object.entries(data.puzzle.clues[key]).sort((a,b)=>Number(a[0])-Number(b[0]))){
   for(const question of list){const li=document.createElement("li");li.textContent=num+" — "+question;ul.append(li);}
  }
  wrap.append(h,ul);clues.append(wrap);
 }
 $("demoMeta").textContent=data.slots+" سؤال — شبکهٔ "+size+"×"+size+"، حداکثر دو خانهٔ سیاه در هر ردیف یا ستون؛ خروجی نیازمند بازبینی.";
}
async function generateSample(){
 const btn=$("buildDemo"),size=Number($("demoSize").value),category=$("demoFilter").value;
 const bank=(typeof entries!=="undefined"&&entries.length)?entries:[];
 if(!bank.length){$("demoNote").textContent="ابتدا بانک سؤال‌وجواب را وارد کن؛ نسخهٔ دوم از دادهٔ نمایشی استفاده نمی‌کند.";return;}
 let filtered=category?bank.filter(e=>(e.category||"دسته‌بندی‌نشده")===category):bank;
 const t=Date.now();btn.disabled=true;btn.textContent="در حال جست‌وجو…";
 $("demoNote").textContent="در حال بررسی الگوهای کم‌سیاه و تقاطع همهٔ پاسخ‌ها…";
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const masks=patterns(size,t,8),tries=[];
  for(let i=0;i<masks.length;i++){
   const solved=solve(masks[i],filtered,7500,t+i);
   if(solved)tries.push(solved);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const best=tries[0];
  if(!best){$("demoResult").hidden=true;$("demoNote").textContent="با محدودیت حداکثر دو خانهٔ سیاه در هر ردیف و ستون، در این تلاش جدول کاملاً پُر و معتبر پیدا نشد. می‌توانی دوباره امتحان کنی یا اندازهٔ کوچک‌تر انتخاب کنی. جدول ناقص نمایش داده نمی‌شود.";return;}
  render(best);
  $("demoNote").textContent="این جدول با بانک خودت ساخته شد؛ همهٔ جایگاه‌ها پر هستند. تأیید محتوایی و کنترل شباهت به آرشیو اصلی هنوز لازم است.";
 }catch(err){$("demoNote").textContent="خطای ساخت نمونه: "+err.message;}
 finally{btn.disabled=false;btn.textContent="ساخت یک نمونه جدول";}
}
function init(){
 if(!$("buildDemo"))return;
 $("demoSize").replaceChildren(...[7,10,15].map(x=>new Option(x+" × "+x,String(x))));
 $("demoSize").value="7";
 const old=$("buildDemo");old.replaceWith(old.cloneNode(true));$("buildDemo").onclick=generateSample;
 $("showAnswers").onchange=()=>{document.querySelectorAll(".demo-cell[data-letter]").forEach(x=>x.textContent=$("showAnswers").checked?x.dataset.letter:"");};
 $("downloadDemo").onclick=()=>{if(!last)return;const blob=new Blob([JSON.stringify(last.puzzle,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="jadval-draft-v2.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.JadvalSparse={slotsFor,validMask,patterns,solve,compare};
})();
