/* Private Firestore bank. Migration is explicit, backed up, content-checked and create-only. */
(function(){
'use strict';
const $=id=>document.getElementById(id),S=window.JadvalSafety,B=window.JadvalBackup;
const config=window.JADVAL_FIREBASE_CONFIG||{},configured=['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim());
const SDK='https://www.gstatic.com/firebasejs/12.19.0/';
let auth=null,db=null,api=null,administrator=null,remoteReady=false,loading=false,source='locked',epoch=0,cache=null,verifiedSecurity=false;
const state=s=>{$('cloudStatus').textContent=s;},summary=s=>{$('cloudProgress').textContent=s;};
function buttons(){ $('cloudLogin').disabled=!api||!!auth?.currentUser; $('cloudLogout').disabled=!auth?.currentUser||loading; $('cloudReload').disabled=!administrator||loading; $('cloudImport').disabled=!administrator||loading||remoteReady; }
const bankRef=()=>api.doc(db,'meta','bank');
const rawToLocal=s=>{const d=s.data();return {...d.legacy,...d,id:d.id,reviewed:d.reviewed,_cloudId:s.id,_cloudRevision:d.revision};};
const still=(token,uid)=>token===epoch&&administrator?.uid===uid;
async function cacheRows(rows,generation,uid){cache={uid,generation,entries:rows};await B.put('cloud-cache',cache);}
async function showPending(){
 const box=$('cloudPending');box.replaceChildren();if(!administrator)return;
 const stored=await B.readState(),pending=stored['pending-cloud-edits']?.entries||[];
 for(const item of pending){
  const line=document.createElement('div');line.className='note';
  const label=document.createElement('p');label.textContent='ویرایش معلق: '+item.id+' — '+item.answer;line.append(label);
  const button=document.createElement('button');button.className='btn';button.textContent='بررسی و حل تعارض';
  button.onclick=()=>resolvePending(item).catch(e=>state(e.message));line.append(button);box.append(line);
 }
}
async function finishPending(item,choice){
 const stored=await B.readState(),p=stored['pending-cloud-edits']||{entries:[],history:[]};
 p.history=p.history||[];p.history.push({item,choice,resolvedAt:new Date().toISOString()});p.entries=p.entries.filter(x=>x.id!==item.id);
 await B.put('pending-cloud-edits',p);await showPending();
}
async function resolvePending(item){
 if(!administrator||loading)return;
 const id=item._cloudId||await S.docId(item),snap=await api.getDocFromServer(api.doc(db,'entries',id));
 const server=snap.exists()?rawToLocal(snap):null;
 B.download({schema:1,exportedAt:new Date().toISOString(),local:item,server},'jadval-conflict-'+id+'.json');
 if(!confirm('نسخهٔ این دستگاه:\n'+JSON.stringify(S.record(item),null,2)+'\n\nنسخهٔ سرور:\n'+JSON.stringify(server?S.record(server):null,null,2)+'\n\nنسخهٔ این دستگاه پس از مقایسه جای نسخهٔ سرور ثبت شود؟'))return;
 const candidate={...item,_cloudId:id,_cloudRevision:server?server._cloudRevision:0};
 await saveEntry(candidate,true);await finishPending(item,'local-after-review');await loadCentral();
}
async function loadCentral(){
 if(!administrator||loading)return;
 const token=epoch,uid=administrator.uid;loading=true;remoteReady=false;source='locked';buttons();
 try{
  const pending=await window.JadvalApp.pendingCount();
  if(pending){state(pending+' ویرایش معلق محفوظ است. پیش از دریافت تغییرات، تعارض‌ها را بررسی کن.');await showPending();return;}
  const marker=await api.getDocFromServer(bankRef()),control=marker.exists()?marker.data():null;
  if(!still(token,uid))return;
  if(control?.status!=='ready'){
   const stored=await B.readState();window.JadvalApp.useCloudRows(stored.bank?.entries||[]);window.JadvalApp.grantEditorView();source='local';
   state(control?.status==='importing'?'انتقال اولیه ناتمام است؛ ادامه فقط با همان بانک و پشتیبان تأییدشده مجاز است.':'بانک مرکزی هنوز راه‌اندازی نشده است.');
   summary('بانک ذخیره‌شدهٔ این مرورگر: '+(stored.bank?.entries?.length||0)+' مدخل. هیچ انتقال خودکاری انجام نمی‌شود.');await B.refresh();return;
  }
  if(control.schema!==2||!Number.isInteger(control.generation))throw Error('نسخهٔ بانک مرکزی با این برنامه سازگار نیست؛ دریافت متوقف شد.');
  const stored=await B.readState();cache=cache?.uid===uid?cache:stored['cloud-cache'];
  const usable=cache?.uid===uid&&Array.isArray(cache.entries)&&Number.isInteger(cache.generation)&&cache.generation<=control.generation;
  let rows=usable?cache.entries:[];
  if(!usable||cache.generation!==control.generation){
   state('در حال دریافت بانک خصوصی...');
   const q=usable?api.query(api.collection(db,'entries'),api.where('generation','>',cache.generation)):api.collection(db,'entries');
   const docs=await api.getDocsFromServer(q),merged=new Map(rows.map(r=>[r._cloudId,r]));for(const d of docs.docs)merged.set(d.id,rawToLocal(d));rows=[...merged.values()];
  }
  if(!still(token,uid))return;
  if(rows.length<control.count)throw Error('تعداد رکوردهای دریافت‌شده کمتر از شمارش مرکزی است؛ نسخهٔ محلی جایگزین نشد.');
  await cacheRows(rows,control.generation,uid);
  if(!still(token,uid))return;
  window.JadvalApp.useCloudRows(rows);window.JadvalApp.grantEditorView();remoteReady=true;source='cloud';
  state('متصل به بانک مرکزی: '+rows.length+' مدخل — '+administrator.email);
  summary('آخرین دریافت موفق: '+new Date().toLocaleTimeString('fa-IR')+'؛ تغییرات هر ۹۰ ثانیه و با دکمهٔ دریافت به‌روز می‌شوند.');
 }catch(e){state('دریافت متوقف شد؛ داده‌های محلی محفوظ‌اند: '+(e.code||e.message));}
 finally{loading=false;buttons();}
}
async function authChanged(user){
 const token=++epoch;administrator=null;remoteReady=false;source='locked';cache=null;verifiedSecurity=false;window.JadvalApp.hideCloudRows();buttons();
 if(!user){state('برای دسترسی به بانک خصوصی، با حساب مدیر وارد شو.');return;}
 state('در حال بررسی مجوز مدیر...');
 try{
  const snap=await api.getDocFromServer(api.doc(db,'admins',user.uid));if(token!==epoch)return;
  if(!user.emailVerified||user.providerData.every(p=>p.providerId!=='google.com')||!snap.exists()||snap.data().enabled!==true){state('این حساب مجوز ندارد. UID: '+user.uid);summary('پس از ایجاد سند مدیر در Firebase، «دریافت آخرین تغییرات» یا ورود مجدد را امتحان کن.');return;}
  administrator={uid:user.uid,email:user.email};await loadCentral();await showPending();
 }catch(e){state('بررسی مجوز ناموفق: '+(e.code||e.message)+' — UID: '+user.uid);}
 finally{buttons();}
}
async function login(){try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}catch(e){state('ورود ناموفق: '+(e.code||e.message)+(e.code==='auth/popup-blocked'?'؛ پنجره‌های بازشو را برای این سایت مجاز کن و دوباره دکمهٔ ورود را بزن.':''));}}
async function saveEntry(entry,resolving=false){
 if(!administrator||loading||(!remoteReady&&!resolving))throw Error('بانک مرکزی آمادهٔ ثبت نیست.');
 const uid=administrator.uid,token=epoch,id=entry._cloudId||await S.docId(entry),ref=api.doc(db,'entries',id),prior=Number(entry._cloudRevision||0),raw=S.validate(S.record(entry));
 const result=await api.runTransaction(db,async tx=>{
  const [meta,old]=await Promise.all([tx.get(bankRef()),tx.get(ref)]);
  if(!still(token,uid)||!meta.exists()||meta.data().status!=='ready')throw Error('بانک آماده نیست.');
  if(old.exists()&&prior!==old.data().revision)throw Error('تعارض نسخه: این مدخل در دستگاه دیگر تغییر کرده است.');
  if(!old.exists()&&prior)throw Error('مدخل مورد انتظار در سرور نیست.');
  const generation=meta.data().generation+1,revision=old.exists()?prior+1:1;
  const value={...raw,revision,generation,createdAt:old.exists()?old.data().createdAt:api.serverTimestamp(),updatedAt:api.serverTimestamp()};
  tx.set(ref,value);tx.update(bankRef(),{generation,count:meta.data().count+(old.exists()?0:1),lastEntry:id});return {revision,generation};
 });
 entry._cloudId=id;entry._cloudRevision=result.revision;entry.revision=result.revision;entry.generation=result.generation;
 // Do not advance the cache cursor here: another device may have committed an earlier generation.
 summary('ویرایش «'+entry.answer+'» در سرور ثبت شد.');return true;
}
async function assertPrivate(){
 const [appSdk,authSdk,storeSdk]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);
 const probe=appSdk.initializeApp(config,'jadval-anonymous-check-'+Date.now());const probeAuth=authSdk.initializeAuth(probe,{persistence:authSdk.inMemoryPersistence});const probeDb=storeSdk.getFirestore(probe);
 try{
  if(probeAuth.currentUser)throw Error('آزمون ناشناس معتبر نیست.');
  for(const path of [['entries','__access_probe__'],['meta','bank']]){
   let denied=false;try{await storeSdk.getDocFromServer(storeSdk.doc(probeDb,...path));}catch(e){if(e.code==='permission-denied')denied=true;else throw e;}
   if(!denied)throw Error('قواعد خصوصی نیستند؛ خواندن ناشناس مجاز شد. انتقال مسدود است.');
  }
  verifiedSecurity=true;
 }finally{await storeSdk.terminate(probeDb);await appSdk.deleteApp(probe);}
}
// Browser-native prompt/confirm dialogs can be suppressed by automated browser
// debugging. Keep migration consent in an accessible, explicit page dialog.
function migrationConsent(title,description,{number=false,approveLabel='ادامه'}={}){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-label',title);
  dialog.setAttribute('dir','rtl');
  dialog.style.cssText='width:min(92vw,560px);max-width:92vw;border:1px solid #d6dfe7;border-radius:15px;padding:24px;background:#fff;color:#1b2734;box-shadow:0 18px 55px #18232d55;';
  const form=document.createElement('form');
  form.setAttribute('novalidate','');
  const heading=document.createElement('h2');heading.textContent=title;
  const details=document.createElement('p');details.textContent=description;details.style.cssText='white-space:pre-line;line-height:1.9;margin:12px 0;color:#526778;';
  form.append(heading,details);
  let field=null;
  if(number){
   field=document.createElement('input');field.type='text';field.inputMode='numeric';
   field.autocomplete='off';field.dir='ltr';field.required=true;
   field.setAttribute('aria-label',title);field.placeholder='عدد را وارد کن';
   field.style.cssText='display:block;width:100%;padding:12px;border:1px solid #afbdc9;border-radius:9px;margin:12px 0 18px;text-align:left;';
   form.append(field);
  }
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:20px;';
  const approve=document.createElement('button');approve.type='submit';approve.className='btn primary';approve.textContent=approveLabel;
  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='انصراف';
  actions.append(approve,cancel);form.append(actions);dialog.append(form);
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
  form.addEventListener('submit',event=>{event.preventDefault();if(number&&!field.value.trim()){field.focus();return;}finish(number?field.value:true);});
  cancel.addEventListener('click',()=>finish(null));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  document.body.append(dialog);
  try{dialog.showModal();(field||approve).focus();}catch(error){dialog.remove();reject(error);}
 });
}
function parseConfirmedCount(value){
 const normalized=String(value??'').trim().replace(/[۰-۹٠-٩]/g,ch=>{
  const code=ch.charCodeAt(0);return String(code>=0x06F0?code-0x06F0:code-0x0660);
 }).replace(/[\s,٬]/g,'');
 return /^\d+$/.test(normalized)?Number(normalized):NaN;
}
async function importBrowser(){
 if(!administrator||loading||remoteReady)return;
 loading=true;source='locked';buttons();const uid=administrator.uid,token=epoch;
 try{
  const stored=await B.assertVerified();if(stored['pending-cloud-edits']?.entries?.length)throw Error('ویرایش معلق موجود است؛ ابتدا تعارض‌ها را بررسی کن.');
  const plan=await S.prepare(stored.bank?.entries||[]);
  const expected=await migrationConsent('تأیید تعداد بانک','برای ادامه باید تعداد دقیق مدخل‌های بانک اصلی را وارد کنی.\nتعداد ذخیره‌شده در این مرورگر: '+plan.count+' مدخل.\nاین مرحله هیچ داده‌ای منتقل نمی‌کند.',{number:true,approveLabel:'تأیید تعداد'});
  if(expected===null)return;if(parseConfirmedCount(expected)!==plan.count)throw Error('تعداد تأییدشده با بانک مرورگر یکسان نیست. عدد '+plan.count+' را وارد کن.');
  await assertPrivate();
  const marker=await api.getDocFromServer(bankRef()),info=marker.exists()?marker.data():null;
  if(info&&(info.status!=='importing'||info.schema!==2||info.owner!==uid||info.expected!==plan.count||info.fingerprint!==plan.fingerprint))throw Error('بانک یا مهاجرت دیگری موجود است؛ انتقال مسدود شد.');
  const docs=await api.getDocsFromServer(api.collection(db,'entries'));
  if(docs.size&&!info)throw Error('سرور دارای دادهٔ قبلی بدون نشانگر معتبر است؛ هیچ سندی بازنویسی نمی‌شود.');
  const missing=S.reconcile(plan.prepared,docs.docs.map(d=>({id:d.id,record:d.data()})));
  const budgetInput=await migrationConsent('بررسی سهمیهٔ Firestore','پس از بررسی Usage در Firebase، فقط تعداد نوشتن باقی‌ماندهٔ امروز را وارد کن.\nسقف روزانهٔ رایگان: ۲۰۰۰۰؛ برنامه ۱۰۲ عملیات حاشیهٔ امن نگه می‌دارد.\nتعداد اسناد جدید لازم: '+missing.length+'.\nدر صورت نامشخص بودن سهمیه، انصراف را انتخاب کن.',{number:true,approveLabel:'بررسی سهمیه'});
  if(budgetInput===null)return;const budget=parseConfirmedCount(budgetInput);
  if(!Number.isInteger(budget)||budget>20000||budget<103)throw Error('سهمیهٔ تأییدشده معتبر نیست.');
  const allowance=Math.min(missing.length,budget-102);
  const approved=await migrationConsent('تأیید نهایی انتقال','پشتیبان SHA-256 بررسی و دسترسی ناشناس رد شده است.\nکل بانک: '+plan.count+' مدخل؛ اسناد موجود و مطابق: '+docs.size+'؛ اسناد جدید برای این نوبت: '+allowance+'.\nهیچ سند موجود بازنویسی نمی‌شود. با تأیید این مرحله نوشتن واقعی در Firestore آغاز می‌شود.',{approveLabel:'تأیید و شروع انتقال'});
  if(!approved)return;
  if(!still(token,uid))throw Error('حساب تغییر کرده است.');
  // Freeze the exact source: a second tab's edits invalidate the verified backup.
  await B.assertVerified();
  if(!info)await api.runTransaction(db,async tx=>{const current=await tx.get(bankRef());if(current.exists())throw Error('مهاجرت هم‌زمان آغاز شده؛ دوباره بررسی کن.');tx.set(bankRef(),{schema:2,status:'importing',owner:uid,expected:plan.count,fingerprint:plan.fingerprint,startedAt:api.serverTimestamp()});});
  for(let i=0;i<allowance;i+=100){
   if(!still(token,uid))throw Error('حساب تغییر کرده است.');
   const batch=api.writeBatch(db);for(const x of missing.slice(i,Math.min(i+100,allowance)))batch.set(api.doc(db,'entries',x.id),{...x.record,revision:1,generation:0,createdAt:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
   // Rules prohibit ALL updates while importing, including racing batch.set calls.
   await batch.commit();summary('انتقال: '+(docs.size+Math.min(i+100,allowance))+' از '+plan.count);
  }
  if(allowance<missing.length){state('انتقال برای حفظ سهمیه متوقف شد؛ پس از بازنشانی سهمیه، با همان پشتیبان ادامه بده.');return;}
  const final=await api.getDocsFromServer(api.collection(db,'entries'));
  if(final.size!==plan.count||S.reconcile(plan.prepared,final.docs.map(d=>({id:d.id,record:d.data()}))).length)throw Error('تطبیق کامل تعداد/محتوا موفق نبود؛ بانک آماده اعلام نشد.');
  await api.runTransaction(db,async tx=>{const current=await tx.get(bankRef()),m=current.data();if(m.status!=='importing'||m.owner!==uid||m.fingerprint!==plan.fingerprint)throw Error('نشانگر انتقال تغییر کرده است.');tx.update(bankRef(),{status:'ready',count:plan.count,generation:0,completedAt:api.serverTimestamp()});});
  const rows=final.docs.map(rawToLocal);await cacheRows(rows,0,uid);window.JadvalApp.useCloudRows(rows);window.JadvalApp.grantEditorView();remoteReady=true;source='cloud';state('انتقال و تطبیق کامل موفق: '+rows.length+' مدخل. بانک اصلی مرورگر محفوظ است.');
 }catch(e){remoteReady=false;state('انتقال متوقف شد؛ داده‌های محلی محفوظ‌اند: '+(e.code||e.message));}
 finally{loading=false;buttons();}
}
// Public publication is independent of the private bank migration.
// Only a completely reviewed, whitelisted puzzle leaves the browser.
async function publishPuzzle(publication){
 if(!administrator||!auth?.currentUser||loading)throw Error('برای انتشار، با حساب مدیر وارد شو.');
 if(!publication||publication.editorApproved!==true||!publication.id||!publication.title||
    !publication.puzzle||!Number.isInteger(publication.size))throw Error('بستهٔ انتشار یا تأیید ویراستار معتبر نیست.');
 const uid=administrator.uid,token=epoch;
 const ref=api.doc(db,'publishedPuzzles',publication.id);
 const payload={id:publication.id,title:publication.title,size:publication.size,
  publishedAt:api.serverTimestamp(),approvedBy:uid,editorApproved:true,
  puzzle:publication.puzzle};
 await api.setDoc(ref,payload); // Firestore rules permit CREATE only; no overwrites.
 if(!still(token,uid))throw Error('حساب پس از درخواست انتشار تغییر کرده است؛ وضعیت صفحهٔ عمومی را بررسی کن.');
 return {id:publication.id,url:'https://nimania.github.io/payamejadval/?id='+encodeURIComponent(publication.id)};
}
async function bootstrap(){
 if(!configured){state('اتصال مرکزی تنظیم نشده است.');buttons();return;}
 try{const [a,b,c]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);const app=a.initializeApp(config,'jadval-private');api={...b,...c};auth=b.getAuth(app);db=c.getFirestore(app);b.onAuthStateChanged(auth,authChanged);buttons();}catch(e){state('بارگذاری Firebase ناموفق: '+e.message);}
}
window.JadvalCloud={isReady:()=>remoteReady&&!!administrator,isConnected:()=>!!administrator,canEdit:()=>!!administrator&&!loading&&(source==='cloud'||source==='local'),canPublish:()=>!!administrator&&!loading,publishPuzzle,saveEntry,loadCentral,configIsReady:()=>configured};
function init(){ $('cloudLogin').onclick=login;$('cloudLogout').onclick=()=>api.signOut(auth);$('cloudReload').onclick=()=>administrator?loadCentral():authChanged(auth.currentUser);$('cloudImport').onclick=importBrowser;buttons();Promise.resolve(window.JadvalApp?.localReady).then(bootstrap);setInterval(()=>{if(remoteReady&&!loading&&document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))loadCentral();},90000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
