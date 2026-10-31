const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('classic-patterns.js','utf8'),{window,Math});
for(const size of [15,20]){
 const masks=window.JadvalClassic.build(size,20261031,8);
 assert(masks.length>0,'Need at least one classic mask for '+size);
 const keys=new Set();
 for(const mask of masks){
  assert(window.JadvalClassic.valid(mask),'Invalid classic pattern');
  assert(mask.every(row=>row.some(v=>v===false)&&row.some(Boolean)),'Lost/empty row');
  for(let c=0;c<size;c++)assert(mask.some(row=>!row[c])&&mask.some(row=>row[c]),'Lost/empty column');
  assert(window.JadvalClassic.slots(mask).every(x=>x.length>=2),'One-letter slot');
  keys.add(mask.map(row=>row.map(x=>x?'#':'.').join('')).join('/'));
 }
 assert.equal(keys.size,masks.length,'Duplicate patterns');
 console.log('Classic '+size+' x '+size+': '+masks.length+' valid masks');
}
