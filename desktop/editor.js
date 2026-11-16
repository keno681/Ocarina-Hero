const file = document.querySelector('#file'), code = document.querySelector('#code'), status = document.querySelector('#status');
const patch = document.querySelector('#patch'), apply = document.querySelector('#apply'), preview = document.querySelector('#preview');
let current = file.value, clean = '', busy = false, ready = false;
async function load() { code.value = await window.editor.read(current); clean = code.value; }
function error(e) { status.textContent = `Refusé : ${e.message}`; }
function invalidate() { ready = false; apply.disabled = true; preview.replaceChildren(); }
async function run(action) {
  if (busy) return;
  busy = true;
  for (const element of document.querySelectorAll('button, select, textarea')) element.disabled = true;
  try { await action(); } catch (e) { invalidate(); error(e); }
  finally {
    busy = false;
    for (const element of document.querySelectorAll('button, select, textarea')) element.disabled = false;
    apply.disabled = !ready;
  }
}
patch.oninput = invalidate;
document.querySelector('#inspect').onclick = () => run(async () => {
  invalidate();
  const result = await window.editor.preview(patch.value);
  for (const item of result.files) {
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = item.name;
    const before = document.createElement('pre'), after = document.createElement('pre');
    before.textContent = 'AVANT\n' + item.before; after.textContent = 'APRÈS\n' + item.after;
    details.append(summary, before, after); preview.append(details);
  }
  ready = true;
  status.textContent = `PRÊT · ${result.title}\nFichiers : ${result.files.map(f => f.name).join(', ')}. Ouvrez chaque fichier pour comparer avant et après.`;
});
apply.onclick = () => {
  if (!ready || (code.value !== clean && !confirm('Abandonner le brouillon de l’éditeur avancé ?'))) return;
  run(async () => { const title = await window.editor.apply(); invalidate(); await load(); status.textContent = `APPLIQUÉ · ${title}\nFichiers sauvegardés. Le jeu a redémarré.`; });
};
document.querySelector('#undo').onclick = () => {
  if (!confirm('Annuler la dernière modification appliquée par la console ? Les fichiers changés depuis seront protégés.')) return;
  if (code.value !== clean && !confirm('Abandonner le brouillon de l’éditeur avancé ?')) return;
  run(async () => { const title = await window.editor.undo(); invalidate(); await load(); status.textContent = `ANNULÉ · ${title}\nLe jeu a redémarré.`; });
};
file.onchange = async () => {
  if(busy || (code.value !== clean && !confirm('Abandonner les modifications non enregistrées ?'))) {file.value=current;return;}
  current=file.value;try{await load();}catch(e){error(e);}
};
document.querySelector('#save').onclick = () => run(async () => {
  await window.editor.save(current,code.value);clean=code.value;invalidate();status.textContent='Fichier enregistré. Le jeu a redémarré.';
});
document.querySelector('#restore').onclick = () => {
  if (!confirm('Remplacer ce fichier par la version fournie avec cette application ?')) return;
  run(async () => { code.value=await window.editor.restore(current);clean=code.value;invalidate();status.textContent='Original rétabli.'; });
};
window.addEventListener('beforeunload', event => {if(code.value !== clean){event.preventDefault();event.returnValue='';}});
load().catch(error);
