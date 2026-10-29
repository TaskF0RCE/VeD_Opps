import { useState } from 'react'
import { LABELS_FILE, ORG, ORG_CONFIG_REPO, PROJECT_TITLE, STATUS } from '../config'
import { useSession } from '../context'
import { applyRepoSettings, applyRuleset, fetchLabelDefs, syncLabels } from '../github/admin'
import { errorMessage, mapLimit } from '../github/client'
import { findKanban, syncKanban } from '../github/kanban'
import { useAsync } from '../hooks'
import { TokenGuide } from '../components/TokenGuide'
import { ExternalLink, LogBox } from '../components/ui'

type Job = 'labels' | 'settings' | 'ruleset' | 'kanban' | 'all'

export function Admin() {
  const { gh, repos } = useSession()
  const kanban = useAsync(() => findKanban(gh), [gh])
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState<Job | null>(null)

  const targets = (repos.data ?? []).filter((r) => !r.isArchived).map((r) => r.name)
  const log = (line: string) => setLines((l) => [...l, line])

  async function run(job: Job) {
    setLines([])
    setRunning(job)
    try {
      if (job === 'labels' || job === 'all') {
        log(`— Labels (source : ${ORG_CONFIG_REPO}/${LABELS_FILE})`)
        const defs = await fetchLabelDefs(gh)
        await mapLimit(targets, 3, (repo) => syncLabels(gh, repo, defs, log))
      }
      if (job === 'settings' || job === 'all') {
        log('— Options de merge et permissions Actions')
        await mapLimit(targets, 3, (repo) => applyRepoSettings(gh, repo, log))
      }
      if (job === 'ruleset' || job === 'all') {
        log('— Protection de main')
        await mapLimit(targets, 3, (repo) => applyRuleset(gh, repo, log))
      }
      if (job === 'kanban' || job === 'all') {
        log('— Kanban')
        const board = await findKanban(gh)
        if (!board) log(`⚠ Kanban « ${PROJECT_TITLE} » introuvable : crée-le d’abord (voir ci-dessous).`)
        else await syncKanban(gh, board, targets, log)
      }
      log('Terminé.')
    } catch (e) {
      log(`✗ ${errorMessage(e)}`)
    } finally {
      setRunning(null)
      repos.reload()
    }
  }

  const button = (job: Job, label: string, primary = false) => (
    <button className={`btn${primary ? ' btn-primary' : ''}`} disabled={running !== null || targets.length === 0} onClick={() => run(job)}>
      {running === job ? 'En cours…' : label}
    </button>
  )

  const missingColumns = kanban.data
    ? (Object.keys(STATUS) as (keyof typeof STATUS)[]).filter((k) => !kanban.data?.options[k]).map((k) => STATUS[k])
    : []

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">
            Applique les mêmes règles aux {targets.length} repos actifs de {ORG}. Tu peux relancer sans risque : rien n’est supprimé.
          </p>
        </div>
      </div>

      <div className="admin-grid">
        <article className="card">
          <h2>Labels</h2>
          <p className="muted small">
            Crée ou corrige les labels standards (bug, feature, docs, priorités…) définis dans{' '}
            <ExternalLink href={`https://github.com/${ORG}/${ORG_CONFIG_REPO}/blob/main/${LABELS_FILE}`}>
              {ORG_CONFIG_REPO}/{LABELS_FILE}
            </ExternalLink>
            .
          </p>
          {button('labels', 'Synchroniser les labels')}
        </article>
        <article className="card">
          <h2>Options de merge</h2>
          <p className="muted small">
            Squash merge uniquement (le titre de la PR devient le commit), branche supprimée après merge, Actions autorisé à ouvrir la PR de
            release.
          </p>
          {button('settings', 'Appliquer les options')}
        </article>
        <article className="card">
          <h2>Protection de main</h2>
          <p className="muted small">
            PR obligatoire, 1 approbation, CI verte, pas de push direct ni forcé. Sur le plan gratuit, GitHub ne l’applique qu’aux repos{' '}
            <b>publics</b> : pour les repos privés, c’est le dashboard qui bloque le merge.
          </p>
          {button('ruleset', 'Protéger main')}
        </article>
        <article className="card">
          <h2>Kanban</h2>
          {kanban.loading ? (
            <p className="muted small">Recherche…</p>
          ) : kanban.data ? (
            <p className="muted small">
              ✓ <ExternalLink href={kanban.data.url}>{PROJECT_TITLE}</ExternalLink> trouvé.
              {missingColumns.length > 0 && <span className="text-danger"> Colonnes manquantes : {missingColumns.join(', ')}.</span>}
            </p>
          ) : (
            <p className="muted small text-danger">
              « {PROJECT_TITLE} » introuvable{kanban.error ? ` (${kanban.error})` : ''}. Crée-le en suivant le{' '}
              <ExternalLink href={`https://github.com/${ORG}/${ORG_CONFIG_REPO}#kanban`}>README du repo {ORG_CONFIG_REPO}</ExternalLink>.
            </p>
          )}
          <p className="muted small">Ajoute au kanban toutes les issues et PR ouvertes qui n’y sont pas encore.</p>
          {button('kanban', 'Synchroniser le kanban')}
        </article>
      </div>

      <div className="stack admin-run">
        {button('all', 'Tout synchroniser', true)}
        <LogBox lines={lines} />
      </div>

      <details className="card">
        <summary>Créer un nouveau token</summary>
        <TokenGuide />
      </details>
    </section>
  )
}
