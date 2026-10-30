// Réglages du dashboard. C'est le seul fichier à modifier si l'orga ou l'équipe change.

export const ORG = 'TaskF0RCE'

// Les membres de l'équipe : chacun review le code de l'autre.
export const TEAM = ['snakeify', 'klem844']

// Repo dont chaque nouveau projet est une copie (marqué "Template repository").
export const TEMPLATE_REPO = 'project-template'

// Repo spécial de l'orga : templates par défaut, workflows réutilisables, labels.json.
export const ORG_CONFIG_REPO = '.github'
export const LABELS_FILE = 'labels.json'

// Workflows du template, déclenchés par les boutons du dashboard.
export const RELEASE_WORKFLOW = 'release.yml'
export const CI_WORKFLOW_FILE = '.github/workflows/ci.yml'

// Nom du check CI exigé pour merger (job "ci" du repo qui appelle le job "build" réutilisable).
export const REQUIRED_CHECK = 'ci / build'

// Le kanban de l'orga (GitHub Project) et les noms des colonnes de son champ "Status".
export const PROJECT_TITLE = 'Kanban TaskF0RCE'
export const STATUS = {
  todo: 'À faire',
  doing: 'En cours',
  review: 'En review',
  done: 'Fini',
} as const

// Nom du ruleset qui protège la branche principale de chaque repo.
export const RULESET_NAME = 'Protection de main'

// Label posé sur une PR "en cours" quand le repo ne permet pas les PR brouillon
// (repos privés sur le plan gratuit).
export const WIP_LABEL = 'en cours'
