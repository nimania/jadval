/* Pure, offline-compatible import/geometry helpers for the private Sheets studio. */
(function(root){
'use strict';
const alphabet=/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیؤئء]+$/;
const normalize=s=>String(s??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
 .replace(/[\u064b-\u065f\u0670\s\u200c\u200d\-ـ]/g,'');
const clueClean=s=>String(s??'').trim().replace(/\s+/g,' ');
const rejected=new Set(['رد','نیازمند اصلاح']);
function makeEntry(src){
 const answer=normalize(src?.answer),clue=clueClean(src?.clue);
 const letters=answer.length;
 if(!alphabet.test(answer)||letters<3||letters>15)return null;
 if(rejected.has(String(src?.status||'').trim()))return null;
 if(src?.letters!=null && src.letters!=='' && Number(src.letters)!==letters)return null;
 return {
  id:String(src.id||src.candidate_id||'row-'+answer+'-'+clue),
  answer,clue,letters,
  category:String(src.category||'دسته‌بندی‌نشده'),
  difficulty:String(src.difficulty||'unknown'),
  source:String(src.source||src.source_url||src.source_id||'').trim(),
  license:String(src.license||''),
  reviewed:1,
  assumption:'owner-attested-words',
  clueStatus:clue?(src.clueStatus||'در انتظار بررسی'):'بدون سرنخ'
 };
}
function fromSheet(values){
 if(!Array.isArray(values)||!Array.isArray(values[0]))throw Error('Google Sheets values expected');
 if(values[0][0]!=='شناسه'||values[0][1]!=='پاسخ نرمال')
  throw Error('ساختار ستون‌های شیت با بانک مرکزی مطابقت ندارد.');
 const result=[],errors=[];
 for(let i=1;i<values.length;i++){
  const v=values[i];if(!v?.length||!v[1])continue;
  const row=makeEntry({
   id:v[0],answer:v[1],letters:v[3],clue:v[4],category:v[5],
   difficulty:v[6],status:v[7],source_id:v[9],source_url:v[10],
   license:v[11],clueStatus:v[16]
  });
  if(row)result.push(row);
  else errors.push(i+1);
 }
 return {entries:result,rejectedRows:errors};
}
function fromJsonRows(data){
 const source=Array.isArray(data)?data:Array.isArray(data?.entries)?data.entries:null;
 if(!source)throw Error('فرمت JSON باید آرایه یا شامل entries باشد.');
 const entries=[],errors=[];
 for(let i=0;i<source.length;i++){
  const row=makeEntry(source[i]);
  if(row)entries.push(row);else errors.push(i+1);
 }
 return {entries,rejectedRows:errors};
}
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++;}
   else quoted=!quoted;
  }else if(ch===','&&!quoted){row.push(cell);cell='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);if(row.some(v=>v!==''))rows.push(row);
   row=[];cell='';
  }else cell+=ch;
 }
 if(quoted)throw Error('فایل CSV کوتیشن باز دارد.');
 row.push(cell);if(row.some(v=>v!==''))rows.push(row);
 return rows;
}
function parseFile(text,name=''){
 const lower=String(name).toLowerCase();
 if(lower.endsWith('.csv'))return fromSheet(parseCSV(text));
 if(lower.endsWith('.jsonl')){
  const parsed=String(text).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  return fromJsonRows(parsed);
 }
 return fromJsonRows(JSON.parse(text));
}
function merge(existing,incoming){
 const map=new Map();
 for(const item of [...existing,...incoming]){
  const e=makeEntry(item);if(!e)continue;
  const key=e.answer+'\u0000'+e.clue;
  if(!map.has(key))map.set(key,e);
 }
 return [...map.values()];
}
function summarize(entries){
 const answers=new Set(),clued=new Set(),lengths={},withoutClue=[];
 for(const e of entries){
  answers.add(e.answer);lengths[e.letters]=(lengths[e.letters]||0)+1;
  if(e.clue)clued.add(e.answer);else withoutClue.push(e);
 }
 return {records:entries.length,uniqueAnswers:answers.size,withClue:entries.filter(e=>!!e.clue).length,
  uniqueCluedAnswers:clued.size,withoutClue:withoutClue.length,lengths};
}
function geometry(mask){
 if(!Array.isArray(mask)||mask.length!==15||mask.some(row=>row?.length!==15))return {valid:false,reason:'size'};
 let black=0,symmetric=true,twobytwo=0;
 for(let r=0;r<15;r++)for(let c=0;c<15;c++){
  if(mask[r][c])black++;
  if(mask[r][c]!==mask[14-r][14-c])symmetric=false;
  if(r<14&&c<14&&mask[r][c]&&mask[r+1][c]&&mask[r][c+1]&&mask[r+1][c+1])twobytwo++;
 }
 const density=black/225,validDensity=density>=.12-1e-9&&density<=.167+1e-9;
 let connected=false;
 const white=[];
 for(let r=0;r<15;r++)for(let c=0;c<15;c++)if(!mask[r][c])white.push([r,c]);
 if(white.length){
  const seen=new Set([white[0].join(',')]),queue=[white[0]];
  for(let i=0;i<queue.length;i++){
   const [r,c]=queue[i];
   for(const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]])
    if(nr>=0&&nr<15&&nc>=0&&nc<15&&!mask[nr][nc]&&!seen.has(nr+','+nc)){
     seen.add(nr+','+nc);queue.push([nr,nc]);
    }
  }
  connected=seen.size===white.length;
 }
 const lengths=[],goodRuns=()=>lengths.every(n=>n>=3);
 for(let r=0;r<15;r++){
  let length=0;
  for(let c=0;c<=15;c++){
   if(c===15||mask[r][c]){if(length)lengths.push(length);length=0;}else length++;
  }
 }
 for(let c=0;c<15;c++){
  let length=0;
  for(let r=0;r<=15;r++){
   if(r===15||mask[r][c]){if(length)lengths.push(length);length=0;}else length++;
  }
 }
 const valid=validDensity&&symmetric&&twobytwo===0&&connected&&goodRuns();
 return {valid,size:15,black,density,white:225-black,rotationalSymmetry:symmetric,
  blackSquares2x2:twobytwo,connected,slots:lengths.length,minimumLength:Math.min(...lengths),
  maximumLength:Math.max(...lengths)};
}
const api={normalize,clueClean,makeEntry,fromSheet,fromJsonRows,parseCSV,parseFile,merge,summarize,geometry};
if(root)root.JadvalSheetCore=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
