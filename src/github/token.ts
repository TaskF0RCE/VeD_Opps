// Le token ne quitte jamais le navigateur : il est gardé dans le localStorage
// et envoyé uniquement à api.github.com.

const KEY = 'ved-opps:token'

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // Navigation privée ou stockage bloqué : le token reste en mémoire pour cette visite.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // rien à effacer
  }
}

// Un fine-grained PAT commence par "github_pat_". On refuse les autres formats
// pour ne pas encourager les tokens "classic", qui donnent beaucoup plus de droits.
export function looksLikeFineGrainedToken(token: string) {
  return /^github_pat_[A-Za-z0-9_]{20,}$/.test(token.trim())
}
