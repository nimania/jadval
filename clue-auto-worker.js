/* Offline generator worker. Runs only after main Studio authenticated and fetched private Firestore data. */
'use strict';
importScripts('./clue-in-cell.js','./clue-auto-generator.js');
self.onmessage=event=>{
 const {rows,variant,seed,attempts,budgetMs}=event.data||{};
 try{
  const result=self.JadvalClueAuto.run(rows,variant,{
   seed,attempts,budgetMs,
   onProgress:p=>self.postMessage({type:'progress',progress:p})
  });
  self.postMessage({type:'complete',result});
 }catch(error){
  self.postMessage({type:'error',message:error?.message||String(error)});
 }
};