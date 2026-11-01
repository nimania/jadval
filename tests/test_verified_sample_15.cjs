const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},document:{readyState:'loading',addEventListener(){}},Date,Math,Set,Map};
vm.runInNewContext(fs.readFileSync('sparse-generator.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('verified-sample-15.js','utf8'),context);
const {getRows,build,variants}=context.window.JadvalVerified15,api=context.window.JadvalSparse;
assert.equal(variants,3);
for(let variant=0;variant<variants;variant++){
 const rows=getRows(variant);
 assert.equal(rows.length,15);
 const raw=rows.map(s=>[...s].reverse().map(ch=>ch==='■'?'':ch));
 const grid=variant===1?raw.map((row,r)=>row.map((_,c)=>raw[14-c][14-r])):raw;
 const mask=grid.map(row=>row.map(ch=>!ch));
 const slots=api.slotsFor(mask);
 assert.equal(slots.length,77,'Exactly 77 bank-backed answer slots');
 const words=slots.map(slot=>slot.cells.map(([r,c])=>grid[r][c]).join(''));
 assert.equal(new Set(words).size,77,'No repeated answers');
 const bank=words.map((answer,i)=>({id:'s'+i,answer,clue:'سرنخ بانک '+i}));
 const result=build(bank,variant);
 assert(result.result,result.error);
 assert.equal(result.result.puzzle.meta.sampleVariant,variant+1);
 assert(api.validateComplete(result.result),'15x15 proof must be fully solved');

 assert(api.validateWithBank(result.result,bank),'Every answer and matching source clue must be present in bank');
 const tampered=JSON.parse(JSON.stringify(result.result));
 const firstSlot=api.slotsFor(tampered.mask)[0];
 tampered.puzzle.clues[firstSlot.dir][String(firstSlot.group)][0]='سرنخِ ساختگی و خارج از بانک';
 assert(!api.validateWithBank(tampered,bank),'Made-up clue must be rejected even on a full grid');
 assert(!api.validateWithBank(result.result,bank.slice(1)),'Missing source-backed answer must be rejected');
 assert(!api.validateWithBank(result.result,[]),'Empty bank must never authorize a complete puzzle');

 assert(grid.every(row=>row.some(Boolean)),'No removed row');
 for(let c=0;c<15;c++)assert(grid.some(row=>row[c]),'No removed column');
 assert.equal(mask.flat().filter(Boolean).length,58);
 assert(build([],variant).error,'Bankless attempt must fail honestly');
 console.log('Complete sample',variant+1,': 77 unique answers, 58 blocks, all cells accounted for');
}
