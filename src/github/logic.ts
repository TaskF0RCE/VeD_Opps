// Règles du dashboard sans appel réseau : faciles à lire et testées dans logic.test.ts.

export type CiState = 'success' | 'failure' | 'pending' | 'none'

export interface RunLite {
  workflow_id: number
  status: string | null
  conclusion: string | null
  created_at: string
}

const OK_CONCLUSIONS = new Set(['success', 'skipped', 'neutral'])

// État de la CI d'un commit : on garde le dernier run de chaque workflow,
// puis rouge si un seul échoue, en cours si un seul tourne encore.
export function ciState(runs: RunLite[]): CiState {
  const latest = new Map<number, RunLite>()
  for (const run of runs) {
    const previous = latest.get(run.workflow_id)
    if (!previous || run.created_at > previous.created_at) latest.set(run.workflow_id, run)
  }
  if (latest.size === 0) return 'none'
  let pending = false
  for (const run of latest.values()) {
    if (run.status !== 'completed') pending = true
    else if (!OK_CONCLUSIONS.has(run.conclusion ?? '')) return 'failure'
  }
  return pending ? 'pending' : 'success'
}

export const CONVENTIONAL_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert',
] as const

// Même règle que le workflow pr-title du repo .github.
const CONVENTIONAL_RE = new RegExp(
  `^(${CONVENTIONAL_TYPES.join('|')})(\\([A-Za-z0-9._/ -]+\\))?!?: [^ ].*$`,
)

export function isConventionalTitle(title: string) {
  return CONVENTIONAL_RE.test(title)
}

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
}

export type WorkKind = 'feature' | 'fix'

export function namesFor(kind: WorkKind, name: string) {
  const clean = name.trim()
  return kind === 'feature'
    ? { branch: `feature/${slugify(clean)}`, prTitle: `feat: ${clean}`, label: 'feature' }
    : { branch: `fix/${slugify(clean)}`, prTitle: `fix: ${clean}`, label: 'bug' }
}

// Noms de repo acceptés par GitHub.
export function isValidRepoName(name: string) {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== '.' && name !== '..'
}

export interface ReviewLite {
  author: string | null
  state: string
}

export function reviewSummary(reviews: ReviewLite[], prAuthor: string | null) {
  const approvedBy: string[] = []
  const changesRequestedBy: string[] = []
  for (const review of reviews) {
    if (!review.author || review.author === prAuthor) continue
    if (review.state === 'APPROVED') approvedBy.push(review.author)
    if (review.state === 'CHANGES_REQUESTED') changesRequestedBy.push(review.author)
  }
  return { approvedBy, changesRequestedBy }
}

export interface MergeInput {
  title: string
  isDraft: boolean
  labels: string[]
  mergeable: string
  ci: CiState
  approvedBy: string[]
  changesRequestedBy: string[]
}

// Le bouton "Merger" n'est actif que si cette liste est vide.
export function mergeBlockers(pr: MergeInput, wipLabel: string): string[] {
  const reasons: string[] = []
  if (pr.isDraft) reasons.push("C'est encore un brouillon")
  if (pr.labels.includes(wipLabel)) reasons.push(`Marquée « ${wipLabel} »`)
  if (pr.mergeable === 'CONFLICTING') reasons.push('Conflit avec main à résoudre')
  if (pr.ci === 'failure') reasons.push('CI rouge')
  if (pr.ci === 'pending') reasons.push('CI en cours')
  if (pr.ci === 'none') reasons.push("La CI n'a pas tourné")
  if (pr.changesRequestedBy.length > 0)
    reasons.push(`Modifications demandées par ${pr.changesRequestedBy.join(', ')}`)
  else if (pr.approvedBy.length === 0) reasons.push('Pas encore approuvée')
  if (!isConventionalTitle(pr.title)) reasons.push('Titre non conforme (ex : « feat: ajoute la connexion »)')
  return reasons
}
