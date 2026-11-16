const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const sources=[],buffers=[];
 function param(){return {value:0,events:[],setValueAtTime(value,time){this.events.push({value,time});},linearRampToValueAtTime(value,time){this.events.push({value,time});},exponentialRampToValueAtTime(value,time){this.events.push({value,time});}};}
 function node(kind){const result={kind,gain:param(),frequency:param(),detune:param(),Q:param(),connections:[],stops:[],connect(other){this.connections.push(other);return other;},disconnect(){this.disconnected=true;},start(time){this.startTime=time;},stop(time){this.stops.push(time);}};if(kind==='oscillator'||kind==='noise')sources.push(result);return result;}
 const audio={currentTime:1,sampleRate:8000,destination:node('destination'),createGain:()=>node('gain'),createBiquadFilter:()=>node('filter'),createConvolver:()=>node('reverb'),createOscillator:()=>node('oscillator'),createBufferSource:()=>node('noise'),createBuffer:(channels,length)=>{const data=Array.from({length:channels},()=>new Float32Array(length)),buffer={getChannelData:i=>data[i]};buffers.push(buffer);return buffer;}};
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('app.js','utf8').split('// BEGIN OCARINA TONE')[1].split('// END OCARINA TONE')[0],ctx);
 return {ctx,audio,sources,buffers,node};
}
test('ocarina voice combines mellow harmonics, delayed vibrato and filtered breath',()=>{
 const s=setup();let cleaned=0;const voice=s.ctx.createOcarinaVoice(s.audio,587.33,s.node('output'),()=>cleaned++);
 assert.equal(s.sources.length,5);assert.equal(s.sources[0].frequency.value,5.1);
 const fundamental=s.sources[1];assert.equal(fundamental.frequency.events.at(-1).value,587.33);
 assert.ok(s.sources.some(source=>source.kind==='noise'&&source.loop));
 voice.stop(2);voice.stop(3);assert.ok(s.sources.every(source=>source.stops.length===1&&source.stops[0]===2));
 s.sources.forEach(source=>source.onended());assert.equal(cleaned,1);assert.ok(s.sources.every(source=>source.disconnected));
});
test('breath buffers and short room response are cached per audio context',()=>{
 const s=setup(),room=s.ctx.ocarinaDestination(s.audio);assert.equal(s.ctx.ocarinaDestination(s.audio),room);assert.equal(s.buffers.length,1);
 s.ctx.createOcarinaVoice(s.audio,587,s.node('output'));s.ctx.createOcarinaVoice(s.audio,880,s.node('output'));assert.equal(s.buffers.length,2);
});
