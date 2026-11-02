/* Private Google Sheets → classical 15×15 crossword studio.
   No anonymous or public export of the raw wordbank; OAuth token stays in memory.
   Solver receives only source-backed answer/clue pairs. No automatic publishing. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const C=root.JadvalSheetCore;
const SHEET_ID='1u0dv4WNjQAz3QYleYDCbUkHDTWrLwxpYVDzCRl78p7E';
const SHEET_RANGE="'بانک یکپارچه'!A1:Q30000";
const SDK='https://www.gstatic.com/firebasejs/12.19.0/';
const fmt=new Intl.NumberFormat('fa-IR');
const state={entries:[],masks:[],maskIndex:0,solved:null,source:'',sourceCount:0,loading:false};
function setStatus(message,error=false){
 const el=$('status');
 el.textContent=message;
 el.classList.toggle('error',!!error);
}
function ready(){
 $('makeMasks').disabled=!state.entries.length||state.loading;
 $('nextMask').disabled=state.masks.length<2||state.loading;
 $('solve').disabled=!state.masks.length||state.loading||!state.entries.some(e=>e.clue);
 $('download').disabled=!state.solved;
 $('print').disabled=!state.solved;
 $('readSheet').disabled=state.loading;
 $('bankFile').disabled=state.loading;
}
function usableEntries(){
 const seen=new Set();
 return state.entries.filter(e=>{
  if(!e.clue)return false;
  const k=e.answer;
  if(seen.has(k))return false;
  seen.add(k);
  return true;
 });
}
function describeSource(){
 const stats=C.summarize(state.entries);
 $('bankStats').textContent=
  fmt.format(stats.records)+' مدخل خوانده شده؛ '+fmt.format(stats.uniqueAnswers)+
  ' پاسخ یکتا؛ '+fmt.format(stats.withClue)+' رکورد دارای سرنخ ('+
  fmt.format(stats.uniqueCluedAnswers)+' پاسخ یکتای قابل استفاده در حل‌گر).'+
  ' واژه‌های بدون سرنخ: '+fmt.format(stats.withoutClue)+'.';
}
function accept(rows,label,merge=true){
 const old=state.entries.length;
 state.entries=merge?C.merge(state.entries,rows.entries):C.merge([],rows.entries);
 state.source=label;
 state.sourceCount++;
 state.masks=[];state.solved=null;
 $('clues').classList.add('hidden');
 $('grid').replaceChildren();
 resetMetrics();
 describeSource();
 const added=state.entries.length-old;
 setStatus(fmt.format(added)+' رکورد جدید دریافت شد؛ '+
  fmt.format(rows.rejectedRows?.length||0)+' ردیف به دلیل ساختار، طول یا وضعیت رد/اصلاح کنار گذاشته شد. '+
  'فایل اصلی و بانک Google Sheets تغییر نکرده‌اند.');
 $('maskStatus').textContent='اکنون می‌توان الگوهای هندسی را تولید کرد.';
 ready();
}
function resetMetrics(){
 for(const id of ['statBlack','statDensity','statSlots','statGeometry'])$(id).textContent='—';
 $('qualityText').textContent='هنوز جدول کاملاً حل‌شده‌ای نداریم. نمای فعلی فقط الگوی هندسی است.';
}
function drawGrid(mask,grid=null){
 const container=$('grid');
 container.replaceChildren();
 container.classList.toggle('red',$('redBlocks').checked);
 container.classList.toggle('preview',!grid);
 for(let r=0;r<15;r++)for(let c=0;c<15;c++){
  const cell=document.createElement('div');
  cell.className='cell'+(mask[r][c]?' black':'');
  if(!mask[r][c]&&grid)cell.textContent=grid[r][c]||'';
  container.append(cell);
 }
}
function showCurrentMask(){
 if(!state.masks.length)return;
 const mask=state.masks[state.maskIndex];
 const g=C.geometry(mask);
 if(!g.valid||!root.JadvalClassic?.valid(mask))
  throw Error('الگوی غیرمجاز شناسایی شد؛ نمایش متوقف شد.');
 state.solved=null;
 drawGrid(mask);
 $('clues').classList.add('hidden');
 $('statBlack').textContent=fmt.format(g.black);
 $('statDensity').textContent=(g.density*100).toFixed(1)+'٪';
 $('statSlots').textContent=fmt.format(g.slots);
 $('statGeometry').textContent='معتبر';
 $('qualityText').textContent='چرخش ۱۸۰ درجه: برقرار؛ تعداد سیاه‌خانه: '+g.black+
  '؛ اتصال سفیدخانه‌ها و حداقل ۳ حرف در هر جهت: برقرار. این فقط الگوست، نه جدول حل‌شده.';
 $('maskStatus').textContent='الگوی '+fmt.format(state.maskIndex+1)+' از '+fmt.format(state.masks.length)+'.';
 ready();
}
function randomSeed(){return Math.floor(Math.random()*0x7fffffff);}
async function makeMasks(){
 if(state.loading)return;
 const maker=root.JadvalClassic;
 if(!maker)throw Error('موتور هندسهٔ کلاسیک در دسترس نیست.');
 state.loading=true;ready();
 $('maskStatus').textContent='در حال ساخت الگوهای هندسی و سنجش طول پاسخ‌ها…';
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  // Geometry must be judged against lengths that can actually have clues.
  const pool=usableEntries();
  const support=pool.length?pool:state.entries;
  const masks=maker.build(15,randomSeed(),8,support);
  state.masks=masks.filter(mask=>C.geometry(mask).valid&&maker.valid(mask));
  state.maskIndex=0;state.solved=null;
  if(!state.masks.length){
   $('grid').replaceChildren();
   resetMetrics();
   throw Error('الگوی ۱۵×۱۵ واجد شرایط پیدا نشد. می‌توان الگوی بذر دیگری آزمایش کرد.');
  }
  showCurrentMask();
  setStatus('هندسهٔ کلاسیک آماده است. برای ساخت جدول کامل، حل‌گر باید تمام جایگاه‌های افقی و عمودی را از سرنخ‌های بانک پر کند.');
 }catch(err){setStatus(err.message,true);}
 finally{state.loading=false;ready();}
}
function workerSolve(mask,pool,budget){
 return new Promise(resolve=>{
  const worker=new Worker('./classic-solver-worker.js');
  const id=String(randomSeed());
  const watchdog=setTimeout(()=>finish({status:'timeout',reports:[]}),budget+4000);
  function finish(message){
   clearTimeout(watchdog);worker.terminate();resolve(message);
  }
  worker.onmessage=event=>{if(event.data?.id===id)finish(event.data);};
  worker.onerror=()=>finish({status:'error',message:'اشکال اجرای Worker'});
  worker.postMessage({action:'solve',id,masks:[mask],entries:pool.map(x=>({
   id:x.id,answer:x.answer,clue:x.clue})),options:{totalMs:budget,seed:randomSeed()}});
 });
}
function renderClues(puzzle){
 const sections=[
  ['horizontal','acrossClues'],['vertical','downClues']
 ];
 for(const [direction,target] of sections){
  const box=$(target);box.replaceChildren();
  const clues=puzzle.clues?.[direction]||{};
  for(const number of Object.keys(clues).sort((a,b)=>Number(a)-Number(b))){
   const p=document.createElement('p');
   const strong=document.createElement('strong');
   strong.textContent=fmt.format(Number(number))+'. ';
   p.append(strong,document.createTextNode(clues[number].join(' — ')));
   box.append(p);
  }
 }
 $('clues').classList.remove('hidden');
}
async function solveCurrent(){
 if(state.loading||!state.masks.length)return;
 const mask=state.masks[state.maskIndex];
 const pool=usableEntries();
 if(!pool.length){setStatus('بانک هیچ پرسش‌وپاسخ قابل‌استفاده‌ای ندارد.',true);return;}
 state.loading=true;state.solved=null;ready();
 const budget=Math.min(60000,Math.max(12000,Number($('budget').value)||12000));
 setStatus('حل‌گر تقاطعی در حال بررسی '+fmt.format(pool.length)+
  ' پاسخ منحصربه‌فرد با سرنخ است؛ خروجی ناقص نمایش داده نخواهد شد.');
 try{
  const response=await workerSolve(mask,pool,budget);
  if(response.status!=='solved'||!response.result?.puzzle){
   const reports=response.reports||[];
   const top=reports.reduce((best,v)=>(v.bestDepth||0)>(best.bestDepth||0)?v:best,{});
   setStatus('جدول کامل پیدا نشد. بیشترین پیشرفت: '+
    fmt.format(top.bestDepth||0)+' از '+fmt.format(top.slotCount||0)+' جایگاه. '+
    'علت: '+(top.status||response.status)+'. افزایش تعداد سرنخ‌های مستقل و تنوع حروف می‌تواند امکان حل را بیشتر کند. این نتیجه به معنی ناممکن‌بودن جدول نیست.',true);
   return;
  }
  const result=response.result,puzzle=result.puzzle;
  const maskCheck=C.geometry(result.mask||mask);
  if(!maskCheck.valid)throw Error('هندسهٔ خروجی معیارهای سخت‌گیرانه را نقض می‌کند.');
  // A true word + clue pair from the selected source is required for each slot.
  const bankAudit=root.JadvalQuality?.audit(puzzle,pool,{trustedCorpus:true});
  if(!bankAudit?.technicalPassed||!bankAudit?.bankPassed){
   const failures=(bankAudit?.errors||[]).map(x=>x.code).slice(0,7).join('، ');
   throw Error('دروازهٔ کنترل کیفیت جدول را رد کرد: '+failures+'.');
  }
  state.solved=puzzle;
  drawGrid(result.mask||mask,puzzle.grid);
  renderClues(puzzle);
  $('statBlack').textContent=fmt.format(maskCheck.black);
  $('statDensity').textContent=(maskCheck.density*100).toFixed(1)+'٪';
  $('statSlots').textContent=fmt.format(maskCheck.slots);
  $('statGeometry').textContent='قبول';
  $('qualityText').textContent='جدول کامل و صحیح از نظر هندسه و تطبیق پرسش‌وپاسخ با داده‌های بارگذاری‌شده؛ بازبینی انسانی سرنخ‌ها و حقوق انتشار همچنان ضروری است.';
  setStatus('جدول کامل ساخته شد. '+fmt.format(maskCheck.slots)+' پاسخ منحصربه‌فرد و تمام تقاطع‌ها تأیید شدند. این پیش‌نویس خودکار منتشر نمی‌شود.');
 }catch(err){setStatus('خطا یا رد کنترل کیفیت: '+err.message,true);}
 finally{state.loading=false;ready();}
}
function download(){
 if(!state.solved)return;
 const packageData={schema:1,stage:'editorial-draft',generatedAt:new Date().toISOString(),
  bankSource:state.source,geometry:C.geometry(state.masks[state.maskIndex]),puzzle:state.solved};
 const blob=new Blob([JSON.stringify(packageData,null,2)],{type:'application/json;charset=utf-8'});
 const u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='jadval-classic-15-draft.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(u),1000);
}
async function readGoogleSheet(){
 if(state.loading)return;
 state.loading=true;ready();setStatus('در حال ورود مجاز به Google Sheets…');
 try{
  const config=root.JADVAL_FIREBASE_CONFIG;
  if(!config?.apiKey||!config?.authDomain||!config?.projectId||!config?.appId)
   throw Error('پیکربندی عمومی Firebase Auth تنظیم نشده است.');
  const [appModule,authModule]=await Promise.all([
   import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js')]);
  const app=appModule.getApps().find(x=>x.name==='jadval-sheet-reader')||
   appModule.initializeApp(config,'jadval-sheet-reader');
  const auth=authModule.getAuth(app);
  const provider=new authModule.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
  const result=await authModule.signInWithPopup(auth,provider);
  const token=authModule.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if(!token)throw Error('Google Sheets OAuth access token دریافت نشد.');
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(SHEET_ID)+
   '/values/'+encodeURIComponent(SHEET_RANGE)+'?valueRenderOption=UNFORMATTED_VALUE';
  // Token remains in the local JS stack; never store it in GitHub, Firestore or logs.
  const resp=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!resp.ok){
   const error=await resp.json().catch(()=>({}));
   const detail=error?.error?.message||'HTTP '+resp.status;
   throw Error('Google Sheets API دسترسی نداد ('+resp.status+'): '+detail+
    '. حساب باید به شیت دسترسی داشته باشد و Sheets API در پروژهٔ Google Cloud فعال باشد.');
  }
  const response=await resp.json();
  if(!Array.isArray(response.values))throw Error('شیت خالی یا پاسخ API نامعتبر است.');
  const rows=C.fromSheet(response.values);
  accept(rows,'Google Sheets خصوصی',true);
 }catch(err){setStatus('خواندن شیت ناموفق بود: '+(err?.message||err)+'. در صورت نیاز از فایل CSV/JSON استفاده کنید.',true);}
 finally{state.loading=false;ready();}
}
async function readFile(event){
 const file=event.target.files?.[0];if(!file)return;
 state.loading=true;ready();
 try{
  const content=await file.text();
  const rows=C.parseFile(content,file.name);
  accept(rows,'فایل محلی '+file.name,true);
 }catch(err){setStatus('ورود فایل انجام نشد: '+err.message,true);}
 finally{state.loading=false;ready();event.target.value='';}
}
function init(){
 if(!$('grid'))return;
 $('readSheet').addEventListener('click',readGoogleSheet);
 $('bankFile').addEventListener('change',readFile);
 $('makeMasks').addEventListener('click',makeMasks);
 $('nextMask').addEventListener('click',()=>{
  if(!state.masks.length)return;
  state.maskIndex=(state.maskIndex+1)%state.masks.length;
  showCurrentMask();
 });
 $('solve').addEventListener('click',solveCurrent);
 $('redBlocks').addEventListener('change',()=>{
  $('grid').classList.toggle('red',$('redBlocks').checked);
 });
 $('download').addEventListener('click',download);
 $('print').addEventListener('click',()=>{if(state.solved)window.print();});
 ready();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
root.JadvalSheetStudio={state,usableEntries,accept};
})(window);
