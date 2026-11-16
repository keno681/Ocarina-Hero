const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('yellow aura follows the played note and repeated presses renew its duration',()=>{
 const states=Array.from({length:5},()=>new Set()),labels=states.map(state=>({classList:{add:name=>state.add(name),remove:name=>state.delete(name)}}));
 const callbacks=new Map(),played=[];let ready,next=0;
 const context={window:{},document:{addEventListener:(_name,fn)=>ready=fn,querySelectorAll:()=>labels},queueMicrotask:fn=>fn(),input:index=>played.push(index),setTimeout:fn=>{callbacks.set(++next,fn);return next;},clearTimeout:id=>callbacks.delete(id)};
 const patch=JSON.parse(fs.readFileSync('patches/aura-jaune.json','utf8'));
 vm.createContext(context);vm.runInContext(patch.files[0].new,context);ready();
 context.input(3);assert.ok(states[3].has('note-glow'));assert.equal(states[0].size,0);
 context.input(3);assert.equal(callbacks.size,1);context.input(0);assert.equal(callbacks.size,2);
 for(const callback of callbacks.values())callback();
 assert.equal(states[3].size,0);assert.equal(states[0].size,0);assert.deepEqual(played,[3,3,0]);
});
