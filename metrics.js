/* Shared public crossword novelty metrics.
 * Exact duplicate = normalized answer AND normalized clue.
 * Equal answers with different clues remain different entries.
 * No private lexicon data is read, embedded or exposed. */
(function(root){
 'use strict';
 const norm=s=>String(s??'').normalize('NFKC')
   .replace(/[يى]/g,'ی').replace(/ك/g,'ک')
   .replace(/[\u064b-\u065f\u0670\u0640\u200c\u200d\s]+/g,'').toLocaleLowerCase('fa');
 const pair=(clue,answer)=>norm(answer)+'\u0000'+norm(clue);
 function uniquePairs(rows){
  const map=new Map();
  for(const row of rows||[]){
   if(!row||typeof row.answer!=='string'||typeof row.clue!=='string')continue;
   if(!norm(row.answer)||!norm(row.clue))continue;
   const key=pair(row.clue,row.answer);
   if(!map.has(key))map.set(key,row);
  }
  return [...map.values()];
 }
 function summarize(rows){
  const records=(rows||[]).filter(x=>x&&typeof x.answer==='string'&&typeof x.clue==='string');
  const unique=uniquePairs(records), answers=new Set(),clues=new Set(),lengths={};
  for(const item of unique){
   const answer=norm(item.answer),clue=norm(item.clue);
   answers.add(answer);clues.add(clue);
   const n=[...answer].length;
   lengths[n]=(lengths[n]||0)+1;
  }
  return {totalEntries:records.length,uniquePairs:unique.length,
   duplicateEntries:records.length-unique.length,
   uniqueAnswers:answers.size,uniqueClues:clues.size,lengths};
 }
 function crosswordPairs(item,player){
  if(!player?.validateItem?.(item))return [];
  const slots=player.slotsFor(item.puzzle.grid);
  const idx=new Map(),items=[];
  for(const s of slots){
   const k=s.dir+':'+s.group,offset=idx.get(k)||0;
   idx.set(k,offset+1);
   const clue=item.puzzle.clues[s.dir]?.[String(s.group)]?.[offset];
   if(!clue||!s.answer)continue;
   items.push({answer:s.answer,clue});
  }
  return uniquePairs(items);
 }
 function overlap(item,older,requested,player){
  const mine=crosswordPairs(item,player);
  const history=(older||[]).filter(x=>x?.id!==item?.id).slice(0,requested);
  const oldPairs=new Set(),oldAnswers=new Set(),oldClues=new Set();
  for(const past of history){
   for(const row of crosswordPairs(past,player)){
    oldPairs.add(pair(row.clue,row.answer));oldAnswers.add(norm(row.answer));oldClues.add(norm(row.clue));
   }
  }
  let exact=0,answers=0,clues=0;
  for(const row of mine){
   if(oldPairs.has(pair(row.clue,row.answer)))exact++;
   if(oldAnswers.has(norm(row.answer)))answers++;
   if(oldClues.has(norm(row.clue)))clues++;
  }
  return {requested,actual:history.length,total:mine.length,
   exact,answers,clues,exactPct:mine.length?Math.round(exact/mine.length*1000)/10:0,
   answerPct:mine.length?Math.round(answers/mine.length*1000)/10:0,
   cluePct:mine.length?Math.round(clues/mine.length*1000)/10:0,
   enoughHistory:history.length>=requested};
 }
 function windows(item,published,player){
  const index=(published||[]).findIndex(x=>x.id===item.id);
  const older=index>=0?published.slice(index+1):(published||[]).filter(x=>x.id!==item.id);
  return [10,30,100].map(n=>overlap(item,older,n,player));
 }
 const api={normalize:norm,pair,uniquePairs,summarize,crosswordPairs,overlap,windows};
 if(root)root.PayameMetrics=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
