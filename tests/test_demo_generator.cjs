/* Regression test: generated entries must match slots in crossword v3 JSON. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(fs.readFileSync('demo-generator.js','utf8'),{window,document,console,Blob:global.Blob,Date,Set,Math});
const source=['آرامش','باران','شیراز','آفتاب','ریحان','ایران','تهران','کبوتر','پاییز','بارانی','مریخ','خورشید','ماهتاب','کتاب','مداد','بهاران','رودخانه','فردوسی','آسمان','تابستان','دماسنج'].map((answer,i)=>({id:String(i),answer,clue:'پرسش آزمایشی '+i}));
for(const size of [10,15,20]){
 const result=window.JadvalDemo.generate(source,size,20261031);
 assert(result&&result.placed.length>=3,'Need at least 3 placed words');
 const {grid,clues}=result.puzzle;
 const across={},down={};
 for(let row=0;row<size;row++){
  let col=size-1,answers=[];
  while(col>=0){
   if(!grid[row][col]){col--;continue}
   let chars=[];
   while(col>=0&&grid[row][col])chars.push(grid[row][col--]);
   if(chars.length>=2)answers.push(chars.join(''));
  }
  if(answers.length)across[String(row+1)]=answers;
 }
 for(let col=size-1;col>=0;col--){
  let row=0,answers=[];
  while(row<size){
   if(!grid[row][col]){row++;continue}
   let chars=[];
   while(row<size&&grid[row][col])chars.push(grid[row++][col]);
   if(chars.length>=2)answers.push(chars.join(''));
  }
  if(answers.length)down[String(size-col)]=answers;
 }
 for(const [direction,runs] of [['horizontal',across],['vertical',down]]){
  assert.equal(Object.keys(runs).length,Object.keys(clues[direction]).length,'Unexpected clue groups');
  for(const [key,answers] of Object.entries(runs)){
   assert.equal(answers.length,(clues[direction][key]||[]).length,'Slot/clue mismatch');
   for(const answer of answers)assert(result.placed.some(p=>p.answer===answer),'Unexpected orphan slot '+answer);
  }
 }
 console.log('OK',size,result.placed.length);
}
