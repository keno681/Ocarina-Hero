const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(actuator){
 const nodes=new Map();let ready;
 function el(){return {style:{},appendChild(){},querySelector:name=>{if(!nodes.has(name))nodes.set(name,el());return nodes.get(name);}};}
 const ctx={document:{getElementById:id=>id==='pad-select'?{value:'1'}:null,createElement:el,querySelector:el,addEventListener:(_name,fn)=>ready=fn},setTimeout:fn=>fn(),navigator:{getGamepads:()=>[{index:1,id:'DualSense',connected:true,vibrationActuator:actuator}]}};
 vm.createContext(ctx);vm.runInContext(JSON.parse(fs.readFileSync('patches/test-vibration.json','utf8')).files[0].new,ctx);ready();return nodes;
}
test('rumble diagnostic reports missing support instead of claiming a vibration',async()=>{
 const nodes=setup(null);await nodes.get('#rumble-test').onclick();assert.match(nodes.get('#rumble-result').textContent,/non exposée/);assert.equal(nodes.get('#rumble-test').disabled,false);
});
test('rumble diagnostic sends a strong pulse and reports the driver result',async()=>{
 let duration;
 const nodes=setup({playEffect:async(_effect,options)=>{duration=options.duration;return 'complete';}});await nodes.get('#rumble-test').onclick();assert.equal(duration,500);assert.match(nodes.get('#rumble-result').textContent,/complete/);
});
test('rumble diagnostic reports errors and unlocks its button',async()=>{
 const nodes=setup({playEffect:async()=>{throw Error('No support');}});await nodes.get('#rumble-test').onclick();assert.match(nodes.get('#rumble-result').textContent,/No support/);assert.equal(nodes.get('#rumble-test').disabled,false);
});
