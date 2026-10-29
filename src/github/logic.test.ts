import { describe, expect, it } from 'vitest'
import { ciState, isConventionalTitle, isValidRepoName, mergeBlockers, namesFor, reviewSummary, slugify } from './logic'

const run = (workflow_id: number, status: string, conclusion: string | null, created_at: string) => ({
  workflow_id,
  status,
  conclusion,
  created_at,
})

describe('ciState', () => {
  it("vaut 'none' sans aucun run", () => {
    expect(ciState([])).toBe('none')
  })

  it('ne garde que le dernier run de chaque workflow', () => {
    expect(
      ciState([
        run(1, 'completed', 'failure', '2026-01-01T10:00:00Z'),
        run(1, 'completed', 'success', '2026-01-01T11:00:00Z'),
      ]),
    ).toBe('success')
  })

  it('est rouge dès qu’un workflow échoue, même si un autre tourne encore', () => {
    expect(
      ciState([run(1, 'in_progress', null, '2026-01-01T10:00:00Z'), run(2, 'completed', 'failure', '2026-01-01T10:00:00Z')]),
    ).toBe('failure')
  })

  it('est en cours si un workflow n’est pas fini', () => {
    expect(
      ciState([run(1, 'queued', null, '2026-01-01T10:00:00Z'), run(2, 'completed', 'skipped', '2026-01-01T10:00:00Z')]),
    ).toBe('pending')
  })
})

describe('isConventionalTitle', () => {
  it.each(['feat: ajoute la connexion', 'fix(api): corrige le timeout', 'feat!: change le format', 'chore(main): release 0.2.0'])(
    'accepte « %s »',
    (title) => expect(isConventionalTitle(title)).toBe(true),
  )

  it.each(['Ajoute la connexion', 'feat:sans espace', 'feature: mauvais type', 'feat: '])('refuse « %s »', (title) =>
    expect(isConventionalTitle(title)).toBe(false),
  )
})

describe('noms', () => {
  it('fabrique un nom de branche propre', () => {
    expect(slugify('  Écran de Connexion (v2) !! ')).toBe('ecran-de-connexion-v2')
  })

  it('donne branche, titre et label selon le type', () => {
    expect(namesFor('feature', 'Page profil')).toEqual({ branch: 'feature/page-profil', prTitle: 'feat: Page profil', label: 'feature' })
    expect(namesFor('fix', 'Crash au démarrage')).toEqual({ branch: 'fix/crash-au-demarrage', prTitle: 'fix: Crash au démarrage', label: 'bug' })
  })

  it('valide les noms de repo', () => {
    expect(isValidRepoName('mon-projet_2')).toBe(true)
    expect(isValidRepoName('mon projet')).toBe(false)
    expect(isValidRepoName('..')).toBe(false)
  })
})

describe('reviews et merge', () => {
  it("ignore la review de l'auteur", () => {
    expect(
      reviewSummary(
        [
          { author: 'snakeify', state: 'APPROVED' },
          { author: 'klem844', state: 'CHANGES_REQUESTED' },
        ],
        'snakeify',
      ),
    ).toEqual({ approvedBy: [], changesRequestedBy: ['klem844'] })
  })

  const ready = {
    title: 'feat: page profil',
    isDraft: false,
    labels: [],
    mergeable: 'MERGEABLE',
    ci: 'success' as const,
    approvedBy: ['klem844'],
    changesRequestedBy: [],
  }

  it('autorise le merge si CI verte et PR approuvée', () => {
    expect(mergeBlockers(ready, 'en cours')).toEqual([])
  })

  it('bloque et explique pourquoi', () => {
    expect(mergeBlockers({ ...ready, ci: 'failure', approvedBy: [] }, 'en cours')).toEqual(['CI rouge', 'Pas encore approuvée'])
    expect(mergeBlockers({ ...ready, labels: ['en cours'] }, 'en cours')).toEqual(['Marquée « en cours »'])
    expect(mergeBlockers({ ...ready, isDraft: true, mergeable: 'CONFLICTING' }, 'en cours')).toEqual([
      "C'est encore un brouillon",
      'Conflit avec main à résoudre',
    ])
  })
})
