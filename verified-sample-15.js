/* First fully completed 15×15 construction from the licensed local question bank.
   This is a proof-of-concept draft, not a randomized puzzle and not approved for publication.
   The word layout is retained; clues are resolved from the user's locally imported bank. */
(function(root){
"use strict";
const variants=[
 [
"اوان■نفرون■تربت",
"سوله■ریحان■ناشو",
"لهوف■اتللو■همرس",
"وانت■دوتار■■■■■",
"بنده■■■■■■مرسین",
"■■■■وخامت■ایرما",
"■■■■اولاد■همسال",
"صفه■راهرو■ایرنا",
"دلق■سنایی■نایین",
"■■■■یامان■■■■■■",
"لیتر■■■■■■■■حمد",
"هاشم■ایربال■وره",
"اقوا■بایستن■ابا",
"سوید■بریانی■لوت",
"اتشی■ریسمان■یطی"
 ],
 [
"شلیل■خودرو■حیدر",
"راغب■باروک■بناب",
"ایلو■اربیل■سامر",
"رکود■زوایا■■■■■",
"هایا■■■■■■سندرم",
"■■■■دهلیز■یاکنه",
"■■■■ایهام■اکتبر",
"زشت■رمادی■هاروی",
"کمد■انسان■هراره",
"■■■■بهاری■■■■■■",
"حنان■■■■■■■■بدل",
"رومی■لیسبون■درا",
"یکرو■یونانی■نام",
"ریزش■اتوبوس■اور",
"هاشا■ناراست■مرد"
 ],
 [
"مشرف■اتباع■اوسر",
"ترام■هواکش■میرا",
"مینی■دهدار■نرمه",
"ساکن■امارت■■■■■",
"کنیا■■■■■■تبرید",
"■■■■سیراف■انهار",
"■■■■رامین■نانسی",
"اقا■هلاکو■کرمان",
"خلل■مترنم■اسارا",
"■■■■یامان■■■■■■",
"بیدا■■■■■■■■خیر",
"زانو■اکادمی■رکب",
"بمبی■سنپیتر■واو",
"ابان■بیابان■اند",
"شولی■قزلالا■رهن"
 ]
];
const clean=s=>String(s??"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\s\u200c\u200d\-ـ\u064b-\u065f]/g,"");
function build(bank,variant=0){
 const n=15;
 if(!Array.isArray(bank)||!bank.length)return {error:"بانک سؤال‌وجواب بارگذاری نشده است."};
 const wordLookup=new Map();
 for(const e of bank){
  const word=clean(e.answer),clue=String(e.clue||"").trim();
  if(word&&clue&&!wordLookup.has(word))wordLookup.set(word,{clue,id:e.id||null});
 }
 const index=((Math.floor(Number(variant)||0)%variants.length)+variants.length)%variants.length;
 const sourceGrid=variants[index].map(line=>[...line].reverse().map(ch=>ch==="■"?"":ch));
 // For the second curated sample, reflect along the anti-diagonal so
 // horizontal RTL answers become vertical top-down answers and vice versa.
 const grid=index===1?sourceGrid.map((row,r)=>row.map((_,c)=>sourceGrid[14-c][14-r])):sourceGrid;
 if(grid.length!==n||grid.some(row=>row.length!==n))return {error:"اندازهٔ نمونهٔ ذخیره‌شده نامعتبر است."};
 const mask=grid.map(row=>row.map(ch=>!ch));
 const slots=root.JadvalSparse?.slotsFor(mask);
 if(!slots)return {error:"مدخل‌های یک‌حرفی یا ساختار نادرست پیدا شد."};
 const clues={horizontal:{},vertical:{}},used=new Set(),missing=[];
 for(const slot of slots){
  const answer=slot.cells.map(([r,c])=>grid[r][c]).join(""),entry=wordLookup.get(clean(answer));
  if(!entry){missing.push(answer);continue;}
  if(used.has(clean(answer)))return {error:"جواب تکراری در نمونه وجود دارد."};
  used.add(clean(answer));
  (clues[slot.dir][String(slot.group)]??=[]).push(entry.clue);
 }
 if(missing.length)return {error:"در بانک محلی برای "+missing.length+" پاسخ این نمونه مدخلی یافت نشد."};
 const puzzle={version:3,grid,clues,meta:{title:"نمونهٔ کامل ۱۵×۱۵ شمارهٔ "+(index+1)+" — نیازمند بازبینی",size:{rows:n,cols:n},
   language:"fa",direction:"rtl",status:"draft",method:"constructed-bank-proof",
   editorialStatus:"not-reviewed",sampleVariant:index+1,source:"local licensed question bank"}};
 const result={puzzle,mask,slots:slots.length,usedIds:[],sample:true};
 if(!root.JadvalSparse.validateComplete(result))return {error:"اعتبارسنجی نهایی نمونه ناموفق بود."};
 if(slots.length!==77)return {error:"تعداد جایگاه‌های نمونه با نسخهٔ آزموده‌شده یکسان نیست."};
 return {result};
}
root.JadvalVerified15={build,rows:variants[0],getRows:index=>variants[index],variants:variants.length};
})(window);
