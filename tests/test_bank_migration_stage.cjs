const assert=require('node:assert/strict');
const stage=require('../bank-migration-stage.js');
const security=require('../cloud-safety.js');
const make=(id,answer,clue,extra={})=>({
 id,answer,clue,letters:[...answer.replace(/[\u200c\s-]/g,'')].length,
 category:'دسته‌بندی‌نشده',difficulty:'unknown',reviewed:0,
 source:'',license:'',legacy:{},...extra
});
const original=[
 make('a','کتاب','چیز خواندنی'),make('b','کتاب','چیز خواندنی'),
 make('c','کتاب','دفتر نوشته‌شده'),make('d','باران','رحمت آسمانی')
];
const target=[
 original[0],original[2],original[3],
 make('new-1','ابر','توده‌ای از قطرات آب')
];
const report=stage.plan(original,target,security);
assert.equal(report.original,4);
assert.equal(report.originalUnique,3);
assert.equal(report.removedDuplicates,1);
assert.equal(report.added,1);
assert.equal(report.final,4);
assert.equal(report.uniqueAnswers,3);
assert.equal(report.uniqueClues,4);
assert.equal(report.preserved,true);
assert.equal(stage.acceptPayload({count:4,entries:target}).length,4);
assert.throws(()=>stage.plan(original,target.slice(1),security),/حذف می‌کند/);
assert.throws(()=>stage.plan(original,[...target,original[1]],security),/تکراری/);
assert.throws(()=>stage.plan(original,[{...target[0],clue:'سؤال متفاوت'},...target.slice(1)],security),/تغییر|حذف/);
assert.throws(()=>stage.plan(original,[{...target[0],reviewed:1},...target.slice(1)],security),/محتوای مدخل/);
assert.throws(()=>stage.plan(original,[{...target[0],id:'x'},...target.slice(1)],security),/شناسه/);
assert.throws(()=>stage.plan(original,[{...target[0],letters:2},...target.slice(1)],security),/تعداد حروف/);
assert.throws(()=>stage.acceptPayload({count:33,entries:target}),/تعداد/);
assert.deepEqual(original[0],make('a','کتاب','چیز خواندنی'),'Original data stays untouched');
assert.equal(stage.pair({answer:'كِتاب',clue:'چیز‌خواندنی'}),
 stage.pair({answer:'کتاب',clue:'چیز خواندنی'}));
console.log('Bank staging validates source preservation, pair-only dedup, ID integrity, no silent overwrites and additive changes.');
