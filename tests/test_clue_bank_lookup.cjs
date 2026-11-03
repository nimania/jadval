const assert=require('node:assert/strict');
const lookup=require('../clue-bank-lookup.js');
const words=[
 {id:'one',answer:'باران',clue:'رحمت آسمانی'},
 {id:'two',answer:'باران',clue:'رحمت آسمانی'},
 {id:'three',answer:'باران',clue:'قطرات آب'},
 {id:'four',answer:'دریا',clue:'پهنهٔ آب'},
 {id:'five',answer:'كتاب',clue:'دفتر نوشته'},
];
assert.equal(lookup.search(words,'باران').length,2,'Exact clue+answer duplicates are collapsed');
assert.equal(lookup.search(words,'رحمت')[0].answer,'باران');
assert.equal(lookup.search(words,'كِتاب')[0].answer,'کتاب');
assert.equal(lookup.search(words,'ا').length,0,'Single-letter queries are blocked');
assert.equal(lookup.search(words,'باران',1).length,1,'Result size capped');
assert.equal(lookup.search(words,'موضوع ناموجود').length,0);
assert.equal(words.length,5,'Source remains untouched');
console.log('Private local lexicon lookup: read-only normalization, dedup and search limit passed.');
