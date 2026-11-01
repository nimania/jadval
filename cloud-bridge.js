/* Jadval private Firestore bridge. No Firebase SDK is loaded unless configured.
   This module never deletes the IndexedDB bank or uploads it without confirmation.
   Dedicated Firebase Auth + Firestore Rules must be enabled by the owner first. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const config=window.JADVAL_FIREBASE_CONFIG||{};
const configured=["apiKey","authDomain","projectId","appId"].every(key=>typeof config[key]==="string"&&config[key].trim());
let auth=null,db=null,api=null,administrator=null,remoteReady=false,loading=false,remoteCount=0;
let retainedLocal=null,cloudRows=[],lastLoadError=null;
const SDK="https://www.gstatic.com/firebasejs/12.19.0/";
const state=message=>{if($("cloudStatus"))$("cloudStatus").textContent=message;};
const summary=message=>{if($("cloudProgress"))$("cloudProgress").textContent=message;};
const setButtons=()=>{
 if($("cloudLogin"))$("cloudLogin").disabled=!configured||!!administrator;
 if($("cloudLogout"))$("cloudLogout").disabled=!administrator;
 if($("cloudReload"))$("cloudReload").disabled=!administrator||loading;
 if($("cloudImport"))$("cloudImport").disabled=!administrator||loading||remoteReady;
};
function normalizedItem(entry){
 return {
  id:String(entry.id||""),
  answer:String(entry.answer||"").trim(),clue:String(entry.clue||"").trim(),
  letters:Number(entry.letters||[...String(entry.answer||"")].length),
  category:String(entry.category||"دسته‌بندی‌نشده"),
  difficulty:String(entry.difficulty||"unknown"),
  reviewed:entry.reviewed?1:0,
  source:String(entry.source||""),license:String(entry.license||""),
  revision:Number(entry.revision||entry._cloudRevision||1)
 };
}
function firestoreId(entry){
 const id=String(entry.id||"");
 if(/^[A-Za-z0-9_-]{1,180}$/.test(id)&&!/^__.*__$/.test(id))return id;
 // Legacy entries without safe IDs get a reproducible composite 32-bit checksum.
 // Such IDs are checked for collisions before any writes are committed.
 let h1=2166136261,h2=0x9e3779b9;
 const str=id+"|"+String(entry.answer||"")+"|"+String(entry.clue||"");
 for(let i=0;i<str.length;i++){const ch=str.charCodeAt(i);h1=Math.imul(h1^ch,16777619);h2=Math.imul(h2+ch,2246822519);}
 return "legacy_"+(h1>>>0).toString(16).padStart(8,"0")+(h2>>>0).toString(16).padStart(8,"0");
}
const rawToLocal=(snap)=>{
 const e=snap.data();
 return {...e,id:e.id||snap.id,reviewed:e.reviewed?1:0,_cloudId:snap.id,_cloudRevision:Number(e.revision||1)};
};
async function loadCentral(){
 if(!administrator||loading)return;
 loading=true;setButtons();state("در حال بررسی پایگاه دادهٔ مرکزی...");
 try{
  const marker=await api.getDoc(api.doc(db,"meta","bank"));
  const control=marker.exists()?marker.data():null;
  const count=await api.getCountFromServer(api.collection(db,"entries"));
  remoteCount=count.data().count;
  if(control?.status==="importing"){
   remoteReady=false;
   state("انتقال اولیه ناتمام است. از همان دستگاه با بانک اصلی، انتقال را ادامه بده.");
   summary("رکوردهای منتقل‌شده تا این لحظه: "+remoteCount+"؛ انتظار: "+(control.expected||"نامعلوم"));
   return;
  }
  if(!remoteCount){
   remoteReady=false;
   state("پایگاه مرکزی هنوز خالی است. بانکِ ذخیره‌شدهٔ این مرورگر را می‌توان یک بار منتقل کرد.");
   retainedLocal=window.JadvalApp?.getLocal?.()||[];
   summary("بانک همین مرورگر: "+retainedLocal.length+" مدخل؛ هنوز چیزی ارسال نشده است.");
   return;
  }
  if(control?.status!=="ready"){
   remoteReady=false;state("مدخل‌های ابری موجودند، اما وضعیت انتقال اولیه تأیید نشده است. برای جلوگیری از جایگزینی اطلاعات، همگام‌سازی متوقف شد.");
   return;
  }
  state("در حال دریافت بانک مرکزی ("+remoteCount+" مدخل)...");
  const snapshots=await api.getDocsFromServer(api.collection(db,"entries"));
  const data=snapshots.docs.map(rawToLocal);
  await window.JadvalApp?.backupBeforeCloud?.();
  cloudRows=data;
  window.JadvalApp?.useCloudRows?.(data);
  remoteReady=true;
  lastLoadError=null;
  state("متصل به بانک مرکزی: "+data.length+" مدخل — "+(administrator.email||"مدیر"));
  summary("ویرایش‌ها پس از ذخیره در Firestore روی دستگاه دیگر با ورود یا «دریافت آخرین تغییرات» نمایش داده می‌شوند.");
 }catch(err){
  lastLoadError=err;remoteReady=false;
  state("دسترسی یا دریافت بانک مرکزی ناموفق بود: "+(err.code||err.message));
 }finally{loading=false;setButtons();}
}
async function authStateChanged(user){
 administrator=null;remoteReady=false;cloudRows=[];setButtons();
 if(!user){
  state(configured?"برای دسترسی به بانک خصوصی، با حساب مدیر وارد شو.":"اتصال مرکزی تنظیم نشده است.");
  return;
 }
 state("در حال بررسی مجوز دسترسی...");
 try{
  const admin=await api.getDoc(api.doc(db,"admins",user.uid));
  if(!admin.exists()||admin.data().enabled!==true){
   state("حساب وارد شده مجوز مدیریت ندارد. شناسهٔ مدیر (UID): "+user.uid+" — دسترسی به بانک داده نشد.");
   summary("مدیر پروژه باید سند admins/"+user.uid+" با enabled=true را در Firebase Console ایجاد کند.");
   return;
  }
  administrator={uid:user.uid,email:user.email||""};
  retainedLocal=window.JadvalApp?.getLocal?.()||[];
  await loadCentral();
 }catch(err){state("بررسی مجوز مدیر ناموفق بود: "+(err.code||err.message));}
 finally{setButtons();}
}
async function login(){
 if(!configured||!api)return;
 try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}
 catch(err){state("ورود ناموفق بود: "+(err.code||err.message));}
}
async function logout(){
 if(!auth)return;
 await api.signOut(auth);
 administrator=null;remoteReady=false;
 window.JadvalApp?.hideCloudRows?.();
 state("از حساب مدیریتی خارج شدی. داده‌های ابری دیگر نمایش داده نمی‌شوند.");
 setButtons();
}
async function saveEntry(entry){
 if(!remoteReady||!administrator)throw Error("بانک مرکزی هنوز آمادهٔ ثبت ویرایش نیست.");
 const id=entry._cloudId||firestoreId(entry);
 const ref=api.doc(db,"entries",id),previous=Number(entry._cloudRevision||0);
 const raw=normalizedItem(entry);
 await api.runTransaction(db,async tx=>{
  const old=await tx.get(ref);
  if(old.exists()){
   const rev=Number(old.data().revision||1);
   if(previous!==rev)throw new Error("تعارض نسخه: این مدخل در دستگاه دیگری تغییر کرده؛ ابتدا آخرین نسخه را دریافت کن.");
   tx.update(ref,{...raw,revision:rev+1,updatedAt:new Date().toISOString()});
  }else if(!previous){
   tx.set(ref,{...raw,revision:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }else throw new Error("این مدخل در بانک مرکزی پیدا نشد.");
 });
 entry._cloudId=id;entry._cloudRevision=previous?previous+1:1;
 summary("ویرایش «"+entry.answer+"» در پایگاه مرکزی ذخیره شد.");
 return true;
}
async function importBrowser(){
 if(!administrator||loading||remoteReady)return;
 const local=retainedLocal?.length?retainedLocal:(window.JadvalApp?.getLocal?.()||[]);
 if(!local.length){state("بانک مرورگر خالی است؛ ابتدا از دستگاه اصلی با بانک موجود وارد شو.");return;}
 if(!confirm("انتقال اولیهٔ "+local.length+" مدخل به Firestore آغاز شود؟ این کار ممکن است هزینهٔ سرویس داشته باشد. هیچ سند موجودی بازنویسی نمی‌شود و بانک محلی محفوظ می‌ماند."))return;
 loading=true;setButtons();
 try{
  const markerRef=api.doc(db,"meta","bank");
  const marker=await api.getDoc(markerRef);
  const info=marker.exists()?marker.data():null;
  if(info?.status==="ready")throw new Error("بانک مرکزی قبلاً راه‌اندازی شده است. واردسازی مجدد مجاز نیست.");
  if(info?.status==="importing"&&info.owner!==administrator.uid)throw new Error("مهاجرت در حساب مدیر دیگری آغاز شده است.");
  const docs=await api.getDocsFromServer(api.collection(db,"entries"));
  if(docs.size>0&&info?.status!=="importing")throw new Error("سندهای مرکزی موجودند اما وضعیت مهاجرت مشخص نیست؛ انتقال ایمن متوقف شد.");
  const existing=new Set(docs.docs.map(s=>s.id));
  const prepared=[],unique=new Map();
  for(const e of local){
   const norm=normalizedItem(e),id=firestoreId(e);
   if(!norm.id||!norm.answer||!norm.clue)throw new Error("بانک دارای مدخل بدون شناسه، جواب یا سؤال است.");
   const identity=norm.id+"|"+norm.answer+"|"+norm.clue;
   if(unique.has(id)&&unique.get(id)!==identity)throw new Error("تداخل شناسهٔ مدخل‌ها: "+id);
   unique.set(id,identity);
   if(!existing.has(id))prepared.push({id,record:norm});
  }
  if(!info)await api.setDoc(markerRef,{status:"importing",owner:administrator.uid,expected:local.length,startedAt:new Date().toISOString()});
  let uploaded=0;
  for(let i=0;i<prepared.length;i+=100){
   const batch=api.writeBatch(db);
   for(const {id,record} of prepared.slice(i,i+100)){
    batch.set(api.doc(db,"entries",id),{...record,revision:1,
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   }
   await batch.commit();uploaded+=Math.min(100,prepared.length-i);
   summary("انتقال: "+(existing.size+uploaded)+" از "+local.length+" مدخل");
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const final=await api.getCountFromServer(api.collection(db,"entries"));
  const total=final.data().count;
  if(total!==unique.size)throw new Error("تعداد مدخل‌های مرکزی ("+total+") با تعداد شناسه‌های یکتای محلی ("+unique.size+") یکسان نیست؛ وضعیت انتقال باز می‌ماند.");
  await api.setDoc(markerRef,{status:"ready",owner:administrator.uid,expected:unique.size,count:total,completedAt:new Date().toISOString()});
  state("انتقال بانک مرکزی انجام شد: "+total+" مدخل.");
 }catch(err){remoteReady=false;state("انتقال متوقف شد؛ بانک محلی حفظ شده است. "+(err.code||err.message));}
 finally{loading=false;setButtons();}
 if(administrator)await loadCentral();
}
async function bootstrap(){
 if(!$("cloudStatus"))return;
 if(!configured){state("Firebase هنوز به این سایت متصل نشده است. پیکربندی پروژهٔ خصوصی لازم است.");setButtons();return;}
 try{
  const [appSdk,authSdk,storeSdk]=await Promise.all([
   import(SDK+"firebase-app.js"),import(SDK+"firebase-auth.js"),import(SDK+"firebase-firestore.js")]);
  const app=appSdk.initializeApp(config,"jadval-private");
  auth=authSdk.getAuth(app);db=storeSdk.getFirestore(app);
  api={...authSdk,...storeSdk};
  api.onAuthStateChanged(auth,authStateChanged);
  setButtons();
 }catch(err){state("بارگذاری سرویس Firebase ناموفق بود: "+(err.message||err));}
}
window.JadvalCloud={
 isReady:()=>remoteReady&&!!administrator,
 isConnected:()=>!!administrator,
 saveEntry,loadCentral,
 getLocalSnapshot:()=>retainedLocal?.slice()||[],
 configIsReady:()=>!!configured
};
function init(){
 if($("cloudLogin"))$("cloudLogin").onclick=login;
 if($("cloudLogout"))$("cloudLogout").onclick=logout;
 if($("cloudReload"))$("cloudReload").onclick=loadCentral;
 if($("cloudImport"))$("cloudImport").onclick=importBrowser;
 setButtons();
 Promise.resolve(window.JadvalApp?.localReady).then(bootstrap);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();