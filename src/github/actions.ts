// Actions déclenchées par les boutons : approuver, merger, passer en review,
// démarrer une feature, lancer une release.

import { ORG, RELEASE_WORKFLOW, TEAM, WIP_LABEL, sameLogin } from '../config'
import { type GitHub, errorMessage, httpStatus } from './client'
import { findKanban, placeOnKanban } from './kanban'
import { type WorkKind, namesFor } from './logic'
import type { PullRequest } from './queries'

export async function approvePullRequest(gh: GitHub, pr: PullRequest) {
  await gh.rest.pulls.createReview({ owner: ORG, repo: pr.repo, pull_number: pr.number, event: 'APPROVE' })
}

// Squash : un seul commit sur main, avec le titre (Conventional Commit) de la PR.
// Release-please lit ces titres pour calculer la prochaine version.
export async function mergePullRequest(gh: GitHub, pr: PullRequest) {
  await gh.rest.pulls.merge({
    owner: ORG,
    repo: pr.repo,
    pull_number: pr.number,
    merge_method: 'squash',
    commit_title: `${pr.title} (#${pr.number})`,
  })
  try {
    await gh.rest.git.deleteRef({ owner: ORG, repo: pr.repo, ref: `heads/${pr.headRefName}` })
  } catch {
    // Déjà supprimée par le réglage "supprimer la branche après merge".
  }
}

// Brouillon → prête : on demande la review des autres membres et on déplace la carte.
export async function markReadyForReview(gh: GitHub, pr: PullRequest) {
  if (pr.isDraft) {
    await gh.graphql(
      `mutation ($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { id } } }`,
      { id: pr.id },
    )
  }
  if (pr.labels.includes(WIP_LABEL)) {
    await gh.rest.issues.removeLabel({ owner: ORG, repo: pr.repo, issue_number: pr.number, name: WIP_LABEL })
  }
  const reviewers = TEAM.filter((login) => !sameLogin(login, pr.author))
  if (reviewers.length > 0) {
    await gh.rest.pulls.requestReviewers({ owner: ORG, repo: pr.repo, pull_number: pr.number, reviewers })
  }
  try {
    const kanban = await findKanban(gh)
    if (kanban) await placeOnKanban(gh, kanban, pr.id, 'review')
  } catch {
    // Le kanban est un bonus : la PR est déjà prête même s'il n'est pas à jour.
  }
}

export interface FeatureInput {
  repo: string
  kind: WorkKind
  name: string
  description: string
  me: string
}

export interface FeatureResult {
  branch: string
  issueUrl: string
  prUrl: string
  draft: boolean
}

// Nouvelle feature : issue + branche + PR (brouillon si possible) liées entre elles.
export async function startFeature(gh: GitHub, input: FeatureInput, log: (line: string) => void): Promise<FeatureResult> {
  const { branch, prTitle, label } = namesFor(input.kind, input.name)
  const owner = ORG
  const repo = input.repo

  const { data: repoData } = await gh.rest.repos.get({ owner, repo })
  const base = repoData.default_branch

  try {
    await gh.rest.git.getRef({ owner, repo, ref: `heads/${branch}` })
    throw new Error(`La branche ${branch} existe déjà dans ${repo}. Choisis un autre nom.`)
  } catch (error) {
    if (httpStatus(error) !== 404) throw error
  }

  const { data: issue } = await gh.rest.issues.create({
    owner,
    repo,
    title: input.name.trim(),
    body: `${input.description.trim() || '_Pas de description._'}\n\n---\nBranche : \`${branch}\` · créée depuis le dashboard VeD Opps.`,
    labels: [label],
    assignees: [input.me],
  })
  log(`✓ Issue #${issue.number} créée`)

  // Une PR a besoin d'au moins un commit d'avance sur main : on crée un commit vide.
  const { data: baseRef } = await gh.rest.git.getRef({ owner, repo, ref: `heads/${base}` })
  const { data: baseCommit } = await gh.rest.git.getCommit({ owner, repo, commit_sha: baseRef.object.sha })
  const { data: commit } = await gh.rest.git.createCommit({
    owner,
    repo,
    message: `chore: démarre ${branch}\n\nRefs #${issue.number}`,
    tree: baseCommit.tree.sha,
    parents: [baseCommit.sha],
  })
  await gh.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.sha })
  log(`✓ Branche ${branch} créée`)

  const body = `Closes #${issue.number}\n\n## Ce que ça change\n\n${input.description.trim() || '_À compléter._'}\n`
  let draft = true
  let pr
  try {
    pr = (await gh.rest.pulls.create({ owner, repo, title: prTitle, head: branch, base, body, draft: true })).data
  } catch (error) {
    // Les PR brouillon n'existent pas dans les repos privés du plan gratuit : on met un label à la place.
    if (!/draft/i.test(errorMessage(error))) throw error
    draft = false
    pr = (await gh.rest.pulls.create({ owner, repo, title: prTitle, head: branch, base, body })).data
    await gh.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: [WIP_LABEL] })
  }
  log(`✓ PR #${pr.number} ouverte${draft ? ' en brouillon' : ` avec le label « ${WIP_LABEL} »`}`)

  try {
    const kanban = await findKanban(gh)
    if (kanban) {
      await placeOnKanban(gh, kanban, issue.node_id, 'doing')
      await placeOnKanban(gh, kanban, pr.node_id, 'doing')
      log('✓ Cartes ajoutées au kanban dans « En cours »')
    }
  } catch (error) {
    log(`⚠ Kanban non mis à jour : ${errorMessage(error)}`)
  }

  return { branch, issueUrl: issue.html_url, prUrl: pr.html_url, draft }
}

// Lance le workflow release.yml du repo : release-please ouvre (ou met à jour)
// la PR de release avec la version calculée et le CHANGELOG.
export async function triggerRelease(gh: GitHub, repo: string) {
  const { data } = await gh.rest.repos.get({ owner: ORG, repo })
  try {
    await gh.rest.actions.createWorkflowDispatch({ owner: ORG, repo, workflow_id: RELEASE_WORKFLOW, ref: data.default_branch })
  } catch (error) {
    if (httpStatus(error) === 404) {
      throw new Error(`${repo} n'a pas de workflow ${RELEASE_WORKFLOW}. Il n'a sans doute pas été créé depuis le template.`)
    }
    throw error
  }
  return `https://github.com/${ORG}/${repo}/actions/workflows/${RELEASE_WORKFLOW}`
}
