const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('per-note binding swaps duplicates, saves and plays only the new mapping',()=>{
 const nodes=new Map(),buttons=[],storage=new Map(),played=[],events={};let frame;
 function element(tag){const el={style:{},value:'',children:[],textContent:'',append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);}};if(tag==='button')buttons.push(el);return el;}
 let connected=true,pressed=[];
 const pad=()=>({id:'DualSense',index:0,mapping:'standard',connected:true,buttons:Array.from({length:18},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});
 const document={createElement:element,querySelector:()=>element(),getElementById:id=>id==='pad-select'?{value:'0'}:id==='display-mode'?{value:'ps5'}:null,hasFocus:()=>true,addEventListener:(name,fn)=>events[name]=fn};
 const ctx={document,window:{},queueMicrotask:fn=>fn(),navigator:{getGamepads:()=>connected?[pad()]:[]},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},requestAnimationFrame:fn=>frame=fn,input:note=>played.push(note)};
 vm.createContext(ctx);vm.runInContext(JSON.parse(fs.readFileSync('patches/manette-par-note.json','utf8')).files[0].new,ctx);events.DOMContentLoaded();frame();
 pressed=[4];frame();assert.deepEqual(played,[0]);pressed=[];frame();
 buttons[0].onclick();pressed=[1];frame();assert.deepEqual(played,[0]);
 assert.deepEqual(JSON.parse(storage.get('ocarina-gamepad-mappings')).DualSense,[1,5,2,3,4]);
 pressed=[];frame();pressed=[1];frame();assert.deepEqual(played,[0,0]);
 buttons[2].onclick();connected=false;frame();assert.match(nodes.get('#binding-status').textContent,/annulée/);
 let stopped=false;events.click({isTrusted:false,target:{closest:()=>true},stopImmediatePropagation:()=>stopped=true});assert.ok(stopped);
});
