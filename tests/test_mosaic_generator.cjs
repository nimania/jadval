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
const bank=[...synthetic(2),...synthetic(3),...synthetic(4)];
for(const size of [7,10,15,20]){
 for(const seed of [2026+size,2027+size,2028+size]){
  const output=engine.generate(bank,size,seed);
  assert(output.result,output.error);
  const {puzzle,mask}=output.result;
  assert.equal(puzzle.grid.length,size);
  assert(validator.validateComplete(output.result),'Generated crossword failed strict validation');
  // Every numbered axis has an ordered list of slots. Across goes from the
  // right edge leftward; down goes from the top edge toward the bottom.
  const slotOffsets={horizontal:new Map(),vertical:new Map()};
  const clueLookup=new Map(bank.map(e=>[e.answer,e.clue]));
  for(const slot of validator.slotsFor(mask)){
   const key=String(slot.group),offset=slotOffsets[slot.dir].get(key)||0;
   const answer=slot.cells.map(([r,c])=>puzzle.grid[r][c]).join('');
   assert.equal(puzzle.clues[slot.dir][key][offset],clueLookup.get(answer),
    'Clues must follow RTL/down slot order (not tile order)');
   slotOffsets[slot.dir].set(key,offset+1);
  }
  for(const dir of ['horizontal','vertical'])for(const [number,count] of slotOffsets[dir]){
   assert.equal(puzzle.clues[dir][number].length,count,'Only one numbered group per axis');
   const line=validator.groupedClueLines(puzzle,dir).find(x=>x.number===Number(number));
   assert.equal(line.questions.length,count);
   assert.equal(line.text.split(' - ').length,count+1,'Hyphens must separate all clues');
  }
  assert(puzzle.grid.every((row,r)=>row.every((letter,c)=>mask[r][c]?letter==='':letter.length===1)));
  assert(puzzle.grid.every(row=>row.some(Boolean)),'No fully black row allowed');
  for(let c=0;c<size;c++)assert(puzzle.grid.some(row=>row[c]),'No fully black column allowed');
  const across=Object.values(puzzle.clues.horizontal).flat().length;
  const down=Object.values(puzzle.clues.vertical).flat().length;
  assert.equal(across,down,'Tiled answer groups must balance');
  if(size===20)assert(output.result.tiles.some(t=>t.tileSize===2)&&output.result.tiles.some(t=>t.tileSize===4),'Mixed 2x2 and 4x4 tiles');
  console.log('complete',size,seed,'answers',across+down,'black',mask.flat().filter(Boolean).length);
 }
}
