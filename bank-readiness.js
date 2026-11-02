/* Private, local-only readiness and editorial review queue.
   Does not upload, overwrite, approve or silently change bank entries. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const normalize=s=>String(s||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
 .replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,'');
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
const licences=new Set(['author-original','public-domain','permission-granted','licensed-content']);
const generic=/^(?:unknown|none|source|archive|legacy|imported|no-source|not-known|نامشخص|آرشیو|جدول|منبع نامشخص|فایل|بانک|بدون منبع|کتاب)$/i;
function citationOK(text){
 const s=String(text||'').trim();
 if(s.length<14||generic.test(s))return false;
 // The source must identify a dictionary entry/publication, not merely the
 // original archive of clues: the archive proves provenance, not word meaning.
 if(/^(?:جدول|آرشیو|فایل|bank|archive)[\s:،#\d-]*$/i.test(s))return false;
 if(/^https?:\/\//i.test(s)){try{return new URL(s).hostname.includes('.') }catch(_){return false}}
 return /[\p{L}]/u.test(s);
}
function reviewReasons(entry,limit=15){
 const issues=[],answer=normalize(entry?.answer),clue=String(entry?.clue||'').trim();
 if(!alphabet.test(answer)||answer.length<3||answer.length>limit)
  issues.push('پاسخ باید بین ۳ تا '+limit+' حرف فارسی نرمال‌شده باشد.');
 if(!clue||clue.length<5)issues.push('سرنخ دقیق و کامل لازم است.');
 if(!citationOK(entry?.source))issues.push('منبع معتبر و مشخص (فرهنگ لغت، مدخل و نشانی یا ارجاع کتاب‌شناختی) ثبت نشده است.');
 if(!licences.has(String(entry?.license||'')))issues.push('نوع مجوز استفاده/تألیف سرنخ مشخص نشده است.');
 if(!['easy','medium','hard'].includes(entry?.difficulty))issues.push('سطح دشواری باید آسان، متوسط یا دشوار باشد.');
 if(!entry?.category||['دسته‌بندی‌نشده','عمومی','سایر','unknown'].includes(entry.category))
  issues.push('موضوع مشخص و غیرعمومی لازم است.');
 return issues;
}
function approved(entry,max=15){
 return !!entry&&(entry.reviewed===1||entry.reviewed===true)&&reviewReasons(entry,max).length===0;
}
function approvedEntries(entries,max=15){return (entries||[]).filter(e=>approved(e,max));}
function analyze(entries,max=15){
 const data=Array.isArray(entries)?entries:[],ready=approvedEntries(data,max),byLength={},candidates=[],answers=new Set(),sources=new Set();
 for(let n=3;n<=max;n++)byLength[n]={raw:0,approved:0};
 const rawSets=new Map(),approvedSets=new Map();
 for(const e of data){
  const word=normalize(e?.answer),n=word.length;
  if(!alphabet.test(word)||n<3||n>max)continue;
  if(!rawSets.has(n))rawSets.set(n,new Set());
  rawSets.get(n).add(word);
  if(approved(e,max)){
   if(!approvedSets.has(n))approvedSets.set(n,new Set());
   approvedSets.get(n).add(word);
   answers.add(word);sources.add(String(e.source));
  }else if(e?.id&&String(e.clue||'').trim()){
   candidates.push({id:e.id,answer:word,clue:String(e.clue).trim(),length:n,
    issues:reviewReasons(e,max).length});
  }
 }
 for(let n=3;n<=max;n++){
  byLength[n].raw=rawSets.get(n)?.size||0;
  byLength[n].approved=approvedSets.get(n)?.size||0;
 }
 // Short and medium answers supply flexible crossings; include long anchors.
 const priority=n=>n>=4&&n<=9?0:n>=10&&n<=12?1:2;
 candidates.sort((a,b)=>priority(a.length)-priority(b.length)||
  a.issues-b.issues||a.length-b.length||String(a.id).localeCompare(String(b.id)));
 const categories=new Set(ready.map(x=>x.category)),difficulties=new Set(ready.map(x=>x.difficulty));
 return {total:data.length,reviewedFlag:data.filter(e=>e?.reviewed===1||e?.reviewed===true).length,
  approved:ready.length,uniqueApproved:answers.size,byLength,categories:[...categories],
  difficulties:[...difficulties],sourceCount:sources.size,candidates:candidates.slice(0,24),
  warnings:!ready.length?['هیچ مدخلِ دارای بازبینی، منبع، مجوز، موضوع و درجهٔ سختی قابل استفاده نیست؛ ساخت حرفه‌ای مسدود است.']:
   Object.entries(byLength).filter(([n,v])=>v.approved<5).map(([n,v])=>'پاسخ '+n+'حرفی منبع‌دار: '+v.approved+' مورد یکتا')};
}
function privateEntries(){return root.JadvalApp?.getLocal?.()||[]}
function make(tag,cls,text){
 const d=document.createElement(tag);if(cls)d.className=cls;if(text!==undefined)d.textContent=text;return d;
}
let lastShown=0;
function refresh(){
 const panel=$('bankReadiness');if(!panel)return;
 const info=analyze(privateEntries());
 const sum=$('bankReadinessSummary');
 sum.textContent='از '+new Intl.NumberFormat('fa-IR').format(info.total)+' مدخل، '+
  new Intl.NumberFormat('fa-IR').format(info.reviewedFlag)+' دارای نشان بازبینی و فقط '+
  new Intl.NumberFormat('fa-IR').format(info.approved)+' مدخل دارای اطلاعات کاملِ قابل ورود به حل‌گر حرفه‌ای هستند؛ پاسخ یکتا: '+
  new Intl.NumberFormat('fa-IR').format(info.uniqueApproved)+'.';
 const tbody=$('readinessLengths');tbody.replaceChildren();
 for(const [len,item] of Object.entries(info.byLength)){
  const tr=make('tr');
  for(const v of [len,item.raw,item.approved]){
   const td=make('td','',new Intl.NumberFormat('fa-IR').format(Number(v)));tr.append(td);
  }
  tbody.append(tr);
 }
 const issues=$('readinessWarnings');issues.replaceChildren();
 const msgs=info.warnings.slice(0,5);
 for(const msg of msgs)issues.append(make('p','muted small',msg));
 if(!msgs.length)issues.append(make('p','muted small','شمارش مدخل‌های واجد شرایط آماده است؛ داشتن واژگان کافی، تکمیل جدول و کیفیت معنایی را تضمین نمی‌کند.'));
 const list=$('reviewCandidates');list.replaceChildren();
 for(const e of info.candidates.slice(0,12)){
  const row=make('div','',undefined);
  row.style.cssText='padding:8px 0;border-bottom:1px solid #edf0f2;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;';
  const line=make('span','',e.answer+' — '+e.clue.slice(0,120)+' ('+e.length+' حرف)');
  const button=make('button','btn','بازبینی مدخل');
  button.type='button';
  button.onclick=()=>root.JadvalApp?.openEntry?.(String(e.id));
  row.append(line,button);list.append(row);
 }
 if(!info.candidates.length)list.append(make('p','muted','مدخلی برای پیشنهاد بازبینی پیدا نشد.'));
 lastShown=info.approved;
 return info;
}
function init(){
 if(!$('bankReadiness'))return;
 $('refreshBankReadiness').onclick=refresh;
 Promise.resolve(root.JadvalApp?.localReady).then(refresh).catch(()=>{});
}
root.JadvalBankReadiness={analyze,approved,approvedEntries,reviewReasons,citationOK,refresh,normalize,licences};
if(typeof module!=='undefined'&&module.exports)module.exports=root.JadvalBankReadiness;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}
})(typeof window!=='undefined'?window:null);
