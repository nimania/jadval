/* One-click automatic clue-in-cell composer in the authenticated Jadval Studio. */
(function(){
'use strict';
const model=window.PayameClueInCell,$=id=>document.getElementById(id),
 fmt=new Intl.NumberFormat('fa-IR');
let worker=null,result=null,sourcePairs=null,sourceGeneration=null,showAnswers=false;
const key=e=>model.normalize(e.answer)+'\u0000'+String(e.clue||'').trim();
function update(text,isError=false){
 const label=$('autoClueStatus');if(!label)return;
 label.textContent=text;label.style.borderRightColor=isError?'#b5292d':'#3b8ba2';
}
function cell(r,c,value,entries){
 const button=document.createElement('div');
 button.className='auto-clue-cell '+value.kind;
 if(value.kind==='block')return button;
 if(value.kind==='letter'){
  button.textContent=showAnswers?value.answer:'';
  button.title='سطر '+fmt.format(r+1)+'، ستون '+fmt.format(entries[0]?.gridWidth-c||c+1);
 }else if(value.kind==='clue'){
  const source=(value.clueIds||[]).map(id=>entries.find(x=>x.id===id)).filter(Boolean);
  const words=source.map(x=>x.clue+(x.direction==='across'?' ←':' ↓'));
  button.textContent=words.join(' / ');
  button.title=words.join('\n');
 }
 return button;
}
function view(){
 const grid=$('autoClueGrid');grid.replaceChildren();
 if(!result)return;
 const item=result.item,report=model.inspect(item),size=model.sizes[item.variant],
  rows=item.puzzle.grid;
 grid.style.gridTemplateColumns='repeat('+size.width+',30px)';
 for(let r=0;r<size.height;r++)for(let c=0;c<size.width;c++)
  grid.append(cell(r,c,rows[r][c],item.puzzle.entries));
 const metrics=$('autoClueMetrics');
 metrics.textContent='مدخل‌های مورد استفاده: '+fmt.format(report.stats.entries)+
  ' | افقی: '+fmt.format(report.stats.across)+
  ' | عمودی: '+fmt.format(report.stats.down)+
  ' | حروف: '+fmt.format(report.stats.letter)+
  ' | تقاطع: '+fmt.format(report.stats.crossings)+
  ' | خانهٔ بلاتکلیف: '+fmt.format(report.stats.empty);
 $('autoClueToggle').disabled=false;
 $('autoClueSave').disabled=false;
 $('autoClueReview').disabled=!report.publishable;
 const errors=report.errors||[];
 const note=report.publishable?'طرح از کنترل ساختاری عبور کرده است؛ برای انتشار، بازبینی محتوایی و تأیید نهایی لازم است.':
  'این طرح ناقص است و منتشر نمی‌شود. '+errors.slice(0,6).join(' | ');
 $('autoClueReport').textContent=note;
 $('autoClueReport').style.color=report.publishable?'#176c44':'#975222';
}
function stop(){
 if(worker){worker.terminate();worker=null;}
 $('autoClueRun').disabled=false;
 $('autoClueCancel').disabled=true;
}
async function generate(){
 if(worker){update('جست‌وجوی قبلی هنوز تمام نشده است.',true);return;}
 if(!window.JadvalCloud?.verifiedGenerationSnapshot){
  update('اتصال امن بانک مرکزی برای تولید خودکار در دسترس نیست.',true);return;
 }
 $('autoClueRun').disabled=true;$('autoClueCancel').disabled=false;
 $('autoClueReview').disabled=true;$('autoClueSave').disabled=true;
 result=null;sourcePairs=null;sourceGeneration=null;
 const variant=$('autoClueVariant').value;
 if(!model.sizes[variant]){stop();update('ابعاد جدول نامعتبر است.',true);return;}
 update('در حال دریافت نسخهٔ تازهٔ فرهنگ‌نامه از Firestore…');
 let snapshot;
 try{
  snapshot=await window.JadvalCloud.verifiedGenerationSnapshot();
  if(!worker&&$('autoClueCancel').disabled){return;}
  if(!snapshot?.rows?.length)throw Error('بانک مرکزی خالی است.');
  sourcePairs=new Set(snapshot.rows.map(key));
  sourceGeneration=snapshot.generation;
 }catch(err){stop();update('ساخت متوقف شد: '+err.message,true);return;}
 const count=snapshot.rows.length;
 update('نسخهٔ مرکزی '+fmt.format(sourceGeneration)+' با '+fmt.format(count)+
  ' مدخل دریافت شد. موتور در حال آزمایش چیدمان واژه‌هاست…');
 const seed=Date.now()>>>0;
 const controller=new Worker('./clue-auto-worker.js');worker=controller;
 controller.onmessage=event=>{
  if(worker!==controller)return;
  const message=event.data||{};
  if(message.type==='progress'){
   const p=message.progress;
   update('تلاش '+fmt.format(p.round)+' از '+fmt.format(p.attempts)+
    '؛ '+fmt.format(p.placements)+' پاسخ جای‌گذاری شد، '+fmt.format(p.occupied)+
    ' خانهٔ استفاده‌شده از '+fmt.format(p.total));
   return;
  }
  stop();
  if(message.type==='error'){update('تولید کامل نشد: '+message.message,true);return;}
  try{
   const output=message.result;
   if(!output?.item||!output.item.puzzle?.entries)throw Error('نتیجهٔ موتور نامعتبر است.');
   if(!output.item.puzzle.entries.every(e=>sourcePairs.has(key(e))))
    throw Error('دست‌کم یک سؤال یا جواب در بانک مرکزی وجود ندارد.');
   if(output.diagnostics?.source!=='central-firestore-authenticated')
    throw Error('منبع واژگان تأیید نشده است.');
   const fresh=model.inspect(output.item);
   if(!fresh.valid)throw Error(fresh.errors[0]||'چیدمان ناسازگار است.');
   output.item.puzzle.meta={...(output.item.puzzle.meta||{}),bankGeneration:sourceGeneration};
   result=output;showAnswers=false;view();
   update(fresh.publishable?
    'شبکهٔ کامل از '+fmt.format(count)+' مدخل بانک مرکزی ساخته شد؛ اکنون آمادهٔ بررسی انتشار است.':
    'موتور '+fmt.format(output.diagnostics.attempted)+' طرح را آزمایش کرد؛ بهترین نتیجه هنوز کامل نیست و قابل انتشار نیست.');
  }catch(err){update('نتیجه رد شد: '+err.message,true);}
 };
 controller.onerror=event=>{
  if(worker!==controller)return;
  stop();update('خطای موتور خودکار: '+(event.message||'خطای ناشناخته'),true);
 };
 controller.postMessage({rows:snapshot.rows,variant,seed,attempts:4,budgetMs:16000});
}
function exportJson(ready){
 if(!result?.item)return;
 const report=model.inspect(result.item);
 if(!report.valid||ready&&!report.publishable){update('خروجی آمادهٔ انتشار نیست.',true);return;}
 const copy=JSON.parse(JSON.stringify(result.item));
 copy.id='clue-'+copy.variant+'-'+Date.now();
 copy.title=$('autoClueTitle').value.trim()||copy.title;
 copy.puzzle.meta={...copy.puzzle.meta,status:ready?'review-pending':'draft',
  method:'central-bank-generator',bankGeneration:sourceGeneration,
  editorialApproval:false,diagnostics:{...result.diagnostics,source:'central-firestore-authenticated'}};
 const filename='payame-clue-'+copy.variant+'-'+(ready?'for-review':'draft')+'.json';
 const blob=new Blob([JSON.stringify(copy,null,2)+'\n'],{type:'application/json;charset=utf-8'}),
 url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
 update((ready?'خروجی آمادهٔ بررسی ویراستاری':'پیش‌نویس بهترین طرح')+' دریافت شد. هیچ چیزی خودکار منتشر نشده است.');
}
function init(){
 if(!$('autoClueRun'))return;
 $('autoClueRun').addEventListener('click',generate);
 $('autoClueCancel').addEventListener('click',()=>{stop();update('جست‌وجو به درخواست تو متوقف شد. هیچ داده‌ای تغییر نکرد.');});
 $('autoClueSave').addEventListener('click',()=>exportJson(false));
 $('autoClueReview').addEventListener('click',()=>exportJson(true));
 $('autoClueToggle').addEventListener('click',()=>{
  showAnswers=!showAnswers;
  $('autoClueToggle').textContent=showAnswers?'پنهان‌کردن پاسخ‌ها':'نمایش پاسخ‌ها';
  view();
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
