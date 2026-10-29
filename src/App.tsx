import { useCallback, useMemo, useState } from 'react'
import { ORG } from './config'
import { type Session, SessionContext } from './context'
import { makeClient } from './github/client'
import { fetchRepos, fetchViewer } from './github/queries'
import { clearToken, loadToken, saveToken } from './github/token'
import { useAsync, useHashRoute, useTheme } from './hooks'
import { Login } from './components/Login'
import { NewFeatureDialog, NewProjectDialog, NewReleaseDialog } from './components/dialogs'
import { ErrorBox, Spinner } from './components/ui'
import { Admin } from './pages/Admin'
import { History } from './pages/History'
import { Overview } from './pages/Overview'
import { PullRequests } from './pages/PullRequests'

const PAGES = [
  { route: 'repos', label: 'Vue d’ensemble', Page: Overview },
  { route: 'pr', label: 'Pull requests', Page: PullRequests },
  { route: 'historique', label: 'Historique', Page: History },
  { route: 'admin', label: 'Admin', Page: Admin },
]

type Dialog = 'feature' | 'release' | 'project' | null

export function App() {
  const [token, setToken] = useState(loadToken)
  const [theme, toggleTheme] = useTheme()

  const login = (value: string) => {
    saveToken(value)
    setToken(value)
  }
  const logout = useCallback(() => {
    clearToken()
    setToken(null)
  }, [])

  if (!token) return <Login onLogin={login} />
  return <Dashboard key={token} token={token} theme={theme} onLogout={logout} onToggleTheme={toggleTheme} />
}

interface DashboardProps {
  token: string
  theme: 'dark' | 'light'
  onLogout: () => void
  onToggleTheme: () => void
}

function Dashboard({ token, theme, onLogout, onToggleTheme }: DashboardProps) {
  const gh = useMemo(() => makeClient(token), [token])
  const viewer = useAsync(() => fetchViewer(gh), [gh])
  const repos = useAsync(() => fetchRepos(gh), [gh])
  const route = useHashRoute()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)

  const notify = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 5000)
  }, [])

  if (viewer.loading) return <Spinner label="Connexion à GitHub…" />
  if (viewer.error || !viewer.data) {
    return (
      <main className="login">
        <div className="login-card stack">
          <ErrorBox message={viewer.error ?? 'Connexion impossible'} onRetry={viewer.reload} />
          <button className="btn" onClick={onLogout}>
            Changer de token
          </button>
        </div>
      </main>
    )
  }

  const session: Session = { gh, viewer: viewer.data, repos, notify }
  const current = PAGES.find((p) => p.route === route) ?? PAGES[0]

  return (
    <SessionContext.Provider value={session}>
      <header className="topbar">
        <a className="brand" href="#/">
          <img src="./favicon.svg" alt="" width={28} height={28} />
          <span>
            VeD Opps <small className="muted">· {ORG}</small>
          </span>
        </a>
        <nav className="tabs" aria-label="Navigation">
          {PAGES.map((p) => (
            <a key={p.route} href={`#/${p.route}`} className={p === current ? 'tab active' : 'tab'} aria-current={p === current ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="user">
          <button className="icon-btn" onClick={onToggleTheme} aria-label="Changer de thème" title="Mode clair / sombre">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <img className="avatar" src={viewer.data.avatarUrl} alt="" width={28} height={28} />
          <span className="hide-mobile">{viewer.data.login}</span>
          <button className="btn btn-small" onClick={onLogout} title="Efface le token de ce navigateur">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="actionbar">
        <button className="btn btn-primary" onClick={() => setDialog('feature')}>
          ＋ Nouvelle feature
        </button>
        <button className="btn" onClick={() => setDialog('release')}>
          🏷 Nouvelle release
        </button>
        <button className="btn" onClick={() => setDialog('project')}>
          📁 Nouveau projet
        </button>
      </div>

      <main className="content">
        <current.Page />
      </main>

      {dialog === 'feature' && <NewFeatureDialog onClose={() => setDialog(null)} />}
      {dialog === 'release' && <NewReleaseDialog onClose={() => setDialog(null)} />}
      {dialog === 'project' && <NewProjectDialog onClose={() => setDialog(null)} />}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status" onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </SessionContext.Provider>
  )
}
