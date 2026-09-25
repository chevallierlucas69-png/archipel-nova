# Archipel Nova — Battle Royale 3D local

Archipel Nova est un jeu 3D original jouable localement dans le navigateur. Il comprend un lobby, des comptes sécurisés, Nova Online, des salons, du matchmaking, une boutique fictive, un Bus Nova, plusieurs biomes et POI, des combats, du loot, une tempête, de la construction et un mode créatif.

## Lancement sous Windows

1. Installer Node.js 18 ou plus récent.
2. Double-cliquer sur `Lancer le jeu.bat`.
3. Le launcher vérifie les fichiers, démarre le serveur local et ouvre le jeu.

Le serveur écoute uniquement sur `127.0.0.1`. Three.js est inclus dans le dossier `vendor` : aucune connexion Internet n’est nécessaire pour charger le moteur 3D.

Les comptes, mots de passe hachés et sessions restent dans `.nova-data`. Ce dossier n’est jamais exposé par le serveur web.

Le protocole HTTP/WebSocket de Nova Online est documenté dans
[`PROTOCOL.md`](PROTOCOL.md).

## Lancement manuel

```powershell
node server.js 8765
```

Ouvrir ensuite `http://127.0.0.1:8765/index.html`.

## Contrôles

- `ZQSD`, `WASD` ou flèches : se déplacer
- Souris : regarder autour de soi
- Maj : sprinter
- Espace : sauter ou quitter le Bus Nova
- Clic gauche : tirer ou construire
- Clic droit : quitter le mode construction
- `E` : ouvrir un coffre
- `R` : recharger ou tourner une construction
- `1` à `4` : armes
- Souris 4 / 5 : sélectionner les constructions
- `M` : afficher la carte tactique
- Échap : ouvrir le menu de pause

## Contenu actuel

- Lobby cinématique et personnage Gardien Nova
- Boutique de 12 apparences et packs de Gemmes en mode démonstration
- Compte local avec session de sept jours
- Présence temps réel par WebSocket
- Salons publics et matchmaking Solo, Arène et Box PVP
- Modes Solo Nova et Créatif
- Bus Nova, planeur et phase d’atterrissage
- Mini-carte, carte tactique, boussole, vie, bouclier et inventaire
- 16 adversaires avec plusieurs apparences
- Fusil, pompe, pistolet et fusil de précision
- Coffres, munitions, soins et boucliers
- Construction en bois, pierre ou métal
- Tempête progressive et écran de résultats
- POI : Nova City, Tour Nova, Port Aurore, Citadelle Nova, Ferme Solaire, Temple Ancien, Cratère Nova, Île du Phare et Lagon Bleu

La monnaie et les achats sont entièrement fictifs. Aucun paiement réel n’est réalisé.

## Vérifications

```powershell
node --check game3d.js
node --check server.js
node tools/server-audit.mjs 8765
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\launcher-gui.ps1 -SelfTest
```

Le dernier test vérifie le launcher complet sans ouvrir de fenêtre : fichiers, installation de Node.js, port local, démarrage du serveur et réponse du jeu. L’audit navigateur automatisé utilise Chrome en mode débogage et se trouve dans `tools/browser-audit.mjs`.
