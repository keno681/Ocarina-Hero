const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const nodes=new Map(),events={},classes=new Set();let now=0,tick,active=false;
 function el(){return {children:[],style:{},clientWidth:500,value:'',textContent:'',appendChild(item){item.parent=this;this.children.push(item);},remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,el());return nodes.get(selector);},animate(){return {cancel(){}};}};}
 const tracks=Array.from({length:5},el),box=el();box.querySelectorAll=()=>tracks;
 const body=el();body.classList={contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)};
 const document={createElement:el,head:el(),body,getElementById:id=>id==='note-lanes'?box:nodes.get('#'+id)||null,querySelector:()=>el(),addEventListener:(name,fn)=>events[name]=fn,hasFocus:()=>true};
 const ctx={document,queueMicrotask:fn=>fn(),performance:{now:()=>now},Math:Object.assign(Object.create(Math),{random:()=>0}),localStorage:{getItem:()=>null,setItem(){}},input(){},context(){},setInterval:fn=>{tick=fn;active=true;return 1;},clearInterval:()=>active=false,addEventListener(){}};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(JSON.parse(fs.readFileSync('patches/mode-test.json','utf8')).files[0].new,ctx);events.DOMContentLoaded();
 return {ctx,nodes,classes,advance(time){now=time;if(active)tick();},get active(){return active;}};
}
test('timing windows distinguish perfect, good and incorrect hits',()=>{
 const {ctx}=setup();assert.equal(ctx.ocarinaTimingJudge(-90),'Parfait');assert.equal(ctx.ocarinaTimingJudge(150),'Bien');assert.equal(ctx.ocarinaTimingJudge(181),null);
});
test('eight correct timed notes finish the test with 800 points',()=>{
 const s=setup(),mode=s.nodes.get('#game-mode');mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 for(let time=25;time<=9000;time+=25){s.advance(time);if(time>=2000&&(time-2000)%900===0)s.ctx.input(0);}
 assert.match(s.nodes.get('#test-feedback').textContent,/Terminé.*8\/8.*800/);assert.equal(s.active,false);
});
test('misses finish a round and opening options cancels a new round',()=>{
 const s=setup(),mode=s.nodes.get('#game-mode');mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 for(let time=25;time<=10000;time+=25)s.advance(time);
 assert.match(s.nodes.get('#test-feedback').textContent,/Terminé.*0\/8/);
 s.nodes.get('#test-start').onclick();s.classes.add('options-open');s.advance(10025);
 assert.equal(s.active,false);assert.match(s.nodes.get('#test-feedback').textContent,/interrompu/);
 mode.value='free';mode.onchange();assert.equal(s.nodes.get('#test-start').hidden,true);
});
