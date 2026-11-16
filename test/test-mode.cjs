const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(lateLanes=false,shifted=false,gated=false,penalty=false,navigation=false,modern=false,cachedSong=null){
 const played=[];
 const timers=new Map();let timerId=0;let lanesReady=!lateLanes;
 const nodes=new Map(),events={},classes=new Set();let now=0,tick,active=false;
 function el(){return {children:[],attributes:{},setAttribute(name,value){this.attributes[name]=value;},style:{},clientWidth:500,offsetWidth:40,value:'',textContent:'',appendChild(item){item.parent=this;this.children.push(item);},remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,el());return nodes.get(selector);},getBoundingClientRect(){const x=this.motion ? this.motion.from - (now-this.motion.start)*0.25 : 0;return {left:x,right:x+40};},animate(frames){this.motion={from:Number(frames[0].transform.match(/[-0-9.]+/)[0]),start:now};return {cancel(){}};}};}
 const tracks=Array.from({length:5},el),box=el();box.querySelectorAll=()=>tracks;
 const body=el();body.classList={contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)};
 const barStyles=new Map();
 const bar={style:{setProperty:(key,value)=>barStyles.set(key,value),removeProperty:key=>barStyles.delete(key)},getAnimations:()=>[],getBoundingClientRect:()=>({left:shifted?110:24,right:shifted?114:28})};
 function flushTimers(){let entry;while((entry=Array.from(timers.entries()).find(([,task])=>task.at<=now))){timers.delete(entry[0]);entry[1].fn();}}
 const document={createElement:el,head:el(),body,getElementById:id=>id==='hit-bar'?bar:id==='note-lanes'?(lanesReady?box:null):nodes.get('#'+id)||null,querySelector:()=>el(),addEventListener:(name,fn)=>events[name]=fn,hasFocus:()=>true};
 const ctx={document,queueMicrotask:fn=>fn(),setTimeout:(fn,delay=0)=>{timers.set(++timerId,{fn,at:now+delay});return timerId;},clearTimeout:id=>timers.delete(id),performance:{now:()=>now},Math:Object.assign(Object.create(Math),{random:()=>0}),localStorage:{getItem:key=>cachedSong?(key==='ocarina-midi-song'?JSON.stringify(cachedSong):key==='ocarina-game-mode'?'music1':null):null,setItem(){}},input:note=>played.push(note),context(){},setInterval:fn=>{tick=fn;active=true;return 1;},clearInterval:()=>active=false,addEventListener(){}};ctx.window=ctx;
 let source=JSON.parse(fs.readFileSync('patches/mode-test.json','utf8')).files[0].new;
 if(shifted){for(const op of JSON.parse(fs.readFileSync('patches/barre-continue-retour.json','utf8')).files.slice(1))source=source.replace(op.old,op.new);}
 if(gated){const op=JSON.parse(fs.readFileSync('patches/test-zone-obligatoire.json','utf8')).files[0];source=source.replace(op.old,op.new);}
 if(penalty){for(const op of JSON.parse(fs.readFileSync('patches/penalite-appui.json','utf8')).files)source=source.replace(op.old,op.new);}
 if(navigation){const op=JSON.parse(fs.readFileSync('patches/modes-a-gauche.json','utf8')).files[0];source=source.replace(op.old,op.new);}
 if(modern){const full=fs.readFileSync('app.js','utf8');const end=full.lastIndexOf('document.addEventListener',full.indexOf("  if (document.getElementById('note-bindings'))"));source=full.slice(full.indexOf('window.ocarinaTimingJudge ='),end);}
 vm.createContext(ctx);if(modern){ctx.TextDecoder=TextDecoder;vm.runInContext(fs.readFileSync('app.js','utf8').split('// BEGIN MIDI SUPPORT')[1].split('// END MIDI SUPPORT')[0],ctx);}
 vm.runInContext(source,ctx);events.DOMContentLoaded();lanesReady=true;flushTimers();
 return {ctx,nodes,classes,played,barStyles,body,advance(time){now=time;flushTimers();if(active)tick();},get active(){return active;}};
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

test('test mode waits for lanes created by a later DOMContentLoaded listener',()=>{
 const s=setup(true);
 assert.ok(s.nodes.get('#game-mode'));
 assert.ok(s.nodes.get('#test-start'));
});

test('shifted bar judges notes at the new crossing time and triggers success feedback',()=>{
 const s=setup(false,true),mode=s.nodes.get('#game-mode');let feedback=0;
 s.ctx.ocarinaHitFeedback=()=>feedback++;
 mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 for(let time=25;time<=9000;time+=25){s.advance(time);if(time>=1675&&(time-1675)%900===0)s.ctx.input(0);}
 assert.match(s.nodes.get('#test-feedback').textContent,/Terminé.*8\/8.*800/);
 assert.equal(feedback,8);
});

test('test inputs are silent outside the yellow zone and accept only one correct note',()=>{
 const s=setup(false,true,true),mode=s.nodes.get('#game-mode');
 s.ctx.input(2);assert.deepEqual(s.played,[2]);
 mode.value='test';mode.onchange();s.ctx.input(0);assert.deepEqual(s.played,[2]);
 s.nodes.get('#test-start').onclick();s.advance(1000);s.ctx.input(0);assert.deepEqual(s.played,[2]);
 s.advance(1560);s.ctx.input(0);assert.deepEqual(s.played,[2]);
 s.advance(1580);s.ctx.input(1);assert.deepEqual(s.played,[2]);
 s.ctx.input(0);assert.deepEqual(s.played,[2,0]);assert.match(s.nodes.get('#test-feedback').textContent,/1\/8.*100/);
 s.ctx.input(0);assert.deepEqual(s.played,[2,0]);
});
test('test inputs after the note has left the zone are ignored without penalty',()=>{
 const s=setup(false,true,true),mode=s.nodes.get('#game-mode');mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 s.advance(1800);s.ctx.input(0);assert.deepEqual(s.played,[]);assert.match(s.nodes.get('#test-feedback').textContent,/Score 0/);
 mode.value='free';mode.onchange();s.ctx.input(0);assert.deepEqual(s.played,[0]);
});

test('invalid inputs blacken the bar for 400ms without extending on extra presses',()=>{
 const s=setup(false,true,true,true),mode=s.nodes.get('#game-mode');mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 s.advance(1200);s.ctx.input(0);assert.equal(s.barStyles.get('background'),'#080808');assert.deepEqual(s.played,[]);
 s.advance(1580);s.ctx.input(0);assert.deepEqual(s.played,[]);assert.equal(s.barStyles.get('background'),'#080808');
 s.advance(1600);assert.equal(s.barStyles.has('background'),false);s.ctx.input(0);assert.deepEqual(s.played,[0]);
 assert.match(s.nodes.get('#test-feedback').textContent,/1\/8.*100/);
});
test('changing mode clears penalty and free mode remains playable',()=>{
 const s=setup(false,true,true,true),mode=s.nodes.get('#game-mode');mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 s.ctx.input(1);assert.equal(s.barStyles.get('background'),'#080808');mode.value='free';mode.onchange();
 assert.equal(s.barStyles.has('background'),false);s.ctx.input(1);assert.deepEqual(s.played,[1]);
 mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();s.advance(1580);s.ctx.input(0);assert.deepEqual(s.played,[1,0]);
});

test('main-screen mode buttons switch the mode, show selection and stop an active test',()=>{
 const s=setup(false,false,false,false,true);
 const menu=s.body.children.find(node=>node.id==='main-game-modes');assert.ok(menu);
 const [free,testButton]=menu.children;
 assert.equal(free.textContent,'Libre');assert.equal(testButton.textContent,'Test');
 assert.equal(free.attributes['aria-pressed'],'true');
 testButton.onclick();assert.ok(s.classes.has('test-mode'));assert.equal(testButton.attributes['aria-pressed'],'true');
 s.nodes.get('#test-start').onclick();assert.equal(s.active,true);
 free.onclick();assert.equal(s.active,false);assert.equal(s.classes.has('test-mode'),false);assert.equal(free.attributes['aria-pressed'],'true');
});

test('long test notes require a maintained input and finish the round',()=>{
 const s=setup(false,true,false,false,false,true),mode=s.nodes.get('#game-mode');
 s.ctx.ocarinaHeldNote=()=>true;
 mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 for(let time=25;time<=10000;time+=25){s.advance(time);if(time>=1675&&(time-1675)%900===0)s.ctx.input(0);}
 assert.match(s.nodes.get('#test-feedback').textContent,/Terminé.*8\/8.*800/);
});
test('releasing a long test note early fails it and stops its sound',()=>{
 const s=setup(false,true,false,false,false,true),mode=s.nodes.get('#game-mode');let held=true,released=0;
 s.ctx.ocarinaHeldNote=()=>held;s.ctx.ocarinaReleaseNote=()=>released++;
 mode.value='test';mode.onchange();s.nodes.get('#test-start').onclick();
 for(let time=25;time<=2575;time+=25){s.advance(time);if(time===2575)s.ctx.input(0);}
 assert.match(s.nodes.get('#test-feedback').textContent,/Maintenez/);
 held=false;s.advance(3000);assert.match(s.nodes.get('#test-feedback').textContent,/trop tôt/);assert.ok(released>0);
});

test('music 1 restores an imported score and uses its own timing and note count',()=>{
 const song={name:'Melody',events:[{note:0,time:0,duration:200},{note:1,time:1000,duration:500}],transpose:0,approximated:0,simplified:0};
 const s=setup(false,true,false,false,false,true,song);s.ctx.ocarinaHeldNote=()=>true;
 assert.equal(s.nodes.get('#game-mode').value,'music1');assert.equal(s.nodes.get('#test-start').disabled,false);
 s.nodes.get('#test-start').onclick();
 for(let time=25;time<=5000;time+=25){s.advance(time);if(time===2475)s.ctx.input(0);if(time===3475)s.ctx.input(1);}
 assert.match(s.nodes.get('#test-feedback').textContent,/Terminé.*2\/2.*200/);assert.equal(s.active,false);
});
