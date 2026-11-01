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
const context={window,document,Promise,Date,Math,Set,Map,JSON,console};
vm.runInNewContext(src,context,{filename:'cloud-bridge.js'});
assert.equal(typeof window.JadvalCloud.saveEntry,'function');
assert.equal(window.JadvalCloud.isReady(),false);
assert.equal(window.JadvalCloud.configIsReady(),false);
assert.equal(typeof boot,'function');
boot();
setImmediate(()=>{
 assert.equal(get('cloudLogin').disabled,true);
 assert.match(get('cloudStatus').textContent,/تنظیم نشده/);
 assert(!/serviceAccount|private_key/.test(src),'No service account secret in browser code');
 const html=fs.readFileSync('index.html','utf8');
 const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(inline.length,1,'Only one original inline application script should remain');
 assert(html.includes('src="./firebase-config.js"'));
 assert(html.includes('src="./cloud-bridge.js"'));
 console.log('Cloud bridge is safe by default and UI integration is present');
});
