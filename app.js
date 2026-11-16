'use strict';
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
function play(index, duration = .48) {
  const ctx = context(), now = ctx.currentTime;
  const output = ctx.createGain();
  const volume = Number(document.querySelector('#volume').value) / 100;
  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(volume * .22, now + .035);
  output.gain.exponentialRampToValueAtTime(.001, now + duration);
  output.connect(ctx.destination);
  [1, 2, 3].forEach((harmonic, i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequencies[index] * harmonic;
    gain.gain.value = [1, .13, .035][i];
    oscillator.connect(gain).connect(output); oscillator.start(now); oscillator.stop(now + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
  setTimeout(() => output.disconnect(), (duration + .1) * 1000);
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
