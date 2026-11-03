const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const window={},document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(fs.readFileSync('sparse-generator.js','utf8'),{window,document,Date,Math,Set});
const engine=window.JadvalSparse;
for(const size of [7,10,15,20]){
 const masks=engine.patterns(size,2026,8);
 assert(masks.length>0,'No masks generated');
 for(const mask of masks){
  assert(engine.validMask(mask),'Invalid black-cell pattern');
  for(const row of mask) assert(row.filter(Boolean).length>=1&&row.filter(Boolean).length<=2);
  for(let c=0;c<size;c++) assert(mask.filter(row=>row[c]).length>=1&&mask.filter(row=>row[c]).length<=2);
  assert(engine.slotsFor(mask).every(slot=>slot.cells.length>=2),'No single-letter slots');
 }
 const incomplete={partial:true,puzzle:{version:0,grid:masks[0].map(row=>row.map(x=>x?'':' '))}};
 assert(!engine.validateComplete(incomplete),'Must reject incomplete drafts');
 console.log('Masks checked:',size);
}
const fullMask=engine.patterns(7,1234,1)[0];
const fake={puzzle:{version:3,grid:fullMask.map(row=>row.map(x=>x?'':' ')),clues:{horizontal:{},vertical:{}}},mask:fullMask};
assert(!engine.validateComplete(fake),'A complete marker must not mask unfilled cells');
const windowForPatterns={};
vm.runInNewContext(fs.readFileSync('classic-patterns.js','utf8'),{window:windowForPatterns,Math});
const magazineMask=windowForPatterns.JadvalClassic.referenceMask();
assert.equal(engine.slotsFor(magazineMask),null,'Legacy generator still rejects singleton answers');
assert.equal(engine.validMask(magazineMask,true),true,'Magazine profile permits genuine singleton cells');
assert.equal(engine.slotsFor(magazineMask,true).length,96,'Magazine reference slots must remain correctly grouped');
console.log('Magazine-only singleton allowance and strict legacy compatibility passed');
console.log('Complete-only preview guards pass');
