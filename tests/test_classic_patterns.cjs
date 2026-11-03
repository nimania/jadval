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
  assert(mask.every(row=>row.some(v=>!v)),'Lost row');
  for(let c=0;c<size;c++)assert(mask.some(row=>!row[c]),'Lost column');
  const black=mask.flat().filter(Boolean).length;
  assert(black/(size*size)>=.12&&black/(size*size)<=.167,'Black density outside 12-16.7%');
  for(let r=0;r<size;r++)for(let c=0;c<size;c++)
   assert.equal(mask[r][c],mask[size-1-r][size-1-c],'180-degree rotational symmetry required');
  const spans=window.JadvalClassic.slots(mask);
  assert(spans.every(x=>x.length>=3),'Short answers must be at least three letters');
  // Long slots can be legitimate; the CSP solver must report missing bank lengths honestly.
  assert(spans.every(x=>x.length<=size),'Slot must fit the grid');
  keys.add(mask.map(row=>row.map(x=>x?'#':'.').join('')).join('/'));
 }
 assert.equal(keys.size,masks.length,'Duplicate masks');
 console.log('Classic',size,'valid patterns:',masks.length);
}

// The 15x15 classic mask is the editorial baseline; it is not a completed crossword.
assert(window.JadvalClassic.build(15,31827,4,sample).length>0);


// Printed Iranian magazine layout: 36 black cells and 18 genuine short slots.
const reference=window.JadvalClassic.referenceMask();
assert.equal(reference.length,15);
assert.equal(reference.flat().filter(Boolean).length,36);
assert.equal(window.JadvalClassic.valid(reference,'iran-magazine'),true);
assert.equal(window.JadvalClassic.valid(reference,'strict'),false);
const referenceSlots=window.JadvalClassic.slots(reference);
assert.equal(referenceSlots.filter(x=>x.length===1).length,6);
assert.equal(referenceSlots.filter(x=>x.length===2).length,12);
for(let r=0;r<15;r++)for(let c=0;c<15;c++)
 assert.equal(reference[r][c],reference[14-r][14-c],'Reference must rotate by 180°');
const adapted=window.JadvalClassic.adaptedMask();
assert.equal(adapted.flat().filter(Boolean).length,36);
assert.equal(window.JadvalClassic.valid(adapted,'iran-magazine'),true);
assert.equal(window.JadvalClassic.slots(adapted).filter(x=>x.length===1).length,0);
const bankWithoutSingles=Array.from({length:15},(_,i)=>({
 answer:'ا'.repeat(i+1),clue:'نمونهٔ تست'
})).filter(x=>x.answer.length>=2);
const magazineSet=window.JadvalClassic.build(15,20261103,3,bankWithoutSingles,'iran-magazine');
assert(magazineSet.length>0);
assert(magazineSet.every(x=>window.JadvalClassic.valid(x,'iran-magazine')));
assert(magazineSet.every(mask=>window.JadvalClassic.slots(mask).every(x=>x.length>=2)),
 'Magazine layouts must not require unavailable one-letter entries');
assert(magazineSet.some(mask=>JSON.stringify(mask)===JSON.stringify(adapted)),
 'The closest bank-compatible photo layout must be included');

// Duplicate clue records do not create additional usable answer strings.
const twoLetterGrid=Array.from({length:10},()=>Array(10).fill(false));
twoLetterGrid[0][2]=true;
const repeated=Array.from({length:30},()=>({answer:'آب',clue:'یک پرسش متفاوت'}));
const review=window.JadvalClassic.assess(twoLetterGrid,repeated);
assert(review.scarceLengths.includes(2),'30 duplicate records count as one 2-letter answer');
