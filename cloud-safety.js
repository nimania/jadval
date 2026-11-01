/* Pure validation shared by migration, backups and tests. No network access. */
(function(root){
'use strict';
const fields=['id','answer','clue','letters','category','difficulty','reviewed','source','license'];
const internal=new Set([...fields,'legacy','revision','createdAt','updatedAt','generation','_cloudId','_cloudRevision']);
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
async function digest(value){const bytes=new TextEncoder().encode(canonical(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function record(e){
 const legacy={...(e.legacy||{})};for(const [k,v] of Object.entries(e))if(!internal.has(k))legacy[k]=v;
 return {id:String(e.id??''),answer:e.answer,clue:e.clue,letters:e.letters,
 category:e.category??'دسته‌بندی‌نشده',difficulty:e.difficulty??'unknown',reviewed:e.reviewed===true?1:e.reviewed===false?0:(e.reviewed??0),source:e.source??'',license:e.license??'',legacy};
}
function validate(r){
 if(!r.id||typeof r.answer!=='string'||!r.answer.trim()||typeof r.clue!=='string'||!r.clue.trim())throw Error('شناسه، سؤال یا جواب نامعتبر: '+r.id);
 if(r.id.length>500||r.answer.length>160||r.clue.length>1500||!Number.isInteger(r.letters)||r.letters<1||r.letters>30)throw Error('ساختار یا طول نامعتبر: '+r.id);
 const length=[...r.answer.replace(/[\u200c\s\-]/g,'')].length;
 if(r.letters!==length)throw Error('تعداد حروف با جواب یکسان نیست: '+r.id);
 if(![0,1].includes(r.reviewed)||['category','difficulty','source','license'].some(k=>typeof r[k]!=='string'))throw Error('نوع فیلد نامعتبر: '+r.id);
 if(new TextEncoder().encode(canonical(r)).length>100000)throw Error('مدخل بیش از حد بزرگ: '+r.id);
 return r;
}
async function docId(e){const id=String(e.id??'');return /^[A-Za-z0-9_-]{1,180}$/.test(id)&&!/^__.*__$/.test(id)?id:'legacy_'+await digest(id);}
async function prepare(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('بانک مرورگر خالی است؛ هیچ داده‌ای برای انتقال وجود ندارد.');
 const ids=new Set(),prepared=[];
 for(const e of rows){const r=validate(record(e)),id=await docId(e);if(ids.has(id))throw Error('شناسهٔ تکراری؛ انتقال متوقف شد: '+r.id);ids.add(id);prepared.push({id,record:r});}
 prepared.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 return {prepared,fingerprint:await digest(prepared),count:prepared.length};
}
function reconcile(prepared,existing){
 const wanted=new Map(prepared.map(x=>[x.id,x.record])),seen=new Set();
 for(const x of existing){if(!wanted.has(x.id))throw Error('رکورد اضافی در سرور: '+x.id);if(canonical(record(x.record))!==canonical(wanted.get(x.id)))throw Error('تعارض محتوا در رکورد موجود؛ بازنویسی نشد: '+x.id);seen.add(x.id);}
 return prepared.filter(x=>!seen.has(x.id));
}
function verifyBackup(payload,currentState){
 if(payload?.schema!==2||!payload.state||!payload.checksum)throw Error('پشتیبان کامل نسخهٔ ۲ لازم است.');
 if(canonical(payload.state)!==canonical(currentState))throw Error('پشتیبان با وضعیت فعلی مرورگر یکسان نیست؛ دوباره پشتیبان بگیر.');
 return true;
}
const api={canonical,digest,record,validate,docId,prepare,reconcile,verifyBackup};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JadvalSafety=api;
})(typeof window==='undefined'?this:window);
