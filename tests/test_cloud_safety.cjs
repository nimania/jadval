const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../cloud-safety.js');
const row={id:'one',answer:'ایران',clue:'نام کشور',letters:5,category:'جغرافیا',difficulty:'unknown',reviewed:0,source:'test',license:'test',addedAt:'original'};
test('deterministic fingerprint preserves unknown metadata and ignores row order',async()=>{
 const a=await S.prepare([row,{...row,id:'two'}]),b=await S.prepare([{...row,id:'two'},row]);assert.equal(a.fingerprint,b.fingerprint);assert.equal(a.prepared[0].record.legacy.addedAt,'original');assert.deepEqual(S.reconcile(a.prepared,a.prepared),[]);
});
test('duplicate identifiers, invalid letter counts and changed content fail closed',async()=>{
 await assert.rejects(S.prepare([row,row]),/تکراری/);await assert.rejects(S.prepare([{...row,letters:4}]),/حروف/);
 const p=await S.prepare([row]);assert.throws(()=>S.reconcile(p.prepared,[{id:'one',record:{...row,category:'تاریخ'}}]),/تعارض/);assert.throws(()=>S.reconcile(p.prepared,[{id:'extra',record:row}]),/اضافی/);
});
test('legacy ID does not change when the clue is edited',async()=>{assert.equal(await S.docId({...row,id:'شماره/۱'}),await S.docId({...row,id:'شماره/۱',clue:'تازه'}));});
test('backup verification detects pending edit changes',()=>{const state={bank:{entries:[row]},'pending-cloud-edits':{entries:[]}},p={schema:2,state,checksum:'test'};assert(S.verifyBackup(p,state));assert.throws(()=>S.verifyBackup(p,{...state,'pending-cloud-edits':{entries:[row]}}),/یکسان نیست/);});
