# VeD Opps

Le tableau de bord de l'organisation [TaskF0RCE](https://github.com/TaskF0RCE) :
tous les repos, leur version, leur CI, les pull requests et les releases au même endroit.

👉 **https://taskf0rce.github.io/VeD_Opps/**

## Ce qu'on peut faire

| Onglet / bouton | À quoi ça sert |
| --- | --- |
| **Vue d'ensemble** | Chaque repo avec sa dernière version, sa CI (verte/rouge), ses PR et issues ouvertes. |
| **Pull requests** | Toutes les PR de l'orga : qui doit reviewer quoi, boutons *Approuver*, *Prête pour review* et *Merger* (actif seulement si CI verte + approuvée). |
| **Historique** | La timeline des releases de tous les projets, avec le changelog. |
| **Admin** | Synchronise labels, options de merge, protection de `main` et kanban sur tous les repos. |
| **＋ Nouvelle feature** | Crée d'un coup l'issue, la branche `feature/…` (ou `fix/…`) et la PR liée. |
| **🏷 Nouvelle release** | Lance release-please : il ouvre une PR de release avec la version calculée et le CHANGELOG. |
| **📁 Nouveau projet** | Crée un repo depuis [`project-template`](https://github.com/TaskF0RCE/project-template) et applique les réglages de l'orga. |

## Connexion

Chacun colle son **fine-grained personal access token**. Le guide pas à pas est sur la page de connexion.
Le token est gardé uniquement dans le `localStorage` de ton navigateur et n'est envoyé qu'à `api.github.com` :
il n'est jamais commité ni stocké ailleurs. Le bouton **Déconnexion** l'efface.

## Développer le dashboard

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests des règles (CI, merge, noms de branches)
npm run build    # vérifie les types puis construit dist/
```

- Stack : Vite + React + TypeScript + [Octokit](https://github.com/octokit/rest.js), sans bibliothèque d'UI.
- `src/config.ts` : nom de l'orga, membres de l'équipe, noms des colonnes du kanban. **C'est le seul fichier à modifier si l'équipe change.**
- `src/github/` : tous les appels à l'API GitHub (`queries.ts` lit, `actions.ts` et `admin.ts` écrivent).
- `src/pages/` : un fichier par onglet.

Le workflow `.github/workflows/dashboard.yml` vérifie chaque PR et publie le site à chaque merge dans `main`.
