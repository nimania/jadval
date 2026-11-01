const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('classic-patterns.js','utf8'),{window,Math});
const model={2:200,3:200,4:200,5:200,6:200,7:200,8:200,9:200,10:200,11:200,12:200,13:6,14:9,15:51};
const sample=[];
for(const [length,total] of Object.entries(model))
 for(let i=0;i<Math.min(total,20);i++)sample.push({answer:'آ'.repeat(Number(length))});
for(const size of [15,20]){
 const masks=window.JadvalClassic.build(size,20261031,5,sample);
 assert(masks.length>0,'Need classic masks for '+size);
 const keys=new Set();
 for(const mask of masks){
  assert(window.JadvalClassic.valid(mask),'Invalid classic mask');
  assert(mask.every(row=>row.some(v=>!v)&&row.some(Boolean)),'Lost row');
  for(let c=0;c<size;c++)assert(mask.some(row=>row[c])&&mask.some(row=>!row[c]),'Lost column');
  const spans=window.JadvalClassic.slots(mask);
  assert(spans.every(x=>x.length>=2),'One-letter slot');
  assert(spans.every(x=>x.length<=12),'Do not require unavailable long answers');
  keys.add(mask.map(row=>row.map(x=>x?'#':'.').join('')).join('/'));
 }
 assert.equal(keys.size,masks.length,'Duplicate masks');
 console.log('Classic',size,'valid patterns:',masks.length);
}

// The 15x15 classic mask is the editorial baseline; it is not a completed crossword.
assert(window.JadvalClassic.build(15,31827,4,sample).length>0);


// Duplicate clue records do not create additional usable answer strings.
const twoLetterGrid=Array.from({length:10},()=>Array(10).fill(false));
twoLetterGrid[0][2]=true;
const repeated=Array.from({length:30},()=>({answer:'آب',clue:'یک پرسش متفاوت'}));
const review=window.JadvalClassic.assess(twoLetterGrid,repeated);
assert(review.scarceLengths.includes(2),'30 duplicate records count as one 2-letter answer');
