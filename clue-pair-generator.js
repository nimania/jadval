/* Paired-clue-first composer for Persian 30x20. No private bank is bundled.
   Interior clue cells are installed as ←+↓ pairs. A single clue is allowed
   only on the last row (←) or leftmost column (↓). */
(function(root){
'use strict';
const model=root?.PayameClueInCell||(typeof module!=='undefined'?require('./clue-in-cell.js'):null);
const core=root?.JadvalClueAuto||(typeof module!=='undefined'?require('./clue-auto-generator.js'):null);
if(!model||!core)throw Error('Pair-first composer requires the clue-in-cell model and word composer');
function buildFromBank(source,options={}){
 const seed=options.seed||93015,variant='horizontal',size=model.sizes[variant];
 const rejected=new Set(['کییف','هرجیسا','خارطوم','یارن'].map(model.normalize));
 const rows=(Array.isArray(source)?source:[]).map(x=>({
  answer:model.normalize(x.answer),clue:String(x.clue||'').trim()
 })).filter(x=>x.answer&&x.clue&&!x.clue.startsWith('واحد پول')&&!rejected.has(x.answer)&&
    !/پهلوی/.test(x.clue));
 const pool=core.poolFrom(rows,{seed:1}).pool.map(x=>({...x,
  category:x.clue.startsWith('پایتخت')?'cap':'other'}));
 if(pool.length<150)throw Error('بانک پرسش‌وپاسخ متنوع کافی نیست');
 const rng=core.seedRandom(seed),board=core.board(size),index=(r,c)=>r*size.width+c;
 let capitals=0,paired=0,edgeSingles=0;
 const maxCapitals=options.maxCapitals??13;
 for(let step=0;step<72;step++){
  let best=null;
  for(let t=0;t<100;t++){
   const r=Math.floor(rng()*(size.height-2)),c=3+Math.floor(rng()*(size.width-4));
   if(board.clues.has(index(r,c))||board.letters[index(r,c)])continue;
   const across=[],down=[];
   for(const e of pool){
    if(board.used.has(e.answer)||(e.category==='cap'&&capitals>=maxCapitals))continue;
    if(e.length>13&&step>8)continue;
    if(e.length<=c){const p=core.evaluate(board,e,1,r,c);if(p)across.push(p)}
    if(e.length+r+1<=size.height){const p=core.evaluate(board,e,2,r,c);if(p)down.push(p)}
   }
   if(!across.length||!down.length)continue;
   const rank=p=>p.intersections*20+p.added*2.3-
    Math.max(0,p.entry.length-9)*2+(p.entry.category==='other'?7:0)+rng()*8;
   across.sort((x,y)=>rank(y)-rank(x));down.sort((x,y)=>rank(y)-rank(x));
   let candidate=null;
   for(const x of across.slice(0,8))for(const y of down.slice(0,8)){
    if(x.entry.answer===y.entry.answer)continue;
    const nextCapitals=capitals+Number(x.entry.category==='cap')+Number(y.entry.category==='cap');
    if(nextCapitals>maxCapitals)continue;
    const score=x.intersections*24+y.intersections*24+(x.added+y.added)*2.3+
     (x.entry.category==='other'?7:0)+(y.entry.category==='other'?7:0)+rng()*8;
    if(!candidate||score>candidate.score)candidate={x,y,score};
   }
   if(candidate&&(!best||candidate.score>best.score))best=candidate;
  }
  if(!best)break;
  core.place(board,best.x);core.place(board,best.y);paired++;
  capitals+=Number(best.x.entry.category==='cap')+Number(best.y.entry.category==='cap');
 }
 // Border-only single-clue entries, never on interior cells.
 for(let step=0;step<22;step++){
  let best=null;
  for(let trial=0;trial<300;trial++){
   const horizontal=rng()<.65;
   const r=horizontal?size.height-1:Math.floor(rng()*(size.height-4));
   const c=horizontal?2+Math.floor(rng()*(size.width-2)):0;
   const dir=horizontal?1:2;
   if(board.clues.has(index(r,c))||board.letters[index(r,c)])continue;
   const entry=pool[Math.floor(rng()*pool.length)];
   if(!entry||board.used.has(entry.answer)||(entry.category==='cap'&&capitals>=maxCapitals))continue;
   const p=core.evaluate(board,entry,dir,r,c);
   if(!p)continue;
   const score=p.intersections*24+p.added*2+rng()*4;
   if(!best||score>best.score)best={p,score};
  }
  if(!best)break;
  core.place(board,best.p);edgeSingles++;
  capitals+=Number(best.p.entry.category==='cap');
 }
 let item=model.blank(variant);
 item.puzzle.entries=board.entries;
 item.puzzle.grid=model.build(item).grid;
 item=model.finishBlocks(item);
 const report=model.inspect(item);
 const badCells=[];
 for(let r=0;r<item.puzzle.grid.length;r++)for(let c=0;c<item.puzzle.grid[r].length;c++){
  const cell=item.puzzle.grid[r][c];
  if(cell.kind!=='clue')continue;
  const refs=cell.clueIds.map(id=>item.puzzle.entries.find(x=>x.id===id));
  const a=refs.some(x=>x?.direction==='across'),d=refs.some(x=>x?.direction==='down');
  if(r< size.height-1&&c>0&&(!a||!d))badCells.push([r,c,'interior must have two clues']);
  if(r===size.height-1&&d)badCells.push([r,c,'down clue on last row']);
  if(c===0&&a)badCells.push([r,c,'left clue in leftmost column']);
 }
 if(badCells.length)throw Error('Invalid clue pairing: '+JSON.stringify(badCells.slice(0,4)));
 return {item,report,diagnostics:{seed,sourceRows:rows.length,eligibleWords:pool.length,
  pairs:paired,borderSingles:edgeSingles,capitals,pairedInterior:true}};
}
const api={buildFromBank};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.JadvalCluePair=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:null);
