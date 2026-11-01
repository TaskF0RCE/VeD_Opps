import { useState } from 'react'
import { TEAM, WIP_LABEL, sameLogin } from '../config'
import { useSession } from '../context'
import { approvePullRequest, markReadyForReview, mergePullRequest } from '../github/actions'
import { errorMessage } from '../github/client'
import { mergeBlockers } from '../github/logic'
import { type PullRequest, fetchPullRequests } from '../github/queries'
import { type PageProps, timeAgo, useAsync } from '../hooks'
import { CiBadge, Empty, ErrorBox, ExternalLink, Spinner } from '../components/ui'

const isWip = (pr: PullRequest) => pr.isDraft || pr.labels.includes(WIP_LABEL)

// Qui doit reviewer : les personnes demandées, sinon les autres membres de l'équipe.
function reviewersOf(pr: PullRequest) {
  if (pr.requestedReviewers.length > 0) return pr.requestedReviewers
  return TEAM.filter((login) => !sameLogin(login, pr.author) && !pr.approvedBy.some((a) => sameLogin(a, login)))
}

// Les PR qui attendent la review de `login`. Une seule approbation suffit :
// dès qu'un membre a approuvé, la PR ne réclame plus la relecture des autres.
function awaitingReviewFrom(prs: PullRequest[], login: string) {
  return prs.filter(
    (pr) =>
      !isWip(pr) &&
      pr.approvedBy.length === 0 &&
      !sameLogin(pr.author, login) &&
      reviewersOf(pr).some((r) => sameLogin(r, login)),
  )
}

export function PullRequests({ params }: PageProps) {
  const { gh, viewer, repos, notify } = useSession()
  const repoFilter = params.get('repo') ?? ''
  const prs = useAsync(() => fetchPullRequests(gh), [gh])
  const [busy, setBusy] = useState<string | null>(null)

  async function act(pr: PullRequest, label: string, action: () => Promise<void>) {
    setBusy(pr.id)
    try {
      await action()
      notify(`${label} : ${pr.repo}#${pr.number}`)
      prs.reload()
      repos.reload()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (prs.loading && !prs.data) return <Spinner label="Chargement des pull requests…" />
  if (prs.error) return <ErrorBox message={prs.error} onRetry={prs.reload} />

  const all = (prs.data ?? []).filter((pr) => !repoFilter || pr.repo === repoFilter)
  const repoNames = [...new Set((prs.data ?? []).map((pr) => pr.repo))].sort()
  const me = viewer.login
  const toReview = awaitingReviewFrom(all, me)
  const mine = all.filter((pr) => pr.author === me)
  const others = all.filter((pr) => !toReview.includes(pr) && !mine.includes(pr))

  const renderPr = (pr: PullRequest) => {
    const blockers = mergeBlockers(pr, WIP_LABEL)
    const isMine = pr.author === me
    const working = busy === pr.id
    return (
      <li key={pr.id} className="pr">
        <div className="pr-main">
          <div className="pr-title">
            <span className="repo-chip">{pr.repo}</span>
            <ExternalLink href={pr.url}>
              <b>{pr.title}</b> <span className="muted">#{pr.number}</span>
            </ExternalLink>
          </div>
          <div className="pr-meta muted small">
            {pr.authorAvatar && <img className="avatar" src={pr.authorAvatar} alt="" width={18} height={18} />}
            {pr.author ?? 'inconnu'} · <code>{pr.headRefName}</code> → <code>{pr.baseRefName}</code> · mise à jour {timeAgo(pr.updatedAt)}
          </div>
          <div className="pr-badges">
            {isWip(pr) && <span className="badge badge-neutral">{pr.isDraft ? 'Brouillon' : WIP_LABEL}</span>}
            <CiBadge state={pr.ci} />
            {pr.approvedBy.length > 0 && <span className="badge ci-success">✓ Approuvée par {pr.approvedBy.join(', ')}</span>}
            {pr.changesRequestedBy.length > 0 && (
              <span className="badge ci-failure">Modifs demandées par {pr.changesRequestedBy.join(', ')}</span>
            )}
            {pr.staleApprovals.length > 0 && pr.approvedBy.length === 0 && (
              <span className="badge ci-pending">↻ À réapprouver ({pr.staleApprovals.join(', ')})</span>
            )}
            {!isWip(pr) && pr.approvedBy.length === 0 && (
              <span className="badge badge-neutral">👀 Review : {reviewersOf(pr).join(', ') || 'personne'}</span>
            )}
            {pr.mergeable === 'CONFLICTING' && <span className="badge ci-failure">Conflit</span>}
          </div>
          {blockers.length > 0 && !isWip(pr) && <p className="muted small">Merge bloqué : {blockers.join(' · ')}</p>}
        </div>
        <div className="pr-actions">
          {isMine && isWip(pr) && (
            <button className="btn" disabled={working} onClick={() => act(pr, 'Prête pour review', () => markReadyForReview(gh, pr))}>
              Prête pour review
            </button>
          )}
          {!isMine && (
            <button
              className="btn"
              disabled={working || isWip(pr) || pr.approvedBy.includes(me)}
              title={pr.approvedBy.includes(me) ? 'Tu as déjà approuvé' : isWip(pr) ? 'Pas encore prête' : undefined}
              onClick={() => act(pr, 'Approuvée', () => approvePullRequest(gh, pr))}
            >
              {pr.approvedBy.includes(me) ? '✓ Approuvée' : 'Approuver'}
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled={working || blockers.length > 0}
            title={blockers.length > 0 ? blockers.join('\n') : 'Squash merge dans main'}
            onClick={() =>
              window.confirm(`Merger « ${pr.title} » dans ${pr.baseRefName} (${pr.repo}) ?`) &&
              act(pr, 'Mergée', () => mergePullRequest(gh, pr))
            }
          >
            Merger
          </button>
        </div>
      </li>
    )
  }

  const group = (title: string, list: PullRequest[], hint: string) => (
    <section className="pr-group">
      <h2>
        {title} <span className="count">{list.length}</span>
      </h2>
      {list.length === 0 ? <Empty>{hint}</Empty> : <ul className="pr-list">{list.map(renderPr)}</ul>}
    </section>
  )

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Pull requests</h1>
          <p className="muted">
            {all.length} PR ouvertes{repoFilter ? ` dans ${repoFilter}` : ' dans l’orga'}. « Merger » s’active quand la CI est verte et la
            PR approuvée.
          </p>
        </div>
        <div className="toolbar">
          <select
            value={repoFilter}
            aria-label="Filtrer par repo"
            onChange={(e) => (window.location.hash = e.target.value ? `#/pr?repo=${encodeURIComponent(e.target.value)}` : '#/pr')}
          >
            <option value="">Tous les repos</option>
            {repoNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={prs.reload} disabled={prs.loading}>
            {prs.loading ? '…' : '↻ Actualiser'}
          </button>
        </div>
      </div>
      <div className="reviewers" aria-label="Qui doit reviewer quoi">
        {TEAM.map((login) => {
          const count = awaitingReviewFrom(all, login).length
          return (
            <span key={login} className={`reviewer${count > 0 ? ' reviewer-busy' : ''}`}>
              👀 <b>{sameLogin(login, me) ? 'toi' : login}</b> : {count === 0 ? 'rien à reviewer' : `${count} PR à reviewer`}
            </span>
          )
        })}
      </div>
      {group('À toi de reviewer', toReview, 'Rien à reviewer 🎉')}
      {group('Tes PR', mine, 'Aucune PR ouverte. Lance-toi avec « Nouvelle feature ».')}
      {group('Les autres', others, 'Rien ici.')}
    </section>
  )
}
