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
