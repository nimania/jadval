/* Streamlined maker interface; visual-only mode, never grants Firebase permissions. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function init(){
 const button=$('makerSimpleSwitch');if(!button)return;
 let simple=new URLSearchParams(location.search).get('simple')==='1';
 const apply=()=>{
  document.body.classList.toggle('simple-maker',simple);
  button.textContent=simple?'نمایش ابزارهای پیشرفته':'حالت سادهٔ تولید';
  button.setAttribute('aria-pressed',String(simple));
 };
 button.addEventListener('click',()=>{simple=!simple;apply()});
 const picker=$('patternTemplate'),mode=$('patternStyle'),size=$('demoSize');
 function sync(){
  if(!picker||!mode||!size)return;
  const available=mode.value==='magazine'&&size.value==='15';
  picker.disabled=!available;
  if(!available)picker.value='auto';
 }
 for(const el of [mode,size])el?.addEventListener('change',sync);
 apply();sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();