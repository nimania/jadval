/* Complete tiled crossword prototype. Each open cell belongs to across/down
   answers from the user's own local bank; no artificial filler letters. */
(function(){
"use strict";
const clean=s=>String(s??"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\s\u200c\u200d\u064b-\u065f\u0670\-ـ]/g,"").trim();
const letters=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
function rand(seed){let s=seed>>>0;return ()=>{s=Math.imul(s,1664525)+1013904223>>>0;return s/4294967296}}
function buildIndex(entries,n){
 const words=new Map(),first=new Map();
 for(const e of entries){
  const word=clean(e.answer),clue=String(e.clue||"").trim();
  if(word.length!==n||!letters.test(word)||!clue||words.has(word))continue;
  words.set(word,{word,clue,id:e.id||null});
  const a=first.get(word[0])||[];a.push(word);first.set(word[0],a);
 }
 return {words,first,list:[...words.keys()]};
}
function searchTile(index,random,used,limit=45000){
 const {words,first,list}=index;if(list.length<12)return null;
 let fallback=null,leastReused=Infinity;
 for(let attempt=0;attempt<limit;attempt++){
  const w0=list[Math.floor(random()*list.length)];
  const rows=[w0];
  for(let j=1;j<w0.length;j++){
   const choices=w0.length===2?list:first.get(w0[j]);if(!choices?.length)break;
   rows.push(choices[Math.floor(random()*choices.length)]);
  }
  if(rows.length!==w0.length)continue;
  const columns=Array.from({length:w0.length},(_,j)=>rows.map(w=>w[j]).join(""));
  if(!columns.every(w=>words.has(w)))continue;
  const joined=[...rows,...columns];
  if(new Set(joined).size < rows.length+Math.floor(rows.length/2))continue;
  const reused=joined.filter(w=>used.has(w)).length;
  if(reused===0)return {rows,columns};
  if(reused<leastReused){leastReused=reused;
   fallback={rows,columns,reused};}
 }
 return fallback;
}
function layout(size,seed=2026){
 const random=rand(seed),tiles=[];
 if(size===7){
  // Irregular composition of two 3x3 and two 2x2 valid word squares.
  const preset=[
   {top:0,right:0,tileSize:3},
   {top:3,right:3,tileSize:3},
   {top:0,right:5,tileSize:2},
   {top:5,right:0,tileSize:2}
  ];
  const mirror=seed%2===1;
  return mirror?preset.map(x=>({...x,right:7-x.right-x.tileSize})):preset;
 }
 if(![10,15,20].includes(size))return null;
 const unit=size/5;
 const parity=seed%2;
 const fulls=[];
 for(let r=0;r<5;r++)for(let c=0;c<5;c++){
  if((r+c)%2===parity)fulls.push([r,c]);
 }
 // Irregular variation: turn up to three full 4x4 patches into smaller
 // centered 2x2 patches, without leaving any entire row/column black.
 const omit=new Set();
 if(size===20){
  const count=1+Math.floor(random()*3),available=fulls.slice();
  for(let i=available.length-1;i>0;i--){
   const j=Math.floor(random()*(i+1));[available[i],available[j]]=[available[j],available[i]];
  }
  for(const [r,c] of available){
   if(omit.size>=count)break;
   const key=r+","+c;
   if(fulls.filter(([rr,cc])=>rr===r&&!omit.has(rr+","+cc)).length<=2)continue;
   if(fulls.filter(([rr,cc])=>cc===c&&!omit.has(rr+","+cc)).length<=2)continue;
   omit.add(key);
  }
 }
 for(let r=0;r<5;r++)for(let c=0;c<5;c++){
  const full=(r+c)%2===parity&&!omit.has(r+","+c);
  if(full)tiles.push({top:r*unit,right:c*unit,tileSize:unit});
  else if(size===20)tiles.push({top:r*unit+1,right:c*unit+1,tileSize:2});
 }
 return tiles;
}
function structuralCheck(grid){
 const size=grid.length;
 if(!grid.every(row=>Array.isArray(row)&&row.length===size))return false;
 for(let r=0;r<size;r++)if(!grid[r].some(Boolean))return false;
 for(let c=0;c<size;c++)if(!grid.some(row=>Boolean(row[c])))return false;
 return true;
}
function generate(entries,size,seed){
 const positions=layout(size,seed);
 if(!positions)return {error:"اندازه پشتیبانی نمی‌شود."};
 const indexes=new Map(),random=rand(seed),grid=Array.from({length:size},()=>Array(size).fill("")),
       clues={horizontal:{},vertical:{}},used=new Set(),tiles=[];
 for(const {top,right,tileSize} of positions){
  if(!indexes.has(tileSize))indexes.set(tileSize,buildIndex(entries,tileSize));
  const idx=indexes.get(tileSize);
  if(idx.list.length<12)return {error:"تعداد پاسخ‌های "+tileSize+"حرفی کافی نیست."};
  const result=searchTile(idx,random,used,55000);
  if(!result)return {error:"برای همهٔ بخش‌های جدول، ترکیب متقاطع پیدا نشد. دوباره تلاش کن."};
  const {rows,columns}=result;
  for(const word of [...rows,...columns])used.add(word);
  for(let r=0;r<tileSize;r++){
   for(let c=0;c<tileSize;c++){
    const col=size-1-(right+c);
    if(grid[top+r][col])return {error:"هم‌پوشانی نامعتبر خانه‌ها."};
    grid[top+r][col]=rows[r][c];
   }
   (clues.horizontal[String(top+r+1)]??=[]).push(idx.words.get(rows[r]).clue);
  }
  for(let c=0;c<tileSize;c++){
   (clues.vertical[String(right+c+1)]??=[]).push(idx.words.get(columns[c]).clue);
  }
  tiles.push({top,right,rows,columns,tileSize});
 }
 if(!structuralCheck(grid))return {error:"چیدمان یک ردیف یا ستون را کاملاً حذف کرده است."};
 const mask=grid.map(row=>row.map(ch=>ch===""));
 const slots=window.JadvalSparse?.slotsFor(mask);
 if(!slots)return {error:"شبکه شامل جایگاه یک‌حرفی یا نامعتبر است."};
 const puzzle={version:3,grid,clues,meta:{
  title:"جدول آزمایشی "+size+"×"+size,
  language:"fa",direction:"rtl",size:{rows:size,cols:size},
  status:"draft",method:"variable-mosaic"
 }};
 const finished={puzzle,mask,slots:slots.length,tiles,usedWordCount:used.size};
 if(!window.JadvalSparse?.validateComplete(finished))return {error:"جدول در اعتبارسنجی کامل رد شد."};
 return {result:finished};
}
window.JadvalMosaic={generate,layout,buildIndex,searchTile};
})();