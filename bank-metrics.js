/* Private bank accounting in Studio. Never deletes Firestore entries or exposes
   questions or answers through GitHub Pages. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),fmt=new Intl.NumberFormat('fa-IR');
let latest=null,sourceSignature='';
function refresh(rows){
 const data=rows||root.JadvalApp?.getLocal?.()||[];
 const stats=root.PayameMetrics?.summarize(data);
 if(!stats||!$('bankMetrics'))return null;
 latest=stats;
 const pairs=$('metricUniquePairs'),clues=$('metricUniqueClues'),dups=$('metricDuplicateRows');
 if(pairs)pairs.textContent=fmt.format(stats.uniquePairs);
 if(clues)clues.textContent=fmt.format(stats.uniqueClues);
 if(dups)dups.textContent=fmt.format(stats.duplicateEntries);
 const status=$('bankMetricsStatus');
 if(status)status.textContent='شمار دقیق روی بانک فعلیِ این نشست: '+fmt.format(stats.totalEntries)+
  ' رکورد خام، '+fmt.format(stats.uniquePairs)+' سؤال+جواب غیرتکراری؛ '+
  fmt.format(stats.duplicateEntries)+' رکورد تکراری کامل. '+
  'این شمار، لزوماً به معنی همگام‌بودن نسخهٔ عمومی آمار یا Firestore نیست.';
 const body=$('bankLengthMetrics');if(body){
  body.replaceChildren();
  for(const length of Object.keys(stats.lengths).map(Number).sort((a,b)=>a-b)){
   const tr=document.createElement('tr');
   for(const val of [length,stats.lengths[length]]){
    const td=document.createElement('td');td.textContent=fmt.format(val);tr.append(td);
   }
   body.append(tr);
  }
 }
 return stats;
}
function downloadBank(){
 const raw=root.JadvalApp?.getLocal?.()||[];
 if(!raw.length){$('bankMetricsStatus').textContent='بانک خالی است.';return;}
 const duplicates=root.PayameMetrics.uniquePairs(raw);
 if(!confirm('نسخهٔ مستقلِ پالایش‌شده از بانک فعلی دانلود شود؟\nاین کار هیچ رکوردی را حذف نمی‌کند یا به سرور ارسال نمی‌کند.'))return;
 const payload={schema:1,source:'Jadval Studio non-destructive pair dedup export',
  exportedAt:new Date().toISOString(),count:duplicates.length,entries:duplicates};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='jadval-bank-pair-deduplicated-'+Date.now()+'.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 $('bankMetricsStatus').textContent='نسخهٔ پالایش‌شده ذخیره شد؛ بانک اصلی بدون تغییر باقی ماند.';
}
function exportAggregate(){
 const rows=root.JadvalApp?.getLocal?.()||[],s=refresh(rows);
 if(!s)return;
 const payload={schema:1,snapshotAt:new Date().toISOString(),source:'jadval-studio',
  dataStatus:'exported-from-current-studio',totalEntries:s.uniquePairs,
  rawEntries:s.totalEntries,duplicateEntries:s.duplicateEntries,
  uniquePairs:s.uniquePairs,uniqueAnswers:s.uniqueAnswers,uniqueClues:s.uniqueClues,
  lengths:Object.keys(s.lengths).map(n=>({length:Number(n),entries:s.lengths[n]}))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='jadval-aggregate-stats-'+Date.now()+'.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function init(){
 if(!$('bankMetrics'))return;
 $('bankDedupExport').onclick=downloadBank;
 $('bankStatsExport').onclick=exportAggregate;
 Promise.resolve(root.JadvalApp?.localReady).then(()=>refresh()).catch(()=>{});
}
root.JadvalBankMetrics={refresh,downloadBank,exportAggregate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:null);
