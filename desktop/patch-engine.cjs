'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const allowed = ['index.html', 'style.css', 'app.js'];
const limit = 2_000_000;
class PatchEngine {
  constructor(root) { this.root = root; this.pending = null; }
  target(name) {
    if (!allowed.includes(name)) throw Error(`Fichier non autorisé : ${name}`);
    const target = path.join(this.root, name);
    if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) throw Error(`Fichier irrégulier : ${name}`);
    return target;
  }
  read(name) {
    const target = this.target(name);
    if (fs.statSync(target).size > limit) throw Error(`Fichier trop volumineux : ${name}`);
    return fs.readFileSync(target, 'utf8');
  }
  validate(name, text) {
    this.target(name);
    if (typeof text !== 'string' || Buffer.byteLength(text) > limit) throw Error(`Contenu invalide : ${name}`);
    if (name.endsWith('.js')) new vm.Script(text, { filename: name });
  }
  preview(raw) {
    this.pending = null;
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > limit) throw Error('Bloc trop volumineux.');
    const text = raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1');
    let patch;
    try { patch = JSON.parse(text); } catch (_) { throw Error('Collez le bloc JSON fourni dans la conversation, pas une demande en langage naturel.'); }
    if (!patch || !['ocarina-patch-v1', 'cosmowrap-patch-v1'].includes(patch.format) || !Array.isArray(patch.files) || !patch.files.length || patch.files.length > 30) throw Error('Bloc de modification non reconnu.');
    const before = {}, after = {};
    for (const operation of patch.files) {
      if (!operation || typeof operation.path !== 'string') throw Error('Chemin manquant.');
      const name = operation.path;
      this.target(name);
      if (!Object.hasOwn(before, name)) before[name] = after[name] = this.read(name);
      if (Object.hasOwn(operation, 'write')) after[name] = operation.write;
      else {
        if (typeof operation.old !== 'string' || !operation.old || typeof operation.new !== 'string') throw Error(`Remplacement incomplet : ${name}`);
        if (after[name].split(operation.old).length !== 2) throw Error(`Version différente : texte absent ou non unique dans ${name}. Aucun fichier modifié.`);
        after[name] = after[name].replace(operation.old, () => operation.new);
      }
      this.validate(name, after[name]);
    }
    this.pending = { title: String(patch.title || 'Modification du jeu').slice(0,120), before, after };
    return { title: this.pending.title, files: Object.keys(after).map(name => ({ name, before: before[name], after: after[name] })) };
  }
  unchanged(expected) {
    for (const [name, text] of Object.entries(expected)) if (this.read(name) !== text) throw Error(`Le fichier ${name} a changé. Refaire l’aperçu avant de continuer.`);
  }
  write(name, text) {
    const target = this.target(name), temp = target + '.patch-' + crypto.randomUUID();
    try { fs.writeFileSync(temp, text, { flag: 'wx' }); fs.renameSync(temp, target); }
    finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  transaction(before, after) {
    const changed = [];
    try { for (const [name, text] of Object.entries(after)) { this.write(name, text); changed.push(name); } }
    catch (error) {
      const failures = [];
      for (const name of changed.reverse()) { try { this.write(name, before[name]); } catch (_) { failures.push(name); } }
      throw Error(failures.length ? `Échec de restauration pour ${failures.join(', ')}. Récupérez la sauvegarde dans .console-backups.` : `Écriture refusée, fichiers restaurés : ${error.message}`);
    }
  }
  apply() {
    if (!this.pending) throw Error('Cliquez d’abord sur Aperçu.');
    const patch = this.pending;
    this.unchanged(patch.before);
    for (const [name, text] of Object.entries(patch.after)) this.validate(name, text);
    const folder = path.join(this.root, '.console-backups');
    fs.mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, Date.now() + '-' + crypto.randomUUID() + '.json');
    fs.writeFileSync(backup, JSON.stringify(patch), { flag: 'wx' });
    try { this.transaction(patch.before, patch.after); }
    catch (error) { fs.renameSync(backup, backup + '.rejected'); throw error; }
    this.pending = null;
    return patch.title;
  }
  undo() {
    const folder = path.join(this.root, '.console-backups');
    const latest = fs.existsSync(folder) && fs.readdirSync(folder).filter(name => name.endsWith('.json')).sort().pop();
    if (!latest) throw Error('Aucune modification à annuler.');
    const backup = path.join(folder, latest), patch = JSON.parse(fs.readFileSync(backup, 'utf8'));
    if (!patch.before || !patch.after || !Object.keys(patch.before).length || Object.keys(patch.before).sort().join() !== Object.keys(patch.after).sort().join()) throw Error('Sauvegarde invalide.');
    for (const [name, text] of Object.entries(patch.before)) this.validate(name, text);
    this.unchanged(patch.after);
    this.transaction(patch.after, patch.before);
    fs.renameSync(backup, backup + '.undone');
    this.pending = null;
    return patch.title;
  }
}
module.exports = { PatchEngine };
