const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const window={},document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(fs.readFileSync('sparse-generator.js','utf8'),{window,document,Date,Math,Set});
const engine=window.JadvalSparse;
for(const size of [7,10,15]){
 const patterns=engine.patterns(size,2026,8);
 assert(patterns.length>0,'Must produce test patterns');
 for(const mask of patterns){
  assert(engine.validMask(mask),'Mask invalid');
  for(const row of mask)assert(row.filter(Boolean).length<=2);
  for(let c=0;c<size;c++)assert(mask.filter(row=>row[c]).length<=2);
  assert(engine.slotsFor(mask).every(slot=>slot.cells.length>=2));
 }
}
// A fillable low-block grid must be returned with its exact original clues.
const mask=Array.from({length:3},()=>Array(3).fill(false));
const bank=[
 ['ترم','ترم'],['اما','اما'],['مار','مار'],
 ['تام','تام'],['رام','رام'],['مرا','مرا'],
 ['تار','تار'],['رام','رام'],['مار','مار'],
].map(([answer,clue],i)=>({answer,clue:'سؤال '+i+' '+clue,id:String(i)}));
const value=engine.solve(mask,bank,500,42);
assert(value===null||value.puzzle.grid.length===3);
const horizontal=['مسافت','اینده','دلدار','اولیا','مرسین'];
const vertical=['مادام','سیلور','اندلس','فدایی','تهران'];
const bank2=[...horizontal,...vertical].map(answer=>({answer,clue:'نمونهٔ سؤال: '+answer,id:answer}));
const sample=engine.verifiedSeedSample(bank2);
assert(sample,'Verified seed sample should exist for a complete bank');
assert.equal(sample.slots,10);
assert(sample.puzzle.grid.every(row=>row.every(Boolean)),'Every sample cell must be filled');
for(let j=0;j<5;j++){
 const verticalWord=sample.puzzle.grid.map(row=>row[4-j]).join('');
 assert.equal(verticalWord,vertical[j]);
}
assert.equal(sample.puzzle.meta.referenceMaximumAnswerOverlap,.1);
console.log('Sparse mask and validated sample tests passed');
