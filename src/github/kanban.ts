// Le kanban de l'orga (GitHub Project). Toutes les fonctions sont sans effet
// si le projet n'existe pas encore : le reste du dashboard marche sans lui.

import { ORG, PROJECT_TITLE, STATUS } from '../config'
import { type GitHub, mapLimit } from './client'

export type StatusKey = keyof typeof STATUS

export interface Kanban {
  id: string
  url: string
  fieldId: string
  options: Partial<Record<StatusKey, string>>
}

export async function findKanban(gh: GitHub): Promise<Kanban | null> {
  const data: {
    organization: {
      projectsV2: {
        nodes: {
          id: string
          title: string
          url: string
          closed: boolean
          field: { id: string; options?: { id: string; name: string }[] } | null
        }[]
      }
    }
  } = await gh.graphql(
    /* GraphQL */ `
      query ($org: String!) {
        organization(login: $org) {
          projectsV2(first: 30) {
            nodes {
              id title url closed
              field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
            }
          }
        }
      }
    `,
    { org: ORG },
  )
  const project = data.organization.projectsV2.nodes.find((p) => p.title === PROJECT_TITLE && !p.closed)
  if (!project?.field?.options) return null
  const options: Kanban['options'] = {}
  for (const key of Object.keys(STATUS) as StatusKey[]) {
    const option = project.field.options.find((o) => o.name === STATUS[key])
    if (option) options[key] = option.id
  }
  return { id: project.id, url: project.url, fieldId: project.field.id, options }
}

// Ajoute une issue ou une PR au kanban (sans doublon : GitHub renvoie la carte existante)
// et range sa carte dans la colonne demandée.
export async function placeOnKanban(gh: GitHub, kanban: Kanban, contentId: string, status?: StatusKey) {
  const added: { addProjectV2ItemById: { item: { id: string } } } = await gh.graphql(
    /* GraphQL */ `
      mutation ($project: ID!, $content: ID!) {
        addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
      }
    `,
    { project: kanban.id, content: contentId },
  )
  const optionId = status ? kanban.options[status] : undefined
  if (!optionId) return
  await gh.graphql(
    /* GraphQL */ `
      mutation ($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(
          input: { projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option } }
        ) { projectV2Item { id } }
      }
    `,
    { project: kanban.id, item: added.addProjectV2ItemById.item.id, field: kanban.fieldId, option: optionId },
  )
}

interface OpenItem {
  id: string
  isDraft?: boolean
  projectItems: { nodes: { project: { id: string }; fieldValueByName: { name?: string } | null }[] }
}

// Range dans le kanban toutes les issues et PR ouvertes de tous les repos.
// Une carte déjà placée n'est déplacée que pour passer d'"En cours" à "En review"
// quand sa PR n'est plus un brouillon.
export async function syncKanban(gh: GitHub, kanban: Kanban, repos: string[], log: (line: string) => void) {
  const fields = /* GraphQL */ `
    id
    projectItems(first: 20) { nodes { project { id } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } }
  `
  await mapLimit(repos, 3, async (repo) => {
    try {
      const data: { repository: { issues: { nodes: OpenItem[] }; pullRequests: { nodes: OpenItem[] } } } = await gh.graphql(
        `query ($org: String!, $repo: String!) {
          repository(owner: $org, name: $repo) {
            issues(states: OPEN, first: 100) { nodes { ${fields} } }
            pullRequests(states: OPEN, first: 100) { nodes { isDraft ${fields} } }
          }
        }`,
        { org: ORG, repo },
      )
      let changed = 0
      const items = [
        ...data.repository.issues.nodes.map((n) => ({ ...n, kind: 'issue' as const })),
        ...data.repository.pullRequests.nodes.map((n) => ({ ...n, kind: 'pr' as const })),
      ]
      for (const item of items) {
        const card = item.projectItems.nodes.find((n) => n.project.id === kanban.id)
        const current = card?.fieldValueByName?.name
        const wanted: StatusKey = item.kind === 'issue' ? 'todo' : item.isDraft ? 'doing' : 'review'
        if (!card || !current) {
          await placeOnKanban(gh, kanban, item.id, wanted)
          changed++
        } else if (item.kind === 'pr' && wanted === 'review' && current === STATUS.doing) {
          await placeOnKanban(gh, kanban, item.id, 'review')
          changed++
        }
      }
      log(`✓ ${repo} : ${changed} carte(s) ajoutée(s) ou déplacée(s)`)
    } catch (error) {
      log(`✗ ${repo} : ${(error as Error).message}`)
    }
  })
}
