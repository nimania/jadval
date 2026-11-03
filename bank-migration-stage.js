/* Non-destructive, owner-controlled staging for a cleaned private bank.
   This file contains no word data, tokens or service credentials.
   A staged bank is NOT a Firestore sync: the verified migration gate
   in cloud-bridge.js remains mandatory. */
(function(root){
'use strict';
function normalize(s){return String(s??'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
 .replace(/[\u064b-\u065f\u0670\u0640\u200c\u200d\s]+/g,'').toLocaleLowerCase('fa');}
const pair=e=>normalize(e?.answer)+'\u0000'+normalize(e?.clue);
const clean=r=>JSON.parse(JSON.stringify(r));
function plan(source,target,security){
 if(!security?.validate||!security?.record||!security?.canonical)throw Error('کنترل امنیتی بانک در دسترس نیست.');
 if(!Array.isArray(source)||!source.length||!Array.isArray(target)||!target.length)
  throw Error('فایل یا بانک اصلی خالی است.');
 const canon=security.canonical;
 const existingByPair=new Map(),ids=new Set();
 for(const row of source){
  security.validate(security.record(row));
  if(!row.id||ids.has(row.id))throw Error('بانک پایه شناسهٔ غیرمعتبر یا تکراری دارد.');
  ids.add(row.id);
  const k=pair(row);
  if(!normalize(row.answer)||!normalize(row.clue))throw Error('مدخل پایه ناقص است.');
  const matches=existingByPair.get(k)||[];matches.push(row);existingByPair.set(k,matches);
 }
 const usedIds=new Set(),usedPairs=new Set(),newRows=[];
 for(const row of target){
  security.validate(security.record(row));
  const k=pair(row);
  if(usedIds.has(row.id)||usedPairs.has(k))throw Error('فایل تازه شناسه یا ترکیب سؤال+جواب تکراری دارد.');
  usedIds.add(row.id);usedPairs.add(k);
  const existing=existingByPair.get(k);
  if(existing){
   const one=existing.find(x=>x.id===row.id);
   if(!one)throw Error('شناسهٔ رکورد اصلی در فایل پالایش‌شده تغییر کرده است: '+row.id);
   if(canon(security.record(one))!==canon(security.record(row)))
    throw Error('فایل پالایش‌شده محتوای مدخل اصلی را تغییر داده است: '+row.id);
  }else{
   if(ids.has(row.id))throw Error('شناسهٔ جدید با شناسهٔ موجود برخورد دارد: '+row.id);
   newRows.push(row);
  }
 }
 const missing=[...existingByPair.keys()].filter(k=>!usedPairs.has(k));
 if(missing.length)throw Error('فایل پالایش‌شده '+missing.length+' ترکیب سؤال+جواب غیرتکراریِ بانک را حذف می‌کند؛ عملیات متوقف شد.');
 const removed=source.length-existingByPair.size;
 if(target.length!==existingByPair.size+newRows.length)throw Error('تعداد پس از پالایش با تعداد انتظارشده منطبق نیست.');
 return {original:source.length,originalUnique:existingByPair.size,
  removedDuplicates:removed,added:newRows.length,final:target.length,
  uniqueAnswers:new Set(target.map(x=>normalize(x.answer))).size,
  uniqueClues:new Set(target.map(x=>normalize(x.clue))).size,
  preserved:true};
}
function acceptPayload(payload){
 const entries=Array.isArray(payload)?payload:payload?.entries;
 if(!Array.isArray(entries))throw Error('فایل باید آرایهٔ entries داشته باشد.');
 if(payload?.count!==undefined&&Number(payload.count)!==entries.length)
  throw Error('تعداد اعلام‌شده در فایل با تعداد واقعی رکوردها برابر نیست.');
 return entries;
}
const api={plan,normalize,pair,acceptPayload};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.JadvalSafeStage=api;
if(!root||typeof document==='undefined')return;
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('fa-IR').format(n);
let inspected=null;
async function inspect(){
 const input=$('bankStageFile'),file=input?.files?.[0],message=$('bankStageStatus');
 inspected=null;$('bankStageConfirm').disabled=true;
 if(!file){message.textContent='فایل پالایش‌شده را انتخاب کن.';return;}
 try{
  if(file.size>20000000)throw Error('فایل بیش از حد بزرگ است.');
  const B=root.JadvalBackup,S=root.JadvalSafety;
  const state=await B.readState(),original=state.bank?.entries||[];
  if((state['pending-cloud-edits']?.entries||[]).length)throw Error('ویرایش معلق وجود دارد؛ ابتدا تعارض‌ها را حل کن.');
  const payload=JSON.parse(await file.text()),target=acceptPayload(payload);
  const stats=plan(original,target,S);
  const signature=await S.digest({before:original,after:target});
  inspected={target:clean(target),stats,signature,originalSignature:await S.digest(original)};
  message.textContent='فایل بررسی شد: بانک فعلی '+fmt(stats.original)+'؛ تکراری کامل کنارگذاشته‌شده '+
   fmt(stats.removedDuplicates)+'؛ مدخل تازه '+fmt(stats.added)+'؛ نتیجه '+fmt(stats.final)+
   '؛ جواب یکتا '+fmt(stats.uniqueAnswers)+'؛ سؤال یکتا '+fmt(stats.uniqueClues)+
   '. هنوز هیچ داده‌ای تغییر نکرده است.';
  $('bankStageConfirm').disabled=false;
 }catch(e){message.textContent='بررسی ناموفق: '+e.message;}
}
async function stage(){
 const message=$('bankStageStatus'),button=$('bankStageConfirm');button.disabled=true;
 try{
  if(!inspected)throw Error('ابتدا فایل را بررسی کن.');
  const B=root.JadvalBackup,S=root.JadvalSafety,cloud=root.JadvalCloud;
  if(!cloud?.isConnected?.())throw Error('برای آماده‌سازی انتقال، ابتدا با حساب مدیر وارد شو.');
  if(cloud.isReady())throw Error('بانک مرکزی فعال است؛ نباید بانک محلی جایگزین شود.');
  await cloud.preflightNewBank();
  const state=await B.assertVerified();
  const originals=state.bank?.entries||[];
  if(await S.digest(originals)!==inspected.originalSignature)
   throw Error('بانک مرورگر پس از بررسی فایل تغییر کرده است.');
  if(await S.digest({before:originals,after:inspected.target})!==inspected.signature)
   throw Error('فایل بررسی‌شده تغییر کرده است.');
  const report=plan(originals,inspected.target,S);
  const name='before-pair-dedup-'+new Date().toISOString();
  const consent=$('bankStageCount')?.value||'';
  const normalized=String(consent).replace(/[۰-۹٠-٩]/g,ch=>{
   let c=ch.charCodeAt(0);return String(c>=0x06f0?c-0x06f0:c-0x0660);
  }).replace(/[\s٬,]/g,'');
  if(normalized!==String(report.final))throw Error('تعداد را در کادر تأیید به‌درستی وارد کن؛ هیچ تغییری داده نشد.');
  await B.put(name,{entries:clean(originals),savedAt:new Date().toISOString(),reason:'before-dedup-staging'});
  await B.put('bank',{entries:clean(inspected.target)});
  inspected=null;message.textContent='آماده‌سازی در مرورگر انجام شد؛ '+fmt(report.final)+' مدخل. نسخهٔ قبلی تحت '+name+
   ' محفوظ است. اکنون صفحه را تازه کن، پشتیبان کامل تازه بگیر و آن را تأیید کن؛ بعد از بررسی سهمیه می‌توانی انتقال اولیه را شروع کنی.';
 }catch(e){message.textContent='آماده‌سازی متوقف شد؛ داده‌های قبلی محفوظ‌اند: '+e.message;}
 finally{button.disabled=!inspected;}
}
function initialize(){
 const input=$('bankStageFile'),button=$('bankStageConfirm');
 if(!input||!button)return;
 input.addEventListener('change',inspect);
 button.addEventListener('click',stage);
 button.disabled=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})(typeof window!=='undefined'?window:null);
