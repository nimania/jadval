const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('cloud-bridge.js','utf8');
const elems=new Map();
const get=id=>{
 if(!elems.has(id))elems.set(id,{textContent:'',disabled:false,onclick:null});
 return elems.get(id);
};
const window={
 JADVAL_FIREBASE_CONFIG:{},
 JadvalApp:{localReady:Promise.resolve([]),getLocal:()=>[]}
};
let boot;
const document={readyState:'loading',getElementById:get,
 addEventListener:(kind,handler)=>{if(kind==='DOMContentLoaded')boot=handler}};
const context={window,document,Promise,Date,Math,Set,Map,JSON,console,setInterval:()=>0};
const migration=src.slice(src.indexOf('async function importBrowser()'),src.indexOf('async function bootstrap()'));
assert(!/\b(?:prompt|confirm)\s*\(/.test(migration),'Migration must use in-page controls, not native browser dialogs');
const testSource=src.replace(/\n\}\)\(\);\s*$/, '\nwindow.__parseCount=parseConfirmedCount;\nwindow.__testPublicRead=(client,firestore)=>{api=client;db=firestore;return checkPublicPublishing()};\n})();');
assert.notEqual(testSource,src,'Expose numeric parser in test sandbox only');
vm.runInNewContext(testSource,context,{filename:'cloud-bridge.js'});
assert.equal(window.__parseCount('۱۹٬۸۰۴'),19804);
assert.equal(window.__parseCount('١٩٨٠٤'),19804);
assert.equal(window.__parseCount('19,804'),19804);
assert(Number.isNaN(window.__parseCount('۱۹۸۰۴x')),'Malformed count must be rejected');
assert.equal(typeof window.JadvalCloud.saveEntry,'function');
assert.equal(window.JadvalCloud.isReady(),false);
assert.equal(window.JadvalCloud.configIsReady(),false);
assert.equal(typeof boot,'function');
boot();
setImmediate(async()=>{
 assert.equal(get('cloudLogin').disabled,true);
 assert.match(get('cloudStatus').textContent,/(متصل نشده|تنظیم نشده)/);
 assert(!/serviceAccount|private_key/.test(src),'No service account secret in browser code');
 const html=fs.readFileSync('index.html','utf8');
 const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(inline.length,1,'Only one original inline application script should remain');
 assert(html.includes('src="./firebase-config.js"'));
 assert(html.includes('src="./cloud-bridge.js"'));
 const reads=[];
 const sdk={
  collection:(db,path)=>({db,path}),
  limit:n=>({limit:n}),
  query:(collection,limit)=>({collection,limit}),
  getDocsFromServer:async query=>{reads.push(query);return {docs:[]}}
 };
 assert.equal(await window.__testPublicRead(sdk,{}),true,'Public collection readable means rules preflight passes');
 assert.equal(reads.length,1,'Preflight must perform only one read');
 assert.equal(reads[0].collection.path,'publishedPuzzles');
 assert.equal(reads[0].limit.limit,1);
 assert.match(get('cloudPublishStatus').textContent,/فعال است/);
 const denied={...sdk,getDocsFromServer:async()=>{throw Object.assign(new Error('permission denied'),{code:'permission-denied'})}};
 assert.equal(await window.__testPublicRead(denied,{}),false);
 assert.match(get('cloudPublishStatus').textContent,/قواعد انتشار/);
 assert.equal(window.JadvalCloud.canPublish(),false,'No logged-in editor can never publish');
 assert(src.includes("if(!publishReadReady)throw Error"),'Public preflight must gate actual publishing');
 assert(html.includes('id="cloudCheckPublish"'),'Preflight control must be visible');
 assert(html.includes('id="cloudPublishStatus"'),'Preflight status must be visible');
 console.log('Read-only publishing preflight and denial checks passed');
 console.log('Cloud bridge is safe by default and UI integration is present');
});

