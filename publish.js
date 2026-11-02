/* Editorial, opt-in publication to the public Payame Jadval catalogue.
   Never sends the source bank, entry IDs, diagnostics or draft metadata. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
function cleanTitle(value){
 const title=String(value||'').trim().replace(/\s+/g,' ');
 if(!title||title.length>120)throw Error('عنوان باید بین ۱ تا ۱۲۰ نویسه باشد.');
 return title;
}
function preparedPuzzle(data,bank,title,evaluation){
 const validator=root.JadvalSparse,quality=root.JadvalQuality;
 if(!validator||!quality||!data||data.sample===true||data.puzzle?.meta?.method==='constructed-bank-proof')
  throw Error('نمونهٔ آزمایشی یا جدول بدون ارزیابی مستقل قابل انتشار نیست.');
 if(!validator.validateWithBank(data,bank))
  throw Error('جدول کامل نیست یا سرنخ‌ها و جواب‌ها با بانک اصلی تطابق ندارند.');
 const audit=quality.audit(data.puzzle,bank);
 if(!audit.technicalPassed||!audit.bankPassed||audit.errors.length)
  throw Error('دروازهٔ کیفیت رد شد: '+audit.errors.slice(0,3).map(x=>x.detail).join(' | '));
 if(!evaluation?.ready||evaluation.score<90||evaluation.technical!==60)
  throw Error('امتیاز نهاییِ تأییدشده حداقل ۹۰ از ۱۰۰ و گزارش بازبین لازم است.');
 const name=cleanTitle(title),source=data.puzzle,n=source.grid.length;
 if(![7,10,15,20].includes(n))throw Error('اندازهٔ جدول برای انتشار پشتیبانی نمی‌شود.');
 const grid=source.grid.map(row=>row.slice());
 const clues={horizontal:{},vertical:{}};
 for(const direction of ['horizontal','vertical']){
  for(const [number,items] of Object.entries(source.clues[direction])){
   if(!/^\d+$/.test(number)||!Array.isArray(items)||
      items.some(c=>typeof c!=='string'||!c.trim()||c.length>1500))
    throw Error('شماره‌گذاری یا سرنخ نامعتبر است.');
   clues[direction][number]=items.map(c=>c.trim());
  }
 }
 // Precisely whitelist the public shape. No private bank or source metadata.
 return {title:name,size:n,editorApproved:false,puzzle:{
  version:3,grid,clues,meta:{title:name,size:{rows:n,cols:n},
   language:'fa',direction:'rtl',status:'published',method:'editor-approved'}
 }};
}
function newPublicId(){
 if(typeof crypto.randomUUID==='function')return 'pub_'+crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 return 'pub_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function currentBank(){return typeof entries!=='undefined'?entries:[];}
function currentBoard(){return root.JadvalSparse?.getCurrentForPublication?.()||null;}
let busy=false;
function currentAudit(){
 const data=currentBoard();
 return data&&root.JadvalQuality?root.JadvalQuality.audit(data.puzzle,currentBank()):null;
}
function reportQuality(){
 const panel=$('qaReport'),data=currentBoard(),audit=currentAudit();
 if(!panel)return;
 panel.replaceChildren();
 const heading=document.createElement('strong');heading.textContent='گزارش مستقل کنترل کیفیت (۱۸ معیار)';panel.append(heading);
 const summary=document.createElement('p');
 if(!audit){summary.textContent='هنوز جدول کاملی برای بررسی وجود ندارد.';panel.append(summary);return;}
 const s=audit.stats;
 summary.textContent='خانهٔ سیاه: '+s.blackCount+' از '+(s.size*s.size)+
  ' ('+(s.blackRatio*100).toFixed(1)+'٪) — جایگاه پاسخ: '+s.slots+
  ' — وضعیت: '+(audit.technicalPassed&&audit.bankPassed&&!data.sample?'نیازمند امتیازدهی ویراستار':'غیرقابل انتشار');
 panel.append(summary);
 if(data.sample){const sample=document.createElement('p');sample.textContent='این نمونه برای آزمون فنی است و هرگز مستقیماً منتشر نمی‌شود.';panel.append(sample);}
 if(audit.errors.length){
  const details=document.createElement('details');details.open=true;
  const title=document.createElement('summary');title.textContent=audit.errors.length+' ایراد/مدرک تأییدنشده (۱۲ مورد نخست)';details.append(title);
  const list=document.createElement('ol');
  for(const error of audit.errors.slice(0,12)){
   const item=document.createElement('li');item.textContent=error.detail;list.append(item);
  }
  details.append(list);panel.append(details);
 }
 const next=document.createElement('p');
 next.textContent=audit.errors.length?
  'تا رفع همهٔ ایرادها و بازبینی مدخل‌های بانک، امکان انتشار وجود ندارد.':
  'کنترل فنی قبول است؛ امتیاز و تأیید مستقل محتوایی هنوز لازم است.';
 panel.append(next);
}
function onNewPuzzle(){
 const button=$('preparePublish'),data=currentBoard(),audit=currentAudit();
 if(button)button.disabled=!(data&&!data.sample&&audit?.technicalPassed&&audit.bankPassed&&!audit.errors.length);
 const result=$('publishResult');if(result)result.replaceChildren();
 const box=$('publishApproval');if(box)box.checked=false;
 reportQuality();
}
function openReview(){
 const status=$('publishStatus'),dialog=$('publishDialog'),data=currentBoard(),audit=currentAudit();
 status.textContent='';
 if(!data||data.sample||!audit?.technicalPassed||!audit.bankPassed||audit.errors.length){
  const msg='این جدول هنوز ۱۸ معیار اجباری را نمی‌گذراند. گزارش کنترل کیفیت زیر جدول را ببین.';
  if($('demoNote'))$('demoNote').textContent=msg;
  reportQuality();return;
 }
 if(!root.JadvalCloud?.canPublish?.()){
  const msg=!root.JadvalCloud?.isConnected?.()?
   'ابتدا با حساب مدیر جدول‌ساز در بخش پایگاه مرکزی وارد شو.':
   'ابتدا دسترسی انتشار در Firebase را بررسی کن.';
  status.textContent=msg;if($('demoNote'))$('demoNote').textContent=msg;return;
 }
 const n=data.puzzle.grid.length;
 $('publishTitle').value='جدول فارسی '+n+'×'+n;
 $('publishApproval').checked=false;
 for(const input of dialog.querySelectorAll('.qa-attest'))input.checked=false;
 for(const input of dialog.querySelectorAll('.qa-rating'))input.value='';
 $('qaReviewer').value='';
 $('publishSource').textContent='آزمون هندسه و انطباق با مدخل‌های بازبینی‌شده موفق است. یکتایی معنایی، اصالت منابع، روانی سرنخ‌ها، انصاف و تجربهٔ حل را مستقل بررسی و امتیازدهی کن. این موارد با کد اثبات نمی‌شوند.';
 $('publishConfirm').disabled=false;
 $('publishConfirm').textContent='تأیید ویراستاری و انتشار';
 $('publishResult').replaceChildren();
 dialog.showModal();
}
function evaluateForm(){
 const checks={};
 for(const input of $('publishDialog').querySelectorAll('.qa-attest'))checks[input.value]=input.checked;
 const ratings={};
 for(const input of $('publishDialog').querySelectorAll('.qa-rating'))ratings[input.name]=input.value;
 return root.JadvalQuality.score(currentAudit(),ratings,checks,$('qaReviewer').value);
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const status=$('publishStatus');
 if(!$('publishApproval').checked){status.textContent='تأیید نهایی انتشار عمومی الزامی است.';return;}
 const evaluation=evaluateForm();
 if(!evaluation.ready){
  status.textContent=evaluation.reason+(evaluation.score===null?'':' — امتیاز: '+evaluation.score+' از ۱۰۰');return;
 }
 let documentPayload;
 try{
  documentPayload=preparedPuzzle(currentBoard(),currentBank(),$('publishTitle').value,evaluation);
  documentPayload.id=newPublicId();
  documentPayload.editorApproved=true;
 }catch(error){status.textContent=error.message;return;}
 busy=true;$('publishConfirm').disabled=true;
 status.textContent='امتیاز '+evaluation.score+' از ۱۰۰؛ در حال ثبت جدول تأییدشده در آرشیو عمومی…';
 try{
  const result=await root.JadvalCloud.publishPuzzle(documentPayload);
  status.textContent='جدول با امتیاز ویراستاری '+evaluation.score+' منتشر شد. بازبین مسئول: '+evaluation.reviewer;
  const box=$('publishResult');box.replaceChildren();
  const link=document.createElement('a');link.className='btn primary';
  link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='بازی آنلاین این جدول در پیام جدول ↗';
  box.append(link);
  $('publishConfirm').textContent='منتشر شد';
 }catch(error){
  status.textContent=error.code==='permission-denied'?
   'Firestore اجازهٔ انتشار نمی‌دهد. قواعد publishedPuzzles را بدون تغییر بانک خصوصی بررسی کن.':
   'انتشار ناموفق: '+(error.code||error.message||'خطای نامشخص');
  $('publishConfirm').disabled=false;
 }finally{busy=false;}
}
function init(){
 const open=$('preparePublish'),dialog=$('publishDialog');
 if(!open||!dialog)return;
 open.onclick=openReview;
 $('publishCancel').onclick=()=>{if(!busy)dialog.close()};
 $('publishForm').addEventListener('submit',submit);
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
}
root.JadvalPublish={preparedPuzzle,cleanTitle,onNewPuzzle,openReview};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
