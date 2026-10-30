import { type FormEvent, useState } from 'react'
import { ORG, TEMPLATE_REPO } from '../config'
import { activeRepos, useSession } from '../context'
import { type FeatureResult, startFeature, triggerRelease } from '../github/actions'
import { createProject } from '../github/admin'
import { errorMessage } from '../github/client'
import { type WorkKind, isValidRepoName, namesFor } from '../github/logic'
import { ErrorBox, ExternalLink, LogBox, Modal } from './ui'

function RepoSelect({ value, onChange }: { value: string; onChange: (repo: string) => void }) {
  const { repos } = useSession()
  const list = activeRepos(repos.data)
  return (
    <>
      <label htmlFor="repo">Projet</label>
      <select id="repo" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          {list.length ? 'Choisis un repo…' : 'Aucun projet pour l’instant'}
        </option>
        {list.map((r) => (
          <option key={r.name} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
    </>
  )
}

function useRunner() {
  const [lines, setLines] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  async function run<T>(task: (log: (line: string) => void) => Promise<T>): Promise<T | undefined> {
    setLines([])
    setError(null)
    setRunning(true)
    try {
      return await task((line) => setLines((l) => [...l, line]))
    } catch (e) {
      setError(errorMessage(e))
      return undefined
    } finally {
      setRunning(false)
    }
  }
  return { lines, error, running, run }
}

export function NewFeatureDialog({ onClose }: { onClose: () => void }) {
  const { gh, viewer, repos } = useSession()
  const [repo, setRepo] = useState('')
  const [kind, setKind] = useState<WorkKind>('feature')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<FeatureResult>()
  const { lines, error, running, run } = useRunner()
  const preview = name.trim() ? namesFor(kind, name) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    const done = await run((log) => startFeature(gh, { repo, kind, name, description, me: viewer.login }, log))
    if (done) {
      setResult(done)
      repos.reload()
    }
  }

  return (
    <Modal title="Nouvelle feature" onClose={onClose}>
      {!result ? (
        <form className="stack" onSubmit={submit}>
          <RepoSelect value={repo} onChange={setRepo} />
          <fieldset className="segmented">
            <legend>Type</legend>
            <label>
              <input type="radio" checked={kind === 'feature'} onChange={() => setKind('feature')} /> Nouvelle fonctionnalité
            </label>
            <label>
              <input type="radio" checked={kind === 'fix'} onChange={() => setKind('fix')} /> Correction de bug
            </label>
          </fieldset>
          <label htmlFor="feature-name">Nom</label>
          <input
            id="feature-name"
            required
            maxLength={80}
            placeholder="ex : page de connexion"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="feature-desc">Description (optionnel)</label>
          <textarea id="feature-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {preview && (
            <p className="muted small">
              Branche <code>{preview.branch}</code> · PR « {preview.prTitle} » · label <code>{preview.label}</code>
            </p>
          )}
          <LogBox lines={lines} />
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary" disabled={running || !repo || !name.trim()}>
            {running ? 'Création…' : 'Créer issue + branche + PR'}
          </button>
        </form>
      ) : (
        <div className="stack">
          <LogBox lines={lines} />
          <p>
            C’est parti ! <ExternalLink href={result.issueUrl}>Voir l’issue</ExternalLink> ·{' '}
            <ExternalLink href={result.prUrl}>Voir la PR</ExternalLink>
          </p>
          <h3>Pour coder dessus</h3>
          <p>
            <b>GitHub Desktop</b> : Fetch origin, puis Current branch → <code>{result.branch}</code>.
            <br />
            <b>VS Code</b> : clique sur le nom de branche en bas à gauche → <code>origin/{result.branch}</code>.
            <br />
            <b>Terminal</b> :
          </p>
          <pre>
            <code>git fetch{'\n'}git switch {result.branch}</code>
          </pre>
          <p className="muted small">
            Quand c’est prêt, clique sur « Prête pour review » dans l’onglet Pull requests.
            {!result.draft && ' (Repo privé en plan gratuit : la PR porte le label « en cours » au lieu d’être en brouillon.)'}
          </p>
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      )}
    </Modal>
  )
}

export function NewReleaseDialog({ onClose }: { onClose: () => void }) {
  const { gh } = useSession()
  const [repo, setRepo] = useState('')
  const [actionsUrl, setActionsUrl] = useState<string>()
  const { error, running, run } = useRunner()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const url = await run(() => triggerRelease(gh, repo))
    if (url) setActionsUrl(url)
  }

  return (
    <Modal title="Nouvelle release" onClose={onClose}>
      {!actionsUrl ? (
        <form className="stack" onSubmit={submit}>
          <RepoSelect value={repo} onChange={setRepo} />
          <div className="callout">
            <p>La version est calculée automatiquement à partir des titres des PR mergées depuis la dernière release :</p>
            <ul>
              <li>
                <code>fix: …</code> → correctif (0.1.0 → 0.1.1)
              </li>
              <li>
                <code>feat: …</code> → nouvelle version mineure (0.1.0 → 0.2.0)
              </li>
              <li>
                <code>feat!: …</code> → changement cassant (version majeure après la 1.0.0)
              </li>
            </ul>
            <p>
              Le bouton ouvre une <b>PR de release</b> avec la nouvelle version et le CHANGELOG. Approuvez-la et mergez-la : la release
              GitHub est publiée.
            </p>
          </div>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary" disabled={running || !repo}>
            {running ? 'Lancement…' : 'Préparer la release'}
          </button>
        </form>
      ) : (
        <div className="stack">
          <p>
            ✓ Workflow lancé. Dans une minute environ, la PR « chore(main): release x.y.z » apparaît dans l’onglet Pull requests.
          </p>
          <p className="muted small">
            Pas de PR ? C’est qu’aucune PR <code>feat</code> ou <code>fix</code> n’a été mergée depuis la dernière release. Le détail est
            dans <ExternalLink href={actionsUrl}>l’onglet Actions du repo</ExternalLink>.
          </p>
          <div className="row">
            <a className="btn btn-primary" href={`#/pr?repo=${encodeURIComponent(repo)}`} onClick={onClose}>
              Voir les PR de {repo}
            </a>
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { gh, repos } = useSession()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [url, setUrl] = useState<string>()
  const { lines, error, running, run } = useRunner()
  const nameOk = isValidRepoName(name)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const created = await run((log) => createProject(gh, { name, description, isPrivate }, log))
    if (created) {
      setUrl(created)
      repos.reload()
    }
  }

  return (
    <Modal title="Nouveau projet" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label htmlFor="project-name">Nom du repo</label>
        <input
          id="project-name"
          required
          placeholder="ex : sae-302-chat"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/\s+/g, '-'))}
          disabled={!!url}
        />
        {name && !nameOk && <p className="field-error">Lettres, chiffres, « - », « _ » et « . » seulement.</p>}
        <label htmlFor="project-desc">Description</label>
        <input id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!!url} />
        <label className="checkbox">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} disabled={!!url} />
          Repo privé (recommandé pour les travaux d’école)
        </label>
        <p className="muted small">
          Copie de <code>
            {ORG}/{TEMPLATE_REPO}
          </code>{' '}
          : CI, release automatique, templates d’issues et guide de contribution déjà en place.
        </p>
        <LogBox lines={lines} />
        {error && <ErrorBox message={error} />}
        {url ? (
          <>
            <p>
              ✓ Projet prêt : <ExternalLink href={url}>{url}</ExternalLink>
            </p>
            <p className="muted small">Prochaine étape : « ＋ Nouvelle feature » dans ce projet.</p>
            <button type="button" className="btn" onClick={onClose}>
              Fermer
            </button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={running || !nameOk}>
            {running ? 'Création…' : 'Créer le projet'}
          </button>
        )}
      </form>
    </Modal>
  )
}
