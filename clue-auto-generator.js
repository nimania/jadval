/* Automatic Persian clue-in-cell crossword composer.
   Uses only an authenticated, current central-bank snapshot supplied by Studio.
   Runs in a dedicated Web Worker. Does not invent answers, upload bank data,
   or mark a draft as editor approved. */
(function(root){
'use strict';
const model=root?.PayameClueInCell||(typeof module!=='undefined'?require('./clue-in-cell.js'):null);
if(!model)throw Error('Clue-in-cell model missing');
const FA=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
function poolFrom(entries,{maxWord=15,maxClue=92}={}){
 const seen=new Set(),pool=[],byLength={};
 for(const entry of Array.isArray(entries)?entries:[]){
  const word=model.normalize(entry?.answer),clue=String(entry?.clue||'').trim();
  const len=[...word].length;
  if(len<3||len>maxWord||!FA.test(word)||clue.length<3||clue.length>maxClue)continue;
  if(seen.has(word))continue;
  seen.add(word);
  const value={answer:word,clue,letters:[...word],length:len};
  pool.push(value);byLength[len]=(byLength[len]||0)+1;
 }
 return {pool,byLength,inputCount:Array.isArray(entries)?entries.length:0};
}
function seedRandom(value){
 let x=(Number(value)||32843831)>>>0;
 if(!x)x=123456789;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
}
function charIndex(pool){
 const byChar=new Map();
 for(let i=0;i<pool.length;i++){
  for(let offset=0;offset<pool[i].letters.length;offset++){
   const ch=pool[i].letters[offset];
   if(!byChar.has(ch))byChar.set(ch,[]);
   byChar.get(ch).push([i,offset]);
  }
 }
 return byChar;
}
function board(dim){
 return {
  width:dim.width,height:dim.height,
  letters:Array(dim.width*dim.height).fill(''),
  owners:new Uint8Array(dim.width*dim.height),
  clues:new Map(),used:new Set(),entries:[],frontier:[],numAcross:0,numDown:0,
  crossing:0
 };
}
function idx(b,r,c){return r*b.width+c;}
function inBounds(b,r,c){return r>=0&&c>=0&&r<b.height&&c<b.width;}
function evaluate(b,entry,dir,clueR,clueC){
 if(!inBounds(b,clueR,clueC)||b.used.has(entry.answer))return null;
 const startR=clueR+(dir===2?1:0),startC=clueC-(dir===1?1:0);
 const endR=startR+(dir===2?entry.length-1:0);
 const endC=startC-(dir===1?entry.length-1:0);
 if(!inBounds(b,startR,startC)||!inBounds(b,endR,endC))return null;
 const clueKey=idx(b,clueR,clueC),oldClues=b.clues.get(clueKey)||0;
 if(b.letters[clueKey]||oldClues&dir)return null;
 const afterR=endR+(dir===2?1:0),afterC=endC-(dir===1?1:0);
 // Prevent accidental continuation of another answer in the same direction.
 if(inBounds(b,afterR,afterC)&&(b.owners[idx(b,afterR,afterC)]&dir))return null;
 let added=0,intersections=0;
 const cells=[];
 for(let i=0;i<entry.length;i++){
  const row=startR+(dir===2?i:0),col=startC-(dir===1?i:0),key=idx(b,row,col);
  if(b.clues.has(key)||(b.owners[key]&dir))return null;
  if(b.letters[key]&&b.letters[key]!==entry.letters[i])return null;
  if(b.letters[key])intersections++;else added++;
  cells.push([key,row,col,entry.letters[i]]);
 }
 if(!added)return null;
 // Prefer actual crosswords rather than just independent words.
 const score=added*3+intersections*12+Math.min(12,entry.length)
  +(dir===1?b.numAcross<b.numDown?10:0:b.numDown<b.numAcross?10:0)
  +(!intersections&&b.entries.length>4?-7:0);
 return {entry,dir,clueR,clueC,cells,score,added,intersections};
}
function place(b,proposal){
 const {entry,dir,clueR,clueC,cells}=proposal;
 const key=idx(b,clueR,clueC);b.clues.set(key,(b.clues.get(key)||0)|dir);
 b.entries.push({
  id:'auto-'+String(b.entries.length+1).padStart(3,'0'),
  answer:entry.answer,clue:entry.clue,clueCell:[clueR,clueC],
  start:[clueR+(dir===2?1:0),clueC-(dir===1?1:0)],
  direction:dir===1?'across':'down'
 });
 b.used.add(entry.answer);
 for(const [k,r,c,ch] of cells){
  if(!b.letters[k]){b.letters[k]=ch;b.frontier.push([r,c,k]);}
  else b.crossing++;
  b.owners[k]|=dir;
 }
 if(dir===1)b.numAcross++;else b.numDown++;
}
function bestProposal(b,pool,index,rng,options={}){
 let best=null;
 const crossAttempts=options.crossAttempts||340,newAttempts=options.newAttempts||120;
 if(b.frontier.length){
  for(let count=0;count<crossAttempts;count++){
   const point=b.frontier[Math.floor(rng()*b.frontier.length)];
   if(!point)break;
   const [r,c,k]=point;
   if(b.owners[k]===3)continue;
   const dir=(b.owners[k]&1)?2:1;
   const matches=index.get(b.letters[k]);
   if(!matches||!matches.length)continue;
   const [wi,offset]=matches[Math.floor(rng()*matches.length)];
   const entry=pool[wi];if(b.used.has(entry.answer))continue;
   const clueR=dir===2?r-offset-1:r;
   const clueC=dir===1?c+offset+1:c;
   const candidate=evaluate(b,entry,dir,clueR,clueC);
   if(candidate&&(!best||candidate.score>best.score))best=candidate;
  }
 }
 for(let k=0;k<newAttempts;k++){
  const entry=pool[Math.floor(rng()*pool.length)];
  if(!entry||b.used.has(entry.answer))continue;
  const dir=rng()<.5?1:2;
  const clueR=dir===1?Math.floor(rng()*b.height):
   Math.floor(rng()*(b.height-entry.length));
  const clueC=dir===1?Math.floor(rng()*(b.width-entry.length))+entry.length:
   Math.floor(rng()*b.width);
  const candidate=evaluate(b,entry,dir,clueR,clueC);
  if(candidate&&(!best||candidate.score>best.score))best=candidate;
 }
 return best;
}
function toItem(b,variant,seed,index){
 const item=model.blank(variant);
 item.id='draft-clue-'+variant+'-'+seed+'-'+index;
 item.title='شرح در متن '+(variant==='horizontal'?'افقی ۳۰×۲۰':'عمودی ۲۰×۱۴')+' ـ طرح خودکار';
 item.puzzle.entries=b.entries.map(e=>({...e,clueCell:e.clueCell.slice(),start:e.start.slice()}));
 item.puzzle.meta={status:'draft',method:'central-bank-generator',
  seed:Number(seed)||0,generatedAt:new Date().toISOString()};
 const result=model.build(item);
 if(result.errors.length)throw Error('خطای ساخت داخلی: '+result.errors.slice(0,2).join(' | '));
 item.puzzle.grid=result.grid;
 return item;
}
function rank(report){
 if(!report.stats)return -1e9;
 const s=report.stats;
 return s.letter*2+s.crossings*6+s.entries*2+
   Math.min(s.across,s.down)*2-
   Math.max(0,s.empty-s.total*.28)*9-
   Math.max(0,s.letter*.2-s.crossings)*15-
   Math.max(0,s.block-s.total*.30)*14;
}
function run(entries,variant,settings={}){
 const size=model.sizes[variant];if(!size)throw Error('قالب انتخاب‌شده وجود ندارد.');
 const prepared=poolFrom(entries);
 if(prepared.pool.length<200)throw Error('واژگان مناسب کافی نیستند؛ دست‌کم ۲۰۰ جواب یکتا و دارای سؤال لازم است.');
 const randomSeed=(Number(settings.seed)||Number(new Date().toISOString().slice(0,10).replaceAll('-',''))||20261103)>>>0;
 const attempts=Math.max(1,Math.min(8,Number(settings.attempts)||4));
 const maxSteps=Math.max(30,Math.min(380,Number(settings.steps)||Math.round(size.width*size.height*.45)));
 const budgetMs=Math.max(1000,Math.min(30000,Number(settings.budgetMs)||14500));
 const start=Date.now(),index=charIndex(prepared.pool);
 let best=null,attempted=0,complete=false;
 const diagnostics=[];
 for(let round=0;round<attempts&&Date.now()-start<budgetMs;round++){
  const rng=seedRandom(randomSeed+round*0x9E3779B9);
  const b=board(size),seenClues=new Set();
  for(let step=0;step<maxSteps&&Date.now()-start<budgetMs;step++){
   const proposal=bestProposal(b,prepared.pool,index,rng);
   if(!proposal)break;
   place(b,proposal);
   if(step>0&&step%24===0&&typeof settings.onProgress==='function'){
    settings.onProgress({round:round+1,attempts,placements:b.entries.length,
     occupied:b.frontier.length+b.clues.size,total:size.width*size.height});
   }
   if(b.frontier.length+b.clues.size>size.width*size.height*.82&&
      b.crossing>=b.frontier.length*.2&&b.entries.length>=size.minEntries)break;
  }
  attempted++;
  const item=toItem(b,variant,randomSeed,round);
  const partial=model.inspect(item);
  let candidate=item,report=partial;
  if(partial.valid){
   try{
    const finished=model.finishBlocks(item),finishedReport=model.inspect(finished);
    if(finishedReport.publishable){candidate=finished;report=finishedReport;}
   }catch(_){}
  }
  const outcome={round:round+1,items:b.entries.length,letters:report.stats?.letter||0,
   crossings:report.stats?.crossings||0,empty:report.stats?.empty||0,
   publishable:report.publishable,errors:report.errors.slice(0,5)};
  diagnostics.push(outcome);
  const score=rank(report);
  if(!best||score>best.score||(report.publishable&&!best.report.publishable))
   best={item:candidate,report,score};
  if(report.publishable){complete=true;break;}
 }
 if(!best)throw Error('در بودجهٔ جست‌وجو هیچ طرحی تولید نشد.');
 best.item.puzzle.meta={...best.item.puzzle.meta,status:'draft',method:'central-bank-generator',bankRows:prepared.inputCount,
  eligibleWords:prepared.pool.length,attempted,complete,source:'central-firestore-authenticated'};
 return {item:best.item,report:best.report,
  diagnostics:{source:'central-firestore-authenticated',
   inputCount:prepared.inputCount,eligible:prepared.pool.length,
   uniqueAnswers:prepared.pool.length,attempted,complete,seed:randomSeed,
   budgetMs:Date.now()-start,attemptReports:diagnostics}};
}
const api={poolFrom,seedRandom,board,evaluate,place,run,rank};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.JadvalClueAuto=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:null);
