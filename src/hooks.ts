import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

// Charge une donnée au montage, et à chaque reload().
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadRef
      .current()
      .then((value) => !cancelled && setData(value))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [version, ...deps])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading, reload }
}

// Navigation par l'ancre de l'URL (#/pr, #/historique…) : marche sur GitHub Pages sans serveur.
export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'repos'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

type Theme = 'dark' | 'light'
const THEME_KEY = 'ved-opps:theme'

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      // stockage indisponible
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // stockage indisponible
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit)
  }
  return "à l'instant"
}
