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
   d.className=mask[r][c]?"demo-cell demo-block art-"+($("blockArt")?.value||"plain"):"demo-cell";
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
  const bank=(typeof entries!=="undefined"?entries:[]);
  const magazine=$("patternStyle")?.value==="magazine";
  const masks=magazine&&n===15?
   [window.JadvalClassic?.referenceMask?.()].filter(Boolean):
   window.JadvalClassic?.build(n,Date.now(),8,bank,magazine?"iran-magazine":"strict")||[];
  if(!masks.length){$("classicPreview").hidden=true;$("demoNote").textContent="برای این تلاش الگوی مناسبی یافت نشد؛ دوباره امتحان کن.";return;}
  const mask=masks[0];
  const stats=window.JadvalClassic.assess(mask,bank);
  current=mask;renderMask(mask);
  const shortSlots=window.JadvalClassic.slots(mask).filter(x=>x.length<3).length;
  $("classicPreviewMeta").textContent="الگوی "+n+"×"+n+" — "+stats.blackCells+" خانهٔ سیاه ("+(100*stats.blackCells/(n*n)).toFixed(1)+"٪)، "+stats.slots+" جایگاه، "+shortSlots+" جایگاه یک‌ یا دوحرفی؛ بلندترین پاسخ "+stats.longestRequired+" حرف. پیش‌نمایش، جدول حل‌شده نیست.";
  $("demoNote").textContent=stats.missingLengths.length?
   "این تصویر الگوی مرجع است، اما بانک فعلی برای طول‌های "+stats.missingLengths.join("، ")+" حرف پاسخ ندارد؛ در جست‌وجوی واقعی، طرح‌های سازگار دیگری انتخاب می‌شوند و هیچ واژه‌ای ساختگی جایگزین نمی‌شود.":
   "الگوی مجله‌ای نمایش داده شد. برای هر جایگاه کوتاه نیز پاسخ واقعی و سرنخ مطابق بانک لازم است؛ حل کامل تقاطع‌ها تضمین نشده است.";
  $("classicPreview").scrollIntoView({behavior:"smooth",block:"start"});
 };
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
const style=$("blockArt");if(style)style.addEventListener("change",()=>{if(current)renderMask(current);});
window.JadvalClassicPreview={renderMask,getSelected:()=>current?current.map(row=>row.slice()):null};
})();