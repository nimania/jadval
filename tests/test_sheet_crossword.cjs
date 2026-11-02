const assert=require('node:assert/strict');
const core=require('../sheet-crossword-core.js');
const fs=require('node:fs');
const vm=require('node:vm');
const norm=core.normalize;
assert.equal(norm('كــتاب'),'کتاب');
assert.equal(norm('مي‌رويم'),'میرویم');
assert.notEqual(norm('آباد'),norm('اباد'));
const data=[[
'شناسه','پاسخ نرمال','پاسخ نمایشی','تعداد حروف','سرنخ','دسته',
'درجه دشواری','وضعیت','نوع رکورد','شناسه منبع','پیوند منبع','مجوز',
'تأیید مستند','یادداشت سردبیر','بازبین','تاریخ بررسی','وضعیت سرنخ'],
['id-1','شیراز','شیراز',5,'مرکز استان فارس','جغرافیا','easy','تأیید فرضی کاربر','','','','','','','','','در انتظار بررسی'],
['id-2','کتاب','کتاب',4,'','دسته‌بندی‌نشده','unknown','تأیید فرضی کاربر','','','','','','','','','بدون سرنخ'],
['id-3','دریا','دریا',5,'پهنهٔ آب شور','طبیعت','medium','رد','','','','','','','','','رد'],
['id-4','آب','آب',2,'مایع حیاتی','طبیعت','easy','تأیید فرضی کاربر','','','','','','','','','در انتظار بررسی']
];
const loaded=core.fromSheet(data);
assert.equal(loaded.entries.length,2);
assert.deepEqual(loaded.rejectedRows,[4,5]);
assert.equal(core.summarize(loaded.entries).withClue,1);
assert.equal(core.summarize(loaded.entries).uniqueAnswers,2);
const csv='شناسه,پاسخ نرمال,پاسخ نمایشی,تعداد حروف,سرنخ,دسته,درجه دشواری,وضعیت,نوع رکورد,شناسه منبع,پیوند منبع,مجوز,تأیید مستند,یادداشت سردبیر,بازبین,تاریخ بررسی,وضعیت سرنخ\n'+
'id-1,شیراز,شیراز,5,"مرکز استان فارس, ایران",جغرافیا,easy,تأیید فرضی کاربر,,,,,,,,,در انتظار بررسی\n';
assert.equal(core.parseFile(csv,'bank.csv').entries[0].clue,'مرکز استان فارس, ایران');
assert.equal(core.merge(loaded.entries,loaded.entries).length,2);
const window={};
vm.runInNewContext(fs.readFileSync('classic-patterns.js','utf8'),{window,Math});
const masks=window.JadvalClassic.build(15,20261102,4,[
 ...Array.from({length:40},(_,i)=>({answer:'آ'.repeat(3+i%6),clue:'سرنخ '+i}))
]);
assert(masks.length>0,'15x15 mask generation must not be empty');
for(const mask of masks){
 const g=core.geometry(mask);
 assert.equal(g.valid,true,'First mask must pass geometry audit');
 assert.equal(g.rotationalSymmetry,true);
 assert(g.density>=0.12&&g.density<=0.167);
 assert.equal(g.blackSquares2x2,0);
 assert(g.minimumLength>=3);
}
console.log('Sheet crossword 15×15 import and geometry checks passed');
