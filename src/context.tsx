import { createContext, useContext } from 'react'
import type { GitHub } from './github/client'
import type { RepoSummary, Viewer } from './github/queries'
import type { AsyncState } from './hooks'

export interface Session {
  gh: GitHub
  viewer: Viewer
  repos: AsyncState<RepoSummary[]>
  notify: (message: string, kind?: 'ok' | 'error') => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession doit être utilisé une fois connecté')
  return session
}

// Repos sur lesquels on travaille : ni archivés, ni le template, ni le repo de config de l'orga.
export function activeRepos(repos: RepoSummary[] | undefined) {
  return (repos ?? []).filter((r) => !r.isArchived && !r.isTemplate && !r.name.startsWith('.'))
}
