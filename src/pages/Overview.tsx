import { useState } from 'react'
import { ORG } from '../config'
import { useSession } from '../context'
import { formatDate, timeAgo } from '../hooks'
import { CiBadge, Empty, ErrorBox, ExternalLink, Spinner } from '../components/ui'

export function Overview() {
  const { repos } = useSession()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  if (repos.loading && !repos.data) return <Spinner label="Chargement des repos…" />
  if (repos.error) return <ErrorBox message={repos.error} onRetry={repos.reload} />

  const list = (repos.data ?? []).filter(
    (r) => (showArchived || !r.isArchived) && `${r.name} ${r.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )
  const totals = (repos.data ?? []).reduce(
    (t, r) => ({ prs: t.prs + r.openPRs, issues: t.issues + r.openIssues, red: t.red + (r.ci === 'failure' ? 1 : 0) }),
    { prs: 0, issues: 0, red: 0 },
  )

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Vue d’ensemble</h1>
          <p className="muted">
            {repos.data?.length ?? 0} repos · {totals.prs} PR ouvertes · {totals.issues} issues ouvertes
            {totals.red > 0 && <span className="text-danger"> · {totals.red} CI rouge(s)</span>}
          </p>
        </div>
        <div className="toolbar">
          <input type="search" placeholder="Rechercher un repo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="checkbox small">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archivés
          </label>
          <button className="btn" onClick={repos.reload} disabled={repos.loading}>
            {repos.loading ? '…' : '↻ Actualiser'}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>Aucun repo. Crée le premier avec « Nouveau projet ».</Empty>
      ) : (
        <div className="grid">
          {list.map((repo) => (
            <article key={repo.name} className={`card${repo.isArchived ? ' card-muted' : ''}`}>
              <header className="card-head">
                <ExternalLink href={repo.url}>
                  <h2>{repo.name}</h2>
                </ExternalLink>
                <div className="tags">
                  {repo.isTemplate && <span className="tag">template</span>}
                  {repo.isArchived && <span className="tag">archivé</span>}
                  <span className="tag">{repo.isPrivate ? '🔒 privé' : 'public'}</span>
                </div>
              </header>
              <p className="muted card-desc">{repo.description || 'Pas de description.'}</p>
              <dl className="stats">
                <div>
                  <dt>Version</dt>
                  <dd>
                    {repo.latestRelease ? (
                      <ExternalLink href={repo.latestRelease.url}>
                        <span className="version">{repo.latestRelease.tagName}</span>
                      </ExternalLink>
                    ) : (
                      <span className="muted">aucune</span>
                    )}
                    {repo.latestRelease && <small className="muted"> {formatDate(repo.latestRelease.publishedAt)}</small>}
                  </dd>
                </div>
                <div>
                  <dt>CI ({repo.defaultBranch ?? '—'})</dt>
                  <dd>
                    <ExternalLink href={`${repo.url}/actions`}>
                      <CiBadge state={repo.ci} />
                    </ExternalLink>
                  </dd>
                </div>
                <div>
                  <dt>PR</dt>
                  <dd>
                    <a href="#/pr">{repo.openPRs}</a>
                  </dd>
                </div>
                <div>
                  <dt>Issues</dt>
                  <dd>
                    <ExternalLink href={`${repo.url}/issues`}>{repo.openIssues}</ExternalLink>
                  </dd>
                </div>
              </dl>
              <footer className="card-foot muted small">Dernier push {timeAgo(repo.pushedAt)}</footer>
            </article>
          ))}
        </div>
      )}
      <p className="muted small">
        Tous les repos de <ExternalLink href={`https://github.com/${ORG}`}>{ORG}</ExternalLink> que ton token peut voir.
      </p>
    </section>
  )
}
