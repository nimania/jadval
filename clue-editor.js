/* Private, offline-first clue-in-cell designer. No Firestore writes, no auto-publish. */
(function(){
'use strict';
const api=window.PayameClueInCell;
if(!api)throw Error('Clue-in-cell model unavailable.');
const $=id=>document.getElementById(id),fmt=new Intl.NumberFormat('fa-IR');
let item=null,selected=null,preview=false,previewValues=new Map(),sequence=0;
const storage=variant=>'payamejadval:clue-draft:v1:'+variant;
const clone=x=>JSON.parse(JSON.stringify(x));
function status(message,error=false){const el=$('actionStatus');el.textContent=message;el.style.borderRightColor=error?'#b53130':'#4388a1';}
function save(){
 if(!item)return;
 try{localStorage.setItem(storage(item.variant),JSON.stringify(item));}
 catch(_){status('حافظهٔ مرورگر پر است؛ پیش‌نویس را با JSON دانلود کن.',true);}
}
function setItem(next,quiet=false){
 item=next;preview=false;previewValues.clear();
 $('variant').value=item.variant;$('puzzleTitle').value=item.title;
 save();draw();if(!quiet)status('تغییرات در همین مرورگر ذخیره شد.');
}
function draft(variant){
 try{
  const raw=localStorage.getItem(storage(variant));
  if(raw){
   const imported=JSON.parse(raw),report=api.inspect(imported);
   if(report.valid)return imported;
  }
 }catch(_){}
 return api.blank(variant);
}
function blockRow(text,className){
 const row=document.createElement('span');row.className=className;row.textContent=text;return row;
}
function cellLabel(r,c,cell){
 const clue=(cell.clueIds||[]).map(id=>item.puzzle.entries.find(e=>e.id===id)).filter(Boolean);
 return 'سطر '+fmt.format(r+1)+'، ستون '+fmt.format(item.puzzle.grid[0].length-c)+
 (cell.kind==='clue'?': '+clue.map(e=>e.clue).join('؛ '):cell.kind==='letter'?': '+cell.answer:'');
}
function drawGrid(report){
 const node=$('clueGrid');node.replaceChildren();
 const grid=report.grid||item.puzzle.grid,size=api.sizes[item.variant];
 node.style.gridTemplateColumns='repeat('+size.width+',34px)';
 node.setAttribute('aria-rowcount',String(size.height));
 node.setAttribute('aria-colcount',String(size.width));
 for(let r=0;r<size.height;r++)for(let c=0;c<size.width;c++){
  const cell=grid[r][c],key=r+','+c;
  if(preview&&cell.kind==='letter'){
   const input=document.createElement('input');
   input.type='text';input.maxLength=1;input.inputMode='text';
   input.className='grid-cell preview-input';
   input.value=previewValues.get(key)||'';
   input.setAttribute('aria-label',cellLabel(r,c,cell));
   input.addEventListener('input',()=>{
    const value=api.normalize(input.value).slice(0,1);
    input.value=value;if(value)previewValues.set(key,value);else previewValues.delete(key);
   });
   node.append(input);continue;
  }
  const button=document.createElement('button');button.type='button';
  button.className='grid-cell '+cell.kind;
  if(selected&&selected[0]===r&&selected[1]===c)button.classList.add('selected');
  button.title=cellLabel(r,c,cell);
  button.setAttribute('aria-label',button.title);
  if(cell.kind==='letter')button.textContent=preview?'':cell.answer;
  else if(cell.kind==='clue'){
   const records=(cell.clueIds||[]).map(id=>item.puzzle.entries.find(x=>x.id===id)).filter(Boolean);
   const label=blockRow(records.map(x=>x.clue).join(' / '),'clue-label');
   const arrows=blockRow(records.map(x=>x.direction==='across'?'←':'↓').join(''),'arrow');
   button.append(label,arrows);
  }else if(cell.kind==='empty')button.textContent='·';
  button.addEventListener('click',()=>select(r,c));
  node.append(button);
 }
}
function drawEntries(){
 const el=$('entryList');el.replaceChildren();
 const entries=item.puzzle.entries;
 if(!entries.length){
  const li=document.createElement('li');li.textContent='هنوز سرنخی وارد نشده است.';el.append(li);return;
 }
 for(const entry of entries){
  const li=document.createElement('li'),label=document.createElement('button'),remove=document.createElement('button');
  label.className='select-entry';label.type='button';
  label.textContent=(entry.direction==='across'?'← ':'↓ ')+entry.clue+' — '+entry.answer;
  label.title='انتخاب خانهٔ سرنخ در شبکه';
  label.addEventListener('click',()=>{
   select(...entry.clueCell);
   $('clueText').value=entry.clue;$('answerText').value=entry.answer;$('entryDirection').value=entry.direction;
  });
  remove.type='button';remove.textContent='حذف';remove.setAttribute('aria-label','حذف '+entry.clue);
  remove.addEventListener('click',()=>{
   try{setItem(api.removeEntry(item,entry.id));status('سرنخ حذف شد؛ حروف مشترک با سایر جواب‌ها حفظ شدند.');}
   catch(err){status(err.message,true);}
  });
  li.append(label,remove);el.append(li);
 }
}
function drawQuality(report){
 const el=$('gridStats');el.replaceChildren();
 const st=report.stats;
 if(st){
  for(const [label,count] of [
   ['پاسخ افقی',st.across],['پاسخ عمودی',st.down],['خانهٔ پاسخ',st.letter],
   ['خانهٔ سرنخ',st.clue],['خانهٔ سیاه',st.block],['بلاتکلیف',st.empty],
   ['حروف متقاطع',st.crossings],['کل سؤال‌ها',st.entries]
  ])el.append(blockRow(label+': '+fmt.format(count),''));
 }
 const qa=$('qaStatus');
 qa.textContent=report.publishable?'تمام کنترل‌های فنی اولیه گذرانده شدند. پیش از انتشار، صحت سرنخ‌ها باید به‌صورت انسانی نیز بازبینی شود.':
  'هنوز آمادهٔ بررسی انتشار نیست:\n'+report.errors.slice(0,6).map(x=>'• '+x).join('\n')+
  (report.errors.length>6?'\n…':'');
 qa.className='note '+(report.publishable?'quality-pass':'quality-fail');
 $('exportApproved').disabled=!report.publishable;
}
function draw(){
 if(!item)return;
 const result=api.inspect(item),size=api.sizes[item.variant];
 $('sizeLabel').textContent=fmt.format(size.width)+'×'+fmt.format(size.height);
 $('togglePreview').textContent=preview?'بازگشت به ویرایش':'پیش‌نمایش حل‌کننده';
 $('checkPreview').hidden=!preview;
 $('toggleBlock').disabled=preview;
 $('fillBlocks').disabled=preview;
 for(const field of $('entryForm').elements)field.disabled=preview;
 drawGrid(result);drawEntries();drawQuality(result);drawSelection();
}
function drawSelection(){
 if(!selected){$('selectionText').textContent='برای انتخاب محل سؤال، روی یک خانه کلیک کن.';
  $('entryLocation').textContent='هنوز خانهٔ سرنخ انتخاب نشده است.';return;}
 const [r,c]=selected;
 const shown='سطر '+fmt.format(r+1)+'، ستون '+fmt.format(api.sizes[item.variant].width-c);
 $('selectionText').textContent='خانهٔ انتخابی: '+shown;
 $('entryLocation').textContent='محل سؤال: '+shown+
  ' | افقی از خانهٔ سمت چپ آغاز می‌شود؛ عمودی از خانهٔ زیر سؤال.';
}
function select(r,c){
 if(preview)return;
 selected=[r,c];drawGrid(api.inspect(item));drawSelection();
}
function fileDownload(content,name){
 const blob=new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),20000);
}
function filename(suffix){
 return 'clue-in-cell-'+item.variant+'-'+new Date().toISOString().slice(0,10)+'-'+suffix+'.json';
}
$('entryForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!selected){status('ابتدا محل سؤال را در شبکه انتخاب کن.',true);return;}
 const word=api.normalize($('answerText').value);
 try{
  const entry={id:'entry-'+Date.now()+'-'+(++sequence),clue:$('clueText').value,
   answer:word,clueCell:selected,direction:$('entryDirection').value};
  const old=item;
  setItem(api.addEntry(old,entry));
  $('clueText').value='';$('answerText').value='';
  status('پاسخ '+word+' در شبکه ثبت شد و تقاطع‌ها بررسی شدند.');
 }catch(err){status('جای‌گذاری ممکن نیست: '+err.message,true);}
});
$('variant').addEventListener('change',()=>{
 selected=null;setItem(draft($('variant').value));status('طرح مستقل بارگذاری شد. پیش‌نویس طرح قبلی حفظ شده است.');
});
$('puzzleTitle').addEventListener('change',()=>{
 item.title=$('puzzleTitle').value.trim()||api.sizes[item.variant].label;save();
});
$('newDraft').addEventListener('click',()=>{
 if(!confirm('طرح فعلی در این مرورگر با یک طرح خالی جایگزین شود؟ قبل از ادامه از آن خروجی JSON بگیر.'))return;
 selected=null;setItem(api.blank($('variant').value));status('طرح جدید باز شد.');
});
$('loadDemo').addEventListener('click',()=>{
 if(!confirm('نمونهٔ آموزشی جایگزین طرح این دستگاه می‌شود. اگر طرح فعلی را لازم داری ابتدا خروجی JSON بگیر.'))return;
 try{
  let example=api.blank($('variant').value);
  const records=[
   ['a','رحمت آسمانی','باران','across',[4,6]],
   ['b','واحدی از زمان','روز','down',[3,3]],
   ['c','خواندنی چاپی','کتاب','across',[9,12]],
   ['d','میوهٔ تابستانی','توت','down',[8,10]]
  ];
  for(const [id,clue,answer,direction,clueCell] of records)
   example=api.addEntry(example,{id,clue,answer,direction,clueCell});
  example.title='نمونهٔ آموزشی شرح در متن ('+api.sizes[example.variant].label+')';
  selected=null;setItem(example);
  status('۴ سرنخ با دو تقاطع درست بارگذاری شد. این فقط نمونهٔ آموزشی است، نه جدول کامل و قابل انتشار.');
 }catch(err){status('نمونه قابل بارگذاری نیست: '+err.message,true);}
});
$('toggleBlock').addEventListener('click',()=>{
 if(!selected){status('اول خانهٔ موردنظر را انتخاب کن.',true);return;}
 const [r,c]=selected,kind=item.puzzle.grid[r][c].kind;
 if(!['empty','block'].includes(kind)){status('این خانه در حال حاضر جزو پاسخ یا محل سؤال است؛ ابتدا سرنخ مربوط را حذف کن.',true);return;}
 try{setItem(api.setBlock(item,r,c,kind!=='block'));}
 catch(err){status(err.message,true);}
});
$('fillBlocks').addEventListener('click',()=>{
 if(!confirm('همهٔ خانه‌های هنوز خالی به خانهٔ سیاه تبدیل شوند؟ این کار به معنی تأیید کیفیت جدول نیست.'))return;
 try{setItem(api.finishBlocks(item));status('خانه‌های بلاتکلیف بسته شدند؛ نتیجهٔ کنترل کیفیت را ببین.');}
 catch(err){status(err.message,true);}
});
$('checkDraft').addEventListener('click',()=>{
 const result=api.inspect(item);drawQuality(result);
 status(result.publishable?'کنترل‌های هندسی قبول شدند؛ بررسی انسانی سرنخ‌ها و منبع‌ها هنوز لازم است.':
  'موانع انتشار: '+result.errors.slice(0,4).join(' | '),!result.publishable);
});
$('togglePreview').addEventListener('click',()=>{
 preview=!preview;previewValues.clear();draw();
 status(preview?'حروف پاسخ پنهان شدند. داخل خانه‌های سفید تایپ کن و «بررسی پاسخ‌های آزمایشی» را بزن.':'به حالت ویرایش بازگشتی.');
});
$('checkPreview').addEventListener('click',()=>{
 let attempted=0,correct=0,total=0;
 for(let r=0;r<item.puzzle.grid.length;r++)for(let c=0;c<item.puzzle.grid[r].length;c++){
  const cell=item.puzzle.grid[r][c];if(cell.kind!=='letter')continue;
  total++;const v=previewValues.get(r+','+c);
  if(v){attempted++;if(v===cell.answer)correct++;}
 }
 status('پیش‌نمایش: '+fmt.format(correct)+' خانهٔ درست از '+fmt.format(attempted)+
  ' خانهٔ تکمیل‌شده؛ کل خانه‌های پاسخ: '+fmt.format(total));
});
$('exportDraft').addEventListener('click',()=>{save();fileDownload(item,filename('draft'));status('پیش‌نویس JSON دانلود شد؛ نسخه‌ای بیرون از این مرورگر نگه دار.');});
$('exportApproved').addEventListener('click',()=>{
 const result=api.inspect(item);
 if(!result.publishable){status('کنترل کیفیت کامل نشده است.',true);return;}
 if(!confirm('این فقط فایل آمادهٔ بازبینی ویراستاری است و به‌صورت خودکار در سایت منتشر نمی‌شود. خروجی بگیرم؟'))return;
 const final=clone(item);
 final.id='clue-'+final.variant+'-'+new Date().toISOString().slice(0,10)+'-'+Date.now();
 final.title=$('puzzleTitle').value.trim()||api.sizes[item.variant].label;
 final.puzzle.meta={status:'review-pending',method:'editor-draft',quality:result.stats};
 fileDownload(final,filename('for-review'));
 status('فایل آمادهٔ بازبینی تولید شد؛ این فایل هنوز مجوز انتشار خودکار ندارد.');
});
$('importDraft').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 try{
  if(file.size>2_000_000)throw Error('فایل بسیار بزرگ است.');
  const data=JSON.parse(await file.text()),check=api.inspect(data);
  if(!check.valid)throw Error(check.errors[0]||'فایل نامعتبر است.');
  if(!['horizontal','vertical'].includes(data.variant))throw Error('نوع طرح نامعتبر است.');
  selected=null;
  // Imported approved records become local drafts; never overwrite a public puzzle.
  data.puzzle.meta={...data.puzzle.meta,status:'draft',method:'editor-draft'};
  setItem(api.refresh(data));status('پیش‌نویس با تطبیق حروف و سرنخ‌ها بازیابی شد.');
 }catch(err){status('بازیابی انجام نشد: '+err.message,true);}
});
selected=null;setItem(draft('horizontal'),true);
})();