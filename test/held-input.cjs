const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const events=new Map(),stops=[],taps=[],outputs=[];let frame,pressed=false,connected=true;
 const classes=Array.from({length:5},()=>new Set()),labels=classes.map(set=>({classList:{add:v=>set.add(v),remove:v=>set.delete(v)}}));
 const volume={value:'55'};
 const document={querySelector:()=>volume,querySelectorAll:selector=>selector.includes('lane-label')?labels:[],hasFocus:()=>true,body:{classList:{contains:()=>false}},createElement:()=>({}),head:{appendChild(){}},addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
 const node=()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}},frequency:{},connect(){return this;},disconnect(){},start(){},stop:time=>stops.push(time)});
 const audio={currentTime:1,destination:{},createGain:()=>{const gain=node();outputs.push(gain);return gain;},createOscillator:node};
 const ctx={document,context:()=>audio,shortcuts:['l','r','q','t','o'],frequencies:[587,698,880,987,1174],localStorage:{getItem:()=>null},navigator:{getGamepads:()=>connected?[{id:'Pad',mapping:'standard',buttons:Array.from({length:16},(_,i)=>({pressed:i===4&&pressed,value:0}))}]:[]},playTap:note=>taps.push(note),performance:{now:()=>0},requestAnimationFrame:fn=>frame=fn,MutationObserver:class{observe(){}},addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};ctx.window=ctx;
 vm.createContext(ctx);const source=fs.readFileSync('app.js','utf8').split('// BEGIN HOLD SUPPORT')[1].split('// END HOLD SUPPORT')[0];vm.runInContext(source,ctx);
 const fire=(name,event={})=>{for(const fn of events.get(name)||[])fn(event);};fire('DOMContentLoaded');
 return {ctx,fire,poll:()=>frame(),stops,taps,classes,gamepad:(down,isConnected=true)=>{pressed=down;connected=isConnected;}};
}
test('keyboard note sustains until keyup, with no repeated voice',()=>{
 const s=setup();s.fire('keydown',{key:'l',code:'KeyL',target:{tagName:'BODY'}});s.ctx.play(0);s.ctx.play(0);s.poll();assert.equal(s.stops.length,0);assert.ok(s.classes[0].has('held-note'));
 assert.equal(vm.runInContext('heldVoices.size',s.ctx),1);
 s.fire('keyup',{key:'l',code:'KeyL'});s.poll();assert.equal(s.stops.length,3);assert.equal(s.classes[0].has('held-note'),false);
});
test('configured gamepad holds release on disconnect and blur releases all notes',()=>{
 const s=setup();s.gamepad(true);s.ctx.play(0);s.poll();assert.equal(s.stops.length,0);
 s.gamepad(false,false);s.poll();assert.equal(s.stops.length,3);
 s.fire('keydown',{key:'q',code:'KeyQ',target:{tagName:'BODY'}});s.ctx.play(2);s.fire('blur');assert.equal(s.stops.length,6);
});
test('non-held actions keep short notes and typing in fields does not sustain',()=>{
 const s=setup();s.ctx.play(1);assert.deepEqual(s.taps,[1]);
 s.fire('keydown',{key:'l',code:'KeyL',target:{tagName:'INPUT'}});assert.equal(s.ctx.ocarinaHeldNote(0),false);
});
