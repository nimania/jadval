/* Persian clue-in-cell ("شرح در متن") grid model and publication quality gate.
   Grid uses left-to-right array indices; reading direction is across: left,
   down: down. Clues occupy their own cells, never answer cells. */
(function(root){
'use strict';
const sizes=Object.freeze({
 horizontal:{width:30,height:20,label:'شرح در متن افقی ۳۰×۲۰',minEntries:42},
 vertical:{width:20,height:14,label:'شرح در متن عمودی ۲۰×۱۴',minEntries:20}
});
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]$/;
const normalize=s=>String(s??'').normalize('NFC').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
 .replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,'');
const coord=(r,c)=>r+','+c;
const clone=x=>JSON.parse(JSON.stringify(x));
function inBounds(r,c,size){return Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&c>=0&&r<size.height&&c<size.width;}
function startFor(clueCell,direction){
 if(!Array.isArray(clueCell)||clueCell.length!==2)return null;
 const [r,c]=clueCell;
 return direction==='across'?[r,c-1]:direction==='down'?[r+1,c]:null;
}
function positions(entry){
 const start=startFor(entry.clueCell,entry.direction);
 if(!start)return [];
 return [...normalize(entry.answer)].map((letter,i)=>{
  const row=start[0]+(entry.direction==='down'?i:0);
  const col=start[1]-(entry.direction==='across'?i:0);
  return {row,col,letter};
 });
}
function blank(variant){
 const size=sizes[variant];if(!size)throw Error('اندازهٔ شرح در متن نامعتبر است.');
 return {id:'',type:'clue-in-cell',variant,title:size.label,publishedAt:null,
  puzzle:{version:1,entries:[],blocked:[],grid:Array.from({length:size.height},
   ()=>Array.from({length:size.width},()=>({kind:'empty'}))),
   meta:{status:'draft',method:'editor-draft'}}};
}
function build(item){
 const size=sizes[item?.variant],p=item?.puzzle;
 if(!size||p?.version!==1||!Array.isArray(p.entries)||!Array.isArray(p.blocked))
  throw Error('فایل جدول یا نوع آن معتبر نیست.');
 const grid=Array.from({length:size.height},()=>Array.from({length:size.width},()=>({kind:'empty'})));
 const errors=[],owner=new Map(),idSet=new Set(),pairSet=new Set(),answerSet=new Set();
 const clueRefs=new Map();let across=0,down=0,crossings=0;
 for(const [i,pos] of p.blocked.entries()){
  if(!Array.isArray(pos)||pos.length!==2||!inBounds(pos[0],pos[1],size)){errors.push('خانهٔ سیاه نامعتبر: '+i);continue;}
  const [r,c]=pos;if(grid[r][c].kind!=='empty'){errors.push('خانهٔ سیاه تکراری: '+coord(r,c));continue;}
  grid[r][c]={kind:'block'};
 }
 for(const entry of p.entries){
  if(!entry||typeof entry.id!=='string'||!entry.id||idSet.has(entry.id)){errors.push('شناسهٔ سرنخ تکراری یا نامعتبر');continue;}
  idSet.add(entry.id);
  const word=normalize(entry.answer),clue=String(entry.clue??'').trim();
  if(!clue||clue.length>180||!word||[...word].length<2||[...word].length>30||![...word].every(ch=>alphabet.test(ch))){
   errors.push('پاسخ یا سؤال نامعتبر: '+entry.id);continue;
  }
  if(entry.answer!==word)errors.push('جواب باید بدون فاصله و با ی/ک فارسی باشد: '+entry.id);
  const key=word+'\u0000'+clue;
  if(pairSet.has(key))errors.push('سؤال و جواب تکراری: '+entry.id);
  pairSet.add(key);
  if(answerSet.has(word))errors.push('پاسخ تکراری در جدول: '+word);
  answerSet.add(word);
  if(!['across','down'].includes(entry.direction)||!Array.isArray(entry.clueCell)||
     entry.clueCell.length!==2||!inBounds(entry.clueCell[0],entry.clueCell[1],size)){
   errors.push('جهت یا محل سرنخ نامعتبر: '+entry.id);continue;
  }
  const [r,c]=entry.clueCell,clueKey=coord(r,c);
  if(grid[r][c].kind==='block'){errors.push('سرنخ روی خانهٔ سیاه: '+entry.id);continue;}
  const dirs=clueRefs.get(clueKey)||new Set();
  if(dirs.has(entry.direction))errors.push('جهت سرنخ در همان خانه تکراری است: '+entry.id);
  dirs.add(entry.direction);clueRefs.set(clueKey,dirs);
  if(entry.direction==='across')across++;else down++;
  const start=startFor(entry.clueCell,entry.direction);
  if(entry.start&&(JSON.stringify(entry.start)!==JSON.stringify(start)))
   errors.push('آغاز پاسخ با جهت فلش سازگار نیست: '+entry.id);
  grid[r][c]={kind:'clue',clueIds:[...(grid[r][c].clueIds||[]),entry.id]};
 }
 for(const entry of p.entries){
  if(!idSet.has(entry?.id)||!startFor(entry.clueCell,entry.direction))continue;
  const word=normalize(entry.answer);
  if(!word||![...word].every(ch=>alphabet.test(ch)))continue;
  const ps=positions(entry);
  if(ps.some(({row,col})=>!inBounds(row,col,size))){errors.push('پاسخ از شبکه بیرون می‌رود: '+entry.id);continue;}
  for(const {row,col,letter} of ps){
   const cell=grid[row][col],key=coord(row,col);
   if(cell.kind==='clue'||cell.kind==='block'){
    errors.push('برخورد با سرنخ یا خانهٔ سیاه در '+key+': '+entry.id);continue;
   }
   if(cell.kind==='letter'&&cell.answer!==letter){
    errors.push('ناسازگاری حرف تقاطع '+key+': '+entry.id);continue;
   }
   const directions=owner.get(key)||new Set();
   if(directions.has(entry.direction)){
    errors.push('هم‌پوشانی دو پاسخ هم‌جهت در '+key+': '+entry.id);continue;
   }
   directions.add(entry.direction);owner.set(key,directions);
   grid[row][col]={kind:'letter',answer:letter};
  }
 }
 let letter=0,clue=0,block=0,empty=0;
 for(let r=0;r<size.height;r++)for(let c=0;c<size.width;c++){
  const k=grid[r][c].kind;
  if(k==='letter'){letter++;if(owner.get(coord(r,c))?.size===2)crossings++;}
  else if(k==='clue')clue++;
  else if(k==='block')block++;
  else empty++;
 }
 return {grid,errors,stats:{letter,clue,block,empty,crossings,across,down,entries:p.entries.length,total:size.width*size.height}};
}
function inspect(item){
 const size=sizes[item?.variant],errors=[];
 if(item?.type!=='clue-in-cell'||!size||!item?.puzzle||item.puzzle.version!==1)
  return {valid:false,publishable:false,errors:['نوع جدول یا نسخهٔ فایل معتبر نیست.'],stats:null,grid:null};
 let built;
 try{built=build(item);}catch(err){return {valid:false,publishable:false,errors:[err.message],stats:null,grid:null};}
 errors.push(...built.errors);
 if(!Array.isArray(item.puzzle.grid)||JSON.stringify(item.puzzle.grid)!==JSON.stringify(built.grid))
  errors.push('شبکهٔ ذخیره‌شده با پاسخ‌ها و سرنخ‌های واردشده مطابقت ندارد.');
 const structurallyValid=errors.length===0,stats=built.stats,checks=[];
 if(stats.empty)checks.push(stats.empty+' خانه هنوز تعیین‌تکلیف نشده است.');
 if(stats.entries<size.minEntries)checks.push('تعداد سؤال‌ها برای انتشار حرفه‌ای کافی نیست (حداقل '+size.minEntries+').');
 if(stats.across<6||stats.down<6)checks.push('سؤال‌های افقی و عمودی باید هر دو به تعداد کافی وجود داشته باشند.');
 if(stats.letter<size.width*size.height*.55)checks.push('پوشش پاسخ‌ها کمتر از ۵۵٪ شبکه است.');
 if(stats.block>0)checks.push('در شرح در متن هیچ خانهٔ سیاهِ فاقد سؤال مجاز نیست؛ همهٔ خانه‌ها باید سؤال یا حرف باشند.');
 if(stats.letter&&stats.crossings/stats.letter<.15)checks.push('تقاطع پاسخ‌ها کمتر از ۱۵٪ حروف است.');
 // A clue cell or black square must immediately terminate each answer
 // unless that answer ends at the outside edge of the printed grid.
 const unterminated=[];
 for(const entry of item.puzzle.entries){
  if(!entry||!['across','down'].includes(entry.direction))continue;
  const path=positions(entry),end=path[path.length-1];
  if(!end)continue;
  const r=end.row+(entry.direction==='down'?1:0);
  const c=end.col-(entry.direction==='across'?1:0);
  if(inBounds(r,c,size)&&built.grid[r][c].kind!=='clue')
   unterminated.push(entry.id);
 }
 if(unterminated.length)
  checks.push('پایان '+unterminated.length+' پاسخ فاقد خانهٔ سؤال یا خانهٔ سیاه است: '+
   unterminated.slice(0,4).join('، '));
 const publishable=structurallyValid&&checks.length===0;
 return {valid:structurallyValid,publishable,errors:[...errors,...checks],stats,grid:built.grid};
}
function refresh(item){
 const out=clone(item),built=build(out);
 if(built.errors.length)throw Error(built.errors[0]);
 out.puzzle.grid=built.grid;
 out.puzzle.meta={...(out.puzzle.meta||{}),status:'draft',method:'editor-draft'};
 return out;
}
function addEntry(item,entry){
 const out=clone(item);
 if(!Array.isArray(out?.puzzle?.entries))throw Error('پروژهٔ جدول معتبر نیست.');
 if(out.puzzle.entries.some(e=>e.id===entry.id))throw Error('شناسهٔ سرنخ تکراری است.');
 const word=normalize(entry.answer),dir=entry.direction,start=startFor(entry.clueCell,dir);
 if(!start)throw Error('جهت یا خانهٔ سؤال انتخاب نشده است.');
 out.puzzle.entries.push({id:entry.id,clue:String(entry.clue||'').trim(),answer:word,
  clueCell:entry.clueCell.slice(),start,direction:dir});
 return refresh(out);
}
function removeEntry(item,id){
 const out=clone(item);
 out.puzzle.entries=out.puzzle.entries.filter(entry=>entry.id!==id);
 return refresh(out);
}
function setBlock(item,r,c,blocked=true){
 const out=clone(item),size=sizes[out.variant];
 if(!size||!inBounds(r,c,size))throw Error('مختصات خانه معتبر نیست.');
 const key=coord(r,c);
 out.puzzle.blocked=out.puzzle.blocked.filter(pos=>coord(...pos)!==key);
 if(blocked)out.puzzle.blocked.push([r,c]);
 return refresh(out);
}
function finishBlocks(item){
 const out=clone(item),compiled=build(out);
 if(compiled.errors.length)throw Error(compiled.errors[0]);
 for(let r=0;r<compiled.grid.length;r++)for(let c=0;c<compiled.grid[r].length;c++)
  if(compiled.grid[r][c].kind==='empty')out.puzzle.blocked.push([r,c]);
 return refresh(out);
}
function validate(item){return inspect(item).publishable&&
 item?.puzzle?.meta?.status==='published'&&item?.puzzle?.meta?.method==='editor-approved'&&
 typeof item?.id==='string'&&!!item.id&&typeof item?.title==='string'&&!!item.title.trim();}
const api={sizes,normalize,blank,positions,startFor,build,inspect,validate,refresh,addEntry,removeEntry,setBlock,finishBlocks};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.PayameClueInCell=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:null);
