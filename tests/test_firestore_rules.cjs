/* Runs only against the local emulator and synthetic records. */
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,updateDoc,deleteDoc,writeBatch,runTransaction,serverTimestamp}=require('firebase/firestore');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator is mandatory; never use a production project.');
 const env=await initializeTestEnvironment({projectId:'demo-jadval-private',firestore:{rules:fs.readFileSync('firebase/firestore.rules','utf8')}});
 let checks=0;const ok=async p=>{await assertSucceeds(p);checks++;},no=async p=>{await assertFails(p);checks++;};
 const token={email:'owner@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}};
 const owner=env.authenticatedContext('owner',token).firestore(),second=env.authenticatedContext('owner',token).firestore();
 const stranger=env.authenticatedContext('stranger',{...token,email:'other@example.test'}).firestore(),anon=env.unauthenticatedContext().firestore();
 const disabled=env.authenticatedContext('disabled',token).firestore(),unverified=env.authenticatedContext('owner',{...token,email_verified:false}).firestore();
 const row=(id)=>({id,answer:'ایران',clue:'کشور',letters:5,category:'جغرافیا',difficulty:'unknown',reviewed:0,source:'synthetic',license:'test',legacy:{note:'preserved'},revision:1,generation:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const meta=doc(owner,'meta','bank'),ref=doc(owner,'entries','one');
 try{
  await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'admins','owner'),{enabled:true});await setDoc(doc(ctx.firestore(),'admins','disabled'),{enabled:false});});
  await no(getDocs(collection(anon,'entries')));await no(getDocs(collection(stranger,'entries')));await no(getDocs(collection(disabled,'entries')));await no(getDocs(collection(unverified,'entries')));
  await no(setDoc(doc(stranger,'admins','stranger'),{enabled:true}));await no(setDoc(doc(owner,'admins','owner'),{enabled:true}));await no(getDocs(collection(owner,'admins')));await ok(getDoc(doc(owner,'admins','owner')));
  await no(setDoc(ref,row('one')));
  await ok(setDoc(meta,{schema:2,status:'importing',owner:'owner',expected:101,fingerprint:'a'.repeat(64),startedAt:serverTimestamp()}));
  await ok(setDoc(ref,row('one')));
  await no(setDoc(ref,row('one')));await no(updateDoc(ref,{revision:2,updatedAt:serverTimestamp()}));await no(deleteDoc(ref));
  const batch=writeBatch(owner);for(let i=0;i<100;i++)batch.set(doc(owner,'entries','batch'+i),row('batch'+i));await ok(batch.commit());
  await no(updateDoc(meta,{fingerprint:'b'.repeat(64)}));await no(updateDoc(meta,{status:'ready',count:100,generation:0,completedAt:serverTimestamp()}));
  await ok(updateDoc(meta,{status:'ready',count:101,generation:0,completedAt:serverTimestamp()}));
  await ok(getDocs(collection(second,'entries')));assert.equal((await getDocs(collection(second,'entries'))).size,101);
  await no(updateDoc(ref,{revision:2,updatedAt:serverTimestamp()}));await no(updateDoc(meta,{generation:1,lastEntry:'one'}));
  const write=async(db,prior,clue)=>runTransaction(db,async tx=>{const m=doc(db,'meta','bank'),r=doc(db,'entries','one'),a=await tx.get(m),b=await tx.get(r);if(b.data().revision!==prior)throw Error('version conflict');tx.update(r,{clue,revision:prior+1,generation:a.data().generation+1,updatedAt:serverTimestamp()});tx.update(m,{generation:a.data().generation+1,lastEntry:'one'});});
  await ok(write(owner,1,'device one'));await assert.rejects(write(second,1,'stale device'),/version conflict/);checks++;
  assert.equal((await getDoc(doc(second,'entries','one'))).data().clue,'device one');checks++;
  await ok(write(second,2,'device two'));assert.equal((await getDoc(ref)).data().revision,3);checks++;
  const bad=writeBatch(owner);bad.update(ref,{revision:4,id:'changed',generation:3,updatedAt:serverTimestamp()});bad.update(meta,{generation:3,lastEntry:'one'});await no(bad.commit());
  await no(setDoc(doc(anon,'entries','attack'),row('attack')));await no(setDoc(doc(stranger,'entries','attack'),row('attack')));
  // The public catalogue is readable by everyone; only a verified editor
  // may CREATE an explicitly approved minimal puzzle (never update or delete).
  const publicId='pub_'+'a'.repeat(24);
  const published=()=>({
   id:publicId,title:'جدول شماره یک',size:7,publishedAt:serverTimestamp(),
   approvedBy:'owner',editorApproved:true,
   puzzleJson:JSON.stringify({version:3,grid:Array.from({length:7},()=>Array(7).fill('ا')),
    clues:{horizontal:{'1':['پرسش بانک']},vertical:{'1':['پرسش بانک']}},
    meta:{title:'جدول شماره یک',size:{rows:7,cols:7},
     language:'fa',direction:'rtl',status:'published',method:'editor-approved'}})
  });
  const pubOwner=doc(owner,'publishedPuzzles',publicId);
  await ok(getDocs(collection(anon,'publishedPuzzles')));
  await no(setDoc(doc(anon,'publishedPuzzles',publicId),published()));
  await no(setDoc(doc(stranger,'publishedPuzzles',publicId),published()));
  await no(setDoc(doc(unverified,'publishedPuzzles',publicId),published()));
  await no(setDoc(pubOwner,{...published(),privateEntries:['must not leak']}));
  await no(setDoc(pubOwner,{...published(),editorApproved:false}));
  await ok(setDoc(pubOwner,published()));
  const publicSnap=await getDoc(doc(anon,'publishedPuzzles',publicId));checks++;
  assert.equal(JSON.parse(publicSnap.data().puzzleJson).version,3);
  assert(!Object.hasOwn(publicSnap.data(),'privateEntries'));
  await ok(getDocs(collection(anon,'publishedPuzzles')));
  await no(updateDoc(pubOwner,{title:'replaced'}));
  await no(deleteDoc(pubOwner));
  await no(setDoc(pubOwner,published()));
  // Public aggregate counts must never contain private clue/answer text.
  const aggregate=()=>({schema:1,source:'jadval-studio',snapshotAt:serverTimestamp(),
   rawEntries:101,totalEntries:100,duplicateEntries:1,uniquePairs:100,
   uniqueAnswers:70,uniqueClues:90});
  const statsRef=doc(owner,'publicStats','bank');
  await no(getDocs(collection(anon,'publicStats')));
  await no(setDoc(doc(anon,'publicStats','bank'),aggregate()));
  await no(setDoc(doc(stranger,'publicStats','bank'),aggregate()));
  await no(setDoc(doc(owner,'publicStats','other'),aggregate()));
  await no(setDoc(statsRef,{...aggregate(),entries:[{answer:'private',clue:'secret'}]}));
  await no(setDoc(statsRef,{...aggregate(),rawEntries:102}));
  await no(setDoc(statsRef,{...aggregate(),uniqueAnswers:'private information'}));
  await ok(setDoc(statsRef,aggregate()));
  const publicAggregate=await getDoc(doc(anon,'publicStats','bank'));checks++;
  assert.equal(publicAggregate.data().uniquePairs,100);
  await no(deleteDoc(statsRef));
  await no(updateDoc(statsRef,{privateBank:'forbidden'}));
  await ok(setDoc(statsRef,aggregate()));
  console.log('PASS: '+checks+' security/version/publication checks; public read only, editor create only, no private bank access.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
