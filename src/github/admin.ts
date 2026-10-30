// Réglages appliqués à tous les repos de l'orga : labels, options de merge,
// protection de main, création d'un projet depuis le template.

import { CI_WORKFLOW_FILE, LABELS_FILE, ORG, ORG_CONFIG_REPO, REQUIRED_CHECK, RULESET_NAME, TEMPLATE_REPO } from '../config'
import { type GitHub, errorMessage, httpStatus, sleep } from './client'

type Log = (line: string) => void

export interface LabelDef {
  name: string
  color: string
  description: string
}

// La liste des labels vit dans le repo .github de l'orga : on la modifie là-bas, pas ici.
export async function fetchLabelDefs(gh: GitHub): Promise<LabelDef[]> {
  try {
    const { data } = await gh.rest.repos.getContent({ owner: ORG, repo: ORG_CONFIG_REPO, path: LABELS_FILE })
    if (Array.isArray(data) || data.type !== 'file') throw new Error(`${LABELS_FILE} n'est pas un fichier`)
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as LabelDef[]
  } catch (error) {
    throw new Error(`Impossible de lire ${ORG_CONFIG_REPO}/${LABELS_FILE} : ${errorMessage(error)}`)
  }
}

// Crée les labels manquants et corrige couleur/description. Ne supprime jamais rien.
export async function syncLabels(gh: GitHub, repo: string, defs: LabelDef[], log: Log) {
  try {
    const existing = await gh.paginate(gh.rest.issues.listLabelsForRepo, { owner: ORG, repo, per_page: 100 })
    let created = 0
    let updated = 0
    for (const def of defs) {
      const color = def.color.replace('#', '').toLowerCase()
      const found = existing.find((l) => l.name.toLowerCase() === def.name.toLowerCase())
      if (!found) {
        await gh.rest.issues.createLabel({ owner: ORG, repo, name: def.name, color, description: def.description })
        created++
      } else if (found.name !== def.name || found.color.toLowerCase() !== color || (found.description ?? '') !== def.description) {
        await gh.rest.issues.updateLabel({ owner: ORG, repo, name: found.name, new_name: def.name, color, description: def.description })
        updated++
      }
    }
    log(`✓ ${repo} : labels à jour (${created} créé(s), ${updated} corrigé(s))`)
  } catch (error) {
    log(`✗ ${repo} : labels — ${errorMessage(error)}`)
  }
}

// Merge en squash uniquement (le titre de la PR devient le commit), branche supprimée
// après merge, et Actions autorisé à ouvrir la PR de release.
export async function applyRepoSettings(gh: GitHub, repo: string, log: Log) {
  try {
    await gh.rest.repos.update({
      owner: ORG,
      repo,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'PR_BODY',
    })
    log(`✓ ${repo} : merge en squash uniquement`)
  } catch (error) {
    log(`✗ ${repo} : options de merge — ${errorMessage(error)}`)
  }
  try {
    await gh.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', {
      owner: ORG,
      repo,
      default_workflow_permissions: 'read',
      can_approve_pull_request_reviews: true,
    })
    log(`✓ ${repo} : Actions peut ouvrir la PR de release`)
  } catch (error) {
    const hint =
      httpStatus(error) === 409
        ? "active d'abord « Allow GitHub Actions to create and approve pull requests » dans les réglages Actions de l'orga"
        : errorMessage(error)
    log(`✗ ${repo} : permissions Actions — ${hint}`)
  }
}

async function hasFile(gh: GitHub, repo: string, path: string) {
  try {
    await gh.rest.repos.getContent({ owner: ORG, repo, path })
    return true
  } catch (error) {
    if (httpStatus(error) === 404) return false
    throw error
  }
}

type RulesetBody = NonNullable<Parameters<GitHub['rest']['repos']['createRepoRuleset']>[0]>
type Rule = NonNullable<RulesetBody['rules']>[number]

// Protège la branche principale : PR obligatoire, 1 approbation, CI verte,
// ni push forcé ni suppression. Personne ne contourne la règle, même les Owners.
export async function applyRuleset(gh: GitHub, repo: string, log: Log) {
  try {
    const rules: Rule[] = [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
        },
      },
    ]
    // Exiger la CI seulement si le repo en a une, sinon plus personne ne pourrait merger.
    if (await hasFile(gh, repo, CI_WORKFLOW_FILE)) {
      rules.push({
        type: 'required_status_checks',
        parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: REQUIRED_CHECK }] },
      })
    }
    const body: RulesetBody = {
      owner: ORG,
      repo,
      name: RULESET_NAME,
      target: 'branch',
      enforcement: 'active',
      bypass_actors: [],
      conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
      rules,
    }
    const { data: rulesets } = await gh.rest.repos.getRepoRulesets({ owner: ORG, repo, includes_parents: false })
    const current = rulesets.find((r) => r.name === RULESET_NAME)
    if (current) await gh.rest.repos.updateRepoRuleset({ ...body, ruleset_id: current.id })
    else await gh.rest.repos.createRepoRuleset(body)
    log(`✓ ${repo} : main protégée`)
  } catch (error) {
    const message = errorMessage(error)
    if (/upgrade|make this repository public/i.test(message)) {
      log(`⚠ ${repo} : protection impossible sur un repo privé avec le plan gratuit (le dashboard bloque quand même le merge)`)
    } else {
      log(`✗ ${repo} : protection de main — ${message}`)
    }
  }
}

export interface NewProjectInput {
  name: string
  description: string
  isPrivate: boolean
}

// Nouveau projet : copie du template, puis mêmes réglages que tous les autres repos.
export async function createProject(gh: GitHub, input: NewProjectInput, log: Log) {
  const { data: repo } = await gh.rest.repos.createUsingTemplate({
    template_owner: ORG,
    template_repo: TEMPLATE_REPO,
    owner: ORG,
    name: input.name,
    description: input.description,
    private: input.isPrivate,
  })
  log(`✓ Repo ${repo.full_name} créé depuis ${TEMPLATE_REPO}`)

  // GitHub copie les fichiers en tâche de fond : on attend que la branche principale existe.
  let ready = false
  for (let attempt = 0; attempt < 20 && !ready; attempt++) {
    try {
      await gh.rest.git.getRef({ owner: ORG, repo: input.name, ref: `heads/${repo.default_branch}` })
      ready = true
    } catch {
      await sleep(1500)
    }
  }
  if (!ready) log('⚠ La copie du template prend du temps : relance « Synchroniser » dans Admin dans une minute.')

  await applyRepoSettings(gh, input.name, log)
  try {
    await syncLabels(gh, input.name, await fetchLabelDefs(gh), log)
  } catch (error) {
    log(`✗ ${input.name} : labels — ${(error as Error).message}`)
  }
  await applyRuleset(gh, input.name, log)
  return repo.html_url
}
