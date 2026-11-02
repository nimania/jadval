const assert=require('node:assert/strict');
const {approved,analyze,reviewReasons,citationOK,normalize}=require('../bank-readiness.js');
const valid={
 id:'item-1',answer:'کتاب',clue:'مجموعه‌ای از برگ‌های نوشته‌شده',
 source:'فرهنگ معین، مدخل کتاب، جلد دوم',license:'author-original',
 category:'ادبیات و زبان',difficulty:'easy',reviewed:1
};
assert.equal(approved(valid),true,'Source-backed manually reviewed entry should qualify');
assert.equal(approved({...valid,reviewed:0}),false,'Unreviewed entry must never enter the professional pool');
assert.equal(approved({...valid,source:'آرشیو جدول'}),false,'A crossword archive is not dictionary evidence');
assert.equal(approved({...valid,source:''}),false,'Citation is required');
assert.equal(approved({...valid,license:'unknown'}),false,'Unclear rights must be rejected');
assert.equal(approved({...valid,category:'عمومی'}),false,'A specific topic is required');
assert.equal(approved({...valid,difficulty:'unknown'}),false,'Unscored entries are not approved');
assert.equal(approved({...valid,answer:'آب'}),false,'Two-character answers are not eligible');
assert.equal(approved({...valid,clue:'?' }),false,'Clue must be more than a token');
assert.equal(approved({...valid,answer:'كتاب'}),true,'Persian normalization should work');
assert.equal(citationOK('https://www.example.org/dictionary/ketab'),true);
assert.equal(citationOK('جدول ۱۲'),false);
assert.equal(normalize('كـتاب'), 'کتاب');
const raw=[valid,{...valid,id:'item-2',reviewed:0},
 {...valid,id:'item-3',answer:'باران',clue:'بارش قطره‌های آب',
  source:'فرهنگ معین، مدخل باران، جلد اول',difficulty:'medium',category:'طبیعت'}];
const report=analyze(raw);
assert.equal(report.total,3);
assert.equal(report.reviewedFlag,2);
assert.equal(report.approved,2);
assert.equal(report.uniqueApproved,2);
assert.equal(report.byLength[4].approved,1);
assert.equal(report.byLength[5].approved,1);
assert(report.candidates.some(x=>x.id==='item-2'),'Queue contains unreviewed source-backed entry');
assert(reviewReasons(raw[1]).length===0,'Unreviewed can have all metadata but still needs human approval');
const nobody=analyze(raw.map(x=>({...x,reviewed:0})));
assert.equal(nobody.approved,0);
assert(nobody.warnings.length>0);
console.log('Local-only bank readiness, safe source/rights review, and approved-only 15x15 pool verified.');
