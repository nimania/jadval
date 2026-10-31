const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={self:{addEventListener(){},postMessage(){}},Date,Math,Set,Map};
vm.runInNewContext(fs.readFileSync('classic-solver-worker.js','utf8'),context);
const {solve,tryMasks}=context.self.JadvalWorkerEngine;
const letters=['ا','ب','پ','ت'],entries=[];
for(const a of letters)for(const b of letters)for(const c of letters){
 const word=a+b+c;entries.push({answer:word,clue:'سرنخ '+word,id:word});
}
const grid=Array.from({length:3},()=>Array(3).fill(false));
const solution=solve(grid,entries,{limitMs:1500,limitNodes:20000,seed:42});
assert.equal(solution.status,'solved');
assert.equal(solution.slotCount,6);
assert.equal(solution.bestDepth,6);
assert(solution.puzzle.grid.every(row=>row.every(Boolean)));
const solution2=tryMasks([grid],entries,{totalMs:1500});
assert.equal(solution2.status,'solved');
const empty=solve(grid,[],{limitMs:100});
assert.equal(empty.status,'missing-lengths');
const broken=solve([[false]],entries,{limitMs:100});
assert.equal(broken.status,'invalid-mask');
console.log('Worker CSP, consistency and failure diagnostics passed');
