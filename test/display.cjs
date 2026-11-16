const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('display modes, configured PS5 buttons and keyboard validation',()=>{
 const selectors=new Map(),events={},storage=new Map(),labels=Array.from({length:5},()=>({style:{},setAttribute(){}}));
 function el(){return {value:'',style:{},appendChild(){},setAttribute(){},querySelector(selector){if(!selectors.has(selector))selectors.set(selector,el());return selectors.get(selector);}};}
 const fields=[];
 const document={createElement:tag=>{const node=el();if(tag==='input')fields.push(node);return node;},addEventListener:(name,fn)=>events[name]=fn,getElementById:id=>id==='pad-select'?{value:'0'}:null,querySelector:()=>el(),querySelectorAll:selector=>selector.includes('lane-label')?labels:[]};
 const shortcuts=['l','r','q','t','o'];let refresh;
 const ctx={document,shortcuts,queueMicrotask:fn=>fn(),setInterval:fn=>refresh=fn,navigator:{getGamepads:()=>[{index:0,id:'DualSense'}]},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};ctx.window=ctx;
 const patch=JSON.parse(fs.readFileSync('patches/affichage-touches.json','utf8'));
 vm.runInNewContext(patch.files[0].new,ctx);events.DOMContentLoaded();
 const select=selectors.get('#display-mode');assert.deepEqual(Array.from(ctx.ocarinaSymbols),['L1','R1','□','△','○']);
 select.value='n64';select.onchange();assert.deepEqual(Array.from(ctx.ocarinaSymbols),['A','C↓','C→','C←','C↑']);
 select.value='switch';select.onchange();assert.deepEqual(Array.from(ctx.ocarinaSymbols),['L','R','X','Y','A']);
 select.value='keyboard';select.onchange();assert.deepEqual(Array.from(ctx.ocarinaSymbols),['L','R','Q','T','O']);
 fields[0].value='z';fields[0].onchange();assert.equal(shortcuts[0],'z');fields[0].value='r';fields[0].onchange();assert.equal(shortcuts[0],'z');
 select.value='ps5';select.onchange();storage.set('ocarina-gamepad-mappings',JSON.stringify({DualSense:[6,7,0,1,3]}));refresh();assert.deepEqual(Array.from(ctx.ocarinaSymbols),['L2','R2','✕','○','△']);
 assert.equal(labels[0].textContent,'L2');assert.equal(JSON.parse(storage.get('ocarina-display')).mode,'ps5');
});
