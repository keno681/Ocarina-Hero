# Ocarina Hero

Petit jeu web d’ocarina, en français, sans dépendance ni compilation.

## Lancer

Depuis le dépôt :

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Ouvrir le port 8000 dans un navigateur. Cliquer sur les boutons ou utiliser **L, R, Q (carré), T (triangle), O (rond)**. Le navigateur active l’audio après une interaction. Le volume se règle dans l’instrument.

Les cinq touches permettent de jouer librement. Les sons sont synthétisés avec Web Audio, sans fichier audio externe. Aucune prise en charge de manette physique n’est encore implémentée.

## Fond personnalisé

Cliquer sur « Choisir le fond » et sélectionner une image PNG, JPG, WebP ou GIF. Le fond est conservé dans ce navigateur si son stockage le permet.

## Application Windows et éditeur

Installer les dépendances avec `npm ci`, lancer avec `npm start` et créer l’exécutable portable Windows avec `npm run dist:win -- --publish never`.

La Pokéball en bas à droite ouvre un éditeur pour `index.html`, `style.css` et `app.js`. Le bouton **Valider et redémarrer le jeu** enregistre le fichier ouvert et recharge le jeu. Les fichiers modifiables sont copiés au premier lancement dans le dossier de données utilisateur de l’application (`%APPDATA%/ocarina-hero/game` sous Windows). Chaque enregistrement conserve une copie `.bak`. Le bouton « Rétablir l’original » restaure la version fournie avec l’application. Les modifications locales sont conservées aux lancements suivants ; elles ne sont pas synchronisées avec GitHub et ne sont pas écrasées par les nouvelles versions de l’exécutable. Pour adopter un nouveau fichier fourni avec l’application, utiliser « Rétablir l’original » après avoir sauvegardé ses changements.

Le workflow **Application Windows** construit le `.exe` à chaque envoi sur `main`. Une fois le workflow réussi, télécharger l’archive **Ocarina-Hero-Windows** dans les artefacts du lancement GitHub Actions, puis la décompresser. Cette version n’est pas signée.
