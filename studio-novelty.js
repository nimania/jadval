/* Preview novelty before publishing: exact answer+clue reuse and
   answer-only reuse against up to 100 older public crossword puzzles. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),fmt=new Intl.NumberFormat('fa-IR');
let run=0;
function asPlayer(){
 return {
  validateItem(item){
   const grid=item?.puzzle?.grid;
   return !!(grid&&Array.isArray(grid)&&grid.length>=2&&
    grid.every(row=>Array.isArray(row)&&row.length===grid.length)&&item?.puzzle?.clues);
  },
  slotsFor(grid){
   const mask=grid.map(row=>row.map(c=>!c));
   return (root.JadvalSparse?.slotsFor(mask,true)||[]).map(s=>({
    ...s,answer:s.cells.map(([r,c])=>grid[r][c]).join('')
   }));
  }
 };
}
function setText(s){const p=$('draftNoveltyStatus');if(p)p.textContent=s;}
async function evaluate(data){
 const token=++run;
 const wrapper=$('draftNovelty');if(!wrapper)return;
 wrapper.hidden=!data;
 if(!data)return;
 setText('در حال مقایسه با جدول‌های منتشرشده…');
 const body=$('draftNoveltyTable');body.replaceChildren();
 const p=asPlayer(),m=root.PayameMetrics;
 if(!m){setText('ماژول محاسبهٔ تکرار در دسترس نیست.');return;}
 const item={id:'__draft__',title:'پیش‌نویس',puzzle:data.puzzle};
 let history=[];
 try{
  if(root.JadvalCloud?.recentPublished)history=await root.JadvalCloud.recentPublished(110);
  else throw Error('اتصال آرشیو عمومی هنوز آماده نیست.');
 }catch(e){
  if(token!==run)return;
  setText('آمار مقایسه فعلاً قابل بررسی نیست: '+(e.code||e.message)+'. نتیجهٔ صفر به‌معنی نبود تکرار نیست.');
  return;
 }
 if(token!==run)return;
 const scores=m.windows(item,history,p);
 for(const x of scores){
  const tr=document.createElement('tr');
  for(const value of [
   'آخرین '+fmt.format(x.requested),
   fmt.format(x.actual),
   fmt.format(x.exactPct)+'٪ ('+fmt.format(x.exact)+' از '+fmt.format(x.total)+')',
   fmt.format(x.answerPct)+'٪ ('+fmt.format(x.answers)+' از '+fmt.format(x.total)+')']){
   const td=document.createElement('td');td.textContent=value;tr.append(td);
  }
  body.append(tr);
 }
 setText('محاسبه بر اساس '+fmt.format(history.length)+' جدول اخیر در آرشیو قابل خواندن. '+
  'نرخ تکرار دقیق، سؤال+جواب را با هم می‌سنجد؛ جوابِ تکراری با سؤال تازه حذف نمی‌شود.');
}
root.JadvalNovelty={evaluate,clear(){run++;const w=$('draftNovelty');if(w)w.hidden=true;}};
})(typeof window!=='undefined'?window:null);
