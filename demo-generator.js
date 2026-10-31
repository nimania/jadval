/* Jadval Studio: browser-only prototype generator. No bank content leaves the browser. */
(function(){
'use strict';
const demo=[
['پایتخت ایران','تهران'],['پایتخت فرانسه','پاریس'],['سیاره سرخ','مریخ'],['واحد پول ژاپن','ین'],['شاعر شاهنامه','فردوسی'],
['دریای شمال ایران','خزر'],['پایتخت ایتالیا','رم'],['مرکز فارس','شیراز'],['ساز زهی ایرانی','تار'],['رنگ آسمان صاف','آبی'],
['نام دیگر خورشید','آفتاب'],['پرنده نامه رسان','کبوتر'],['زبان رسمی برزیل','پرتغالی'],['شهر برج ایفل','پاریس'],
['نخستین ماه خورشیدی','فروردین'],['نام بزرگترین اقیانوس','آرام'],['رنگ ترکیب آبی و زرد','سبز'],
['نمایش نوشته روی کاغذ','چاپ'],['آب جاری طبیعی','رود'],['مجموعه ستارگان','کهکشان'],
['زمین کشاورزی درختی','باغ'],['معادل فارسی ماه','قمر'],['گره طناب','بند'],['گیاه خوشبو','ریحان'],
['گوشه ای از خانه','اتاق'],['ماده اصلی نان','آرد'],['وسیله نوشتن','قلم'],['خاک نرم بیابان','شن']
].map(([clue,answer],id)=>({id:'demo-'+id,clue,answer,reviewed:true,category:'عمومی',difficulty:'easy'}));
const fa=/^[آاأإبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
const chars=w=>[...w];
const normal=w=>String(w??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670\u200c\u200d\s\-ـ]/g,'').trim();
let last=null,attempts=0;
function seeded(seed){let a=(seed>>>0)||2026;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};}
function shuffled(a,rng){const out=a.slice();for(let i=out.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out;}
function eligible(source,size,verifiedOnly){
 const unique=new Set(),out=[];
 for(const e of source){
  const w=normal(e.answer),clue=String(e.clue||'').trim();
  if(w.length<2||w.length>Math.min(size-2,13)||!fa.test(w)||clue.length<3||clue.length>170||(verifiedOnly&&!e.reviewed)||unique.has(w))continue;
  unique.add(w);out.push({...e,word:w,letters:chars(w)});
 }
 return out;
}
function tryPlace(grid,ownership,word,row,col,dr,dc,needCross){
 const size=grid.length,n=word.length;
 const before=[row-dr,col-dc],after=[row+dr*n,col+dc*n];
 const inside=(r,c)=>r>=0&&r<size&&c>=0&&c<size;
 if(!inside(row,col)||!inside(row+dr*(n-1),col+dc*(n-1)))return -1;
 if(inside(...before)&&grid[before[0]][before[1]])return -1;
 if(inside(...after)&&grid[after[0]][after[1]])return -1;
 let crossings=0;
 for(let i=0;i<n;i++){
  const r=row+i*dr,c=col+i*dc,existing=grid[r][c];
  if(existing){
   if(existing!==word[i]||ownership[r][c].has(dr?'v':'h'))return -1;
   crossings++;
  }else{
   const sides=dr?[[r,c-1],[r,c+1]]:[[r-1,c],[r+1,c]];
   for(const [rr,cc] of sides)if(inside(rr,cc)&&grid[rr][cc])return -1;
  }
 }
 if(needCross&&crossings===0)return -1;
 return crossings;
}
function generate(source,size,seed){
 const rng=seeded(seed);
 const candidates=shuffled(eligible(source,size,false),rng);
 // Start with longer answers. Thereafter cross them with short and mid-length entries.
 const ranked=candidates.sort((a,b)=>Math.min(0,b.letters.length-5)-Math.min(0,a.letters.length-5));
 const grid=Array.from({length:size},()=>Array(size).fill(''));
 const owners=Array.from({length:size},()=>Array.from({length:size},()=>new Set()));
 const placed=[],used=new Set();
 function put(entry,r,c,dr,dc){
  entry.letters.forEach((ch,i)=>{const y=r+dr*i,x=c+dc*i;grid[y][x]=ch;owners[y][x].add(dr?'v':'h')});
  placed.push({clue:entry.clue,answer:entry.word,row:r,col:c,dr,dc,entryId:entry.id||null});
  used.add(entry.word);
 }
 const first=ranked.find(x=>x.letters.length>=Math.min(5,size-2))||ranked[0];
 if(!first)return null;
 put(first,Math.floor(size/2),Math.min(size-1,Math.floor((size+first.letters.length-1)/2)),0,-1);
 const next=shuffled(candidates.filter(x=>x!==first),rng).sort((a,b)=>Math.abs(a.word.length-5)-Math.abs(b.word.length-5));
 let rounds=0,progress=true;
 while(progress&&rounds++<3&&placed.length<Math.floor(size*2.3)){
  progress=false;
  for(const e of next){
   if(used.has(e.word))continue;
   const opts=[];
   for(const p of placed){
    const dr=p.dc?1:0,dc=p.dc?0:-1;
    const old=chars(p.answer);
    for(let i=0;i<e.letters.length;i++)for(let j=0;j<old.length;j++){
     if(e.letters[i]!==old[j])continue;
     const y=p.row+p.dr*j-i*dr, x=p.col+p.dc*j-i*dc;
     const cross=tryPlace(grid,owners,e.letters,y,x,dr,dc,true);
     if(cross<1)continue;
     opts.push({y,x,dr,dc,score:cross*30-Math.abs(y-size/2)*.3-Math.abs(x-size/2)*.3+rng()});
    }
   }
   if(!opts.length)continue;
   opts.sort((a,b)=>b.score-a.score);
   const best=opts[0];
   put(e,best.y,best.x,best.dr,best.dc);
   progress=true;
   if(placed.length>=Math.floor(size*2.3))break;
  }
 }
 const groups={horizontal:{},vertical:{}};
 for(const p of placed){
  const key=p.dc?'horizontal':'vertical';
  const num=String(p.dc?p.row+1:size-p.col);
  (groups[key][num]??=[]).push(p);
 }
 for(const [num,arr] of Object.entries(groups.horizontal))arr.sort((a,b)=>b.col-a.col);
 for(const [num,arr] of Object.entries(groups.vertical))arr.sort((a,b)=>a.row-b.row);
 const clues={horizontal:{},vertical:{}};
 for(const dir of ['horizontal','vertical'])for(const [num,arr] of Object.entries(groups[dir]))clues[dir][num]=arr.map(p=>p.clue);
 // A draft can only be used for publication after human review.
 const puzzle={version:3,grid,clues,meta:{id:'draft-'+seed,title:'پیش نویس جدول '+size+'×'+size,language:'fa',direction:'rtl',size:{rows:size,cols:size},status:'draft'}};
 return {puzzle,placed,usedSource:source===demo?'demo':'bank'};
}
function download(name,obj){
 const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function render(result){
 const section=document.getElementById('demoResult'),gridBox=document.getElementById('demoGrid'),clueBox=document.getElementById('demoClues');
 if(!result){section.hidden=false;gridBox.replaceChildren();clueBox.textContent='با واژه‌های موجود جدول قابل ساخت نبود. اندازه یا فیلتر را تغییر بده.';return;}
 last=result;const {puzzle,placed,usedSource}=result; const grid=puzzle.grid;
 section.hidden=false;gridBox.replaceChildren();
 gridBox.style.gridTemplateColumns='repeat('+grid.length+',minmax(0,1fr))';
 gridBox.setAttribute('aria-label','پیش نمایش جدول نمونه');
 for(let r=0;r<grid.length;r++)for(let c=grid.length-1;c>=0;c--){
  const cell=document.createElement('div');cell.className=grid[r][c]?'demo-cell':'demo-cell demo-block';
  if(grid[r][c]){cell.dataset.letter=grid[r][c];cell.textContent=document.getElementById('showAnswers').checked?grid[r][c]:'';}
  gridBox.appendChild(cell);
 }
 clueBox.replaceChildren();
 for(const [dir,label] of [['horizontal','افقی'],['vertical','عمودی']]){
  const div=document.createElement('div');const h=document.createElement('h3');h.textContent=label;div.appendChild(h);
  const ul=document.createElement('ul');ul.className='demo-questions';
  for(const [num,list] of Object.entries(puzzle.clues[dir]).sort((a,b)=>Number(a[0])-Number(b[0]))){
   for(let i=0;i<list.length;i++){const li=document.createElement('li');li.textContent=num+(list.length>1?' ('+(i+1)+')':'')+' — '+list[i];ul.appendChild(li);}
  }
  div.appendChild(ul);clueBox.appendChild(div);
 }
 document.getElementById('demoMeta').textContent=
   placed.length+' پاسخ در جدول '+grid.length+'×'+grid.length+' قرار گرفت — '+(usedSource==='demo'?'دادهٔ آزمایشی داخلی':'بانک خودت')+' — پیش نویس، نیازمند بازبینی.';
 section.scrollIntoView({behavior:'smooth',block:'start'});
}
function populate(){
 const box=document.getElementById('demoFilter'),value=box.value;
 const all=[...new Set((typeof entries!=='undefined'?entries:[]).map(x=>x.category||'دسته‌بندی‌نشده'))];
 box.replaceChildren(new Option('همه موضوع‌ها',''),...all.map(x=>new Option(x,x)));
 box.value=all.includes(value)?value:'';
}
function init(){
 const button=document.getElementById('buildDemo'); if(!button)return;
 document.getElementById('showAnswers').onchange=()=>{document.querySelectorAll('.demo-cell[data-letter]').forEach(x=>x.textContent=document.getElementById('showAnswers').checked?x.dataset.letter:'')};
 document.getElementById('downloadDemo').onclick=()=>{if(last)download('jadval-draft-'+Date.now()+'.json',last.puzzle)};
 button.onclick=()=>{
  const size=Number(document.getElementById('demoSize').value),cat=document.getElementById('demoFilter').value;
  const bank=typeof entries!=='undefined'&&entries.length?entries:demo;
  const source=cat?bank.filter(x=>(x.category||'دسته‌بندی‌نشده')===cat):bank;
  const eligibleEntries=eligible(source,size,false);
  if(eligibleEntries.length<3){document.getElementById('demoNote').textContent='برای این فیلتر واژهٔ مناسب کافی وجود ندارد. موضوع «همه» را انتخاب کن.';return;}
  attempts++;let best=null;
  for(let k=0;k<3;k++){const trial=generate(eligibleEntries,size,Date.now()+attempts*17+k);if(trial&&(!best||trial.placed.length>best.placed.length))best=trial;}
  render(best);document.getElementById('demoNote').textContent='این جدول از تقاطع حرفی واژه‌ها ساخته شده، اما هنوز جدول روزنامه‌ای کامل نیست و سؤال‌ها نیازمند تأیید انسانی‌اند.';
 };
 // Re-read topic choices after importing the current browser bank.
 const input=document.getElementById('file');if(input)input.addEventListener('change',()=>setTimeout(populate,700));
 populate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.JadvalDemo={generate,eligible,tryPlace}; // testing surface; does not expose browser database.
})();
