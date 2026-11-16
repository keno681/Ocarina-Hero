const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({TextDecoder});vm.runInContext(fs.readFileSync('app.js','utf8').split('// BEGIN MIDI SUPPORT')[1].split('// END MIDI SUPPORT')[0],ctx);const midi=ctx.ocarinaMidi;
const word=n=>[n>>8&255,n&255],long=n=>[n>>>24,n>>>16&255,n>>>8&255,n&255];
function vlq(n){const bytes=[n&127];while(n>>=7)bytes.unshift((n&127)|128);return bytes;}
const event=(delta,...bytes)=>[...vlq(delta),...bytes];
const end=event(0,255,47,0);
function file(tracks,format=tracks.length===1?0:1){return Uint8Array.from([...Buffer.from('MThd'),...long(6),...word(format),...word(tracks.length),...word(480),...tracks.flatMap(track=>[...Buffer.from('MTrk'),...long(track.length),...track])]);}
test('format 1 merges tempo changes from the conductor track',()=>{
 const tempo=[...event(0,255,81,3,7,161,32),...event(480,255,81,3,15,66,64),...end];
 const lead=[...event(0,255,3,4,...Buffer.from('Lead')),...event(0,144,74,90),...event(480,128,74,0),...event(0,144,77,90),...event(480,128,77,0),...end];
 const parsed=midi.parse(file([tempo,lead]));assert.equal(parsed.tracks.length,1);assert.match(parsed.tracks[0].name,/Lead/);
 const notes=parsed.tracks[0].notes;assert.equal(notes[0].end,500);assert.equal(notes[1].start,500);assert.equal(notes[1].end,1500);
 const song=midi.convert(parsed.tracks[0]);assert.equal(song.events[1].duration,1000);assert.ok(midi.validSong({...song,name:'Test'}));
});
test('running status, zero-velocity offs and sustain pedal retain durations',()=>{
 const track=[...event(0,144,74,90),...event(0,176,64,127),...event(240,144,74,0),...event(240,176,64,0),...event(0,144,77,90),...event(240,77,0),...end];
 const notes=midi.parse(file([track])).tracks[0].notes;assert.equal(notes[0].end,500);assert.equal(notes[1].end,750);
});
test('percussion is excluded and octave transposition maps to the five available pitches',()=>{
 const track=[...event(0,153,36,100),...event(0,144,62,90),...event(480,128,62,0),...event(0,144,65,90),...event(480,128,65,0),...event(0,137,36,0),...end];
 const parsed=midi.parse(file([track]));assert.equal(parsed.tracks.length,1);const song=midi.convert(parsed.tracks[0]);assert.equal(song.transpose,12);assert.deepEqual(Array.from(song.events,e=>e.note),[0,1]);assert.equal(song.approximated,0);
});
test('conversion simplifies chords and reports pitches that had to be approximated',()=>{
 const song=midi.convert({notes:[{pitch:74,start:0,end:500},{pitch:62,start:0,end:500},{pitch:78,start:500,end:1000}]});
 assert.equal(song.events.length,2);assert.ok(song.simplified>0);assert.ok(song.approximated>0);assert.equal(song.events[0].time,0);
});
test('truncated, invalid running status, type 2 and empty MIDI fail with clear errors',()=>{
 assert.throws(()=>midi.parse(Uint8Array.of(1,2,3)),/tronqué/);
 assert.throws(()=>midi.parse(file([[...event(0,74,90),...end]])),/statut/);
 assert.throws(()=>midi.parse(file([[...end]],2)),/type 2/);
 assert.throws(()=>midi.parse(file([[...end]])),/Aucune note/);
 const broken=file([[...event(0,144,74,90),...end]]);assert.throws(()=>midi.parse(broken.slice(0,-1)),/tronqué/);
 assert.equal(midi.validSong({name:'Bad',events:[{note:8,time:0,duration:100}]}),false);
});

test('repeated notes remain articulated even when their sustain durations overlap',()=>{
 const song=midi.convert({notes:[{pitch:74,start:0,end:800},{pitch:74,start:500,end:1000}]});
 assert.equal(song.events.length,2);assert.equal(song.events[0].duration,500);assert.equal(song.events[1].time,500);
});
