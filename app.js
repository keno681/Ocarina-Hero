'use strict';
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
function input(index) {
  play(index);
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
