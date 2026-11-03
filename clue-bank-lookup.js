/* Read-only search of the crossword editor's existing private IndexedDB bank.
   Never synchronizes, uploads, overwrites or exposes its contents in the public site. */
(function(root){
'use strict';
const model=typeof module!=='undefined'&&module.exports?require('./clue-in-cell.js'):root.PayameClueInCell;
const standard=s=>model.normalize(s).toLocaleLowerCase('fa');
function search(entries,term,limit=30){
 const query=standard(term);
 if(query.length<2)return [];
 const unique=new Set(),found=[];
 for(const item of entries||[]){
  const answer=model.normalize(item?.answer),clue=String(item?.clue||'').trim();
  const key=standard(answer)+'\u0000'+standard(clue);
  if(!answer||!clue||unique.has(key))continue;
  if(standard(answer).includes(query)||standard(clue).includes(query)){
   unique.add(key);found.push({answer,clue,id:item.id||''});
   if(found.length>=limit)break;
  }
 }
 return found;
}
function readLocalBank(){
 return new Promise((resolve,reject)=>{
  if(!root?.indexedDB){reject(Error('این مرورگر IndexedDB ندارد.'));return;}
  const request=root.indexedDB.open('jadval-studio');
  request.onupgradeneeded=()=>request.transaction.abort();
  request.onerror=()=>reject(Error('بانک خصوصی در این مرورگر پیدا نشد. ابتدا بانک کارگاه اصلی را آماده کن.'));
  request.onsuccess=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('state')){db.close();reject(Error('بانک ذخیره‌شده در این مرورگر وجود ندارد.'));return;}
   let tx;
   try{tx=db.transaction('state','readonly');}catch(err){db.close();reject(err);return;}
   const req=tx.objectStore('state').get('bank');
   req.onsuccess=()=>{
    const value=req.result;
    resolve(Array.isArray(value?.entries)?value.entries:[]);
   };
   req.onerror=()=>reject(req.error||Error('خواندن بانک ناموفق بود.'));
   tx.oncomplete=()=>db.close();tx.onerror=()=>db.close();tx.onabort=()=>db.close();
  };
 });
}
function initialize(){
 if(!root?.document)return;
 const doc=root.document,$=id=>doc.getElementById(id);
 const trigger=$('bankLookup'),input=$('bankSearch'),results=$('bankResults'),count=$('bankCount'),status=$('bankLookupStatus');
 if(!trigger||!input||!results||!count||!status)return;
 let entries=null;
 async function run(){
  const term=input.value.trim();
  results.replaceChildren();
  if(model.normalize(term).length<2){status.textContent='حداقل دو حرف وارد کن.';return;}
  trigger.disabled=true;status.textContent='در حال بررسی بانک همین مرورگر…';
  try{
   if(!entries)entries=await readLocalBank();
   count.textContent=new Intl.NumberFormat('fa-IR').format(entries.length)+' مدخل محلی';
   const found=search(entries,term);
   status.textContent=found.length?
    'تعداد نتیجهٔ قابل نمایش: '+new Intl.NumberFormat('fa-IR').format(found.length)+' (حداکثر ۳۰ مورد)':
    'پاسخ یا سؤال منطبق در بانک این مرورگر پیدا نشد.';
   for(const row of found){
    const li=doc.createElement('li');li.style.borderBottom='1px solid #e5eaed';
    const button=doc.createElement('button');button.type='button';button.className='btn';
    button.style.width='100%';button.style.textAlign='right';button.style.padding='6px';
    button.textContent=row.answer+' — '+row.clue;
    button.title='قرار دادن این سؤال و جواب در فرم';
    button.addEventListener('click',()=>{
     $('answerText').value=row.answer;$('clueText').value=row.clue;
     status.textContent='سؤال و جواب انتخاب شد؛ خانهٔ سرنخ و جهت را مشخص کن، سپس «جای‌گذاری در شبکه» را بزن.';
    });
    li.append(button);results.append(li);
   }
  }catch(err){status.textContent='جست‌وجو ناموفق: '+err.message;}
  finally{trigger.disabled=false;}
 }
 trigger.addEventListener('click',run);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void run();}});
}
if(typeof module!=='undefined'&&module.exports)module.exports={search};
if(root?.document){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
 else initialize();
}
})(typeof window!=='undefined'?window:null);