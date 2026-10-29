import DOMPurify from 'dompurify'
import { useMemo, useState } from 'react'
import { useSession } from '../context'
import { fetchReleases } from '../github/queries'
import { formatDate, useAsync } from '../hooks'
import { Empty, ErrorBox, ExternalLink, Spinner } from '../components/ui'

// Les notes de release viennent de GitHub déjà converties en HTML ;
// on les nettoie quand même avant affichage (la page contient ton token).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer noopener')
  }
})
const clean = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })

export function History() {
  const { gh } = useSession()
  const releases = useAsync(() => fetchReleases(gh), [gh])
  const [repo, setRepo] = useState('')

  const repoNames = useMemo(() => [...new Set((releases.data ?? []).map((r) => r.repo))].sort(), [releases.data])
  const list = (releases.data ?? []).filter((r) => !repo || r.repo === repo)

  if (releases.loading && !releases.data) return <Spinner label="Chargement des releases…" />
  if (releases.error) return <ErrorBox message={releases.error} onRetry={releases.reload} />

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Historique</h1>
          <p className="muted">Les releases de tous les projets, de la plus récente à la plus ancienne, avec leur changelog.</p>
        </div>
        <div className="toolbar">
          <select value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="Filtrer par repo">
            <option value="">Tous les repos</option>
            {repoNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {repo && (
            <ExternalLink href={`${list[0]?.repoUrl}/blob/HEAD/CHANGELOG.md`}>
              <span className="btn">CHANGELOG.md</span>
            </ExternalLink>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>Aucune release pour l’instant. Utilise « Nouvelle release » une fois une première feature mergée.</Empty>
      ) : (
        <ol className="timeline">
          {list.map((release) => (
            <li key={`${release.repo}@${release.tagName}`} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-content">
                <div className="timeline-head">
                  <span className="repo-chip">{release.repo}</span>
                  <ExternalLink href={release.url}>
                    <span className="version">{release.tagName}</span>
                  </ExternalLink>
                  {release.isPrerelease && <span className="tag">pré-release</span>}
                  <span className="muted small">
                    {formatDate(release.publishedAt)}
                    {release.author && ` · par ${release.author}`}
                  </span>
                </div>
                {release.descriptionHTML ? (
                  <details>
                    <summary>Changelog</summary>
                    <div className="release-notes" dangerouslySetInnerHTML={{ __html: clean(release.descriptionHTML) }} />
                  </details>
                ) : (
                  <p className="muted small">Pas de notes.</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
