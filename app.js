'use strict';
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
