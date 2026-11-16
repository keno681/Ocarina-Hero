'use strict';
// BEGIN MIDI SUPPORT
(function(root) {
  function parseMidi(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > 10 * 1024 * 1024) throw Error('Fichier MIDI trop volumineux (10 Mo maximum).');
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let pos = 0, limit = bytes.length;
    const need = n => { if(pos + n > limit) throw Error('Fichier MIDI tronqué.'); };
    const u8 = () => { need(1); return bytes[pos++]; };
    const u16 = () => { need(2); const n=view.getUint16(pos); pos+=2; return n; };
    const u32 = () => { need(4); const n=view.getUint32(pos); pos+=4; return n; };
    const text = n => { need(n); const s=new TextDecoder().decode(bytes.subarray(pos,pos+n)); pos+=n; return s; };
    const vlq = () => { let n=0; for(let i=0;i<4;i++){const b=u8();n=n*128+(b&127);if(!(b&128))return n;}throw Error('Durée MIDI invalide.'); };
    if(text(4)!=='MThd') throw Error('Ce fichier n’est pas un MIDI standard.');
    const header=u32();if(header<6)throw Error('En-tête MIDI invalide.');need(header);
    const format=u16(), count=u16(), ppq=u16();pos+=header-6;
    if(format>1)throw Error('MIDI de type 2 non pris en charge. Utilisez un type 0 ou 1.');
    if(!ppq || ppq&0x8000)throw Error('Division SMPTE non prise en charge. Exportez le MIDI avec un tempo musical.');
    if(!count || count>256 || (format===0&&count!==1))throw Error('Nombre de pistes MIDI invalide.');
    const notes=[],tempos=[{tick:0,tempo:500000}],names=[];let attacks=0;
    for(let track=0;track<count;track++){
      limit=bytes.length;if(text(4)!=='MTrk')throw Error('Piste MIDI manquante.');const size=u32();need(size);const end=pos+size;limit=end;
      let tick=0,running=0;const active=new Map(),held=Array.from({length:16},()=>[]),pedal=Array(16).fill(false);
      function close(note,endTick){notes.push({...note,endTick:Math.max(note.tick+1,endTick)});if(notes.length>50000)throw Error('Trop de notes MIDI (50 000 maximum).');}
      function off(channel,pitch){const key=channel+':'+pitch,queue=active.get(key);if(!queue?.length)return;const note=queue.shift();if(pedal[channel])held[channel].push(note);else close(note,tick);}
      while(pos<end){
        tick+=vlq();let status=u8();if(status<128){if(!running)throw Error('Événement MIDI sans statut.');pos--;status=running;}
        if(status===255){running=0;const kind=u8(),length=vlq();need(length);
          if(kind===0x51&&length===3){const tempo=(bytes[pos]<<16)|(bytes[pos+1]<<8)|bytes[pos+2];if(tempo)tempos.push({tick,tempo});}
          if(kind===3)names[track]=new TextDecoder().decode(bytes.subarray(pos,pos+length)).slice(0,120);
          pos+=length;if(kind===0x2f)break;continue;
        }
        if(status===0xf0||status===0xf7){running=0;const length=vlq();need(length);pos+=length;continue;}
        if(status<0x80||status>=0xf0)throw Error('Événement système MIDI non pris en charge.');
        running=status;const kind=status>>4,channel=status&15,a=u8(),b=(kind===12||kind===13)?0:u8();
        if(a>127||b>127)throw Error('Valeur de note MIDI invalide.');
        if(kind===9&&b>0){if(++attacks>50000)throw Error('Trop de notes MIDI (50 000 maximum).');const key=channel+':'+a;if(!active.has(key))active.set(key,[]);active.get(key).push({track,channel,pitch:a,velocity:b,tick});}
        else if(kind===8||(kind===9&&b===0))off(channel,a);
        else if(kind===11&&a===64){const on=b>=64;if(pedal[channel]&&!on){for(const note of held[channel])close(note,tick);held[channel]=[];}pedal[channel]=on;}
        else if(kind===11&&(a===120||a===123)){
          for(const queue of active.values())while(queue[0]?.channel===channel)close(queue.shift(),tick);
          for(const note of held[channel])close(note,tick);held[channel]=[];
        }
      }
      for(const queue of active.values())for(const note of queue)close(note,Math.max(tick,note.tick+ppq/2));
      for(const queue of held)for(const note of queue)close(note,tick);
      pos=end;
    }
    tempos.sort((a,b)=>a.tick-b.tick);const map=[];let lastTick=0,time=0,tempo=500000;
    for(const event of tempos){time+=(event.tick-lastTick)*tempo/ppq/1000;map.push({tick:event.tick,time,tempo:event.tempo});lastTick=event.tick;tempo=event.tempo;}
    function millis(tick){let lo=0,hi=map.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(map[mid].tick<=tick)lo=mid;else hi=mid-1;}const event=map[lo];return event.time+(tick-event.tick)*event.tempo/ppq/1000;}
    const groups=new Map();
    for(const note of notes){if(note.channel===9)continue;const key=note.track+':'+note.channel;if(!groups.has(key))groups.set(key,{id:key,name:(names[note.track]||'Piste '+(note.track+1))+' · canal '+(note.channel+1),notes:[]});groups.get(key).notes.push({pitch:note.pitch,start:millis(note.tick),end:millis(note.endTick),velocity:note.velocity});}
    const tracks=Array.from(groups.values()).filter(group=>group.notes.length);
    if(!tracks.length)throw Error('Aucune note mélodique trouvée (les percussions sont ignorées).');
    for(const track of tracks)track.notes.sort((a,b)=>a.start-b.start||b.pitch-a.pitch);
    const maxCount=Math.max(...tracks.map(track=>track.notes.length));
    const candidates=tracks.filter(track=>track.notes.length>=Math.min(8,maxCount*.25));
    candidates.sort((a,b)=>b.notes.reduce((n,x)=>n+x.pitch,0)/b.notes.length-a.notes.reduce((n,x)=>n+x.pitch,0)/a.notes.length);
    return {tracks,defaultTrack:candidates[0].id};
  }
  function convertMidiTrack(track) {
    const notes=[];let simplified=0;
    for(const raw of track.notes){
      if(raw.end-raw.start<35){simplified++;continue;}
      const previous=notes.at(-1);
      if(previous&&raw.start<previous.end&&raw.pitch<previous.pitch){simplified++;continue;}
      if(previous&&raw.start<previous.end){previous.end=raw.start;simplified++;}
      notes.push({...raw});
    }
    const melody=notes.filter(note=>note.end-note.start>=35);
    if(!melody.length)throw Error('Cette piste ne contient pas de mélodie jouable.');
    if(melody.length>5000)throw Error('Choisissez une piste de moins de 5 000 notes.');
    const pitches=[74,77,81,83,86];
    const nearest=pitch=>pitches.reduce((best,value,i)=>Math.abs(value-pitch)<Math.abs(pitches[best]-pitch)?i:best,0);
    let transpose=0,best=Infinity;
    for(let shift=-72;shift<=72;shift+=12){let error=0;for(const note of melody){const pitch=note.pitch+shift;error+=(pitch-pitches[nearest(pitch)])**2;}if(error<best){best=error;transpose=shift;}}
    const origin=melody[0].start;let approximated=0;
    const events=melody.map(raw=>{const pitch=raw.pitch+transpose,note=nearest(pitch);if(pitches[note]!==pitch)approximated++;return {note,time:Math.round(raw.start-origin),duration:Math.min(60000,Math.round(raw.end-raw.start))};});
    if(events.at(-1).time+events.at(-1).duration>20*60*1000)throw Error('La mélodie dépasse 20 minutes.');
    return {events,transpose,approximated,simplified};
  }
  function validMidiSong(song){return song&&typeof song.name==='string'&&Array.isArray(song.events)&&song.events.length>0&&song.events.length<=5000&&song.events.every((e,i)=>Number.isInteger(e.note)&&e.note>=0&&e.note<5&&Number.isFinite(e.time)&&e.time>=0&&e.time<=1200000&&Number.isFinite(e.duration)&&e.duration>=35&&e.duration<=60000&&(!i||e.time>=song.events[i-1].time));}
  root.ocarinaMidi={parse:parseMidi,convert:convertMidiTrack,validSong:validMidiSong};
})(globalThis);
// END MIDI SUPPORT

// BEGIN OCARINA TONE
const ocarinaBreathBuffers = new WeakMap();
const ocarinaRooms = new WeakMap();
function ocarinaDestination(ctx) {
  if (ocarinaRooms.has(ctx)) return ocarinaRooms.get(ctx);
  const input = ctx.createGain(), reverb = ctx.createConvolver(), wet = ctx.createGain();
  const impulse = ctx.createBuffer(2,Math.floor(ctx.sampleRate * .18),ctx.sampleRate);
  for(let channel=0;channel<2;channel++) {
    const data = impulse.getChannelData(channel); let smooth = 0;
    for(let i=0;i<data.length;i++) {
      smooth = .55 * smooth + .45 * (Math.random() * 2 - 1);
      data[i] = smooth * .025 * Math.exp(-i / ctx.sampleRate * 38);
    }
    data[Math.floor(ctx.sampleRate * .023)] += .12;
    data[Math.floor(ctx.sampleRate * .041)] += .07;
  }
  reverb.buffer = impulse; reverb.normalize = false; wet.gain.value = .18;
  input.connect(ctx.destination); input.connect(reverb).connect(wet).connect(ctx.destination);
  ocarinaRooms.set(ctx,input); return input;
}

function createOcarinaVoice(ctx, frequency, output, onended = () => {}) {
  const now = ctx.currentTime, nodes = [], sources = [];
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass'; toneFilter.Q.value = .5;
  toneFilter.frequency.setValueAtTime(Math.min(6500,frequency * 1.8),now);
  toneFilter.frequency.exponentialRampToValueAtTime(Math.min(7500,frequency * 3),now + .075);
  const body = ctx.createBiquadFilter(), pressure = ctx.createGain();
  body.type = 'peaking'; body.frequency.value = frequency * 1.03; body.Q.value = 1.1; body.gain.value = 1.3;
  pressure.gain.value = 1;
  toneFilter.connect(body).connect(pressure).connect(output); nodes.push(toneFilter,body,pressure);
  const vibrato = ctx.createOscillator(), depth = ctx.createGain();
  vibrato.type = 'sine'; vibrato.frequency.value = 4.8 + Math.random() * .4;
  depth.gain.setValueAtTime(0,now);
  depth.gain.setValueAtTime(0,now + .18);
  depth.gain.linearRampToValueAtTime(4.5,now + .65);
  vibrato.connect(depth); nodes.push(depth); sources.push(vibrato);
  [1,2,3].forEach((harmonic,i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * harmonic * (.9935 + Math.random() * .001),now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * harmonic,now + .055);
    gain.gain.value = [.92,.046,.012][i];
    depth.connect(oscillator.detune);
    oscillator.connect(gain).connect(toneFilter); nodes.push(gain); sources.push(oscillator);
  });
  let buffer = ocarinaBreathBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1,ctx.sampleRate * 2,ctx.sampleRate);
    const data = buffer.getChannelData(0); let softened = 0;
    for(let i=0;i<data.length;i++) { softened = .72 * softened + .28 * (Math.random() * 2 - 1); data[i] = softened; }
    ocarinaBreathBuffers.set(ctx,buffer);
  }
  const breath = ctx.createBufferSource(), breathFilter = ctx.createBiquadFilter(), breathGain = ctx.createGain();
  breath.buffer = buffer; breath.loop = true;
  breathFilter.type = 'bandpass'; breathFilter.frequency.value = Math.min(6000,frequency * 2.5); breathFilter.Q.value = .8;
  breathGain.gain.setValueAtTime(.07,now);
  breathGain.gain.exponentialRampToValueAtTime(.024,now + .12);
  breath.connect(breathFilter).connect(breathGain).connect(output);
  const cavity = ctx.createBiquadFilter(), cavityGain = ctx.createGain();
  cavity.type = 'bandpass'; cavity.frequency.value = frequency; cavity.Q.value = 7;
  cavityGain.gain.setValueAtTime(.09,now);
  cavityGain.gain.exponentialRampToValueAtTime(.045,now + .16);
  breath.connect(cavity).connect(cavityGain).connect(output);
  // Filtered turbulence gently varies pitch and breath pressure rather than a second periodic vibrato.
  const turbulence = ctx.createBiquadFilter(), pitchDrift = ctx.createGain(), pressureDrift = ctx.createGain();
  turbulence.type = 'lowpass'; turbulence.frequency.value = 8; turbulence.Q.value = .5;
  pitchDrift.gain.value = 70; pressureDrift.gain.value = 1.1;
  breath.connect(turbulence); turbulence.connect(pitchDrift); turbulence.connect(pressureDrift).connect(pressure.gain);
  for (const source of sources) if (source !== vibrato) pitchDrift.connect(source.detune);
  nodes.push(breathFilter,breathGain,cavity,cavityGain,turbulence,pitchDrift,pressureDrift); sources.push(breath);
  let remaining = sources.length, stoppedAt = Infinity;
  for(const source of sources) {
    source.onended = () => {
      source.disconnect();
      if (--remaining === 0) { for(const node of nodes) node.disconnect(); onended(); }
    };
    if (source === breath) source.start(now,Math.random() * 1.5);
    else source.start(now);
  }
  return { stop(at) { if (at >= stoppedAt) return; stoppedAt = at; for(const source of sources) source.stop(at); } };
}
// END OCARINA TONE

// BEGIN HOLD SUPPORT
const heldVoices = new Map();
const heldKeys = new Map(), heldPointers = new Map();
function heldGamepadNotes() {
  const notes = new Set();
  try {
    const mappings = JSON.parse(localStorage.getItem('ocarina-gamepad-mappings') || '{}') || {};
    for (const pad of Array.from(navigator.getGamepads?.() || [])) {
      if (!pad || pad.connected === false) continue;
      const configured = mappings[pad.id];
      const mapping = Array.isArray(configured) && configured.length === 5 ? configured : pad.mapping === 'standard' ? [4,5,2,3,1] : [];
      mapping.forEach((button,note) => { if (pad.buttons[button]?.pressed || pad.buttons[button]?.value > .5) notes.add(note); });
    }
  } catch (_) {}
  return notes;
}
window.ocarinaHeldNote = note => Array.from(heldKeys.values()).includes(note) || Array.from(heldPointers.values()).includes(note) || heldGamepadNotes().has(note);
window.ocarinaReleaseNote = note => releaseHeldVoice(note);
function releaseHeldVoice(note) {
  const voice = heldVoices.get(note);
  if (!voice) return;
  heldVoices.delete(note);
  voice.released = performance.now();
  const now = voice.ctx.currentTime;
  voice.output.gain.cancelScheduledValues(now);
  voice.output.gain.setTargetAtTime(.0001,now,.012);
  for (const oscillator of voice.oscillators) oscillator.stop(now + .08);
  document.querySelectorAll('#note-lanes .lane-label')[note]?.classList.remove('held-note');
}
window.ocarinaReleaseNotes = () => {
  heldKeys.clear(); heldPointers.clear();
  for (const note of Array.from(heldVoices.keys())) releaseHeldVoice(note);
};
function playHeldNote(note) {
  if (heldVoices.has(note)) return;
  const ctx = context(), now = ctx.currentTime, output = ctx.createGain();
  output.gain.setValueAtTime(0,now);
  output.gain.linearRampToValueAtTime(Number(document.querySelector('#volume').value) / 100 * .22,now + .02);
  output.connect(ocarinaDestination(ctx));
  const oscillators = [createOcarinaVoice(ctx,frequencies[note],output,() => output.disconnect())];
  const voice = {ctx,output,oscillators,released:null}; heldVoices.set(note,voice);
  const label = document.querySelectorAll('#note-lanes .lane-label')[note];
  label?.classList.add('held-note');
  const track = document.querySelectorAll('#note-lanes .lane-track')[note];
  if (track && !document.body.classList.contains('test-mode')) {
    const trail = document.createElement('span'); trail.className = 'hold-trail'; track.appendChild(trail);
    const begin = performance.now(), from = track.clientWidth + 8;
    function draw() {
      const time = performance.now(), end = voice.released ?? time;
      const x = from - (time - begin) * .25, width = 38 + (end - begin) * .25;
      trail.style.transform = 'translateX(' + x + 'px)'; trail.style.width = width + 'px';
      if (x + width < 0 || document.body.classList.contains('test-mode')) trail.remove();
      else requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
}
function play(note, duration = .48) {
  if (window.ocarinaHeldNote(note)) playHeldNote(note);
  else playTap(note,duration);
}
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const note = shortcuts.indexOf(event.key.toLowerCase());
  if (note >= 0) heldKeys.set(event.code || event.key.toLowerCase(),note);
},true);
document.addEventListener('keyup', event => heldKeys.delete(event.code || event.key.toLowerCase()),true);
document.addEventListener('pointerdown', event => {
  const button = event.target.closest?.('.note');
  if (!button || (event.button !== 0 && event.pointerType !== 'touch')) return;
  const note = Number(button.dataset.note);
  if (!Number.isInteger(note) || note < 0 || note > 4) return;
  heldPointers.set(event.pointerId,note); button.setPointerCapture?.(event.pointerId);
  event.preventDefault(); input(note);
},true);
for (const type of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(type,event => heldPointers.delete(event.pointerId),true);
document.addEventListener('click', event => { if(event.isTrusted && event.detail > 0 && event.target.closest?.('.note')) event.stopImmediatePropagation(); },true);
window.addEventListener('blur',window.ocarinaReleaseNotes);
document.addEventListener('visibilitychange',() => { if(document.hidden) window.ocarinaReleaseNotes(); });
document.addEventListener('DOMContentLoaded',() => {
  const style = document.createElement('style');
  style.textContent = '#note-lanes .lane-label.held-note{background:#ffe469!important;color:#49360b!important;box-shadow:0 0 12px #ffe055,0 0 30px #ffcf36;transform:scale(.9)}#note-lanes .hold-trail{position:absolute;left:0;top:10px;height:24px;border-radius:12px;background:#ffe46966;box-shadow:0 0 8px #ffe055;pointer-events:none}';
  document.head.appendChild(style);
  new MutationObserver(() => window.ocarinaReleaseNotes()).observe(document.body,{attributes:true,attributeFilter:['class']});
  let previousVolume = '';
  function pollHeld() {
    const gamepad = heldGamepadNotes();
    const volume = document.querySelector('#volume').value;
    for (const [note,voice] of heldVoices) {
      const down = Array.from(heldKeys.values()).includes(note) || Array.from(heldPointers.values()).includes(note) || gamepad.has(note);
      if (!down || !document.hasFocus() || document.body.classList.contains('options-open')) releaseHeldVoice(note);
      else if (volume !== previousVolume) voice.output.gain.setTargetAtTime(Number(volume)/100*.22,voice.ctx.currentTime,.02);
    }
    previousVolume = volume;
    requestAnimationFrame(pollHeld);
  }
  requestAnimationFrame(pollHeld);
});
// END HOLD SUPPORT

document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  if (document.getElementById('rumble-test')) return;
  const panel = document.createElement('section');
  panel.style.cssText = 'padding:16px;margin-top:16px;background:#f5f3e9;color:#263d39;border-radius:12px;text-align:left';
  panel.innerHTML = '<button id="rumble-test" style="padding:12px">Tester la vibration</button><p id="rumble-result" role="status">Sélectionnez votre manette puis lancez le test.</p>';
  (document.querySelector('.instrument') || document.querySelector('main')).appendChild(panel);
  const button = panel.querySelector('#rumble-test'), result = panel.querySelector('#rumble-result');
  button.onclick = async () => {
    button.disabled = true;
    try {
      const pads = Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected !== false);
      const index = Number(document.getElementById('pad-select')?.value);
      const pad = pads.find(p => p.index === index) || pads[0];
      if (!pad) { result.textContent = 'Aucune manette détectée.'; return; }
      result.textContent = 'Test en cours : ' + pad.id;
      const actuator = pad.vibrationActuator;
      let state;
      if (actuator?.playEffect) {
        if (actuator.effects?.length && !Array.from(actuator.effects).includes('dual-rumble')) {
          result.textContent = 'Vibration classique non proposée. Effets disponibles : ' + Array.from(actuator.effects).join(', '); return;
        }
        state = await actuator.playEffect('dual-rumble',{startDelay:0,duration:500,weakMagnitude:1,strongMagnitude:1});
      } else if (pad.hapticActuators?.[0]?.pulse) state = await pad.hapticActuators[0].pulse(1,500);
      else { result.textContent = 'Vibration non exposée par Windows/le navigateur pour cette connexion. Essayez la DualSense avec un câble USB de données.'; return; }
      result.textContent = 'Réponse du pilote : ' + String(state) + '. ' + (state === 'complete' || state === true ? 'Commande exécutée. Avez-vous senti la vibration ?' : 'Copiez cette réponse dans notre conversation.');
    } catch (error) { result.textContent = 'Test refusé : ' + error.name + ' — ' + error.message; }
    finally { button.disabled = false; }
  };
}));

window.ocarinaHitFeedback = function(verdict) {
  const bar = document.getElementById('hit-bar');
  bar?.animate([{background:'#fff',boxShadow:'0 0 20px #fff,0 0 55px #ffdf40',transform:'scaleX(2.4)'},{background:'#ffdf40',boxShadow:'0 0 10px #ffe35c,0 0 24px #ffce32',transform:'scaleX(1)'}],{duration:180,easing:'ease-out'});
  try {
    const pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
    const index = Number(document.getElementById('pad-select')?.value);
    const pad = pads.find(p => p.buttons.some(b => b.pressed)) || pads.find(p => p.index === index) || pads[0];
    if (pad?.vibrationActuator?.playEffect) Promise.resolve(pad.vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:70,weakMagnitude:0.4,strongMagnitude:verdict === 'Parfait' ? 0.3 : 0.15})).catch(() => {});
    else if (pad?.hapticActuators?.[0]?.pulse) Promise.resolve(pad.hapticActuators[0].pulse(0.4,70)).catch(() => {});
  } catch (_) {}
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const box = document.getElementById('note-lanes');
  if (!box || document.getElementById('hit-bar')) return;
  const style = document.createElement('style');
  style.textContent = '#note-lanes .lane-track:before{display:none!important}#hit-bar{position:absolute;width:4px;border-radius:4px;background:#ffdf40;box-shadow:0 0 10px #ffe35c,0 0 24px #ffce32;z-index:6;pointer-events:none}';
  document.head.appendChild(style);
  const bar = document.createElement('div'); bar.id = 'hit-bar'; bar.setAttribute('aria-hidden','true'); box.appendChild(bar);
  function place() {
    const tracks = Array.from(box.querySelectorAll('.lane-track'));
    if (!tracks.length || !box.offsetWidth) return;
    const outer = box.getBoundingClientRect(), rects = tracks.map(track => track.getBoundingClientRect());
    const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
    bar.style.left = (rects[0].left - outer.left - box.clientLeft + tracks[0].clientWidth * 0.22) + 'px';
    bar.style.top = (top - outer.top - box.clientTop) + 'px';
    bar.style.height = (bottom - top) + 'px';
  }
  place();
  if (window.ResizeObserver) new ResizeObserver(place).observe(box);
  window.addEventListener('resize',place);
  new MutationObserver(place).observe(document.body,{attributes:true,attributeFilter:['class']});
}));

window.ocarinaTimingJudge = delta => Math.abs(delta) <= 90 ? 'Parfait' : Math.abs(delta) <= 180 ? 'Bien' : null;
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  if (document.getElementById('game-mode')) return;
  const box = document.getElementById('note-lanes');
  if (!box) return;
  const style = document.createElement('style');
  style.textContent = '#note-lanes .lane-track:before{content:"";position:absolute;left:24px;top:0;bottom:0;width:4px;border-radius:3px;background:#ffdf40;box-shadow:0 0 8px #ffe35c,0 0 20px #ffce32;z-index:5}body.test-mode #note-lanes .lane-note:not(.test-target){visibility:hidden}#test-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding-bottom:12px;pointer-events:auto;font:13px Arial}#test-toolbar button{padding:8px 14px;border:1px solid #ffe35c;border-radius:10px;background:#e6c24a;color:#263020;cursor:pointer}#test-feedback{flex:1;min-width:180px}#note-lanes .test-target{animation:none;background:#4b4930;border-color:#ffe35c}';
  document.head.appendChild(style);
  const options = document.createElement('section');
  options.style.cssText = 'margin-top:16px;padding:16px;border-radius:12px;background:#f5f3e9;color:#263d39;text-align:left';
  options.innerHTML = '<label for="game-mode">Mode de jeu : </label><select id="game-mode"><option value="free">Libre</option><option value="test">Test</option><option value="music1">Test musique 1</option></select><p>Test : appuyez quand le centre de la touche atteint la barre jaune. Fermez les options puis lancez le test.</p>';
  (document.querySelector('.instrument') || document.querySelector('main')).appendChild(options);
  const mode = options.querySelector('#game-mode');
  try { const savedMode=localStorage.getItem('ocarina-game-mode'); mode.value = ['test','music1'].includes(savedMode) ? savedMode : 'free'; } catch (_) { mode.value = 'free'; }
  const toolbar = document.createElement('div'); toolbar.id = 'test-toolbar';
  toolbar.innerHTML = '<span id="test-mode-label"></span><button id="test-start">Lancer le test</button><span id="test-feedback" role="status" aria-live="polite"></span>';
  box.appendChild(toolbar);
  const start = toolbar.querySelector('#test-start'), feedback = toolbar.querySelector('#test-feedback');
  const tracks = Array.from(box.querySelectorAll('.lane-track'));
  let running = false, targets = [], clock = null, spawned = 0, judged = 0, correct = 0, score = 0, nextSpawn = 0;
  let total = 8, midiSong = null, midiSource = null, midiName = '', musicStart = 0;
  let previewTimer = null, previewVoices = new Set(), midiReadId = 0;
  try { const saved = JSON.parse(localStorage.getItem('ocarina-midi-song') || 'null'); if (window.ocarinaMidi?.validSong(saved)) midiSong = saved; } catch (_) {}
  const midiPanel = document.createElement('section');
  midiPanel.style.cssText = 'margin-top:16px;padding:16px;border-radius:12px;background:#f5f3e9;color:#263d39;text-align:left';
  midiPanel.innerHTML = '<strong>Test musique 1 · MIDI</strong><p>Importez un fichier .mid ou .midi, puis choisissez sa piste mélodique.</p><input id="midi-file" type="file" accept=".mid,.midi,audio/midi" hidden><button id="midi-import">Importer un MIDI</button> <button id="midi-preview">Écouter la mélodie convertie</button><p><label for="midi-track">Piste : </label><select id="midi-track" disabled></select></p><p id="midi-summary" role="status"></p>';
  (document.querySelector('.instrument') || document.querySelector('main')).appendChild(midiPanel);
  const midiFile = midiPanel.querySelector('#midi-file'), midiTrack = midiPanel.querySelector('#midi-track');
  const midiImport = midiPanel.querySelector('#midi-import'), midiPreview = midiPanel.querySelector('#midi-preview'), midiSummary = midiPanel.querySelector('#midi-summary');
  function describeMidi() {
    midiSummary.textContent = midiSong ? midiSong.name + ' · ' + midiSong.events.length + ' notes · transposition ' + (midiSong.transpose || 0) + ' demi-tons · ' + (midiSong.approximated || 0) + ' notes rapprochées des cinq notes disponibles · ' + (midiSong.simplified || 0) + ' notes d’accompagnement simplifiées.' : 'Aucun fichier importé.';
    midiPreview.disabled = !midiSong;
  }
  function stopMidiPreview() {
    clearInterval(previewTimer); previewTimer = null;
    for (const item of previewVoices) {
      const now = item.ctx.currentTime;
      item.output.gain.cancelScheduledValues(now); item.output.gain.setTargetAtTime(.0001,now,.01); item.voice.stop(now + .05);
    }
    previewVoices.clear(); midiPreview.textContent = 'Écouter la mélodie convertie';
  }
  function installMidiTrack() {
    const track = midiSource.tracks.find(item => item.id === midiTrack.value);
    if (!track) throw Error('Choisissez une piste MIDI.');
    const converted = window.ocarinaMidi.convert(track);
    clearRound(); midiSong = {...converted,name:(midiName + ' — ' + track.name).slice(0,240)};
    try { localStorage.setItem('ocarina-midi-song',JSON.stringify(midiSong)); } catch (_) {}
    describeMidi(); mode.value = 'music1'; mode.onchange();
  }
  midiImport.onclick = () => midiFile.click();
  midiFile.onchange = async () => {
    const file = midiFile.files?.[0]; if (!file) return;
    const token = ++midiReadId; midiTrack.disabled = true; midiSummary.textContent = 'Lecture du fichier MIDI…';
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('Fichier trop volumineux (10 Mo maximum).');
      const data = await file.arrayBuffer(); if(token !== midiReadId) return;
      const parsed = window.ocarinaMidi.parse(data);
      window.ocarinaMidi.convert(parsed.tracks.find(track => track.id === parsed.defaultTrack));
      midiSource = parsed; midiName = file.name.slice(0,120); midiTrack.replaceChildren();
      for (const track of parsed.tracks) { const option=document.createElement('option');option.value=track.id;option.textContent=track.name+' ('+track.notes.length+' notes)';midiTrack.appendChild(option); }
      midiTrack.value = parsed.defaultTrack; midiTrack.disabled = false; installMidiTrack();
    } catch(error) { midiSummary.textContent = 'Import refusé : ' + error.message; feedback.textContent = midiSummary.textContent; }
    finally { if(token === midiReadId) { midiFile.value = ''; midiTrack.disabled = !midiSource; } }
  };
  midiTrack.onchange = () => { try { installMidiTrack(); } catch(error) { midiSummary.textContent = 'Conversion refusée : ' + error.message; } };
  midiPreview.onclick = () => {
    if (previewTimer !== null) { stopMidiPreview(); return; }
    if (!midiSong) return;
    clearRound(); const ctx=context(), origin=performance.now(); let index=0;
    midiPreview.textContent = 'Arrêter l’écoute';
    function playNext() {
      const elapsed=performance.now()-origin;
      while(index<midiSong.events.length && midiSong.events[index].time<=elapsed) {
        const event=midiSong.events[index++], duration=Math.max(.04,(event.duration-(elapsed-event.time))/1000), now=ctx.currentTime, output=ctx.createGain();
        const level=Number(document.querySelector('#volume').value)/100*.22;
        output.gain.setValueAtTime(0,now);output.gain.linearRampToValueAtTime(level,now+Math.min(.02,duration*.2));
        output.gain.setValueAtTime(level,now+Math.max(.02,duration-.05));output.gain.linearRampToValueAtTime(0,now+duration);
        output.connect(ocarinaDestination(ctx));let item;
        const voice=createOcarinaVoice(ctx,frequencies[event.note],output,()=>{output.disconnect();previewVoices.delete(item);});
        item={ctx,output,voice};previewVoices.add(item);voice.stop(now+duration+.05);
      }
      const last=midiSong.events.at(-1); if(elapsed>last.time+last.duration+200) stopMidiPreview();
    }
    previewTimer=setInterval(playNext,25);playNext();
  };
  describeMidi();

  let blockedUntil = 0, blockTimer = null;
  function resetLock() {
    blockedUntil = 0; clearTimeout(blockTimer); blockTimer = null;
    const bar = document.getElementById('hit-bar');
    if (bar) { bar.style.removeProperty('background'); bar.style.removeProperty('box-shadow'); }
  }
  function lockInputs() {
    for (const target of targets) if (target.holding && !target.done) settleTarget(target,false);
    window.ocarinaReleaseNotes?.();
    blockedUntil = performance.now() + 400;
    const bar = document.getElementById('hit-bar');
    if (bar) {
      bar.getAnimations().forEach(animation => animation.cancel());
      bar.style.setProperty('background','#080808','important');
      bar.style.setProperty('box-shadow','none','important');
    }
    clearTimeout(blockTimer); blockTimer = setTimeout(resetLock,400);
    report('Appui inutile : blocage 0,4 s');
  }
  function clearRound() {
    stopMidiPreview();
    window.ocarinaReleaseNotes?.();
    resetLock();
    running = false; clearInterval(clock); clock = null;
    for (const target of targets) { target.animation.cancel(); target.chip.remove(); }
    targets = []; start.disabled = false;
  }
  function report(text) { feedback.textContent = text + ' · ' + correct + '/' + total + ' · Score ' + score; }
  function finishIfReady() {
    if (judged === total && spawned === total) {
      running = false; clearInterval(clock); clock = null; start.disabled = false;
      report('Terminé !'); start.textContent = 'Rejouer';
    }
  }
  function settleTarget(target,success) {
    if (target.done) return;
    target.done = true; judged++;
    if (target.length) window.ocarinaReleaseNote?.(target.note);
    if (success) {
      correct++; score += target.verdict === 'Parfait' ? 100 : 60;
      target.animation.cancel(); target.chip.remove(); targets = targets.filter(t => t !== target);
      window.ocarinaHitFeedback?.(target.verdict); report(target.length ? 'Note tenue !' : target.verdict + ' !');
    } else { target.chip.style.opacity = '.25'; report(target.holding ? 'Relâché trop tôt' : 'Raté'); }
    finishIfReady();
  }
  function spawn(now, event = null, expectedAt = null) {
    const note = event ? event.note : Math.floor(Math.random() * 5), track = tracks[note];
    const holdLength = event ? (event.duration >= 250 ? event.duration : 0) : spawned % 3 === 1 ? 900 : 0;
    const chip = document.createElement('span'); chip.className = 'lane-note test-target';
    if (holdLength) { chip.style.width = (40 + holdLength * .25) + 'px'; chip.style.boxSizing = 'border-box'; chip.style.justifyContent = 'flex-start'; chip.style.paddingLeft = '4px'; }
    chip.textContent = window.ocarinaSymbols?.[note] || ['L','R','□','△','○'][note];
    track.appendChild(chip);
    const hitPosition = track.clientWidth * 0.22 + 2 - 20;
    const from = expectedAt === null ? track.clientWidth + 8 : hitPosition + (expectedAt - now) * .25;
    const animation = chip.animate([{transform:'translateX(' + from + 'px)'},{transform:'translateX(' + (-48 - holdLength * .25) + 'px)'}],{duration:Math.max(1,(from + 48)/0.25 + holdLength),easing:'linear',fill:'forwards'});
    const at = expectedAt === null ? now + (from - hitPosition)/0.25 : expectedAt;
    const target = {note,chip,animation,at,endAt:at + holdLength,length:holdLength,holding:false,verdict:null,done:false};
    animation.onfinish = () => {
      if (running && !target.done) settleTarget(target,false);
      chip.remove(); targets = targets.filter(t => t !== target);
    };
    targets.push(target); spawned++;
  }
  function tick() {
    if (!running) return;
    if (document.body.classList.contains('options-open') || !document.hasFocus()) {
      clearRound(); feedback.textContent = 'Test interrompu. Relancez quand vous êtes prêt.'; return;
    }
    const now = performance.now();
    if (mode.value === 'music1') {
      let batch = 0;
      while (spawned < total && batch++ < 128) {
        const event = midiSong.events[spawned], track = tracks[event.note];
        const travel = (track.clientWidth + 8 - (track.clientWidth * .22 + 2 - 20)) / .25;
        const at = musicStart + event.time;
        if (now < at - travel) break;
        spawn(now,event,at);
      }
    } else if (spawned < total && now >= nextSpawn) { spawn(now); nextSpawn = now + 900; }
    for (const target of targets) {
      if (target.done) continue;
      if (target.holding) {
        if (now >= target.endAt) settleTarget(target,true);
        else if (!window.ocarinaHeldNote?.(target.note)) settleTarget(target,now >= target.endAt - 90);
      } else if (now - target.at > 180) settleTarget(target,false);
    }
    finishIfReady();
  }
  start.onclick = () => {
    if (document.body.classList.contains('options-open')) return;
    if (mode.value === 'music1' && !midiSong) { feedback.textContent = 'Importez un MIDI avec le bouton à gauche.'; return; }
    try { context(); } catch (_) {}
    clearRound(); spawned = judged = correct = score = 0;
    total = mode.value === 'music1' ? midiSong.events.length : 8;
    musicStart = performance.now() + Math.max(...tracks.map(track => (track.clientWidth + 8 - (track.clientWidth * .22 + 2 - 20)) / .25)) + 800;
    running = true; start.disabled = true; nextSpawn = performance.now();
    report('Préparez-vous…'); tick(); clock = setInterval(tick,25);
  };
  const original = input;
  input = function(note) {
    if (mode.value === 'free') { original(note); return; }
    if (!running || document.body.classList.contains('options-open')) return;
    const zone = document.getElementById('hit-bar');
    if (!zone) return;
    if (performance.now() < blockedUntil) return;
    const area = zone.getBoundingClientRect();
    const allowed = targets.some(target => {
      if (target.done || target.holding || target.note !== note) return false;
      const rect = target.chip.getBoundingClientRect();
      return rect.left <= area.right && rect.left + 40 >= area.left;
    });
    if (!allowed) { lockInputs(); return; }
    original(note);
    if (mode.value === 'free' || !running || document.body.classList.contains('options-open')) return;
    const now = performance.now();
    const target = targets.filter(t => !t.done && !t.holding && t.note === note).sort((a,b) => Math.abs(a.at-now)-Math.abs(b.at-now))[0];
    const verdict = target && window.ocarinaTimingJudge(now - target.at);
    if (!verdict) { score = Math.max(0,score-10); report('Hors timing ou mauvaise touche'); return; }
    target.verdict = verdict;
    if (target.length) {
      target.holding = true; target.chip.style.background = '#ffe469'; target.chip.style.color = '#49360b';
      report('Maintenez la touche…');
    } else settleTarget(target,true);
  };
  function applyMode() {
    clearRound(); document.body.classList.toggle('test-mode',mode.value !== 'free');
    start.hidden = mode.value === 'free';
    start.disabled = mode.value === 'music1' && !midiSong;
    toolbar.querySelector('#test-mode-label').textContent = mode.value === 'music1' ? 'TEST MUSIQUE 1' : mode.value === 'test' ? 'MODE TEST' : 'MODE LIBRE';
    feedback.textContent = mode.value === 'music1' ? (midiSong ? midiSong.name + ' · ' + midiSong.events.length + ' notes. Cliquez sur Lancer le test.' : 'Importez un MIDI avec le bouton à gauche.') : mode.value === 'test' ? '8 notes : maintenez les touches longues jusqu’au bout.' : 'Jouez à votre rythme.';
    try { localStorage.setItem('ocarina-game-mode',mode.value); } catch (_) {}
  }
  options.hidden = true;
  const modeMenu = document.createElement('nav');
  modeMenu.id = 'main-game-modes';
  modeMenu.setAttribute('aria-label','Mode de jeu');
  modeMenu.style.cssText = 'position:fixed;left:20px;top:100px;z-index:1000;display:flex;flex-direction:column;gap:10px';
  const modeButtons = ['free','test','music1'].map(value => {
    const button = document.createElement('button');
    button.textContent = value === 'free' ? 'Libre' : value === 'music1' ? 'Test musique 1' : 'Test';
    button.style.cssText = 'min-width:110px;padding:13px 22px;border:1px solid #d8caa8;border-radius:14px;font:16px Arial;cursor:pointer;box-shadow:0 4px 18px #0004';
    button.onclick = () => { mode.value = value; mode.onchange(); };
    modeMenu.appendChild(button);
    return {button,value};
  });
  function syncModeButtons() {
    for (const {button,value} of modeButtons) {
      const active = mode.value === value;
      button.setAttribute('aria-pressed',String(active));
      button.style.background = active ? '#ffe469' : '#17251cdd';
      button.style.color = active ? '#49360b' : '#fff1ce';
    }
  }
  mode.onchange = () => { applyMode(); syncModeButtons(); };
  const importShortcut=document.createElement('button');importShortcut.textContent='Importer MIDI';importShortcut.style.cssText='padding:12px;border:1px solid #d8caa8;border-radius:12px;background:#17251cdd;color:#fff1ce;cursor:pointer';importShortcut.onclick=()=>midiFile.click();modeMenu.appendChild(importShortcut);
  document.body.appendChild(modeMenu);
  syncModeButtons();
  window.addEventListener('blur', () => { stopMidiPreview(); if(running) { clearRound(); feedback.textContent = 'Test interrompu. Relancez quand vous êtes prêt.'; } });
  window.addEventListener('resize', () => { if(running) { clearRound(); feedback.textContent = 'Taille modifiée : relancez le test.'; } });
  applyMode();
}));

document.addEventListener('DOMContentLoaded', () => queueMicrotask(() => {
  if (document.getElementById('note-bindings')) return;
  const panel = document.createElement('section');
  panel.id = 'note-bindings';
  panel.style.cssText = 'padding:16px;margin-top:16px;border-radius:12px;background:#f5f3e9;color:#263d39;text-align:left;font:14px Arial';
  panel.innerHTML = '<strong>Manette : associer chaque note</strong><p>Sélectionnez votre manette au-dessus, cliquez sur une note puis appuyez sur le bouton voulu.</p><div id="binding-rows"></div><p id="binding-status" role="status"></p><button id="binding-cancel" hidden>Annuler</button>';
  (document.querySelector('.instrument') || document.querySelector('main')).appendChild(panel);
  for (const id of ['pad-config','pad-cancel']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const message = panel.querySelector('#binding-status');
  const cancel = panel.querySelector('#binding-cancel');
  const noteNames = ['Ré grave','Fa','La','Si','Ré aigu'];
  const defaults = [4,5,2,3,1];
  let mappings = {}, previous = new Map(), capture = null;
  try { mappings = JSON.parse(localStorage.getItem('ocarina-gamepad-mappings') || '{}') || {}; } catch (_) {}
  if (typeof mappings !== 'object' || Array.isArray(mappings)) mappings = {};
  function mapping(pad) {
    const value = mappings[pad.id];
    return Array.isArray(value) && value.length === 5 && value.every(n => Number.isInteger(n) && n >= 0 && n < 128) ? value.slice() : defaults.slice();
  }
  function pads() { return Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected !== false); }
  function selected(all) { return all.find(p => p.index === Number(document.getElementById('pad-select')?.value)) || all[0]; }
  function stop(text) { capture = null; cancel.hidden = true; message.textContent = text; }
  cancel.onclick = () => stop('Association annulée.');
  const fields = noteNames.map((name,note) => {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0';
    const label = document.createElement('span'); label.textContent = name;
    const button = document.createElement('button'); button.style.cssText = 'padding:9px 14px;min-width:130px';
    button.onclick = () => {
      try {
        const pad = selected(pads());
        if (!pad) { stop('Connectez une manette puis appuyez sur un bouton.'); return; }
        capture = {id:pad.id,index:pad.index,note};
        cancel.hidden = false;
        message.textContent = name + ' : relâchez les boutons puis appuyez sur celui à associer.';
      } catch (_) { stop('Accès à la manette indisponible.'); }
    };
    row.append(label,button); panel.querySelector('#binding-rows').appendChild(row);
    return button;
  });
  // Ignore the old controller loop's simulated clicks; physical clicks still work.
  document.addEventListener('click', event => {
    if (!event.isTrusted && event.target.closest?.('.note')) event.stopImmediatePropagation();
  }, true);
  function poll() {
    try {
      const all = pads(), chosen = selected(all);
      const ps = ['✕','○','□','△','L1','R1','L2','R2','Créer','Options','L3','R3','↑','↓','←','→','PS','Pavé'];
      fields.forEach((button,i) => {
        button.disabled = !chosen;
        const value = chosen && mapping(chosen)[i];
        const text = !chosen ? 'Non connectée' : (document.getElementById('display-mode')?.value === 'ps5' ? ps[value] || 'Bouton ' + (value + 1) : 'Bouton ' + (value + 1));
        if (button.textContent !== text) button.textContent = text;
      });
      if (capture && (!chosen || chosen.id !== capture.id || chosen.index !== capture.index || !document.hasFocus())) stop('Association annulée : manette ou fenêtre inactive.');
      const next = new Map();
      for (const pad of all) {
        const down = pad.buttons.map(b => b.pressed || b.value > .5);
        const old = previous.get(pad.index) || [];
        next.set(pad.index,down);
        if (capture) {
          if (pad.id !== capture.id || pad.index !== capture.index) continue;
          const button = down.findIndex((pressed,i) => pressed && !old[i]);
          if (button < 0) continue;
          const values = mapping(pad), note = capture.note, other = values.indexOf(button);
          if (other >= 0 && other !== note) values[other] = values[note];
          values[note] = button; mappings[pad.id] = values;
          let saved = true;
          try { localStorage.setItem('ocarina-gamepad-mappings',JSON.stringify(mappings)); } catch (_) { saved = false; }
          stop((saved ? 'Enregistré : ' : 'Appliqué pour cette session : ') + noteNames[note] + (other >= 0 && other !== note ? ' — boutons échangés avec ' + noteNames[other] : ''));
          continue;
        }
        if (!document.hasFocus()) continue;
        const configured = Object.hasOwn(mappings,pad.id);
        if (!configured && pad.mapping !== 'standard') continue;
        mapping(pad).forEach((button,note) => { if (down[button] && !old[button]) input(note); });
      }
      previous = next;
    } catch (_) { message.textContent = 'Lecture de la manette indisponible. Nouvelle tentative…'; }
    finally { requestAnimationFrame(poll); }
  }
  requestAnimationFrame(poll);
}));

document.addEventListener('DOMContentLoaded', () => queueMicrotask(() => {
  if (window.ocarinaAura) return;
  window.ocarinaAura = true;
  const timers = new Map();
  const original = input;
  input = function(index) {
    original(index);
    const label = document.querySelectorAll('#note-lanes .lane-label')[index];
    if (!label) return;
    clearTimeout(timers.get(index));
    label.classList.add('note-glow');
    timers.set(index, setTimeout(() => {
      label.classList.remove('note-glow');
      timers.delete(index);
    }, 90));
  };
}));

window.ocarinaSymbols = ['L', 'R', '□', '△', '○'];
document.addEventListener('DOMContentLoaded', () => queueMicrotask(() => {
  if (document.getElementById('display-mode')) return;
  const panel = document.createElement('section');
  panel.style.cssText = 'margin:20px 0;padding:16px;border:1px solid #93a18a;border-radius:12px;background:#f5f3e9;color:#263d39;text-align:left;font:14px Arial';
  panel.innerHTML = '<label for="display-mode">Affichage des touches</label> <select id="display-mode"><option value="ps5">PS5</option><option value="n64">N64</option><option value="keyboard">Clavier</option><option value="switch">Switch</option></select><p id="display-keys" style="line-height:1.7"></p><div id="keyboard-settings" hidden>Touches clavier : <span id="keyboard-fields"></span><p>Choisissez cinq touches différentes. Les sons ne changent pas.</p></div>';
  (document.querySelector('.instrument') || document.querySelector('main')).appendChild(panel);
  const select = panel.querySelector('#display-mode');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('ocarina-display') || '{}') || {}; } catch (_) {}
  const modes = ['ps5', 'n64', 'keyboard', 'switch'];
  select.value = modes.includes(saved.mode) ? saved.mode : 'ps5';
  if (Array.isArray(saved.keys) && saved.keys.length === 5 && saved.keys.every(k => typeof k === 'string' && /^[a-z0-9]$/.test(k)) && new Set(saved.keys).size === 5) shortcuts.splice(0,5,...saved.keys);
  const fields = shortcuts.map((key, i) => {
    const field = document.createElement('input');
    field.value = key.toUpperCase(); field.maxLength = 1;
    field.setAttribute('aria-label', ['Ré', 'Fa', 'La', 'Si', 'Ré aigu'][i]);
    field.style.cssText = 'width:38px;margin:4px;padding:8px;text-align:center';
    panel.querySelector('#keyboard-fields').appendChild(field);
    return field;
  });
  function save() {
    try { localStorage.setItem('ocarina-display', JSON.stringify({mode:select.value,keys:shortcuts})); } catch (_) {}
  }
  let last = '';
  function update() {
    let labels;
    if (select.value === 'keyboard') labels = shortcuts.map(k => k.toUpperCase());
    else if (select.value === 'n64') labels = ['A', 'C↓', 'C→', 'C←', 'C↑'];
    else if (select.value === 'switch') labels = ['L', 'R', 'X', 'Y', 'A'];
    else {
      let mapping = [4,5,2,3,1];
      try {
        const pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
        const chosen = Number(document.getElementById('pad-select')?.value);
        const pad = pads.find(p => p.index === chosen) || pads[0];
        const mappings = JSON.parse(localStorage.getItem('ocarina-gamepad-mappings') || '{}');
        const configured = pad && mappings[pad.id];
        if (Array.isArray(configured) && configured.length === 5 && configured.every(Number.isInteger)) mapping = configured;
      } catch (_) {}
      const ps = ['✕','○','□','△','L1','R1','L2','R2','Créer','Options','L3','R3','↑','↓','←','→','PS','Pavé'];
      labels = mapping.map(n => ps[n] || 'B' + (n + 1));
    }
    window.ocarinaSymbols.splice(0,5,...labels);
    panel.querySelector('#keyboard-settings').hidden = select.value !== 'keyboard';
    const key = select.value + labels.join('|');
    if (key === last) return;
    last = key;
    panel.querySelector('#display-keys').textContent = ['Ré','Fa','La','Si','Ré ↑'].map((note,i) => note + ' : ' + labels[i]).join(' · ');
    document.querySelectorAll('#note-lanes .lane-label').forEach((el,i) => { el.textContent = labels[i]; el.setAttribute('aria-label',labels[i]); el.style.fontSize = '23px'; });
    document.querySelectorAll('.note .symbol').forEach((el,i) => { el.textContent = labels[i]; });
    document.querySelectorAll('.note kbd').forEach((el,i) => { el.textContent = shortcuts[i].toUpperCase(); });
    document.querySelectorAll('.note').forEach((el,i) => { el.setAttribute('aria-label',labels[i] + ', clavier ' + shortcuts[i].toUpperCase()); });
  }
  fields.forEach((field,i) => field.onchange = () => {
    const key = field.value.toLowerCase();
    if (!/^[a-z0-9]$/.test(key) || shortcuts.some((k,j) => i !== j && k === key)) {
      field.value = shortcuts[i].toUpperCase();
      panel.querySelector('#display-keys').textContent = 'Choisissez une lettre ou un chiffre non utilisé.';
      return;
    }
    shortcuts[i] = key; field.value = key.toUpperCase(); save(); update();
  });
  select.onchange = () => { save(); update(); };
  update();
  setInterval(update,500);
}));

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('note-lanes')) return;
  const style = document.createElement('style');
  style.textContent = '#note-dialogue{display:none!important}#note-lanes{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:min(1100px,calc(100% - 160px));padding:16px 20px;border:2px solid #d8caa8;border-radius:24px;background:#17251ce8;color:#fff1ce;z-index:900;box-sizing:border-box;pointer-events:none}#note-lanes .lane-row{display:flex;align-items:center;gap:12px;height:46px}#note-lanes .lane-label{flex:0 0 38px;text-align:center;font:bold 28px Arial}#note-lanes .lane-track{position:relative;flex:1;min-width:0;height:44px;overflow:hidden;background:linear-gradient(transparent 49%,#d8caa840 49%,#d8caa840 51%,transparent 51%)}#note-lanes .lane-note{position:absolute;left:0;top:3px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:12px;background:#22392b;font:bold 26px Arial;will-change:transform}@media(max-width:600px){#note-lanes{width:calc(100% - 24px);bottom:82px;padding:12px}}';
  document.head.appendChild(style);
  const box = document.createElement('section');
  box.id = 'note-lanes';
  box.setAttribute('aria-label', 'Notes jouées sur cinq lignes, défilement continu');
  const symbols = window.ocarinaSymbols;
  const names = ['L', 'R', 'Carré', 'Triangle', 'Rond'];
  const colors = ['#e8dfc6', '#d7dfef', '#e5a0c9', '#9ed9b1', '#f1a08e'];
  const tracks = symbols.map((symbol, index) => {
    const row = document.createElement('div');
    row.className = 'lane-row';
    row.style.color = colors[index];
    const label = document.createElement('span');
    label.className = 'lane-label';
    label.textContent = symbol;
    label.setAttribute('aria-label', names[index]);
    const track = document.createElement('div');
    track.className = 'lane-track';
    track.setAttribute('aria-hidden', 'true');
    row.append(label, track);
    box.appendChild(row);
    return track;
  });
  document.body.appendChild(box);
  const original = input;
  input = function(index) {
    original(index);
    const track = tracks[index];
    if (!track) return;
    const chip = document.createElement('span');
    chip.className = 'lane-note';
    chip.textContent = symbols[index];
    track.appendChild(chip);
    const start = track.clientWidth + 8;
    const animation = chip.animate([{transform:'translateX(' + start + 'px)'}, {transform:'translateX(-48px)'}], {duration:(start + 48) / 0.25,easing:'linear',fill:'forwards'});
    animation.onfinish = animation.oncancel = () => chip.remove();
  };
});

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('scene-only');
  const style = document.createElement('style');
  style.textContent = `
    body.scene-only{min-height:100vh}
    .scene-only:not(.options-open) header,.scene-only:not(.options-open) main,
    .scene-only footer,.scene-only .eyebrow,.scene-only h1,.scene-only .intro,
    .scene-only .footnote,.scene-only .ocarina,.scene-only .keys,.scene-only .brand{display:none}
    .scene-only.options-open header{padding-right:150px;justify-content:flex-start}
    .scene-only.options-open main{padding-top:0}
    #options-toggle{position:fixed;top:20px;right:20px;z-index:1000;padding:12px 20px;border:1px solid #d8caa8;border-radius:24px;background:#17251cdd;color:#fff1ce;font:14px Arial;cursor:pointer}
  `;
  document.head.appendChild(style);
  const toggle = document.createElement('button');
  toggle.id = 'options-toggle';
  toggle.textContent = '⚙ Options';
  toggle.setAttribute('aria-expanded', 'false');
  function setOptions(open) {
    document.body.classList.toggle('options-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Fermer les options' : '⚙ Options';
    if (!open) toggle.focus();
  }
  toggle.onclick = () => {
    try { context(); } catch (_) {}
    setOptions(!document.body.classList.contains('options-open'));
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('options-open')) setOptions(false);
  });
  document.body.appendChild(toggle);
});

const frequencies = [587.33, 698.46, 880, 987.77, 1174.66];
const names = ['Ré', 'Fa', 'La', 'Si', 'Ré aigu'];
const shortcuts = ['l', 'r', 'q', 't', 'o'];
const buttons = [...document.querySelectorAll('.note')];
const status = document.querySelector('#status');
let audio;
const active = new Map();
function context() {
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
function playTap(index, duration = .48) {
  const ctx = context(), now = ctx.currentTime;
  const output = ctx.createGain();
  const volume = Number(document.querySelector('#volume').value) / 100;
  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(volume * .22, now + .035);
  output.gain.setValueAtTime(volume * .22, now + duration * .65);
  output.gain.linearRampToValueAtTime(0, now + duration);
  output.connect(ocarinaDestination(ctx));
  const instrument = createOcarinaVoice(ctx,frequencies[index],output,() => output.disconnect());
  instrument.stop(now + duration + .03);
  clearTimeout(active.get(index));
  buttons[index].classList.add('active');
  active.set(index, setTimeout(() => buttons[index].classList.remove('active'), 300));
  const floating = document.querySelector('#floating-note');
  floating.classList.remove('animate'); void floating.offsetWidth; floating.classList.add('animate');
}
function noteDialogue() {
  let box = document.getElementById('note-dialogue');
  if (box) return box;
  const style = document.createElement('style');
  style.textContent = '#note-dialogue{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);width:min(1000px,calc(100% - 160px));padding:18px 22px;border:2px solid #d8caa8;border-radius:24px;background:#17251ce8;color:#fff1ce;z-index:900;box-shadow:0 12px 40px #0006;pointer-events:none}#note-dialogue .caption{font:12px Arial;letter-spacing:2px;margin-bottom:12px}#note-dialogue .history{display:flex;justify-content:flex-end;gap:14px;overflow:hidden;min-height:72px;align-items:center}#note-dialogue .played{display:flex;align-items:center;justify-content:center;flex:0 0 64px;height:64px;border:1px solid currentColor;border-radius:16px;background:#ffffff10;font:bold 36px Arial}#note-dialogue .hint{font:15px Georgia;margin:auto;color:#dfd5b9}@media(max-width:600px){#note-dialogue{bottom:84px;width:calc(100% - 24px);padding:14px}#note-dialogue .played{flex-basis:50px;height:50px;font-size:28px}}';
  document.head.appendChild(style);
  box = document.createElement('section');
  box.id = 'note-dialogue';
  box.setAttribute('aria-label', 'Historique des touches jouées');
  box.innerHTML = '<div class="caption">VOTRE MÉLODIE</div><div class="history"><span class="hint">Jouez une note…</span></div>';
  document.body.appendChild(box);
  return box;
}
function showPlayedNote(index) {
  const history = noteDialogue().querySelector('.history');
  history.querySelector('.hint')?.remove();
  const positions = new Map(Array.from(history.children, item => [item, item.getBoundingClientRect().left]));
  const item = document.createElement('span');
  item.className = 'played';
  item.textContent = ['L', 'R', '□', '△', '○'][index];
  item.style.color = ['#e8dfc6', '#e8dfc6', '#e5a0c9', '#9ed9b1', '#f1a08e'][index];
  item.setAttribute('aria-label', ['L', 'R', 'Carré', 'Triangle', 'Rond'][index]);
  history.appendChild(item);
  while (history.children.length > 24) history.firstElementChild.remove();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  for (const previous of history.children) {
    if (previous === item) continue;
    const distance = positions.get(previous) - previous.getBoundingClientRect().left;
    previous.animate?.([{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }], { duration: 240, easing: 'ease-out' });
  }
  item.animate?.([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 240 });
}
document.addEventListener('DOMContentLoaded', noteDialogue);

function input(index) {
  play(index);
  showPlayedNote(index);
  status.textContent = `${names[index]} — laissez venir la prochaine note.`;
}
buttons.forEach((button, i) => button.addEventListener('click', () => input(i)));
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const index = shortcuts.indexOf(event.key.toLowerCase());
  if (index >= 0) { event.preventDefault(); input(index); }
});
// Keep the selected image on this device when browser storage permits it.
function applyBackground(url) {
  document.body.style.setProperty('--scene', `url("${url}")`);
  document.body.classList.add('has-background');
}
try {
  const saved = localStorage.getItem('ocarina-background');
  if (saved && /^data:image\/(png|jpeg|webp|gif);base64,/.test(saved)) applyBackground(saved);
} catch (_) { /* Storage can be unavailable for local files. */ }
document.querySelector('#background-file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    status.textContent = 'Choisissez une image PNG, JPG, WebP ou GIF.'; return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    applyBackground(reader.result);
    try { localStorage.setItem('ocarina-background', reader.result); }
    catch (_) { status.textContent = 'Fond appliqué pour cette session.'; }
  };
  reader.onerror = () => { status.textContent = 'Impossible de lire cette image. Réessayez.'; };
  reader.readAsDataURL(file);
});

document.addEventListener('ocarina-unlock-audio', () => context());
