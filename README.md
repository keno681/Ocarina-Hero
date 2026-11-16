# Ocarina Hero

Petit jeu web d’ocarina, en français, sans dépendance ni compilation.

## Lancer

Depuis le dépôt :

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Ouvrir le port 8000 dans un navigateur. Cliquer sur les boutons ou utiliser **L, R, Q (carré), T (triangle), O (rond)**. Le navigateur active l’audio après une interaction. Le volume se règle dans l’instrument.

Les cinq touches permettent de jouer librement. Les sons sont synthétisés avec Web Audio, sans fichier audio externe. Les manettes sont prises en charge par l’API Gamepad.

## Fond personnalisé

Cliquer sur « Choisir le fond » et sélectionner une image PNG, JPG, WebP ou GIF. Le fond est conservé dans ce navigateur si son stockage le permet.

## Application Windows et éditeur

Installer les dépendances avec `npm ci`, lancer avec `npm start` et créer l’exécutable portable Windows avec `npm run dist:win -- --publish never`.

La Pokéball en bas à droite ouvre un éditeur pour `index.html`, `style.css` et `app.js`. Le bouton **Valider et redémarrer le jeu** enregistre le fichier ouvert et recharge le jeu. Les fichiers modifiables sont copiés au premier lancement dans le dossier de données utilisateur de l’application (`%APPDATA%/ocarina-hero/game` sous Windows). Chaque enregistrement conserve une copie `.bak`. Le bouton « Rétablir l’original » restaure la version fournie avec l’application. Les modifications locales sont conservées aux lancements suivants ; elles ne sont pas synchronisées avec GitHub et ne sont pas écrasées par les nouvelles versions de l’exécutable. Pour adopter un nouveau fichier fourni avec l’application, utiliser « Rétablir l’original » après avoir sauvegardé ses changements.

Le workflow **Application Windows** construit le `.exe` à chaque envoi sur `main`. Une fois le workflow réussi, télécharger l’archive **Ocarina-Hero-Windows** dans les artefacts du lancement GitHub Actions, puis la décompresser. Cette version n’est pas signée.

## Manettes (version 0.2.0)

Les manettes exposées par Windows et Chromium sont détectées automatiquement après un appui sur un bouton. USB et Bluetooth sont pris en charge si le pilote expose une manette compatible. Le jeu ne peut pas scanner les périphériques qui ne sont pas exposés par le système comme manettes (MIDI, microphones, etc.).

Les manettes au mapping standard utilisent les boutons 4, 5, 2, 3, 1 : L1/LB, R1/RB, carré/X, triangle/Y et rond/B. Plusieurs manettes peuvent jouer. Cliquer sur **Activer le son** si nécessaire. Un appui joue une note ; maintenir le bouton ne répète pas la note.

**Associer les touches** permet de sélectionner une manette et d’appuyer successivement sur cinq boutons distincts pour L, R, carré, triangle et rond. Les associations sont conservées dans ce navigateur quand le stockage est disponible. Une manette non standard doit être associée avant de jouer. Le jeu ignore les entrées manette lorsque sa fenêtre n’a pas le focus.

La version Windows charge cette prise en charge même avec les anciens fichiers locaux du jeu, sans écraser les modifications de l’éditeur. Le test physique des différents modèles reste à faire sur le PC utilisateur.

## Console Pokéball (version 0.3.0)

Le fonctionnement reprend celui du [jeu des wraps](https://github.com/keno681/essai) :

1. Ouvrir la Pokéball dans le coin du jeu.
2. Coller le bloc JSON de modification fourni dans notre conversation.
3. Cliquer sur **Aperçu des modifications** et consulter les fichiers avant/après.
4. Cliquer sur **Valider et redémarrer le jeu**.
5. Utiliser **Annuler la dernière modification** si nécessaire.

La console conserve aussi un éditeur avancé replié. Les fichiers restent sur ce PC ; les envois sur GitHub sont faits séparément pendant notre conversation. Pas de connexion à un assistant, pas d’abonnement et pas de synchronisation automatique.

Le format `ocarina-patch-v1` contient un titre et une liste `files`. Chaque opération vise `index.html`, `style.css` ou `app.js` et utilise soit `old`/`new` (une seule correspondance exacte), soit `write` (contenu complet). Le nom de format `cosmowrap-patch-v1` est aussi accepté, mais les blocs propres au jeu des wraps (.gd, scènes Godot…) ne sont pas applicables à Ocarina Hero. Les chemins arbitraires, créations et suppressions de fichiers ne sont pas pris en charge. Voir `patches/exemple-couleur.json` pour un exemple utilisable puis annulable.

L’aperçu ne modifie rien. La syntaxe JavaScript est vérifiée sans exécuter le code. Une sauvegarde complète des fichiers concernés est écrite dans `game/.console-backups` avant l’application ; en cas d’échec d’écriture, la console tente de restaurer les fichiers déjà écrits. L’application et l’annulation sont refusées si les fichiers ont changé depuis leur état attendu. Les tests ne garantissent pas qu’un patch est exempt de bogues de jeu : l’annulation permet de revenir à l’état précédent.

Le moteur reste Electron : nous reprenons la console de blocs de modification, sans convertir le jeu en Godot. Les blocs exécutent du code du jeu ; appliquer seulement les modifications dont on connaît la provenance.

## Fond de Link (version 0.3.1)

La capture fournie par l’utilisateur est intégrée sans retouche, en WebP sans perte, à ses dimensions originales (3840 × 1654). Les nouvelles installations disposent de l’image en local. Pour une installation existante avec la console Pokéball, `patches/fond-link.json` active le fond en chargeant cette même image depuis GitHub : une connexion Internet est alors nécessaire. Le bouton « Choisir le fond » reste disponible ; un fond personnalisé déjà enregistré prend priorité sur le fond par défaut.

## Image seule (version 0.3.2)

L’interface est masquée au lancement pour laisser le fond visible. Le bouton Options ouvre les réglages (fond, volume et manettes). Le bouton de fermeture ou Échap les masque. Le clavier et les manettes continuent à jouer lorsque les réglages sont fermés. La Pokéball reste disponible. Le patch `patches/interface-options.json` applique ce changement à une installation existante.
