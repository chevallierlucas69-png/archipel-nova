# Protocole Nova Online v1

Le service écoute localement sur `http://127.0.0.1:8765`. Les comptes utilisent
un cookie de session `HttpOnly`, valable sept jours. Toutes les routes de
matchmaking et de création de salon exigent une session Nova valide.

## API HTTP

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/status` | État du service, joueurs, files et parties |
| `GET` | `/api/account` | Compte de la session courante |
| `POST` | `/api/register` | Crée un compte `{ username, password }` |
| `POST` | `/api/login` | Ouvre une session `{ username, password }` |
| `POST` | `/api/logout` | Ferme la session |
| `GET` | `/api/lobbies` | Liste les salons publics |
| `POST` | `/api/lobbies` | Crée un salon `{ name, mode }` |
| `POST` | `/api/lobbies/:id/join` | Rejoint un salon |
| `POST` | `/api/matchmaking/join` | Rejoint une file `{ mode }` |
| `POST` | `/api/matchmaking/leave` | Quitte toutes les files |

Les modes reconnus sont `solo`, `creative` et `box`. Les réponses sont en JSON.
Une erreur utilise `{ "error": "description" }` avec le statut HTTP adapté.

## WebSocket

Connexion : `ws://127.0.0.1:8765/ws`. Le navigateur transmet automatiquement
le cookie de session. Une connexion non authentifiée reçoit `401`.

Messages serveur :

- `hello` : version du protocole et profil courant ;
- `presence` : liste et nombre de joueurs connectés ;
- `queue.updated` : mode et nombre de joueurs en attente ;
- `match.found` : identifiant, mode, joueurs et adresse du serveur de partie ;
- `lobby.created` / `lobby.updated` : état public d’un salon ;
- `error` : message rejeté.

Message client pris en charge : `{ "type": "ping" }`, réponse `pong`.

## Matchmaking local

Deux joueurs dans la même file déclenchent immédiatement une partie. Pour
conserver le jeu local jouable avec un seul utilisateur, une file solitaire
démarre après 2,5 secondes. La simulation de combat reste exécutée par
`game3d.js`; le service gère l’identité, la présence, les salons et l’allocation
de partie. Une future simulation multijoueur autoritaire pourra réutiliser
l’identifiant `match.id`.
