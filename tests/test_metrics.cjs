const assert=require('node:assert/strict'),M=require('../metrics.js');
const old=[
 {id:'1',answer:'کتاب',clue:'چیز خواندنی'},
 {id:'2',answer:' کتاب ',clue:'چیز خواندنی'},
 {id:'3',answer:'کتاب',clue:'دفتر نوشته‌شده'},
 {id:'4',answer:'كَتاب',clue:'چیز خواندنی'},
 {id:'5',answer:'پژوهش',clue:'جست‌وجو'},
 {id:'6',answer:'پژوهش',clue:'کاوش'}
];
const stats=M.summarize(old);
assert.equal(stats.totalEntries,6);
assert.equal(stats.uniquePairs,4);
assert.equal(stats.duplicateEntries,2);
assert.equal(stats.uniqueAnswers,2);
assert.equal(stats.uniqueClues,4);
const unique=M.uniquePairs(old);
assert.equal(unique.length,4);
assert.equal(unique.filter(x=>M.normalize(x.answer)==='کتاب').length,2,
 'Keep the same answer when the clue changes');
assert.equal(M.pair('کلمهٔ آزمایشی','دنا'),M.pair('کلمه آزمایشی','دنا'));
assert.equal(M.pair('قلهٔ زاگرس','دنا')===M.pair('کلمه آزمایشی','دنا'),false);
assert.equal(old.length,6,'No source rows are deleted by analytics');
console.log('Studio metrics: duplicate = normalized clue AND normalized answer; source bank is untouched.');
