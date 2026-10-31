const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={},document={readyState:'loading',addEventListener(){}};
const ctx={window,document,Date,Math,Set};
for(const name of ['sparse-generator.js','mosaic-generator.js'])vm.runInNewContext(fs.readFileSync(name,'utf8'),ctx);
const engine=window.JadvalMosaic,validator=window.JadvalSparse;
function synthetic(length){
 const chars=['ا','ب','پ','ت'],entries=[];
 const visit=(w)=>{if(w.length===length){entries.push({id:w,answer:w,clue:'سرنخ آزمایشی '+w});return;}
  for(const letter of chars)visit(w+letter)};
 visit('');return entries;
}
for(const size of [7,10,15,20]){
 const bank=synthetic(size===7?3:4),output=engine.generate(bank,size,2026+size);
 assert(output.result,output.error);
 const {puzzle,mask}=output.result;
 assert.equal(puzzle.grid.length,size);
 assert(validator.validateComplete(output.result),'Generated crossword failed strict validation');
 assert(puzzle.grid.every((row,r)=>row.every((letter,c)=>mask[r][c]?letter==='':letter.length===1)));
 const cols=Object.values(puzzle.clues.vertical).flat().length;
 const rows=Object.values(puzzle.clues.horizontal).flat().length;
 assert.equal(rows,cols,'Tiles should balance across and down');
 console.log('complete',size,'slots',rows+cols,'black',mask.flat().filter(Boolean).length);
}
