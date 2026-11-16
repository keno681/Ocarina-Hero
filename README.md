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
