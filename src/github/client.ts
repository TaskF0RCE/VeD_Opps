import { Octokit } from '@octokit/rest'

export type GitHub = Octokit

export function makeClient(token: string): GitHub {
  return new Octokit({ auth: token })
}

interface HttpError {
  status?: number
  message?: string
  response?: { data?: { message?: string; errors?: { message?: string }[] } }
}

// Transforme une erreur de l'API en phrase compréhensible.
export function errorMessage(error: unknown): string {
  const e = error as HttpError
  const detail =
    e.response?.data?.errors?.map((x) => x.message).filter(Boolean).join(' ; ') ||
    e.response?.data?.message ||
    e.message ||
    String(error)
  switch (e.status) {
    case 401:
      return 'Token invalide ou expiré : reconnecte-toi avec un nouveau token.'
    case 403:
      return `Accès refusé (permission manquante sur le token ?) : ${detail}`
    case 404:
      return `Introuvable, ou le token n'y a pas accès : ${detail}`
    default:
      return detail
  }
}

export function httpStatus(error: unknown): number | undefined {
  return (error as HttpError).status
}

// Lance au plus `limit` appels en même temps, pour rester sous les limites de l'API.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
