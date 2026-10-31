/* Preview geometry only. Separate from completed crossword export. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
let current=null;
function renderMask(mask){
 const grid=$("classicPreviewGrid"),n=mask.length;
 grid.replaceChildren();grid.style.gridTemplateColumns="repeat("+(n+1)+",minmax(0,1fr))";
 const label=(num,corner)=>{const d=document.createElement("div");d.className="demo-axis"+(corner?" demo-corner":"");d.textContent=corner?"":new Intl.NumberFormat("fa-IR").format(num);grid.append(d);};
 label(0,true);for(let c=1;c<=n;c++)label(c,false);
 for(let r=0;r<n;r++){
  label(r+1,false);
  for(let c=n-1;c>=0;c--){
   const d=document.createElement("div");
   d.className=mask[r][c]?"demo-cell demo-block":"demo-cell";
   grid.append(d);
  }
 }
 $("classicPreview").hidden=false;
}
function init(){
 const button=$("previewPattern");
 if(!button)return;
 button.onclick=()=>{
  const n=Number($("demoSize").value);
  if(![15,20].includes(n)){
   $("demoNote").textContent="پیش‌نمایش الگوی کلاسیک فعلاً برای اندازه‌های ۱۵×۱۵ و ۲۰×۲۰ آماده است.";
   $("classicPreview").hidden=true;
   return;
  }
  const masks=window.JadvalClassic?.build(n,Date.now(),8)||[];
  if(!masks.length){$("classicPreview").hidden=true;$("demoNote").textContent="برای این تلاش الگوی مناسبی یافت نشد؛ دوباره امتحان کن.";return;}
  const mask=masks[0],bank=(typeof entries!=="undefined"?entries:[]);
  const stats=window.JadvalClassic.assess(mask,bank);
  current=mask;renderMask(mask);
  $("classicPreviewMeta").textContent="الگوی "+n+"×"+n+" — "+stats.blackCells+" خانهٔ سیاه، "+stats.slots+" جایگاه افقی و عمودی، بیشترین طول موردنیاز "+stats.longestRequired+" حرف. این طرح، جدول تکمیل‌شده نیست.";
  $("demoNote").textContent=stats.missingLengths.length?
   "برای تکمیل این الگو، پاسخ‌هایی با طول "+stats.missingLengths.join("، ")+" حرف در فیلتر بانک پیدا نشد. الگو برای بررسی طراحی نمایش داده شده است.":
   "پترن نمایش داده شد. داشتن واژه با طول مناسب به معنی تضمین حل همهٔ تقاطع‌ها نیست.";
  $("classicPreview").scrollIntoView({behavior:"smooth",block:"start"});
 };
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.JadvalClassicPreview={renderMask};
})();