const assert=require('node:assert/strict');
const Q=require('../quality-gate.js');
const mask=[
'#....#.........',
'#....#.........',
'#..............',
'..........#...#',
'...##.....#....',
'....##.....#...',
'...............',
'###.........###',
'...............',
'...#.....##....',
'....#.....##...',
'#...#..........',
'..............#',
'.........#....#',
'.........#....#'
];
const n=15,abc=[...'آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];
let seed=49267;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const grid=mask.map(line=>[...line].map(ch=>ch==='#'?'':abc[Math.floor(random()*abc.length)]));
const clues={horizontal:{},vertical:{}},bank=[];
const sourceSlots=[];
for(const dir of ['horizontal','vertical']){
 if(dir==='horizontal'){
  for(let r=0;r<n;r++){
   let c=n-1;
   while(c>=0){
    if(!grid[r][c]){c--;continue}
    const cells=[];while(c>=0&&grid[r][c])cells.push([r,c--]);
    sourceSlots.push({dir,group:r+1,cells});
   }
  }
 }else{
  for(let c=n-1;c>=0;c--){
   let r=0;
   while(r<n){
    if(!grid[r][c]){r++;continue}
    const cells=[];while(r<n&&grid[r][c])cells.push([r++,c]);
    sourceSlots.push({dir,group:n-c,cells});
   }
  }
 }
}
const topics=['زبان','تاریخ','جغرافیا','هنر','علوم'];
const difficulties=['easy','medium','hard'];
for(const [i,slot] of sourceSlots.entries()){
 const answer=slot.cells.map(([r,c])=>grid[r][c]).join('');
 const clue='سرنخ مستقل شمارهٔ '+(i+1);
 (clues[slot.dir][String(slot.group)]??=[]).push(clue);
 bank.push({id:String(i),answer,clue,reviewed:1,source:'فرهنگ آزمونی، مدخل '+answer,
  license:'author-original',category:topics[i%topics.length],difficulty:difficulties[i%3]});
}
const puzzle={version:3,grid,clues,meta:{status:'draft'}};
const report=Q.audit(puzzle,bank);
assert.deepEqual(report.errors,[],JSON.stringify(report.errors.slice(0,10)));
assert.equal(report.technicalPassed,true);
assert.equal(report.bankPassed,true);
assert.equal(report.stats.blackCount,32);
assert.equal(report.stats.size,15);
assert.equal(report.stats.slots,sourceSlots.length);
assert.equal(report.score,null,'Human editorial work must not be scored automatically');
assert.equal(Q.score(report,{},{}).ready,false,'Editorial sign-off must be explicit');
const checks=Object.fromEntries(['words','clues','uniqueness','experience','geometry','sources','rights'].map(k=>[k,true]));
const max={words:10,clues:10,uniqueness:10,experience:5,geometry:5};
assert.deepEqual(Q.score(report,max,checks,'بازبین آزمون').score,100);
assert.equal(Q.score(report,{...max,words:0,clues:0},checks,'بازبین آزمون').ready,false);
assert.equal(Q.score(report,max,{...checks,uniqueness:false},'بازبین آزمون').ready,false);
assert.equal(Q.score(report,max,checks,'').ready,false);
const clone=x=>JSON.parse(JSON.stringify(x));
const noSym=clone(puzzle);noSym.grid[0][0]='ا';
assert(Q.audit(noSym,bank).errors.some(e=>e.code==='symmetry'));
const tooMany=clone(puzzle);tooMany.grid[0]=Array(n).fill('');tooMany.grid[n-1]=Array(n).fill('');
assert(Q.audit(tooMany,bank).errors.some(e=>e.code==='black-density'));
const noClue=clone(puzzle);noClue.clues.horizontal['1'].pop();
assert(Q.audit(noClue,bank).errors.some(e=>e.code==='clue-count'));
const noReview=bank.map(x=>({...x,reviewed:0}));
assert(Q.audit(puzzle,noReview).errors.some(e=>e.code==='unreviewed'));
const noSource=bank.map(x=>({...x,source:''}));
assert(Q.audit(puzzle,noSource).errors.some(e=>e.code==='unreviewed'));
const publicOnly=Q.audit(puzzle);
assert.equal(publicOnly.bankPassed,false);
assert(Q.audit(puzzle,bank).stats.blackRatio>=0.12);
assert.equal(Q.normalize('كي‌تاب'),'کیتاب');
console.log('Quality gate: symmetric 15x15, 32 black, 3+ letters, source review, editorial score and failure modes verified.');
module.exports={puzzle,bank,report};
