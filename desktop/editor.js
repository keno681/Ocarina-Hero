const file = document.querySelector('#file'), code = document.querySelector('#code'), status = document.querySelector('#status');
let current = file.value, clean = '', busy = false;
async function load() { code.value = await window.editor.read(current); clean = code.value; }
function error(e) { status.textContent = `Erreur : ${e.message}`; }
file.onchange = async () => {
  if(busy || (code.value !== clean && !confirm('Abandonner les modifications non enregistrées ?'))) {file.value=current;return;}
  current=file.value;try{await load();status.textContent='';}catch(e){error(e);}
};
document.querySelector('#save').onclick = async () => {
  if(busy)return;busy=true;file.disabled=true;
  const snapshot=code.value;
  try{await window.editor.save(current,snapshot);clean=snapshot;status.textContent='Enregistré. Le jeu a été rechargé.';}catch(e){error(e);}finally{busy=false;file.disabled=false;}
};
document.querySelector('#restore').onclick = async () => {
  if(busy || !confirm('Remplacer ce fichier par la version fournie avec cette application ?'))return;
  busy=true;file.disabled=true;code.disabled=true;
  try{code.value=await window.editor.restore(current);clean=code.value;status.textContent='Original rétabli.';}catch(e){error(e);}finally{busy=false;file.disabled=false;code.disabled=false;}
};
window.addEventListener('beforeunload', event => {if(code.value !== clean){event.preventDefault();event.returnValue='';}});
load().catch(error);
