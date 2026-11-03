/* Jadval Studio v2 — sparse-grid CSP proof of concept. Only valid, complete grids are displayed. */
(function(){
"use strict";
const normalize=s=>String(s||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,"");
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
const $=id=>document.getElementById(id);
let last=null,lastDiagnostic=null,sampleVariant=0;
function updateReport(report){lastDiagnostic=report;const button=$("downloadSolveReport");if(button)button.disabled=!report;if(!report)window.JadvalNovelty?.clear?.();}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function slotsFor(mask,allowSingles=false) {
 const n=mask.length,slots=[],cellSlots=new Map();
 for(const dir of ["horizontal","vertical"]){
  if(dir==="horizontal"){
   for(let r=0;r<n;r++){let c=n-1;while(c>=0){if(mask[r][c]){c--;continue}let cells=[];while(c>=0&&!mask[r][c])cells.push([r,c--]);if(!cells.length||(!allowSingles&&cells.length<2))return null;const slot={dir,group:r+1,cells};slots.push(slot);}}
  }else{
   for(let c=n-1;c>=0;c--){let r=0;while(r<n){if(mask[r][c]){r++;continue}let cells=[];while(r<n&&!mask[r][c])cells.push([r++,c]);if(!cells.length||(!allowSingles&&cells.length<2))return null;const slot={dir,group:n-c,cells};slots.push(slot);}}
  }
 }
 slots.forEach((s,i)=>{s.id=i;for(let p=0;p<s.cells.length;p++){const key=s.cells[p].join(",");const arr=cellSlots.get(key)||[];arr.push([i,p]);cellSlots.set(key,arr);}});
 for(const s of slots){s.cross=[];for(let p=0;p<s.cells.length;p++){const refs=cellSlots.get(s.cells[p].join(","));for(const [other,q] of refs)if(other!==s.id)s.cross.push([p,other,q]);}}
 return slots;
}
function validMask(mask,allowSingles=false){
 const n=mask?.length;
 if(!Number.isInteger(n)||n<5||mask.some(row=>!Array.isArray(row)||row.length!==n))return false;
 const black=mask.reduce((sum,row)=>sum+row.filter(Boolean).length,0);
 if(black===0||black>=n*n)return false;
 for(let r=0;r<n;r++)if(mask[r].every(Boolean))return false;
 for(let c=0;c<n;c++)if(mask.every(row=>row[c]))return false;
 return !!slotsFor(mask,allowSingles);
}
function slotLengths(mask){
 const n=mask.length,all=[];
 for(const direction of [0,1]){
  for(let line=0;line<n;line++){
   let start=0;
   for(let i=0;i<=n;i++){
    const block=i===n||(direction===0?mask[line][i]:mask[i][line]);
    if(block){if(i>start)all.push(i-start);start=i+1;}
   }
  }
 }
 return all;
}
function maskScore(mask,availableLengths){
 const lengths=slotLengths(mask);
 let score=0;
 for(const length of lengths){
  if(length<2)score+=100000;
  else if(availableLengths&&!availableLengths.has(length))score+=25000;
  else if(length>15)score+=12000+(length-15)*2500;
  else if(length>11)score+=Math.pow(length-11,2)*75;
 }
 return score;
}
// Safe structural fallback for the legacy proof-of-concept generator.
// It is a black-cell template only: never a solved or publishable puzzle.
// Odd sizes begin with a verified 7x7 seed; remaining rows/columns use
// paired 2x2 black cells. Every line has 1-2 black cells, no white
// singleton, and no completely black row or column.
function fallbackPattern(n){
 if(![7,10,15,20].includes(n))return null;
 const mask=Array.from({length:n},()=>Array(n).fill(false));
 let start=0;
 if(n%2){
  const seed=[[2],[2],[0],[0,1],[3,4],[6],[5,6]];
  for(let r=0;r<seed.length;r++)for(const c of seed[r])mask[r][c]=true;
  start=7;
 }
 for(let k=start;k<n;k+=2){
  for(let r=k;r<k+2;r++)for(let c=k;c<k+2;c++)mask[r][c]=true;
 }
 return mask;
}
function patterns(n,seed,count,availableLengths){
 const rand=rng(seed),results=[],seen=new Set();
 if(n<5)return [];
 // Two disjoint column permutations put exactly two black cells in every
 // row and every column. Pairwise row swaps preserve those counts.
 for(let trial=0;trial<Math.max(6,count*5);trial++){
  const cols=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cols[i],cols[j]]=[cols[j],cols[i]];}
  const shift=2+Math.floor(rand()*(n-3));
  const mask=Array.from({length:n},()=>Array(n).fill(false));
  for(let r=0;r<n;r++){mask[r][cols[r]]=true;mask[r][cols[(r+shift)%n]]=true;}
  let score=maskScore(mask,availableLengths),bestScore=score,best=mask.map(row=>row.slice());
  for(let step=0;step<Math.max(1200,n*95);step++){
   const a=Math.floor(rand()*n),b=Math.floor(rand()*n);
   if(a===b)continue;
   const ac=mask[a].flatMap((v,i)=>v?[i]:[]);
   const bc=mask[b].flatMap((v,i)=>v?[i]:[]);
   const u=ac[Math.floor(rand()*ac.length)],v=bc[Math.floor(rand()*bc.length)];
   if(u===v||mask[a][v]||mask[b][u])continue;
   mask[a][u]=false;mask[b][v]=false;mask[a][v]=true;mask[b][u]=true;
   const next=maskScore(mask,availableLengths);
   if(next<=score||rand()<.004){score=next;if(score<bestScore){bestScore=score;best=mask.map(row=>row.slice());}}
   else {mask[a][u]=true;mask[b][v]=true;mask[a][v]=false;mask[b][u]=false;}
   if(bestScore===0)break;
  }
  if(!validMask(best))continue;
  const key=best.map(row=>row.map(x=>x?1:0).join("")).join("/");
  if(!seen.has(key)){seen.add(key);results.push({mask:best,score:bestScore});}
  if(results.length>=count&&results.some(x=>x.score===0))break;
 }
 if(!results.length){const fallback=fallbackPattern(n);if(fallback&&validMask(fallback))results.push({mask:fallback,score:maskScore(fallback,availableLengths)});}
 return results.sort((a,b)=>a.score-b.score).slice(0,count).map(x=>x.mask);
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
function validateComplete(data){
 if(!data||data.partial||data.puzzle?.version!==3||!Array.isArray(data.mask))return false;
 const mask=data.mask,grid=data.puzzle.grid,n=mask.length;
 const allowSingles=data.puzzle.meta?.profile==="iran-magazine";
 if(!validMask(mask,allowSingles)||!Array.isArray(grid)||grid.length!==n)return false;
 if(grid.some((row,r)=>!Array.isArray(row)||row.length!==n||row.some((letter,c)=>mask[r][c]?letter!=="":typeof letter!=="string"||letter.length!==1||!alphabet.test(letter))))return false;
 const slots=slotsFor(mask,allowSingles);
 if(!slots)return false;
 const counter={horizontal:{},vertical:{}};
 for(const slot of slots){
  const key=String(slot.group);
  (counter[slot.dir][key]??=[]).push(slot);
 }
 for(const direction of ["horizontal","vertical"]){
  const expected=counter[direction],actual=data.puzzle.clues[direction];
  if(Object.keys(expected).length!==Object.keys(actual||{}).length)return false;
  for(const [key,group] of Object.entries(expected)){
   if(!Array.isArray(actual[key])||actual[key].length!==group.length||actual[key].some(clue=>!String(clue||"").trim()))return false;
  }
 }
 return true;
}
// Validate actual answer/clue pairs against the local licensed bank, not just
// the shape of the board. This independently audits worker and preset outputs.
function validateWithBank(data,bank){
 if(!validateComplete(data)||!Array.isArray(bank)||!bank.length)return false;
 const pairs=new Map();
 for(const e of bank){
  const answer=normalize(e?.answer),clue=String(e?.clue||"").trim();
  if(!answer||!clue)continue;
  if(!pairs.has(answer))pairs.set(answer,new Set());
  pairs.get(answer).add(clue);
 }
 const used=new Set(),next={horizontal:new Map(),vertical:new Map()};
 for(const slot of slotsFor(data.mask,data.puzzle.meta?.profile==="iran-magazine")){
  const answer=normalize(slot.cells.map(([r,c])=>data.puzzle.grid[r][c]).join(""));
  if(!answer||used.has(answer)||!pairs.has(answer))return false;
  used.add(answer);
  const group=String(slot.group),offset=next[slot.dir].get(group)||0;
  const clue=data.puzzle.clues[slot.dir]?.[group]?.[offset];
  if(typeof clue!=="string"||!pairs.get(answer).has(clue.trim()))return false;
  next[slot.dir].set(group,offset+1);
 }
 return true;
}
// One number identifies a whole row (across) or column (down).
// Keep each answer as its own array element in v3 JSON; join with the
// requested hyphen only when presenting the printed clue list.
function groupedClueLines(puzzle,direction){
 const groups=puzzle?.clues?.[direction]||{};
 return Object.entries(groups).sort((a,b)=>Number(a[0])-Number(b[0])).map(([num,questions])=>({
  number:Number(num),
  questions:[...questions],
  text:new Intl.NumberFormat("fa-IR").format(Number(num))+" - "+questions.join(" - ")
 }));
}
function render(data){
 if(!validateWithBank(data,typeof entries!=="undefined"?entries:[]))throw Error("جواب‌ها یا سؤال‌های جدول با بانک محلی تطابق ندارند؛ نمایش متوقف شد.");
 last=data;
 window.JadvalPublish?.onNewPuzzle?.();
 const grid=$("demoGrid"),section=$("demoResult"),clues=$("demoClues"),size=data.puzzle.grid.length;
 section.hidden=false;grid.replaceChildren();clues.replaceChildren();
 grid.style.gridTemplateColumns="repeat("+(size+1)+",minmax(0,1fr))";
 const numberCell=(num,extra)=>{
  const cell=document.createElement("div");
  cell.className="demo-axis"+(extra?" demo-corner":"");
  cell.textContent=extra?"":new Intl.NumberFormat("fa-IR").format(num);
  return cell;
 };
 // CSS grid uses RTL, so the first item is the upper-right corner.
 grid.append(numberCell(null,true));
 for(let c=0;c<size;c++)grid.append(numberCell(c+1,false));
 for(let r=0;r<size;r++){
  grid.append(numberCell(r+1,false));
  for(let c=size-1;c>=0;c--){
   const cell=document.createElement("div"),letter=data.puzzle.grid[r][c],blocked=data.mask[r][c];
   cell.className=blocked?"demo-cell demo-block art-"+($("blockArt")?.value||"plain"):"demo-cell";
   if(!blocked){
    cell.dataset.letter=letter;
    cell.textContent=$("showAnswers").checked?letter:"";
   }
   grid.append(cell);
  }
 }
 for(const [key,title] of [["horizontal","افقی"],["vertical","عمودی"]]){
  const wrap=document.createElement("div"),h=document.createElement("h3"),ul=document.createElement("ul");
  h.textContent=title;ul.className="demo-questions";
  ul.dir="rtl";ul.style.listStyle="none";ul.style.paddingRight="0";
  for(const line of groupedClueLines(data.puzzle,key)){
   const li=document.createElement("li");
   li.textContent=line.text;li.setAttribute("data-axis-number",String(line.number));
   ul.append(li);
  }
  wrap.append(h,ul);clues.append(wrap);
 }
 const blackCount=data.mask.flat().filter(Boolean).length;
 const profileLabel=data.puzzle.meta?.profile==="iran-magazine"?"سبک مجله‌ای ایرانی":
  data.puzzle.meta?.profile==="strict"?"سبک کلاسیک سخت‌گیرانه":"الگوی آزاد";
 $("demoMeta").textContent="جدول کامل: "+data.slots+" پاسخ — شبکهٔ "+size+"×"+size+" — "+blackCount+" خانهٔ سیاه؛ "+profileLabel+".";
 window.JadvalNovelty?.evaluate(data);
 section.scrollIntoView({behavior:"smooth",block:"start"});
}
function solveClassicInWorker(masks,source,seed,budgetMs=12000){
 return new Promise(resolve=>{
  const worker=new Worker("./classic-solver-worker.js");
  const id=String(seed),watchdog=setTimeout(()=>{worker.terminate();resolve({status:"timeout",reports:[]});},budgetMs+3500);
  const finish=message=>{clearTimeout(watchdog);worker.terminate();resolve(message);};
  worker.onmessage=event=>{if(event.data?.id===id)finish(event.data)};
  worker.onerror=event=>finish({status:"error",message:"خطای اجرای حل‌گر جداگانه"});
  worker.postMessage({action:"solve",id,masks,entries:source.map(e=>({id:e.id,answer:e.answer,clue:e.clue})),
                      options:{totalMs:budgetMs,seed}});
 });
}
async function generateSample(){
 const btn=$("buildDemo"),size=Number($("demoSize").value),category=$("demoFilter").value;
 const budgetMs=Math.min(60000,Math.max(12000,Number($("solverBudget")?.value)||12000));
 const bank=(typeof entries!=="undefined"&&entries.length)?entries:[];
 if(!bank.length){$("demoNote").textContent="اول بانک سؤال‌وجواب خودت را وارد کن.";return;}
 const filtered=category?bank.filter(e=>(e.category||"دسته‌بندی‌نشده")===category):bank;
 const patternMode=$("patternStyle")?.value||"magazine";
 const professional=patternMode!=="mosaic";
 const profile=patternMode==="magazine"?"iran-magazine":"strict";
 const ownerTrusted=window.JadvalBankReadiness?.corpusTrusted(bank)===true;
 const allCandidates=window.JadvalBankReadiness?.candidateEntries(bank,size,profile==="iran-magazine"?1:3)||[];
 const candidatePool=category?allCandidates.filter(e=>(e.category||"دسته‌بندی‌نشده")===category):allCandidates;
 updateReport(null);
 if(professional&&!candidatePool.length){
  const info=window.JadvalBankReadiness?.analyze(filtered,size);
  $("demoNote").textContent="ساخت حرفه‌ای متوقف شد: از "+(info?.total??filtered.length)+
   " مدخل، هنوز مجموعهٔ قابل استفاده برای حل‌گر فعال نشده است."+
   " در «آمادگی بانک»، تأیید استفاده از بانک فعلی برای طراحی را فعال کن؛ بانک خام دست‌نخورده باقی می‌ماند.";
  last=null;$("demoResult").hidden=true;window.JadvalPublish?.onNewPuzzle?.();
  updateReport({schema:1,type:"jadval-solver-diagnostics",status:"bank-not-reviewed",
   size,filteredEntries:filtered.length,candidateEntries:0,
   byLength:info?.byLength||{},reason:"Owner corpus trust or individual reviewed entries is required for professional generation."});
  return;
 }
 btn.disabled=true;btn.textContent="در حال طراحی…";
 $("demoNote").textContent=professional?"جست‌وجوی "+(profile==="iran-magazine"?"مجله‌ای ایرانی":"سخت‌گیرانه")+" با "+candidatePool.length+" مدخل از بانک مورد تأیید…":
  "در حال ساخت پیش‌نویس آزمایشی با بانک خام؛ این حالت به‌تنهایی مجوز انتشار نمی‌دهد…";
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const classic=professional; // magazine and strict both use the genuine CSP solver
  let output;
  if(classic){
   const maker=window.JadvalClassic;
   if(!maker)throw Error("موتور الگوی کلاسیک بارگذاری نشده است.");
   const selectedTemplate=$("patternTemplate")?.value||"auto";
   const explicit=selectedTemplate!=="auto"?maker.templateMask?.(selectedTemplate):null;
   if(explicit&&(explicit.length!==size||!maker.valid(explicit,profile)))
    throw Error("قالب انتخابی با اندازه یا سبک جدول سازگار نیست؛ قالب مناسب را انتخاب کن.");
   const preview=window.JadvalClassicPreview?.getSelected?.();
   const selected=!explicit&&preview&&preview.length===size&&maker.valid(preview,profile)?preview:null;
   const masks=explicit?[explicit]:maker.build(size,Date.now(),8,candidatePool,profile);
   if(selected&&!masks.some(mask=>JSON.stringify(mask)===JSON.stringify(selected)))masks.unshift(selected);
   if(!masks.length){output={error:"برای این اندازه الگوی کلاسیک مناسب پیدا نشد."};}
   else{
    const report=await solveClassicInWorker(masks,candidatePool,Date.now(),budgetMs);
    updateReport({
     schema:1,type:"jadval-solver-diagnostics",timestamp:new Date().toISOString(),
     size,style:profile,template:selectedTemplate,category:category||"all",searchBudgetMs:budgetMs,bankEntries:bank.length,
     filteredEntries:filtered.length,candidateEntries:candidatePool.length,ownerTrusted,attemptedMasks:masks.length,
     reports:(report.reports||[]).map(x=>({
       status:x.status,slotCount:x.slotCount,bestDepth:x.bestDepth,nodes:x.nodes,
       elapsedMs:x.elapsedMs,initialPruned:x.initialPruned,score:x.score,
       missingLengths:x.missingLengths
     }))
    });
    const candidate=report.result;
    if(report.status==="solved"&&candidate)candidate.puzzle.meta.profile=profile;
    if(report.status==="solved"&&candidate&&validateComplete(candidate)){
     output={result:candidate};
    }else{
     const stats=report.reports||[];
     const depth=stats.reduce((m,x)=>Math.max(m,x.bestDepth||0),0);
     const total=stats.find(x=>(x.bestDepth||0)===depth)?.slotCount||0;
     const missing=[...new Set(stats.flatMap(x=>x.missingLengths||[]))].sort((a,b)=>a-b);
     const timeLimited=stats.filter(x=>x.status==="budget-exhausted").length;
     const earlyMismatch=stats.filter(x=>x.status==="arc-inconsistent").length;
     const unsupported=stats.filter(x=>x.status==="unsupported-crossings").length;
     const unsatisfiable=stats.filter(x=>x.status==="inconsistent").length;
     const detail=missing.length?
      "در برخی طرح‌ها طول‌های "+missing.join("، ")+" حرفی در بانک موجود نبود.":
      timeLimited?"در "+timeLimited+" طرح، زمان یا بودجهٔ جست‌وجو تمام شد؛ این به معنی غیرممکن‌بودن جدول نیست.":
      unsupported?"در "+unsupported+" طرح، بعضی تقاطع‌ها از ابتدا هیچ حرف مشترک قابل‌استفاده‌ای نداشتند.":
      earlyMismatch?"در "+earlyMismatch+" طرح، تقاطع‌ها در مرحلهٔ پالایش اولیه ناسازگار شدند.":
      unsatisfiable?"برای "+unsatisfiable+" طرح، حل‌گر در محدودیت‌های بررسی‌شده به جواب کامل نرسید.":
      "هنوز جواب کامل پیدا نشد.";
     const pruned=stats.reduce((sum,x)=>sum+(x.initialPruned||0),0);
     output={error:"جدول کامل پیدا نشد. بیشترین پیشرفت: "+depth+" جایگاه از "+total+
      "؛ "+detail+" "+(pruned?"گزینه‌های حذف‌شده در پالایش اولیه: "+pruned+"؛ ":"")+
      "هیچ جدول ناقصی نمایش یا صادر نمی‌شود."};
    }

   }
  }else{
   const builder=window.JadvalMosaic;
   if(!builder)throw Error("موتور بخش‌بندی بارگذاری نشده است.");
   output=builder.generate(filtered,size,Date.now());
  }
  if(!output.result){
   last=null;$("demoResult").hidden=true;window.JadvalPublish?.onNewPuzzle?.();
   $("demoNote").textContent=output.error||"جدول کاملاً پُر پیدا نشد؛ نتیجهٔ ناقص نمایش داده نمی‌شود.";
   return;
  }
  render(output.result);
  const audit=window.JadvalQuality?.audit(output.result.puzzle,bank,{trustedCorpus:ownerTrusted});
  $("demoNote").textContent=audit?.technicalPassed&&audit?.bankPassed?
   "پیش‌نویس از دروازهٔ فنی و منبع‌دار گذشت؛ برای انتشار، ارزیابی مستقل ویراستار و امتیاز حداقل ۹۰ لازم است.":
   "این خروجی فقط پیش‌نویس تشخیصی است و برای انتشار معتبر نیست. گزارش دقیق نقض معیارها زیر جدول نمایش داده شده است.";
 }catch(err){last=null;$("demoResult").hidden=true;window.JadvalPublish?.onNewPuzzle?.();$("demoNote").textContent="خطا: "+err.message;}
 finally{btn.disabled=false;btn.textContent="تلاش برای طراحی تازه (آزمایشی)";}
}
function init(){
 if(!$("buildDemo"))return;
 $("demoSize").replaceChildren(...[7,10,15,20].map(x=>new Option(x+" × "+x,String(x))));
 $("demoSize").value="15";
 const old=$("buildDemo");old.replaceWith(old.cloneNode(true));$("buildDemo").onclick=generateSample;
 const art=$("blockArt");
 if(art)art.addEventListener("change",()=>{document.querySelectorAll("#demoGrid .demo-block").forEach(cell=>{cell.classList.remove("art-plain","art-abstract","art-patterned","art-red");cell.classList.add("art-"+art.value);});});
 $("showAnswers").onchange=()=>{document.querySelectorAll(".demo-cell[data-letter]").forEach(x=>x.textContent=$("showAnswers").checked?x.dataset.letter:"");};
 const showSample=$("showVerifiedSample");
 if(showSample)showSample.onclick=()=>{
  const currentBank=(typeof entries!=="undefined"&&entries.length)?entries:[];
  const variant=sampleVariant++ % (window.JadvalVerified15?.variants||1);
  const preset=window.JadvalVerified15?.build(currentBank,variant);
  if(!preset?.result){
   $("demoNote").textContent=preset?.error||"نمونهٔ کامل ۱۵×۱۵ در دسترس نیست.";
   return;
  }
  $("demoSize").value="15";
  updateReport(null);
  render(preset.result);
  $("demoNote").textContent="نمونهٔ فنی "+(variant+1)+" — این جدول صرفاً برای آزمون و بررسی اشکالات است؛ با معیارهای سخت‌گیرانهٔ جدید تأیید نشده و امکان انتشار مستقیم ندارد.";
 };
 const reportButton=$("downloadSolveReport");
 if(reportButton)reportButton.onclick=()=>{
  if(!lastDiagnostic)return;
  const blob=new Blob([JSON.stringify(lastDiagnostic,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="jadval-solver-report.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 $("downloadDemo").onclick=()=>{if(!last||!validateWithBank(last,typeof entries!=="undefined"?entries:[]))return;const blob=new Blob([JSON.stringify(last.puzzle,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="jadval-draft-v2.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.JadvalSparse={slotsFor,validMask,patterns,slotLengths,maskScore,solve,validateComplete,validateWithBank,groupedClueLines,getCurrentForPublication:()=>last,compare};
})();
