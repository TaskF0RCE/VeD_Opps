import { type FormEvent, useState } from 'react'
import { ORG } from '../config'
import { errorMessage, makeClient } from '../github/client'
import { fetchViewer } from '../github/queries'
import { looksLikeFineGrainedToken } from '../github/token'
import { TokenGuide } from './TokenGuide'
import { ErrorBox } from './ui'

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = token.trim()
    if (!looksLikeFineGrainedToken(value)) {
      setError('Ce n’est pas un fine-grained token (il doit commencer par « github_pat_ »). Suis le guide ci-dessus.')
      return
    }
    setChecking(true)
    setError(null)
    try {
      const gh = makeClient(value)
      await fetchViewer(gh)
      const data: { organization: { repositories: { totalCount: number } } } = await gh.graphql(
        `query ($org: String!) { organization(login: $org) { repositories { totalCount } } }`,
        { org: ORG },
      )
      if (data.organization.repositories.totalCount === 0) {
        setError(`Le token ne voit aucun repo de ${ORG}. As-tu bien choisi ${ORG} comme « Resource owner » et « All repositories » ?`)
        return
      }
      onLogin(value)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand brand-large">
          <img src="./favicon.svg" alt="" width={40} height={40} />
          <div>
            <h1>VeD Opps</h1>
            <p className="muted">Le tableau de bord de {ORG}</p>
          </div>
        </div>
        <h2>Connexion avec ton token GitHub</h2>
        <TokenGuide />
        <form onSubmit={submit} className="stack">
          <label htmlFor="token">Ton fine-grained token</label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary" disabled={checking || !token}>
            {checking ? 'Vérification…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}
