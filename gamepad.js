(function (root) {
  'use strict';
  const defaults = [4, 5, 2, 3, 1]; // LB, RB, X, Y, B / L1, R1, carré, triangle, rond
  function edges(pads, previous, mappings) {
    const next = new Map(), notes = [];
    for (const pad of pads) {
      if (!pad || pad.connected === false) continue;
      const pressed = pad.buttons.map(button => button.pressed || button.value > .5);
      const old = previous.get(pad.index) || [];
      const mapping = mappings[pad.id] || (pad.mapping === 'standard' ? defaults : null);
      if (mapping) mapping.forEach((button, note) => {
        if (pressed[button] && !old[button]) notes.push(note);
      });
      next.set(pad.index, pressed);
    }
    return { next, notes };
  }
  if (typeof module === 'object' && module.exports) { module.exports = { edges, defaults }; return; }
  if (root.ocarinaGamepads) return;
  root.ocarinaGamepads = true;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Manettes');
  panel.style.cssText = 'margin:20px auto 0;max-width:650px;padding:14px;border:1px solid #93a18a;border-radius:12px;background:#f5f3e9;color:#263d39;font:12px Arial;text-align:left';
  panel.innerHTML = '<div id="pad-status" role="status" aria-live="polite"></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><select id="pad-select" aria-label="Manette" style="max-width:100%;flex:1"></select><button id="pad-scan">Rechercher les manettes</button><button id="pad-config">Associer les touches</button><button id="pad-cancel" hidden>Annuler</button><button id="pad-audio">Activer le son</button></div><p id="pad-help" style="line-height:1.5;margin-bottom:0">Branchez une manette USB ou connectez-la en Bluetooth dans Windows, puis appuyez sur un bouton. L/L1/LB · R/R1/RB · □/X · △/Y · ○/B.</p>';
  (document.querySelector('.instrument') || document.body).appendChild(panel);
  const find = id => panel.querySelector('#' + id);
  let previous = new Map(), signature = '', mappings = {}, capture = null;
  const labels = ['L', 'R', 'carré □', 'triangle △', 'rond ○'];
  try { mappings = JSON.parse(localStorage.getItem('ocarina-gamepad-mappings') || '{}'); } catch (_) {}
  if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) mappings = {};
  for (const id of Object.keys(mappings)) {
    if (!Array.isArray(mappings[id]) || mappings[id].length !== 5 || !mappings[id].every(n => Number.isInteger(n) && n >= 0 && n < 128)) delete mappings[id];
  }
  find('pad-audio').onclick = () => {
    // A real mouse/keyboard gesture unlocks Web Audio. Do not play an unwanted note.
    document.dispatchEvent(new Event('ocarina-unlock-audio'));
    find('pad-help').textContent = 'Son activé. Appuyez sur les touches de votre manette pour jouer.';
  };
  find('pad-config').onclick = () => {
    const pad = Array.from(navigator.getGamepads?.() || []).find(p => p && p.index === Number(find('pad-select').value));
    if (!pad) return;
    capture = { index: pad.index, id: pad.id, buttons: [] };
    find('pad-cancel').hidden = false;
    find('pad-help').textContent = 'Appuyez sur le bouton à associer à L.';
  };
  find('pad-cancel').onclick = () => {
    capture = null; find('pad-cancel').hidden = true;
    find('pad-help').textContent = 'Association annulée. Les réglages précédents sont conservés.';
  };
  function diagnostics() {
    const api = typeof navigator.getGamepads === 'function';
    find('pad-help').textContent = `API manette : ${api ? 'disponible' : 'indisponible'} · Fenêtre : ${document.hasFocus() ? 'active' : 'inactive'} · Application : 0.2.1. Cliquez dans le jeu puis appuyez sur un bouton de la manette. Si elle reste absente, faites Windows + R, tapez joy.cpl et vérifiez qu’elle apparaît et que ses boutons réagissent.`;
  }
  find('pad-scan').onclick = () => { signature = ''; previous.clear(); diagnostics(); };
  root.addEventListener('gamepadconnected', () => { signature = ''; });
  root.addEventListener('gamepaddisconnected', () => { signature = ''; });
  function poll() {
    try {
    if (typeof navigator.getGamepads !== 'function') {
      find('pad-status').textContent = 'Cette application ne fournit pas l’accès aux manettes.';
      return;
    }
    let pads;
    try { pads = Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected !== false); }
    catch (error) { find('pad-status').textContent = `Accès aux manettes refusé (${error.name}). Cliquez sur Rechercher les manettes pour afficher le diagnostic.`; return; }
    const key = pads.map(p => `${p.index}:${p.id}:${p.mapping}`).join('|');
    if (key !== signature || !find('pad-status').textContent) {
      signature = key;
      const selected = find('pad-select').value;
      find('pad-select').replaceChildren();
      for (const pad of pads) {
        const option = document.createElement('option'); option.value = pad.index; option.textContent = pad.id;
        find('pad-select').appendChild(option);
      }
      if (pads.some(p => String(p.index) === selected)) find('pad-select').value = selected;
      find('pad-config').disabled = !pads.length;
      find('pad-status').textContent = pads.length ? `${pads.length} manette(s) détectée(s). ${pads.some(p => p.mapping !== 'standard' && !mappings[p.id]) ? 'Associez les touches des modèles non standard.' : 'Touches appliquées.'}` : 'Aucune manette détectée. Appuyez sur un bouton de la manette pour la détecter.';
    }
    const result = edges(pads, previous, mappings);
    if (capture) {
      const pad = pads.find(p => p.index === capture.index && p.id === capture.id);
      if (!pad) find('pad-cancel').click();
      else {
        const old = previous.get(pad.index) || [];
        const pressed = pad.buttons.findIndex((b, i) => (b.pressed || b.value > .5) && !old[i]);
        if (pressed >= 0 && !capture.buttons.includes(pressed)) {
          capture.buttons.push(pressed);
          if (capture.buttons.length === 5) {
            mappings[capture.id] = capture.buttons;
            let saved = true;
            try { localStorage.setItem('ocarina-gamepad-mappings', JSON.stringify(mappings)); } catch (_) { saved = false; }
            capture = null; find('pad-cancel').hidden = true; signature = '';
            find('pad-help').textContent = saved ? 'Touches enregistrées sur ce PC.' : 'Touches appliquées pour cette session.';
          } else find('pad-help').textContent = `Relâchez, puis appuyez sur le bouton à associer à ${labels[capture.buttons.length]}.`;
        }
      }
    } else if (document.hasFocus()) {
      const notes = document.querySelectorAll('.note');
      for (const note of result.notes) notes[note]?.click();
    }
    previous = result.next;
    } catch (error) {
      find('pad-status').textContent = `Lecture interrompue (${error.name}). Nouvelle tentative automatique…`;
    } finally {
      root.requestAnimationFrame(poll);
    }
  }
  root.requestAnimationFrame(poll);
})(globalThis);
