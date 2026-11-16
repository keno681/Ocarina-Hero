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

## Bulle des touches (version 0.3.3)

Une grande bulle en bas affiche L, R, carré, triangle et rond. Chaque nouvelle note arrive à droite et décale les précédentes vers la gauche. Le clavier, les clics et les manettes partagent cet historique, limité aux 24 dernières notes. Les animations respectent la préférence de réduction des mouvements. Le patch `patches/bulle-touches.json` permet la mise à jour dans la Pokéball.

## Cinq lignes (version 0.3.4)

La bulle affiche cinq lignes horizontales : L, R, carré, triangle et rond. Chaque note jouée traverse sa ligne à vitesse constante (250 pixels/seconde), puis disparaît à gauche, même sans autre appui. Les libellés restent fixes à gauche. L’ancien historique est masqué ; le clavier, la manette et les options restent actifs. Patch Pokéball : `patches/cinq-lignes.json`.

## Affichage des touches (version 0.4.0)

Dans Options, choisir PS5, N64, Clavier ou Switch. Le choix reste enregistré sur ce PC. Les sons et les associations manette restent inchangés. Les notes déjà en mouvement gardent le symbole affiché au moment de l’appui. Les libellés des lignes et les nouvelles notes suivent le mode choisi.

- N64 : Ré=A, Fa=C↓, La=C→, Si=C←, Ré aigu=C↑, selon l’ocarina de N64.
- PS5 : affiche les boutons correspondant à l’association de la manette sélectionnée dans le réglage manette (L1, R1, carré, triangle et rond par défaut). Les boutons non identifiés sont numérotés.
- Clavier : affiche les cinq raccourcis effectifs et permet de les changer (lettres ou chiffres uniques).
- Switch : Ré=L, Fa=R, La=X, Si=Y, Ré aigu=A. Ce choix est visuel : utiliser « Associer les touches » pour modifier les boutons physiques.

Le patch `patches/affichage-touches.json` s’applique après le patch des cinq lignes.

Les lignes sont affichées du plus aigu au plus grave, de haut en bas : Ré aigu, Si, La, Fa, Ré. Les associations aux touches restent inchangées. Patch : `patches/ordre-hauteur.json`.

## Aura jaune

À chaque note, la touche fixe s’illumine en jaune et se réduit légèrement pendant 90 ms, sans transition. Un nouvel appui sur la même touche renouvelle cet effet. La note défilante reçoit aussi un bref éclat. Clavier et manette partagent cet effet. Patch : `patches/aura-jaune.json`.

## Association manette par note

Dans Options, sélectionner la manette puis cliquer sur le bouton face à Ré grave, Fa, La, Si ou Ré aigu. Relâcher puis appuyer sur le bouton physique voulu. Le réglage est appliqué immédiatement et conservé par modèle de manette. Un bouton déjà utilisé échange ses deux notes pour conserver cinq associations distinctes. Annuler, déconnecter la manette ou quitter la fenêtre annule la capture. L’association ne joue pas de note.

Le patch `patches/manette-par-note.json` fonctionne avec les anciennes versions du module manette : il remplace sa lecture des notes sans nécessiter un nouvel exécutable. Les clics physiques et le clavier restent disponibles.

## Libre et Test (version 0.5.0)

Une barre jaune lumineuse marque le point d’appui sur les cinq lignes. Options → Mode de jeu permet de choisir Libre ou Test. Libre conserve le fonctionnement habituel. Test propose huit notes aléatoires : fermer Options puis cliquer sur « Lancer le test ». Appuyer sur la bonne touche lorsque le centre de la note atteint la barre. Parfait : ±90 ms, 100 points ; Bien : ±180 ms, 60 points ; un appui hors timing ou incorrect retire 10 points sans passer sous zéro. Les notes manquées sont comptabilisées. Le test se termine après les huit notes et peut être rejoué.

Ouvrir Options, quitter la fenêtre ou redimensionner le jeu interrompt la partie afin de préserver le timing. Le mode choisi est conservé, mais aucune partie ne démarre automatiquement. Les boutons conservent les associations et le mode d’affichage choisis. Patch : `patches/mode-test.json`.

## Barre continue et retour de réussite

La barre lumineuse traverse les cinq lignes et se situe à 22 % de la piste, après les libellés. Le timing est recalculé pour cette position. Chaque réussite déclenche un flash de 180 ms sur la barre et une vibration de 70 ms si le navigateur, le pilote et la manette prennent en charge les vibrations. La position de la barre suit les dimensions du panneau. Patch : `patches/barre-continue-retour.json`.

## Réparation des installations ayant accumulé des doublons

`patches/reparation-app-barre.json` remplace entièrement `app.js` par la version nettoyée comprenant un seul mode Test, la barre continue à 22 % de la piste et le retour de réussite. Ce bloc évite les remplacements ambigus des anciennes installations ayant empilé plusieurs copies du mode Test. Il conserve les préférences et associations stockées dans le navigateur et ne modifie ni `index.html` ni `style.css`. Il remplace les modifications de code locales éventuelles d’`app.js` ; la console sauvegarde la version précédente et permet l’annulation.

## Appuis dans la zone jaune

En mode Test, les appuis ne jouent un son et ne déclenchent le retour visuel que si une note de la bonne ligne chevauche effectivement la barre jaune. Les appuis avant l’entrée, après la sortie, sur une mauvaise touche ou en dehors d’une partie active sont ignorés sans pénalité. Une note déjà réussie ne peut pas être rejouée. Le mode Libre reste inchangé. Patch : `patches/test-zone-obligatoire.json`.

## Pénalité sur appui inutile

En mode Test actif, une mauvaise touche ou un appui hors de la zone rend la barre noire et bloque tous les appuis pendant 400 ms, sans modifier le score. Le défilement continue. Les appuis pendant le blocage ne prolongent pas sa durée. La barre redevient jaune ensuite. Relancer le test, changer de mode ou interrompre la partie réinitialise le blocage. Le mode Libre reste inchangé. Patch : `patches/penalite-appui.json`.

## Choix du mode sur l’écran principal

Deux boutons Libre et Test sont affichés à gauche du jeu. Le mode actif est surligné en jaune. Ils remplacent le choix du mode dans Options et conservent la mémorisation et l’arrêt de la partie lors d’un changement de mode. Le bouton Lancer le test reste dans la bulle. Patch : `patches/modes-a-gauche.json`.

## Appuis prolongés (version 0.6.0)

Clavier, manette et souris/tactile prennent en charge le maintien : le son et l’aura restent actifs jusqu’au relâchement. En Libre, une traînée représente la durée de l’appui. Plusieurs notes peuvent être tenues ensemble. Les sons s’arrêtent au relâchement, à la perte de focus, à la déconnexion d’une manette ou à l’ouverture des options. Le volume reste réglable pendant une note.

En Test, certaines notes ont une traînée de 900 ms. Attraper leur tête dans la zone jaune, puis maintenir jusqu’au bout de la traînée. La réussite est comptée à la fin (tolérance de relâchement de 90 ms) ; une coupure prématurée fait rater la note. Une pénalité interrompt les notes en cours. Le choix du mode, les associations, le son et les effets visuels existants sont conservés.

`patches/appuis-prolonges.json` est un remplacement complet d’app.js pour éviter les ambiguïtés des anciens correctifs. Il conserve les paramètres stockés sur le PC ; la console sauvegarde l’ancien code avant application.

## Timbre d’ocarina (version 0.6.1)

Le moteur conserve une fondamentale dominante avec des harmoniques plus discrètes, une attaque légèrement soufflée, une courte montée vers la hauteur juste et un vibrato léger qui apparaît progressivement sur les notes tenues. Un bruit filtré simule l’air et une réponse de pièce de 180 ms ajoute une résonance discrète. Les sons courts et prolongés utilisent le même instrument. Les ressources audio sont générées localement et mises en cache par contexte : aucune connexion ni échantillon externe n’est nécessaire. Ce son reste une synthèse, pas un enregistrement d’ocarina.

Validation : rendu réel des cinq notes par OfflineAudioContext dans Chromium, hauteurs contrôlées, pas d’écrêtage au niveau testé et extinction complète ; tests de maintien, relâchement et nettoyage des sources. Patch : `patches/son-ocarina.json` (remplacement complet d’app.js avec conservation des préférences enregistrées).
