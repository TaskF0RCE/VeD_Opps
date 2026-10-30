import { type ReactNode, useEffect, useRef } from 'react'
import type { CiState } from '../github/logic'

const CI_LABEL: Record<CiState, string> = {
  success: 'CI verte',
  failure: 'CI rouge',
  pending: 'CI en cours',
  none: 'Pas de CI',
}

export function CiBadge({ state }: { state: CiState }) {
  return (
    <span className={`badge ci-${state}`} title={CI_LABEL[state]}>
      <span className="dot" aria-hidden="true" />
      {CI_LABEL[state]}
    </span>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-ring" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <strong>Oups.</strong> {message}
      {onRetry && (
        <button className="btn btn-small" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

// Fenêtre modale basée sur <dialog> : Échap et clic hors de la boîte la ferment.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
    >
      <div className="modal-body">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

// Journal des étapes d'une action longue (✓ réussi, ⚠ attention, ✗ échec).
export function LogBox({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="log" aria-live="polite">
      {lines.map((line, i) => (
        <li key={i} className={line.startsWith('✗') ? 'log-error' : line.startsWith('⚠') ? 'log-warn' : 'log-ok'}>
          {line}
        </li>
      ))}
    </ul>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}
