/* Automatic Persian clue-in-cell crossword composer.
   Uses only an authenticated, current central-bank snapshot supplied by Studio.
   Runs in a dedicated Web Worker. Does not invent answers, upload bank data,
   or mark a draft as editor approved. */
(function(root){
'use strict';
const model=root?.PayameClueInCell||(typeof module!=='undefined'?require('./clue-in-cell.js'):null);
if(!model)throw Error('Clue-in-cell model missing');
const FA=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
function poolFrom(entries,{maxWord=15,maxClue=92,seed=1}={}){
 const pairs=new Set(),choices=new Map(),byLength={},rng=seedRandom(seed);
 for(const entry of Array.isArray(entries)?entries:[]){
  const word=model.normalize(entry?.answer),clue=String(entry?.clue||'').trim();
  const len=[...word].length;
  if(len<3||len>maxWord||!FA.test(word)||clue.length<3||clue.length>maxClue)continue;
  const key=word+'\u0000'+clue;if(pairs.has(key))continue;
  pairs.add(key);
  const previous=choices.get(word);
  if(previous){
   // Reservoir sampling chooses different *legitimate* clues on different days
   // while keeping each answer unique within the same grid.
   previous.count++;
   if(rng()<1/previous.count)previous.clue=clue;
  }else choices.set(word,{answer:word,clue,letters:[...word],length:len,count:1});
 }
 const pool=[];
 for(const entry of choices.values()){
  pool.push({answer:entry.answer,clue:entry.clue,letters:entry.letters,length:entry.length});
  byLength[entry.length]=(byLength[entry.length]||0)+1;
 }
 return {pool,byLength,inputCount:Array.isArray(entries)?entries.length:0,uniquePairs:pairs.size};
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
  clues:new Map(),ends:new Set(),used:new Set(),entries:[],frontier:[],numAcross:0,numDown:0,
  crossing:0
 };
}
function idx(b,r,c){return r*b.width+c;}
function inBounds(b,r,c){return r>=0&&c>=0&&r<b.height&&c<b.width;}
function evaluate(b,entry,dir,clueR,clueC){
 if(!inBounds(b,clueR,clueC)||b.used.has(entry.answer))return null;
 // Editorial diversity: routine capital/currency clues must not dominate.
 const capMax=b.width>=30?15:8, currencyMax=b.width>=30?8:4;
 if(entry.clue.startsWith('پایتخت') &&
    b.entries.filter(x=>x.clue.startsWith('پایتخت')).length>=capMax)return null;
 if(entry.clue.startsWith('واحد پول') &&
    b.entries.filter(x=>x.clue.startsWith('واحد پول')).length>=currencyMax)return null;
 const startR=clueR+(dir===2?1:0),startC=clueC-(dir===1?1:0);
 const endR=startR+(dir===2?entry.length-1:0);
 const endC=startC-(dir===1?entry.length-1:0);
 if(!inBounds(b,startR,startC)||!inBounds(b,endR,endC))return null;
 const clueKey=idx(b,clueR,clueC),oldClues=b.clues.get(clueKey)||0;
 if(b.letters[clueKey]||oldClues&dir)return null;
 const afterR=endR+(dir===2?1:0),afterC=endC-(dir===1?1:0);
 // A word cannot visually continue into the adjacent letter of another word.
 if(inBounds(b,afterR,afterC)&&b.letters[idx(b,afterR,afterC)])return null;
 let added=0,intersections=0;
 const cells=[];
 for(let i=0;i<entry.length;i++){
  const row=startR+(dir===2?i:0),col=startC-(dir===1?i:0),key=idx(b,row,col);
  if(b.clues.has(key)||b.ends.has(key)||(b.owners[key]&dir))return null;
  if(b.letters[key]&&b.letters[key]!==entry.letters[i])return null;
  if(b.letters[key])intersections++;else added++;
  cells.push([key,row,col,entry.letters[i]]);
 }
 if(!added)return null;
 // Prefer actual crosswords rather than just independent words.
 const score=added*3+intersections*12+Math.min(12,entry.length)
  +(dir===1?b.numAcross<b.numDown?10:0:b.numDown<b.numAcross?10:0)
  +(!intersections&&b.entries.length>4?-7:0);
 return {entry,dir,clueR,clueC,cells,score,added,intersections,after:inBounds(b,afterR,afterC)?idx(b,afterR,afterC):null};
}
function place(b,proposal){
 const {entry,dir,clueR,clueC,cells,after}=proposal;
 const key=idx(b,clueR,clueC);b.clues.set(key,(b.clues.get(key)||0)|dir);b.ends.delete(key);
 if(after!==null&&!b.clues.has(after))b.ends.add(after);
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
 // Prefer filling a second arrow in an already established clue cell.
 // Right-to-left across runs left; down runs toward the bottom. Edge
 // cells are permitted to have only the geometrically valid arrow.
 if(b.clues.size){
  let second=null;
  for(const [key,mask] of b.clues){
   if(mask===3)continue;
   const r=Math.floor(key/b.width),c=key%b.width,dir=mask===1?2:1;
   for(const entry of pool){
    if(b.used.has(entry.answer))continue;
    const proposal=evaluate(b,entry,dir,r,c);
    if(proposal&&(!second||proposal.score>second.score))second=proposal;
   }
  }
  if(second)return second;
 }
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
// A compact printed label is distinct from the complete editable source clue.
function shortClue(clue){
 const source=String(clue||'').trim();
 if(source.startsWith('پایتخت '))return source.slice('پایتخت '.length).trim()
  .replace('امارات متحده عربی','امارات')
  .replace('جزایر مارشال','مارشال');
 const province=source.match(/^مرکز استان (.+)$/);
 if(province)return 'مرکز '+province[1];
 const symbol=source.match(/^عنصری شیمیایی با نماد ([A-Za-z]+)$/);
 if(symbol)return 'عنصر '+symbol[1];
 const simplifications=[
  [/^ابزار سنجش دما$/,'سنجش دما'],
  [/^ابزار اندازه‌گیری فشار$/,'سنجش فشار'],
  [/^ابزار رصد اجرام دوردست$/,'رصد آسمان'],
  [/^نام دیگر دریای خزر$/,'دریای خزر'],
  [/^رشته‌کوهی در (شمال|غرب) ایران$/,'کوهستان $1'],
  [/^رودی که از شهر اهواز می‌گذرد$/,'رود اهواز'],
  [/^رود شناخته‌شدهٔ اصفهان$/,'رود اصفهان']
 ];
 for(const [pattern,replacement] of simplifications){
  if(pattern.test(source))return source.replace(pattern,replacement);
 }
 return source.length<=16?source:source.slice(0,16).replace(/\s+\S*$/,'')+'…';
}
function toItem(b,variant,seed,index){
 const item=model.blank(variant);
 item.id='draft-clue-'+variant+'-'+seed+'-'+index;
 item.title='شرح در متن '+(variant==='horizontal'?'افقی ۳۰×۲۰':'عمودی ۲۰×۱۴')+' ـ طرح خودکار';
 item.puzzle.entries=b.entries.map(e=>({...e,shortClue:shortClue(e.clue),clueCell:e.clueCell.slice(),start:e.start.slice()}));
 // Every reserved terminal becomes either the next clue cell or a black square.
 item.puzzle.blocked=[...b.ends].filter(k=>!b.clues.has(k)).map(k=>[Math.floor(k/b.width),k%b.width]);
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

/* Dense zero-black layout: every square is either a real clue or a solution
   letter.  Two long vertical bands provide meaningful intersections without
   padding the grid with anonymous black separators. */
function noBlackLayout(variant){
 if(variant==='horizontal')return {
  width:30,height:20,split:11,columns:[23,17,11,5,0],
  special:[5,5,5,5,4],wordCount:5};
 if(variant==='vertical')return {
  width:20,height:14,split:7,columns:[14,9,4,0],
  special:[4,4,4,3],wordCount:4};
 throw Error('قالب انتخاب‌شده وجود ندارد.');
}
function noBlackTuples(layout){
 const valid=[],K=layout.wordCount,W=layout.width;
 const visit=(lengths)=>{
  if(lengths.length===K-1){
   const last=W-K-lengths.reduce((a,b)=>a+b,0);
   if(last<3||last>15)return;
   const all=[...lengths,last],offsets=[];let c=W-1;
   for(let i=0;i<K;i++){
    const offset=c-1-layout.columns[i];
    if(offset<0||offset>=all[i])return;
    offsets.push(offset);c-=all[i]+1;
   }
   if(c===-1)valid.push({lengths:all,offsets});
   return;
  }
  for(let length=3;length<=15;length++)visit([...lengths,length]);
 };
 visit([]);
 return valid;
}
function minCostAssignment(matrix){
 const n=matrix.length,m=matrix[0]?.length||0;
 if(!n||m<n)throw Error('مدخل‌های بانک برای جایگاه‌های شبکه کافی نیستند.');
 const u=Array(n+1).fill(0),v=Array(m+1).fill(0),
  p=Array(m+1).fill(0),way=Array(m+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;
  const minv=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
  do{
   used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=m;j++){
    if(used[j])continue;
    const current=matrix[i0-1][j-1]-u[i0]-v[j];
    if(current<minv[j]){minv[j]=current;way[j]=j0;}
    if(minv[j]<delta){delta=minv[j];j1=j;}
   }
   for(let j=0;j<=m;j++){
    if(used[j]){u[p[j]]+=delta;v[j]-=delta;}
    else minv[j]-=delta;
   }
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 const assigned=Array(n).fill(-1);
 for(let j=1;j<=m;j++)if(p[j])assigned[p[j]-1]=j-1;
 if(assigned.some((j,i)=>j<0||matrix[i][j]>1000000))
  throw Error('همهٔ جواب‌ها را بدون تکرار نتوانستیم جای‌گذاری کنیم.');
 return assigned;
}
function runZeroBlack(entries,variant,settings={}){
 const layout=noBlackLayout(variant),seed=(Number(settings.seed)||20261104)>>>0,
  rng=seedRandom(seed),prepared=poolFrom(entries,{seed}),pool=prepared.pool;
 if(pool.length<200)throw Error('برای این قالب دست‌کم ۲۰۰ پاسخ یکتای دارای سؤال لازم است.');
 const {width,height,split,columns,special,wordCount:K}=layout;
 const topLength=split-1,bottomLength=height-split-1;
 const byLength=new Map(),buckets=new Map();
 for(let i=0;i<pool.length;i++){
  const word=pool[i];
  if(!byLength.has(word.length))byLength.set(word.length,[]);
  byLength.get(word.length).push(i);
  for(let j=0;j<word.length;j++){
   const key=word.length+'|'+j+'|'+word.letters[j];
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(i);
  }
 }
 if((byLength.get(topLength)||[]).length<K ||
    (byLength.get(bottomLength)||[]).length<K ||
    (topLength===bottomLength&&(byLength.get(topLength)||[]).length<2*K))
  throw Error('بانک به واژگان متنوع با طول مناسب برای ساخت بدون خانهٔ سیاه نیاز دارد.');
 const tuples=noBlackTuples(layout);
 if(!tuples.length)throw Error('الگوی هندسی فاقد خانهٔ سیاه در دسترس نیست.');
 const cache=new Map();
 const options=(chars)=>{
  const key=chars.join('');if(cache.has(key))return cache.get(key);
  const available=[];
  for(const tuple of tuples){
   const choices=tuple.lengths.map((len,i)=>buckets.get(len+'|'+tuple.offsets[i]+'|'+chars[i])||[]);
   if(choices.every(x=>x.length))available.push({tuple,choices,
    weight:choices.reduce((x,a)=>x*Math.min(a.length,25),1)});
  }
  available.sort((a,b)=>b.weight-a.weight);
  cache.set(key,available);
  return available;
 };
 const shuffle=a=>{
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
 };
 const cap=Number(settings.budgetMs)||14500;
 const budget=Math.max(1000,Math.min(30000,cap)),limit=Date.now()+budget;
 const maxAttempts=Math.max(120,Math.min(4000,(Number(settings.attempts)||4)*650));
 let tried=0;
 for(;tried<maxAttempts&&Date.now()<limit;tried++){
  const top=shuffle((byLength.get(topLength)||[]).slice()).slice(0,K);
  const bottom=shuffle((byLength.get(bottomLength)||[]).filter(i=>!top.includes(i))).slice(0,K);
  if(bottom.length!==K)continue;
  const vertical=[top,bottom],used=new Set([...top,...bottom]);
  const rows=[];
  let possible=true;
  for(let r=1;r<height;r++){
   if(r===split)continue;
   const group=r<split?0:1,index=r<split?r-1:r-split-1;
   const chars=columns.map((_,j)=>pool[vertical[group][j]].letters[index]);
   const candidates=options(chars);
   if(!candidates.length){possible=false;break;}
   rows.push({r,candidates});
  }
  if(!possible)continue;
  rows.sort((a,b)=>a.candidates.length-b.candidates.length+(rng()-.5)*.05);
  const chosenLengths=new Map();
  for(const row of rows){
   let chosen=null;
   // The word assignment below is a feasibility check; the final editorial
   // assignment is a minimum-cost global matching over the same slot geometry.
   const choices=row.candidates.slice(0,90);
   shuffle(choices);choices.sort((a,b)=>b.weight-a.weight);
   for(const op of choices){
    const selected=[];
    for(const candidates of op.choices){
     const available=candidates.filter(i=>!used.has(i)&&!selected.includes(i));
     if(!available.length){selected.length=0;break;}
     selected.push(available[Math.floor(rng()*available.length)]);
    }
    if(selected.length===K){chosen=op.tuple.lengths;for(const i of selected)used.add(i);break;}
   }
   if(!chosen){possible=false;break;}
   chosenLengths.set(row.r,chosen);
  }
  if(!possible)continue;
  const verticalChars=new Map();
  for(const origin of [0,split]){
   const group=origin===0?0:1;
   for(let col=0;col<K;col++){
    const word=pool[vertical[group][col]];
    for(let i=0;i<word.length;i++)
     verticalChars.set((origin+1+i)+','+columns[col],word.letters[i]);
   }
  }
  const slots=[];
  for(let r=0;r<height;r++){
   const lengths=r===0||r===split?special:chosenLengths.get(r);
   if(!lengths){possible=false;break;}
   let c=width-1;
   for(const len of lengths){
    const constraints=[];
    for(let i=0;i<len;i++){
     const ch=verticalChars.get(r+','+(c-i-1));
     if(ch)constraints.push([i,ch]);
    }
    slots.push({r,c,len,constraints});
    c-=len+1;
   }
   if(c!==(r===0||r===split?0:-1)){possible=false;break;}
  }
  if(!possible)continue;
  const candidateIds=pool.map((_,i)=>i).filter(i=>!top.includes(i)&&!bottom.includes(i));
  let chosen;
  try{
   const costs=slots.map(slot=>candidateIds.map((id,j)=>{
    const e=pool[id];
    if(e.length!==slot.len||slot.constraints.some(([off,ch])=>e.letters[off]!==ch))return 1e7;
    const q=e.clue,cost=q.startsWith('پایتخت')?600:
     q.startsWith('واحد پول')?100:
     q.startsWith('مرکز استان')||q.startsWith('مرکز استانی')?28:0;
    return cost+(q.length>80?2:0)+j*.000001;
   }));
   chosen=minCostAssignment(costs).map(i=>pool[candidateIds[i]]);
  }catch(_){continue;}
  const item=model.blank(variant);
  let entryNumber=0;
  const add=(data,r,c,direction)=>{
   const entry={id:'auto-'+String(++entryNumber).padStart(3,'0'),answer:data.answer,
    clue:data.clue,shortClue:shortClue(data.clue),direction,clueCell:[r,c],
    start:model.startFor([r,c],direction)};
   item.puzzle.entries.push(entry);
  };
  for(let i=0;i<slots.length;i++)add(chosen[i],slots[i].r,slots[i].c,'across');
  for(const origin of [0,split]){
   const group=origin===0?0:1;
   for(let j=0;j<K;j++)add(pool[vertical[group][j]],origin,columns[j],'down');
  }
  const built=model.build(item);
  if(built.errors.length)continue;
  item.puzzle.grid=built.grid;
  const report=model.inspect(item);
  if(!report.publishable||report.stats.block!==0||report.stats.empty!==0)continue;
  item.puzzle.meta={status:'draft',method:'central-bank-generator',
   source:'authenticated-bank-snapshot',seed,bankRows:prepared.inputCount,
   eligibleWords:prepared.pool.length,generatedAt:new Date().toISOString(),
   noBlack:true,complete:true};
  const diagnostics={source:'authenticated-bank-snapshot',inputCount:prepared.inputCount,
   eligible:prepared.pool.length,uniqueAnswers:prepared.pool.length,
   attempted:tried+1,complete:true,seed,budgetMs:budget-(limit-Date.now()),
   attemptReports:[{round:tried+1,items:item.puzzle.entries.length,
    letters:report.stats.letter,crossings:report.stats.crossings,empty:0,publishable:true}]};
  return {item,report,diagnostics};
 }
 throw Error('در بودجهٔ تولید، جدول کاملِ بدون خانهٔ سیاهِ اضافی پیدا نشد. بانک را گسترش بدهید یا دوباره تولید کنید.');
}
function run(entries,variant,settings={}){
 return runZeroBlack(entries,variant,settings);
 const size=model.sizes[variant];if(!size)throw Error('قالب انتخاب‌شده وجود ندارد.');
 const randomSeed=(Number(settings.seed)||Number(new Date().toISOString().slice(0,10).replaceAll('-',''))||20261103)>>>0;
 const prepared=poolFrom(entries,{seed:randomSeed});
 if(prepared.pool.length<200)throw Error('واژگان مناسب کافی نیستند؛ دست‌کم ۲۰۰ جواب یکتا و دارای سؤال لازم است.');
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
