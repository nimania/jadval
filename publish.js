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
function preparedPuzzle(data,bank,title){
 const validator=root.JadvalSparse;
 if(!validator||!validator.validateWithBank(data,bank))
  throw Error('جدول کامل نیست یا سرنخ‌ها و جواب‌ها با بانک اصلی تطابق ندارند. انتشار مجاز نیست.');
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
function onNewPuzzle(){
 const button=$('preparePublish');
 if(button)button.disabled=false;
 const result=$('publishResult');if(result)result.replaceChildren();
 const box=$('publishApproval');if(box)box.checked=false;
}
function openReview(){
 const status=$('publishStatus'),dialog=$('publishDialog'),data=currentBoard();
 status.textContent='';
 if(!data||!root.JadvalSparse.validateWithBank(data,currentBank())){
  const msg='برای انتشار، ابتدا جدول کامل با سرنخ‌های معتبر بساز.';
  status.textContent=msg;if($('demoNote'))$('demoNote').textContent=msg;return;
 }
 if(!root.JadvalCloud?.canPublish?.()){
  const msg=!root.JadvalCloud?.isConnected?.()?
   'ابتدا با حساب مدیر جدول‌ساز در بخش پایگاه مرکزی وارد شو.':
   'ابتدا در بخش پایگاه مرکزی روی «بررسی دسترسی انتشار در پیام جدول» بزن و در صورت رد دسترسی، قواعد Firebase را فعال کن.';
  status.textContent=msg;if($('demoNote'))$('demoNote').textContent=msg;return;
 }
 const n=data.puzzle.grid.length;
 $('publishTitle').value='جدول فارسی '+n+'×'+n;
 $('publishApproval').checked=false;
 $('publishSource').textContent=data.sample?
  'این خروجی از نمونهٔ فنی ساخته شده است. انتشار فقط پس از بازبینی واقعی سؤال‌ها و پاسخ‌ها مجاز است.':
  'متن تمام سرنخ‌ها، جواب‌ها و تقاطع‌ها را قبل از تأیید بررسی کن.';
 $('publishConfirm').disabled=false;
 $('publishConfirm').textContent='تأیید ویراستاری و انتشار';
 $('publishResult').replaceChildren();
 dialog.showModal();
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const status=$('publishStatus');
 if(!$('publishApproval').checked){status.textContent='تأیید بازبینی ویراستاری و حقوق انتشار الزامی است.';return;}
 let documentPayload;
 try{
  documentPayload=preparedPuzzle(currentBoard(),currentBank(),$('publishTitle').value);
  documentPayload.id=newPublicId();
  documentPayload.editorApproved=true;
 }catch(error){status.textContent=error.message;return;}
 busy=true;$('publishConfirm').disabled=true;
 status.textContent='در حال ثبت یک جدول تأییدشده در آرشیو عمومی…';
 try{
  const result=await root.JadvalCloud.publishPuzzle(documentPayload);
  status.textContent='جدول در پایگاه عمومی ثبت شد. ممکن است نمایش آن در سایت چند لحظه به‌روزرسانی بخواهد.';
  const box=$('publishResult');box.replaceChildren();
  const link=document.createElement('a');link.className='btn primary';
  link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='بازی آنلاین این جدول در پیام جدول ↗';
  box.append(link);
  $('publishConfirm').textContent='منتشر شد';
 }catch(error){
  status.textContent=error.code==='permission-denied'?
   'Firestore اجازهٔ انتشار نمی‌دهد. قواعد publishedPuzzles باید در پروژهٔ Firebase منتشر شوند؛ بانک خصوصی را تغییر نده.':
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
