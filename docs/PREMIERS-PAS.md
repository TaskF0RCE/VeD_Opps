# Premiers pas sur TaskF0RCE 👋

Ce guide est pour toute personne qui rejoint l'orga (**@klem844**, **@Paul55672**…). Compte 20 minutes.
Fini les versions qui circulent sur Discord : tout passe maintenant par GitHub, avec un tableau de bord pour piloter le tout.

## 1. Installer les outils (une fois)

1. Accepte l'invitation à l'orga [TaskF0RCE](https://github.com/TaskF0RCE) (mail ou cloche 🔔 sur GitHub).
2. Installe **[GitHub Desktop](https://desktop.github.com)** et connecte-toi avec ton compte GitHub.
   *Ou* **[VS Code](https://code.visualstudio.com)** : il gère Git tout seul (icône *Source Control*).
3. Optionnel : active la double authentification (2FA) sur ton compte GitHub (Settings → Password and authentication).

## 2. Te connecter au dashboard (une fois)

1. Ouvre **https://taskf0rce.github.io/VeD_Opps/**
2. Suis le guide affiché pour créer ton **token** :
   - *Resource owner* = **TaskF0RCE** ;
   - *All repositories* ;
   - les permissions listées.
3. Colle-le, c'est tout. Il reste dans ton navigateur uniquement.
   ⚠️ Ne le partage jamais (ni sur Discord, ni dans le code). Sur un PC partagé, clique sur **Déconnexion** en partant.

## 3. Faire le tour (5 minutes)

| Onglet | Ce que tu y vois |
| --- | --- |
| **Vue d'ensemble** | Tous nos projets : version actuelle, CI 🟢/🔴, PR et issues ouvertes. |
| **Pull requests** | En haut, **« À toi de reviewer »** : c'est ta to-do de review. |
| **Historique** | Toutes les versions publiées, avec leurs changements. |
| **Admin** | Les réglages communs. Pas besoin d'y toucher au quotidien. |

Le [kanban](https://github.com/orgs/TaskF0RCE/projects) montre qui fait quoi : À faire / En cours / En review / Fini.

## 4. Ta première contribution (10 minutes)

On s'entraîne sur un vrai projet avec une toute petite tâche, par exemple compléter le README.

1. **Dashboard → ＋ Nouvelle feature** → choisis le projet → type *Nouvelle fonctionnalité* → nom : `complète le README`.
   Ça crée l'issue, la branche `feature/complete-le-readme` et la PR.
2. **Clone** le projet si ce n'est pas déjà fait (GitHub Desktop : *File → Clone repository*).
3. **Change de branche** : GitHub Desktop → *Fetch origin* → *Current branch* → `feature/complete-le-readme`.
4. **Modifie** `README.md`, puis **commit** (« complète la section Démarrer ») et **Push origin**.
5. **Dashboard → Pull requests → Prête pour review**. Les autres membres reçoivent la demande.
6. Quand il a approuvé et que la CI est verte : **Merger**. 🎉
7. Reviens sur `main` et fais **Pull origin** pour repartir de la dernière version.

Tu viens de faire le cycle complet : **issue → branche → commit → PR → review → merge**.

## 5. Les 5 règles d'or

1. **Jamais de travail directement sur `main`.** Toujours une branche (`feature/…` ou `fix/…`).
2. **Une tâche = une branche = une PR.** Des petites PR se relisent vite.
3. **Le titre de la PR commence par un type** : `feat:`, `fix:`, `docs:`… C'est lui qui calcule la version.
4. **On review le code des autres**, avec bienveillance. Personne ne merge sans l'approbation d'un autre membre.
5. **Pull avant de commencer**, push souvent.

## 6. Quand tu bloques

- Le guide complet est dans le **`CONTRIBUTING.md`** de chaque projet : chaque étape y est expliquée en version dashboard, GitHub Desktop et VS Code, avec une FAQ (CI rouge, conflits, commit sur `main` par erreur…).
- Bouton « Merger » grisé ? Survole-le, il dit ce qui manque.
- Sinon : demande dans l'équipe, ou ouvre une issue avec le label `question`.

Bienvenue ! 🚀
