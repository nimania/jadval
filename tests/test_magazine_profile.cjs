const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Q=require('../quality-gate.js');
const w={};
vm.runInNewContext(fs.readFileSync('classic-patterns.js','utf8'),{window:w,Math});
const mask=w.JadvalClassic.referenceMask(),n=15;
const alphabet=[...'آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];
const probe=grid=>Q.audit({version:3,grid,clues:{horizontal:{},vertical:{}},
 meta:{profile:'iran-magazine'}}).slots;
let grid,slots;
for(let seed=1;seed<=100;seed++){
 let state=seed*7919;
 const next=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)%alphabet.length);
 grid=mask.map(row=>row.map(block=>block?'':alphabet[next()]));
 slots=probe(grid);
 const singles=slots.filter(s=>s.cells.length===1);
 for(let k=0;k<singles.length;k++){
  const [r,c]=singles[k].cells[0];grid[r][c]=alphabet[k];
 }
 slots=probe(grid);
 const all=slots.map(s=>s.cells.map(([r,c])=>grid[r][c]).join(''));
 if(new Set(all).size===all.length)break;
 if(seed===100)throw Error('Synthetic test fixture failed to avoid duplicate answers');
}
const clues={horizontal:{},vertical:{}},bank=[];
for(let i=0;i<slots.length;i++){
 const s=slots[i],answer=s.cells.map(([r,c])=>grid[r][c]).join(''),clue='سؤال مستقل '+i;
 (clues[s.dir][String(s.group)]??=[]).push(clue);
 bank.push({id:String(i),answer,clue,reviewed:0,source:'',license:'',
  category:'دسته‌بندی‌نشده',difficulty:'unknown'});
}
const puzzle={version:3,grid,clues,meta:{profile:'iran-magazine',status:'draft'}};
const audit=Q.audit(puzzle,bank,{trustedCorpus:true});
assert.equal(audit.profile,'iran-magazine');
assert.equal(audit.stats.blackCount,36);
assert.equal(audit.stats.shortSlots,18);
assert.equal(audit.stats.slots,96);
assert.deepEqual(audit.errors,[],JSON.stringify(audit.errors.slice(0,10)));
assert.equal(audit.technicalPassed,true);
assert.equal(audit.bankPassed,true);
assert.equal(audit.publishable,false,'Pure technical test is not editorial approval');
const strict=Q.audit({...puzzle,meta:{profile:'strict'}},bank,{trustedCorpus:true});
assert(strict.errors.some(x=>x.code==='short-answer'),'Original strict option must reject short slots');
const broken=JSON.parse(JSON.stringify(puzzle));
broken.clues.horizontal['6'].pop();
assert(Q.audit(broken,bank,{trustedCorpus:true}).errors.some(x=>x.code==='clue-count'));
console.log('Photo-accurate magazine 15x15: 36 blocks, 96 slots incl. 18 short, crossed, exact-bank pair validation; strict mode preserved.');
