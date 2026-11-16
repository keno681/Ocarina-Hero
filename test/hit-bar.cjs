const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('continuous marker covers five rows and success requests supported vibration',()=>{
 let ready,bar,flash=0,vibration;
 const tracks=Array.from({length:5},(_,i)=>({clientWidth:500,getBoundingClientRect:()=>({left:100,top:100+i*46,bottom:144+i*46})}));
 const box={offsetWidth:700,clientLeft:2,clientTop:2,querySelectorAll:()=>tracks,getBoundingClientRect:()=>({left:20,top:80}),appendChild:item=>bar=item};
 const ctx={document:{getElementById:id=>id==='note-lanes'?box:id==='hit-bar'?bar:id==='pad-select'?{value:'0'}:null,createElement:()=>({style:{},setAttribute(){},animate(){flash++;}}),head:{appendChild(){}},body:{},addEventListener:(_event,fn)=>ready=fn},navigator:{getGamepads:()=>[{index:0,buttons:[{pressed:true}],vibrationActuator:{playEffect:(kind,options)=>{vibration={kind,options};return Promise.resolve();}}}]},setTimeout:fn=>fn(),addEventListener(){},ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}}};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(JSON.parse(fs.readFileSync('patches/barre-continue-retour.json','utf8')).files[0].new,ctx);ready();
 assert.equal(bar.style.height,'228px');assert.equal(bar.style.left,'188px');assert.equal(bar.style.top,'18px');
 ctx.ocarinaHitFeedback('Parfait');assert.equal(flash,1);assert.equal(vibration.kind,'dual-rumble');assert.equal(vibration.options.duration,70);
 ctx.navigator.getGamepads=()=>[];assert.doesNotThrow(()=>ctx.ocarinaHitFeedback('Bien'));
});
