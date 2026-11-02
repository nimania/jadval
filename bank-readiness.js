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

const trustStorageKey='jadval-trusted-corpus-v1';
function signature(entries){
 // A lightweight change detector, not a cryptographic integrity checksum.
 let hash=2166136261;
 for(const entry of entries||[]){
  const part=String(entry.id||'')+'\u0000'+normalize(entry.answer)+'\u0000'+String(entry.clue||'')+'\u0001';
  for(let i=0;i<part.length;i++)hash=Math.imul(hash^part.charCodeAt(i),16777619);
 }
 return (entries?.length||0)+':'+(hash>>>0).toString(16);
}
function corpusTrusted(entries){
 if(!Array.isArray(entries)||!entries.length)return false;
 try{return localStorage.getItem(trustStorageKey)===signature(entries)}catch(_){return false}
}
function trustCorpus(entries){
 if(!Array.isArray(entries)||!entries.length)throw Error('بانک محلی در دسترس نیست.');
 if(typeof localStorage==='undefined')throw Error('ذخیرهٔ تأیید در این مرورگر در دسترس نیست.');
 localStorage.setItem(trustStorageKey,signature(entries));
 return corpusTrusted(entries);
}
function candidateEntries(entries,max=15){
 if(!corpusTrusted(entries))return approvedEntries(entries,max);
 return (entries||[]).filter(e=>{
  const word=normalize(e?.answer);
  return alphabet.test(word)&&word.length>=3&&word.length<=max&&
   typeof e?.clue==='string'&&!!e.clue.trim();
 });
}

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
 // The review queue is a sampling aid, NOT automatic lexical approval.
 // Prefer specific clues, distribute proposals across different word lengths,
 // and never fill the list with many duplicates of the same answer.
 const specificity=e=>{
  const clue=e.clue.trim();let points=Math.min(clue.length,85)/6;
  if(clue.length>=9&&clue.length<=75)points+=8;
  if(/^(?:از نام[‌ ]های|نامی از|یک نوع|نوعی|مخفف|نام|از شهرهای)/.test(clue))points-=10;
  if(clue.length<7)points-=6;
  return points-e.issues*2;
 };
 candidates.sort((a,b)=>specificity(b)-specificity(a)||String(a.id).localeCompare(String(b.id)));
 const lengthBuckets=new Map(),answerSeen=new Set(),clueSeen=new Set();
 for(const candidate of candidates){
  if(answerSeen.has(candidate.answer)||clueSeen.has(candidate.clue))continue;
  answerSeen.add(candidate.answer);clueSeen.add(candidate.clue);
  const arr=lengthBuckets.get(candidate.length)||[];
  arr.push(candidate);lengthBuckets.set(candidate.length,arr);
 }
 const lengthOrder=[4,5,6,7,3,8,9,10,11,12,13,14,15].filter(n=>n<=max);
 const balanced=[];
 for(let round=0;balanced.length<24;round++){
  let added=false;
  for(const n of lengthOrder){
   const item=lengthBuckets.get(n)?.[round];
   if(!item)continue;
   balanced.push(item);added=true;
   if(balanced.length===24)break;
  }
  if(!added)break;
 }
 const categories=new Set(ready.map(x=>x.category)),difficulties=new Set(ready.map(x=>x.difficulty));
 return {total:data.length,reviewedFlag:data.filter(e=>e?.reviewed===1||e?.reviewed===true).length,
  approved:ready.length,uniqueApproved:answers.size,byLength,categories:[...categories],
  difficulties:[...difficulties],sourceCount:sources.size,candidates:balanced,
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
 const trusted=corpusTrusted(privateEntries());
 const status=$('trustedCorpusStatus');
 if(status)status.textContent=trusted?
  'تأیید بانک فعلی برای طراحی فعال است؛ این فقط مجوز استفاده از واژه‌ها در جست‌وجوست، نه تأیید خودکار انتشار.':
  'بانک در حالت بازبینی تک‌مدخل است. برای استفاده از بانک مورد تأییدت در طراحی، گزینهٔ اعتماد به بانک را فعال کن.';
 const pool=candidateEntries(privateEntries());
 const sum=$('bankReadinessSummary');
 sum.textContent='از '+new Intl.NumberFormat('fa-IR').format(info.total)+' مدخل، '+
  new Intl.NumberFormat('fa-IR').format(info.reviewedFlag)+' دارای نشان بازبینی و فقط '+
  new Intl.NumberFormat('fa-IR').format(info.approved)+' مدخل با برچسب بازبینی تک‌مدخل هستند؛ تعداد مدخل قابل استفاده برای طراحی با وضعیت فعلی: '+
  new Intl.NumberFormat('fa-IR').format(pool.length)+'؛ پاسخ یکتای دارای برچسب بازبینی: '+
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
 const msgs=trusted?
  ['درستی بانک بنا بر تأیید مالک برای طراحی پذیرفته شده است؛ صحت هندسه، سرنخ‌های جدول نهایی، تنوع و حقوق انتشار همچنان جداگانه کنترل می‌شوند.']:
  info.warnings.slice(0,5);
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
 const activate=$('activateTrustedCorpus');
 if(activate)activate.onclick=()=>{
  const check=$('trustCorpusConsent'),message=$('trustedCorpusStatus');
  if(!check?.checked){if(message)message.textContent='ابتدا تأیید درستی بانک فعلی را علامت بزن.';return;}
  try{trustCorpus(privateEntries());check.checked=false;refresh();}
  catch(err){if(message)message.textContent=err.message;}
 };
 Promise.resolve(root.JadvalApp?.localReady).then(refresh).catch(()=>{});
}
const api={analyze,approved,approvedEntries,candidateEntries,corpusTrusted,trustCorpus,signature,reviewReasons,citationOK,refresh,normalize,licences};
if(root)root.JadvalBankReadiness=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}
})(typeof window!=='undefined'?window:null);
