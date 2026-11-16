const { test } = require('node:test');
const assert = require('node:assert/strict');
const { edges, defaults } = require('../gamepad');
const pad = (pressed, index = 0, mapping = 'standard') => ({ id: `pad${index}`, index, mapping, connected: true, buttons: Array.from({length:16},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0})) });
test('standard buttons, held buttons and repress', () => {
  for (let note=0;note<5;note++) assert.deepEqual(edges([pad([defaults[note]])],new Map(),{}).notes,[note]);
  const first=edges([pad([4])],new Map(),{});
  assert.deepEqual(edges([pad([4])],first.next,{}).notes,[]);
  const released=edges([pad([])],first.next,{});
  assert.deepEqual(edges([pad([4])],released.next,{}).notes,[0]);
});
test('multiple pads, custom mapping and nonstandard devices', () => {
  assert.deepEqual(edges([null,pad([4]),pad([5],1)],new Map(),{}).notes,[0,1]);
  assert.deepEqual(edges([pad([4],0,'')],new Map(),{}).notes,[]);
  assert.deepEqual(edges([pad([8],0,'')],new Map(),{pad0:[8,9,10,11,12]}).notes,[0]);
});
test('disconnect clears state and reconnect works', () => {
  const first=edges([pad([4])],new Map(),{});
  const disconnected=edges([],first.next,{});
  assert.equal(disconnected.next.size,0);
  assert.deepEqual(edges([pad([4])],disconnected.next,{}).notes,[0]);
});
test('polling recovers after a temporary API error', () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id,{textContent:'',value:'',style:{},setAttribute(){},appendChild(){},replaceChildren(){}});
    return elements.get(id);
  };
  const panel = element('panel'); panel.querySelector = element;
  let frame, fail = true;
  const context = {
    document: { createElement:()=>panel, querySelector:()=>element('instrument'), hasFocus:()=>true },
    navigator: {getGamepads(){if(fail)throw new Error('Temporary');return [];}},
    localStorage:{getItem:()=>null},requestAnimationFrame:fn=>{frame=fn;},addEventListener(){}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../gamepad'),'utf8'),context);
  frame();assert.match(element('#pad-status').textContent,/refusé/);
  fail=false;frame();assert.match(element('#pad-status').textContent,/Aucune manette/);
  assert.equal(typeof frame,'function');
});
