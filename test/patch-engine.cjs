const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PatchEngine}=require('../desktop/patch-engine.cjs');
function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ocarina-patch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'app.js'),'const note = 1;');fs.writeFileSync(path.join(root,'style.css'),'body { color: red; }');return {engine:new PatchEngine(root),root};}
function patch(files){return JSON.stringify({format:'ocarina-patch-v1',title:'Test',files});}
test('preview does not write; multi-file apply and undo survive restart',t=>{
 const {engine,root}=setup(t);
 const raw=patch([{path:'app.js',old:'1',new:'2'},{path:'style.css',old:'red',new:'green'}]);
 assert.equal(engine.preview('```json\n'+raw+'\n```').files.length,2);
 assert.equal(fs.readFileSync(path.join(root,'app.js'),'utf8'),'const note = 1;');
 engine.apply();assert.equal(fs.readFileSync(path.join(root,'app.js'),'utf8'),'const note = 2;');
 new PatchEngine(root).undo();assert.equal(fs.readFileSync(path.join(root,'app.js'),'utf8'),'const note = 1;');
 assert.throws(()=>engine.undo(),/Aucune/);
});
test('reject forbidden paths, ambiguous replacements and invalid JavaScript',t=>{
 const {engine}=setup(t);
 for(const name of ['../app.js','desktop/main.cjs','gamepad.js','C:/bad']) assert.throws(()=>engine.preview(patch([{path:name,write:'bad'}])),/autorisé/);
 assert.throws(()=>engine.preview(patch([{path:'app.js',old:'absent',new:'x'}])),/Version différente/);
 assert.throws(()=>engine.preview(patch([{path:'app.js',write:'const = ;'}])),SyntaxError);
 assert.throws(()=>engine.apply(),/Aperçu/);
});
test('changed files block apply and undo without losing edits',t=>{
 const {engine,root}=setup(t),target=path.join(root,'app.js');
 engine.preview(patch([{path:'app.js',old:'1',new:'2'}]));
 fs.writeFileSync(target,'const note = 3;');assert.throws(()=>engine.apply(),/changé/);
 engine.preview(patch([{path:'app.js',old:'3',new:'4'}]));engine.apply();
 fs.writeFileSync(target,'const note = 5;');assert.throws(()=>engine.undo(),/changé/);
 assert.equal(fs.readFileSync(target,'utf8'),'const note = 5;');
});
test('a failed second write restores the first file',t=>{
 const {engine,root}=setup(t);
 engine.preview(patch([{path:'app.js',old:'1',new:'2'},{path:'style.css',old:'red',new:'green'}]));
 const write=engine.write.bind(engine);engine.write=(name,text)=>{if(name==='style.css')throw Error('Disk failure');write(name,text);};
 assert.throws(()=>engine.apply(),/restaurés/);
 assert.equal(fs.readFileSync(path.join(root,'app.js'),'utf8'),'const note = 1;');
});
test('replacement preserves literal dollar signs',t=>{
 const {engine,root}=setup(t);
 engine.preview(patch([{path:'app.js',old:'const note = 1;',new:'const note = "$&";'}]));engine.apply();
 assert.equal(fs.readFileSync(path.join(root,'app.js'),'utf8'),'const note = "$&";');
});
