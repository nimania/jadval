/* Editable bank extension with length diagnostics; user-controlled, local only. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c\u200d\u064b-\u065f\u0670\-ـ]/g,'');
const valid=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
function bank(){return typeof entries!=='undefined'&&Array.isArray(entries)?entries:[]}
function diagnostics(){
 const arr=bank(),byLength=new Map(),unique=new Map();
 for(const item of arr){
  const word=clean(item.answer);if(!valid.test(word))continue;
  const len=[...word].length,seen=unique.get(len)||new Set();
  seen.add(word);unique.set(len,seen);
 }
 for(const [len,set] of unique)byLength.set(len,set.size);
 const bars=$('lengthBars');if(!bars)return;
 bars.replaceChildren();
 for(let len=2;len<=20;len++){
  const div=document.createElement('div');div.className='length-item';
  const label=document.createElement('span');label.textContent=new Intl.NumberFormat('fa-IR').format(len)+' حرف';
  const track=document.createElement('div');track.className='length-track';
  const fill=document.createElement('div');fill.className='length-fill';fill.style.width=Math.max(0,Math.min(100,(byLength.get(len)||0)/Math.max(...byLength.values(),1)*100))+'%';
  track.append(fill);
  const number=document.createElement('strong');number.textContent=new Intl.NumberFormat('fa-IR').format(byLength.get(len)||0);
  div.append(label,track,number);bars.append(div);
 }
 const count=[13,14,15,16,17,18,19,20].map(len=>len+': '+(byLength.get(len)||0)).join(' | ');
 $('lengthNote').textContent='پاسخ‌های بلندِ یکتا بر اساس طول — '+count+'. وجود پاسخ با طول مناسب به معنی امکان قطعی حل تمام تقاطع‌ها نیست.';
}
function openForm(){$('longEntryDialog').showModal();}
async function addEntry(event){
 event.preventDefault();
 const clue=$('newClue').value.trim(),answer=clean($('newAnswer').value),source=$('newSource').value.trim(),length=[...answer].length;
 if(length<2||length>30||!valid.test(answer)||!clue||!source){
  $('longError').textContent='سؤال، پاسخ فارسی ۲ تا ۳۰حرفی و منبع را کامل وارد کن.';return;
 }
 const existing=bank().find(x=>clean(x.answer)===answer&&String(x.clue||'').trim()===clue);
 if(existing){$('longError').textContent='این سؤال‌وجواب قبلاً در بانک وجود دارد.';return;}
 const id='manual-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e8).toString(36);
 bank().push({id,clue,answer,letters:length,category:$('newCategory').value,difficulty:'unknown',reviewed:0,
 source,license:'user-supplied',addedAt:new Date().toISOString()});
 try{await save();updateCategories();applyFilters();diagnostics();
  $('longEntryDialog').close();$('newEntryForm').reset();
  status('مدخل '+length+'حرفی ذخیره شد. هنوز بازبینی نشده است؛ از کل بانک خروجی پشتیبان بگیر.');
 }catch(err){$('longError').textContent='ذخیره‌سازی ناموفق: '+err.message;}
}
function init(){
 if(!$('addLongEntry'))return;
 $('addLongEntry').onclick=openForm;
 $('closeLongEntry').onclick=()=>$('longEntryDialog').close();
 $('newEntryForm').onsubmit=addEntry;
 $('showLengthStats').onclick=()=>{diagnostics();$('lengthStats').hidden=!$('lengthStats').hidden;};
 const button=$('buildDemo');if(button)button.addEventListener('click',diagnostics);
 const input=$('file');if(input)input.addEventListener('change',()=>setTimeout(diagnostics,750));
 setTimeout(diagnostics,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.JadvalBankTools={diagnostics};
})();