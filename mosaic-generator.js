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
 let fallback=null;
 for(let attempt=0;attempt<limit;attempt++){
  const w0=list[Math.floor(random()*list.length)];
  const rows=[w0];
  for(let j=1;j<w0.length;j++){
   const choices=first.get(w0[j]);if(!choices?.length)break;
   rows.push(choices[Math.floor(random()*choices.length)]);
  }
  if(rows.length!==w0.length)continue;
  const columns=Array.from({length:w0.length},(_,j)=>rows.map(w=>w[j]).join(""));
  if(!columns.every(w=>words.has(w)))continue;
  const joined=[...rows,...columns];
  if(new Set(joined).size < rows.length+Math.floor(rows.length/2))continue;
  const reused=joined.filter(w=>used.has(w)).length;
  if(reused===0)return {rows,columns};
  if(reused<=Math.ceil(joined.length/2) && (!fallback || reused<fallback.reused))
   fallback={rows,columns,reused};
 }
 return fallback;
}
function layout(size){
 if(size===7)return {tileSize:3,count:2};
 if(size===10)return {tileSize:4,count:2};
 if(size===15)return {tileSize:4,count:3};
 if(size===20)return {tileSize:4,count:4};
 return null;
}
function generate(entries,size,seed){
 const config=layout(size);if(!config)return {error:"اندازه پشتیبانی نمی‌شود."};
 const {tileSize,count}=config,idx=buildIndex(entries,tileSize);
 if(idx.list.length<12)return {error:"تعداد پاسخ‌های "+tileSize+"حرفی کافی نیست."};
 const random=rand(seed),grid=Array.from({length:size},()=>Array(size).fill("")),
       clues={horizontal:{},vertical:{}},used=new Set(),tiles=[];
 for(let rowTile=0;rowTile<count;rowTile++){
  for(let colTile=0;colTile<count;colTile++){
   const result=searchTile(idx,random,used,55000);
   if(!result)return {error:"برای همهٔ بخش‌های جدول، ترکیب متقاطع پیدا نشد. دوباره تلاش کن."};
   const {rows,columns}=result,top=rowTile*(tileSize+1),right=colTile*(tileSize+1);
   for(const w of [...rows,...columns])used.add(w);
   for(let r=0;r<tileSize;r++){
    for(let c=0;c<tileSize;c++)grid[top+r][size-1-(right+c)]=rows[r][c];
    const key=String(top+r+1),entry=idx.words.get(rows[r]);
    (clues.horizontal[key]??=[]).push(entry.clue);
   }
   for(let c=0;c<tileSize;c++){
    const key=String(right+c+1),entry=idx.words.get(columns[c]);
    (clues.vertical[key]??=[]).push(entry.clue);
   }
   tiles.push({top,right,rows,columns});
  }
 }
 // Bottom and left edge are black for sizes divisible by tileSize+1.
 // For sizes with no trailing edge (7), the existing separators suffice.
 const mask=grid.map(row=>row.map(ch=>ch===""));
 const slots=window.JadvalSparse?.slotsFor(mask);
 if(!slots)return {error:"شبکهٔ ایجادشده شامل جایگاه نامعتبر است."};
 const all=new Set([...Object.values(clues.horizontal).flat(),...Object.values(clues.vertical).flat()]);
 const puzzle={version:3,grid,clues,meta:{title:"جدول ترکیبی آزمایشی "+size+"×"+size,language:"fa",direction:"rtl",
   size:{rows:size,cols:size},status:"draft",method:"complete-tiled"}};
 const finished={puzzle,mask,slots:slots.length,tiles,usedWordCount:used.size};
 if(!window.JadvalSparse?.validateComplete(finished))return {error:"جدول در اعتبارسنجی نهایی رد شد."};
 return {result:finished};
}
window.JadvalMosaic={generate,layout,buildIndex,searchTile};
})();