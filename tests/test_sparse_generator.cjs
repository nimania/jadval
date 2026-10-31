const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const window={},document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(fs.readFileSync('sparse-generator.js','utf8'),{window,document,Date,Math,Set});
const engine=window.JadvalSparse;
for(const size of [7,10,15,20]){
 const patterns=engine.patterns(size,2026,8);
 assert(patterns.length>0,'Must create masks');
 for(const mask of patterns){
  assert(engine.validMask(mask),'Mask invalid');
  for(const row of mask)assert(row.filter(Boolean).length>=1&&row.filter(Boolean).length<=2);
  for(let c=0;c<size;c++)assert(mask.filter(row=>row[c]).length>=1&&mask.filter(row=>row[c]).length<=2);
  assert(engine.slotsFor(mask).every(slot=>slot.cells.length>=2),'No one-letter slots');
 }
 const bank=['تهران','پاریس','شیراز','آفتاب','مریخ','ایران','ماهتاب','کبوتر','فروردین','دماسنج','باران','آسمان','ریحان','خورشید','کتاب','مداد','رودخانه','آرامش'].map((answer,i)=>({id:String(i),answer,clue:'سؤال '+i}));
 const draft=engine.draftFill(patterns[0],bank,123);
 assert.equal(draft.puzzle.grid.length,size);
 assert.equal(draft.puzzle.meta.status,'partial-draft');
 assert(draft.slots>=draft.filledSlots);
 assert(draft.puzzle.grid.every((row,r)=>row.every((ch,c)=>(patterns[0][r][c]?ch==='':ch!=='') ),'Never turn blanks into blocks');
 assert(draft.mask.every(row=>row.filter(Boolean).length>=1));
 for(const slot of engine.slotsFor(patterns[0])){
  const filled=slot.cells.map(([r,c])=>draft.puzzle.grid[r][c]);
  const hasFull=filled.every(ch=>ch.trim());
  const relevant=draft.puzzle.clues[slot.dir][String(slot.group)]||[];
  if(hasFull)assert(relevant.length>=1,'Finished slot needs its clue');
 }
 console.log('OK',size,'black cells:',patterns[0].flat().filter(Boolean).length,'filled:',draft.filledSlots);
}
