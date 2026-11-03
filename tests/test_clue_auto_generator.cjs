'use strict';
const assert=require('node:assert/strict');
const model=require('../clue-in-cell.js');
const auto=require('../clue-auto-generator.js');
const chars=[...'ابپتجچدذرزژسشغفقرکگلمنوهی'];
const alphabet=chars;
const source=[];
let state=13371337;
function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
for(let i=0;i<1800;i++){
 const n=3+Math.floor(random()*9);
 const word=Array.from({length:n},()=>alphabet[Math.floor(random()*alphabet.length)]).join('');
 source.push({answer:word,clue:'سؤال آزمایشی شمارهٔ '+i});
}
source.push({answer:source[0].answer,clue:'سؤال متفاوت با همان جواب'});
source.push({answer:'نا معتبر',clue:'مدخل فاصله‌دار'});
const prepared=auto.poolFrom(source);
assert(prepared.pool.length>=1600);
assert(prepared.pool.every(x=>x.answer&&!x.answer.includes(' ')));
assert.equal(prepared.pool.filter(x=>x.answer===source[0].answer).length,1);
for(const variant of ['horizontal','vertical']){
 const data=auto.run(source,variant,{seed:42,attempts:3,steps:230,budgetMs:10000});
 const report=model.inspect(data.item);
 assert(report.valid,report.errors.join(' | '));
 assert.equal(data.item.type,'clue-in-cell');
 assert.equal(data.item.variant,variant);
 assert.equal(data.diagnostics.source,'central-firestore-authenticated');
 assert.equal(data.item.puzzle.meta.status,'draft');
 assert.equal(data.item.puzzle.meta.method,'central-bank-generator');
 assert(data.item.puzzle.entries.length>=1);
 const pairs=new Set(source.map(e=>model.normalize(e.answer)+'\u0000'+e.clue.trim()));
 assert(data.item.puzzle.entries.every(e=>pairs.has(e.answer+'\u0000'+e.clue)));
 assert.equal(new Set(data.item.puzzle.entries.map(e=>e.answer)).size,data.item.puzzle.entries.length);
 assert.equal(model.validate(data.item),false,'Generated drafts never auto-publish');
 assert.equal(report.publishable,data.diagnostics.complete);
 console.log('Auto clue '+variant+':',JSON.stringify({entries:report.stats.entries,letters:report.stats.letter,empty:report.stats.empty,crossings:report.stats.crossings,publishable:report.publishable}));
}
assert.throws(()=>auto.run(source,'unknown'),/قالب/);
assert.throws(()=>auto.run([],'vertical'),/کافی/);
console.log('Automated wordbank-only generation, credible intersection, distinct answers and safe editorial output passed.');
