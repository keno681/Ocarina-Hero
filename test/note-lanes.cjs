const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('each note uses its own lane, moves independently and is removed on finish',()=>{
 const nodes=[],events={},played=[];
 function element(){const el={children:[],style:{},clientWidth:500,setAttribute(){},append(...items){for(const item of items)this.appendChild(item);},appendChild(item){item.parent=this;this.children.push(item);},remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);},animate(frames,options){this.animation={frames,options};return this.animation;}};nodes.push(el);return el;}
 const document={head:element(),body:element(),getElementById:id=>nodes.find(n=>n.id===id),createElement:element,addEventListener:(name,handler)=>events[name]=handler};
 const patch=JSON.parse(fs.readFileSync('patches/cinq-lignes.json','utf8'));
 const ctx=vm.createContext({document,input:index=>played.push(index)});
 vm.runInContext(patch.files[0].new,ctx);events.DOMContentLoaded();
 const rows=document.getElementById('note-lanes').children;
 assert.equal(rows.length,5);
 for(let i=0;i<5;i++){
  ctx.input(i);const track=rows[i].children[1],chip=track.children[0];
  assert.equal(chip.textContent,['L','R','□','△','○'][i]);
  assert.equal(chip.animation.options.easing,'linear');
  assert.equal(chip.animation.options.duration,2224);
  assert.match(chip.animation.frames[1].transform,/-48px/);
  // Completion requires no additional input.
  chip.animation.onfinish();assert.equal(track.children.length,0);
 }
 assert.deepEqual(played,[0,1,2,3,4]);
 events.DOMContentLoaded();assert.equal(document.body.children.length,1);
});
