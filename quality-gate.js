/* Independent, fail-closed Persian crossword quality audit.
   Geometry is checked from the actual published grid, not from solver flags.
   No mechanical check can prove dictionary truth or semantic uniqueness.
   Those require reviewed evidence and editorial sign-off. */
(function(root){
'use strict';
const letters=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]$/;
const normalize=s=>String(s??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,'');
const normalizeClue=s=>String(s??'').trim().replace(/\s+/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک');
const id=(r,c)=>r+','+c;
const acceptedLicenses=new Set(['author-original','public-domain','permission-granted','licensed-content']);
function sourceQualified(row,maxLength){
 if(!row||(row.reviewed!==1&&row.reviewed!==true))return false;
 if(root?.JadvalBankReadiness?.approved)return root.JadvalBankReadiness.approved(row,maxLength);
 const answer=normalize(row.answer),source=String(row.source||'').trim();
 return answer.length>=3&&answer.length<=maxLength &&
  source.length>=14&&!/^(?:archive|legacy|unknown|نامشخص|آرشیو|جدول|فایل|بانک)[\s:،#\d-]*$/i.test(source)&&
  acceptedLicenses.has(String(row.license||''))&&
  ['easy','medium','hard'].includes(row.difficulty)&&
  !!row.category&&!['عمومی','دسته‌بندی‌نشده','سایر'].includes(row.category);
}

const supported=new Set([7,10,15,20]);
function audit(puzzle,bank,options={}){
 const trustedCorpus=options?.trustedCorpus===true;
 const errors=[],warnings=[],n=puzzle?.grid?.length;
 const fail=(code,detail)=>{errors.push({code,detail});};
 const report={schema:1,policy:'strict-persian-crossword-2026',technicalPassed:false,
  bankPassed:false,publishable:false,score:null,errors,warnings,
  stats:{size:n||0,blackCount:0,blackRatio:0,whiteCount:0,slots:0,lengths:{},categories:0,difficulties:0}};
 if(!supported.has(n)||!Array.isArray(puzzle.grid)||!puzzle.grid.every(row=>Array.isArray(row)&&row.length===n)){
  fail('grid','شبکه باید مربعی و دارای اندازهٔ پشتیبانی‌شده باشد.');return report;
 }
 const magazine=puzzle?.meta?.profile==='iran-magazine';
 const grid=puzzle.grid,mask=grid.map(row=>row.map(cell=>cell===''));
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const ch=grid[r][c];
  if(typeof ch!=='string'||(ch!==''&&(!letters.test(ch)||ch!==normalize(ch))))
   fail('letters','خانهٔ '+(r+1)+'،'+(n-c)+' باید یک حرف فارسی نرمال‌شده یا خانهٔ سیاه باشد.');
 }
 let black=0;
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  if(mask[r][c])black++;
  if(mask[r][c]!==mask[n-1-r][n-1-c]){
   if(r*n+c<(n-1-r)*n+n-1-c)fail('symmetry','تقارن چرخشی ۱۸۰ درجه در خانهٔ '+(r+1)+'،'+(c+1)+' نقض شده است.');
  }
  if(r<n-1&&c<n-1&&mask[r][c]&&mask[r+1][c]&&mask[r][c+1]&&mask[r+1][c+1])
   fail('black-square','بلوک سیاه ۲×۲ در ردیف '+(r+1)+' و ستون '+(c+1)+' مجاز نیست.');
 }
 const total=n*n,white=total-black,ratio=black/total;
 Object.assign(report.stats,{blackCount:black,blackRatio:ratio,whiteCount:white});
 const minDensity=magazine?.10:.12,maxDensity=magazine?.22:.167;
 if(ratio<minDensity-1e-9||ratio>maxDensity+1e-9)
  fail('black-density','چگالی '+(100*ratio).toFixed(1)+'٪ بیرون محدودهٔ '+(100*minDensity)+' تا '+(100*maxDensity)+' درصد است.');
 if(!white){fail('no-white','جدول هیچ خانهٔ سفیدی ندارد.');return report;}
 const queue=[],visited=new Set();
 outer:for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(!mask[r][c]){queue.push([r,c]);visited.add(id(r,c));break outer;}
 for(let head=0;head<queue.length;head++){
  const [r,c]=queue[head];
  for(const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]])
   if(rr>=0&&rr<n&&cc>=0&&cc<n&&!mask[rr][cc]&&!visited.has(id(rr,cc))){
    visited.add(id(rr,cc));queue.push([rr,cc]);
   }
 }
 if(visited.size!==white)fail('connected','شبکهٔ سفید دارای '+(white-visited.size)+' خانهٔ جداافتاده از بخش اصلی است.');
 const slots=[],coverage=new Map();
 function addSlot(dir,group,cells){
  if(!cells.length)return;
  if(!magazine&&cells.length<3)fail('short-answer','پاسخ '+(dir==='horizontal'?'افقی ':'عمودی ')+group+' تنها '+cells.length+' حرف دارد (حداقل ۳ در حالت سخت‌گیرانه).');
  const answer=cells.map(([r,c])=>grid[r][c]).join('');
  const slot={dir,group,cells,answer};slots.push(slot);
  for(const [r,c] of cells){
   const k=id(r,c),item=coverage.get(k)||{horizontal:0,vertical:0};
   item[dir]++;coverage.set(k,item);
  }
 }
 for(let r=0;r<n;r++){
  let c=n-1;
  while(c>=0){
   if(mask[r][c]){c--;continue;}
   const cells=[];while(c>=0&&!mask[r][c])cells.push([r,c--]);
   addSlot('horizontal',r+1,cells);
  }
 }
 for(let c=n-1;c>=0;c--){
  let r=0;
  while(r<n){
   if(mask[r][c]){r++;continue;}
   const cells=[];while(r<n&&!mask[r][c])cells.push([r++,c]);
   addSlot('vertical',n-c,cells);
  }
 }
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(!mask[r][c]){
  const cross=coverage.get(id(r,c));
  if(!cross||cross.horizontal!==1||cross.vertical!==1)
   fail('coverage','خانهٔ سفید '+(r+1)+'،'+(n-c)+' باید در دقیقاً یک پاسخ افقی و یک پاسخ عمودی باشد.');
 }
 report.profile=magazine?'iran-magazine':'strict';
 report.stats.shortSlots=slots.filter(slot=>slot.cells.length<=2).length;
 report.stats.slots=slots.length;
 const groups={horizontal:{},vertical:{}},uniqueAnswers=new Set(),uniqueClues=new Set();
 for(const slot of slots){
  const key=String(slot.group);
  (groups[slot.dir][key]??=[]).push(slot);
  const answer=normalize(slot.answer);
  report.stats.lengths[slot.cells.length]=(report.stats.lengths[slot.cells.length]||0)+1;
  if(uniqueAnswers.has(answer))fail('duplicate-answer','پاسخ تکراری: '+answer);
  uniqueAnswers.add(answer);
 }
 for(const dir of ['horizontal','vertical']){
  const given=puzzle.clues?.[dir];
  if(!given||typeof given!=='object'||Array.isArray(given)){fail('clues','سرنخ‌های '+dir+' ارائه نشده‌اند.');continue;}
  const expected=groups[dir];
  if(Object.keys(given).length!==Object.keys(expected).length)
   fail('clue-groups','تعداد شماره‌های '+dir+' با جایگاه‌ها یکسان نیست.');
  for(const [key,expectedSlots] of Object.entries(expected)){
   const clues=given[key];
   if(!Array.isArray(clues)||clues.length!==expectedSlots.length){
    fail('clue-count','شمارهٔ '+key+' '+dir+' باید دقیقاً '+expectedSlots.length+' سؤال داشته باشد.');continue;
   }
   for(const clue of clues){
    const cleaned=normalizeClue(clue);
    if(!cleaned||cleaned.length>1500)fail('clue-content','سرنخ خالی یا نامعتبر در '+dir+' '+key+'.');
    if(uniqueClues.has(cleaned))fail('duplicate-clue','سرنخ تکراری: '+cleaned);
    uniqueClues.add(cleaned);
   }
  }
 }
 report.stats.slots=slots.length;
 // Bank verification applies only when the ORIGINAL private source bank is provided.
 // Exact matching alone does not prove a word exists; "reviewed" flags and
 // identifiable sources are required, and they remain subject to human review.
 report.corpusMode=trustedCorpus?'owner-attested':'entry-reviewed';
 const bankAvailable=Array.isArray(bank);
 if(bankAvailable){
  const byPair=new Map();
  for(const row of bank){
   const answer=normalize(row?.answer),clue=normalizeClue(row?.clue);
   if(!answer||!clue)continue;
   const key=answer+'\u0000'+clue;
   const list=byPair.get(key)||[];list.push(row);byPair.set(key,list);
  }
  const category=new Set(),difficulty=new Set();
  for(const dir of ['horizontal','vertical'])
   for(const [group,items] of Object.entries(groups[dir]))
    for(let i=0;i<items.length;i++){
     const slot=items[i],clue=normalizeClue(puzzle.clues?.[dir]?.[group]?.[i]);
     const sources=byPair.get(normalize(slot.answer)+'\u0000'+clue)||[];
     if(!sources.length){fail('unmatched-bank','سرنخ/پاسخ '+dir+' '+group+' با بانک اصلی تطابق ندارد.');continue;}
     const reviewed=sources.find(row=>trustedCorpus||sourceQualified(row,n));
     if(!reviewed){fail('unreviewed','پاسخ '+slot.answer+' هنوز بازبینی، منبع مشخص، مجوز انتشار، موضوع و سطح دشواری قابل‌قبول ندارد.');continue;}
     category.add(String(reviewed.category||'دسته‌بندی‌نشده'));
     difficulty.add(String(reviewed.difficulty||'unknown'));
    }
  report.stats.categories=category.size;report.stats.difficulties=difficulty.size;
  const distinctLengths=Object.keys(report.stats.lengths).length;
  if(slots.length>=15&&distinctLengths<3)
   fail('length-variety','جدول حداقل به سه طول متفاوت پاسخ نیاز دارد.');
  if(slots.length>=20&&category.size<4){
   if(trustedCorpus)warnings.push('موضوع‌ها در بانک خام برچسب‌گذاری نشده‌اند؛ تنوع موضوعی جدول باید در مرحلهٔ بازبینی نهایی به‌طور مستقل تأیید شود.');
   else fail('topic-variety','حداقل چهار حوزهٔ موضوعی بازبینی‌شده لازم است.');
  }
  if(slots.length>=15&&!['easy','medium','hard'].every(x=>difficulty.has(x))){
   if(trustedCorpus)warnings.push('دشواری پاسخ‌ها در بانک خام برچسب‌گذاری نشده است؛ توازن آسان، متوسط و دشوار باید توسط بازبین جدول نهایی تأیید شود.');
   else fail('difficulty-balance','پاسخ‌های آسان، متوسط و دشوار باید همگی حضور داشته باشند.');
  }
 }else warnings.push('بدون بانک خصوصی، اعتبار واژگان و سرنخ‌ها قابل احراز نیست.');
 const structural=['grid','letters','symmetry','black-square','black-density','no-white',
  'connected','short-answer','coverage','duplicate-answer','duplicate-clue',
  'clues','clue-groups','clue-count','clue-content'];
 report.technicalPassed=!errors.some(x=>structural.includes(x.code));
 report.bankPassed=bankAvailable&&errors.length===0;
 report.slots=slots;
 if(report.technicalPassed&&report.bankPassed)
  warnings.push(trustedCorpus?
   'بانک بنا بر تأیید مالک برای طراحی پذیرفته شده است، نه به‌عنوان گواه مستقل. کیفیت، موضوع، دشواری، یکتایی معنایی و حقوق انتشار جدول نهایی به تأیید ویراستار نیاز دارند.':
   'معنای واژگان، یکتایی معنایی حل، انصاف سرنخ‌ها و تجربهٔ بازی نیاز به تأیید مستقل ویراستار دارند.');
 return report;
}
const editorialFields={words:10,clues:10,uniqueness:10,experience:5,geometry:5};
function score(auditResult,ratings,confirmations,reviewer){
 if(!auditResult?.technicalPassed||!auditResult?.bankPassed||auditResult.errors.length)
  return {ready:false,score:null,reason:'آزمون‌های ساختاری یا بانک واژگان رد شده‌اند.'};
 const name=String(reviewer||'').trim();
 if(name.length<3)return {ready:false,score:null,reason:'نام بازبین مسئول را وارد کن.'};
 if(!['words','clues','uniqueness','experience','geometry','variety','difficulty','sources','rights'].every(k=>confirmations?.[k]===true))
  return {ready:false,score:null,reason:'همهٔ تأییدهای محتوایی و حقوق انتشار لازم هستند.'};
 let manual=0;
 for(const [key,max] of Object.entries(editorialFields)){
  const value=Number(ratings?.[key]);
  if(!Number.isInteger(value)||value<0||value>max||ratings?.[key]===''||ratings?.[key]==null)
   return {ready:false,score:null,reason:'امتیاز '+key+' باید عدد صحیح بین ۰ و '+max+' باشد.'};
  manual+=value;
 }
 // 60 technical / 40 editorial. The 60 points are awarded only after ALL
 // non-negotiable technical + reviewed-source tests pass.
 const total=60+manual;
 return {ready:total>=90,score:total,technical:60,editorial:manual,
  reviewer:name,reason:total>=90?'بازبینی انسانی ثبت شده؛ این تأیید به معنی اثبات ماشینیِ یکتایی معنایی نیست.':'امتیاز کمتر از حد نصاب ۹۰ است.'};
}
const api={audit,score,normalize,normalizeClue,editorialFields};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.JadvalQuality=api;
})(typeof window!=='undefined'?window:null);
