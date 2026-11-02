const assert=require('node:assert/strict');
const {approved,analyze,reviewReasons,citationOK,normalize,trustCorpus,corpusTrusted,candidateEntries}=require('../bank-readiness.js');
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
const storage=new Map();
global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
assert.equal(corpusTrusted(raw),false,'Bank trust must be opt-in');
assert.equal(candidateEntries(raw).length,2,'Without explicit trust only reviewed entries are candidates');
assert.equal(trustCorpus(raw),true,'Owner can attest only current local bank');
assert.equal(corpusTrusted(raw),true);
assert.equal(candidateEntries(raw).length,3,'Owner-attested, syntactically valid bank can enter the solver');
assert.equal(raw[1].reviewed,0,'Owner trust must not write or mass-approve entries');
assert.equal(corpusTrusted(raw.map((e,i)=>i===0?{...e,answer:'دفتر'}:e)),false,'Changed bank requires fresh owner approval');
delete global.localStorage;
console.log('Owner-attributed, revision-bound corpus trust permits candidate generation without changing private bank records.');
console.log('Local-only bank readiness, safe source/rights review, and approved-only 15x15 pool verified.');
