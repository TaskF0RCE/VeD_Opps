// Lectures : repos, pull requests, releases. Une requête GraphQL pour l'orga entière,
// puis l'API Actions pour l'état de la CI de chaque commit.

import { ORG } from '../config'
import { type GitHub, mapLimit } from './client'
import { type CiState, ciState, reviewSummary } from './logic'

export interface Viewer {
  login: string
  name: string | null
  avatarUrl: string
}

export async function fetchViewer(gh: GitHub): Promise<Viewer> {
  const { data } = await gh.rest.users.getAuthenticated()
  return { login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url }
}

export async function fetchCi(gh: GitHub, repo: string, sha: string | null): Promise<CiState> {
  if (!sha) return 'none'
  try {
    const { data } = await gh.rest.actions.listWorkflowRunsForRepo({ owner: ORG, repo, head_sha: sha, per_page: 50 })
    return ciState(data.workflow_runs)
  } catch {
    return 'none'
  }
}

// GraphQL pagine par 100 au maximum : on boucle jusqu'au dernier repo.
async function paginateRepos<T>(gh: GitHub, query: string, pageSize: number): Promise<T[]> {
  const nodes: T[] = []
  let cursor: string | null = null
  do {
    const data: {
      organization: { repositories: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] } }
    } = await gh.graphql(query, { org: ORG, cursor, pageSize })
    nodes.push(...data.organization.repositories.nodes)
    cursor = data.organization.repositories.pageInfo.hasNextPage ? data.organization.repositories.pageInfo.endCursor : null
  } while (cursor)
  return nodes
}

// ---------- Vue d'ensemble ----------

export interface RepoSummary {
  name: string
  description: string | null
  url: string
  isPrivate: boolean
  isArchived: boolean
  isTemplate: boolean
  pushedAt: string | null
  defaultBranch: string | null
  latestRelease: { tagName: string; publishedAt: string | null; url: string } | null
  openPRs: number
  openIssues: number
  ci: CiState
}

interface RepoNode {
  name: string
  description: string | null
  url: string
  isPrivate: boolean
  isArchived: boolean
  isTemplate: boolean
  pushedAt: string | null
  defaultBranchRef: { name: string; target: { oid: string } | null } | null
  latestRelease: { tagName: string; publishedAt: string | null; url: string } | null
  pullRequests: { totalCount: number }
  issues: { totalCount: number }
}

const REPOS_QUERY = /* GraphQL */ `
  query ($org: String!, $cursor: String, $pageSize: Int!) {
    organization(login: $org) {
      repositories(first: $pageSize, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name description url isPrivate isArchived isTemplate pushedAt
          defaultBranchRef { name target { oid } }
          latestRelease { tagName publishedAt url }
          pullRequests(states: OPEN) { totalCount }
          issues(states: OPEN) { totalCount }
        }
      }
    }
  }
`

export async function fetchRepos(gh: GitHub): Promise<RepoSummary[]> {
  const nodes = await paginateRepos<RepoNode>(gh, REPOS_QUERY, 100)
  return mapLimit(nodes, 6, async (node) => ({
    name: node.name,
    description: node.description,
    url: node.url,
    isPrivate: node.isPrivate,
    isArchived: node.isArchived,
    isTemplate: node.isTemplate,
    pushedAt: node.pushedAt,
    defaultBranch: node.defaultBranchRef?.name ?? null,
    latestRelease: node.latestRelease,
    openPRs: node.pullRequests.totalCount,
    openIssues: node.issues.totalCount,
    ci: node.isArchived ? 'none' : await fetchCi(gh, node.name, node.defaultBranchRef?.target?.oid ?? null),
  }))
}

// ---------- Pull requests ----------

export interface PullRequest {
  id: string
  repo: string
  number: number
  title: string
  url: string
  isDraft: boolean
  author: string | null
  authorAvatar: string | null
  createdAt: string
  updatedAt: string
  headRefName: string
  baseRefName: string
  mergeable: string
  labels: string[]
  requestedReviewers: string[]
  approvedBy: string[]
  staleApprovals: string[]
  changesRequestedBy: string[]
  ci: CiState
}

interface PrNode {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  headRefName: string
  baseRefName: string
  headRefOid: string
  mergeable: string
  author: { login: string; avatarUrl: string } | null
  labels: { nodes: { name: string }[] }
  reviewRequests: { nodes: { requestedReviewer: { login?: string } | null }[] }
  latestOpinionatedReviews: { nodes: { state: string; author: { login: string } | null; commit: { oid: string } | null }[] }
}

const PRS_QUERY = /* GraphQL */ `
  query ($org: String!, $cursor: String, $pageSize: Int!) {
    organization(login: $org) {
      repositories(first: $pageSize, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name isArchived
          pullRequests(states: OPEN, first: 30, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id number title url isDraft createdAt updatedAt headRefName baseRefName headRefOid mergeable
              author { login avatarUrl }
              labels(first: 10) { nodes { name } }
              reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } } } }
              latestOpinionatedReviews(first: 10) { nodes { state author { login } commit { oid } } }
            }
          }
        }
      }
    }
  }
`

export async function fetchPullRequests(gh: GitHub): Promise<PullRequest[]> {
  const repos = await paginateRepos<{ name: string; isArchived: boolean; pullRequests: { nodes: PrNode[] } }>(
    gh,
    PRS_QUERY,
    25,
  )
  const prs = repos.filter((r) => !r.isArchived).flatMap((r) => r.pullRequests.nodes.map((pr) => ({ repo: r.name, pr })))
  const list = await mapLimit(prs, 6, async ({ repo, pr }): Promise<PullRequest> => {
    const author = pr.author?.login ?? null
    const reviews = reviewSummary(
      pr.latestOpinionatedReviews.nodes.map((r) => ({ author: r.author?.login ?? null, state: r.state, commit: r.commit?.oid ?? null })),
      author,
      pr.headRefOid,
    )
    return {
      id: pr.id,
      repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      isDraft: pr.isDraft,
      author,
      authorAvatar: pr.author?.avatarUrl ?? null,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      mergeable: pr.mergeable,
      labels: pr.labels.nodes.map((l) => l.name),
      requestedReviewers: pr.reviewRequests.nodes.flatMap((n) => (n.requestedReviewer?.login ? [n.requestedReviewer.login] : [])),
      ...reviews,
      ci: await fetchCi(gh, repo, pr.headRefOid),
    }
  })
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// ---------- Historique ----------

export interface Release {
  repo: string
  repoUrl: string
  name: string | null
  tagName: string
  url: string
  publishedAt: string | null
  isPrerelease: boolean
  author: string | null
  descriptionHTML: string | null
}

const RELEASES_QUERY = /* GraphQL */ `
  query ($org: String!, $cursor: String, $pageSize: Int!) {
    organization(login: $org) {
      repositories(first: $pageSize, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name url
          releases(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes { name tagName url publishedAt isPrerelease isDraft descriptionHTML author { login } }
          }
        }
      }
    }
  }
`

interface ReleaseNode {
  name: string | null
  tagName: string
  url: string
  publishedAt: string | null
  isPrerelease: boolean
  isDraft: boolean
  descriptionHTML: string | null
  author: { login: string } | null
}

export async function fetchReleases(gh: GitHub): Promise<Release[]> {
  const repos = await paginateRepos<{ name: string; url: string; releases: { nodes: ReleaseNode[] } }>(gh, RELEASES_QUERY, 25)
  return repos
    .flatMap((r) =>
      r.releases.nodes
        .filter((rel) => !rel.isDraft)
        .map((rel) => ({
          repo: r.name,
          repoUrl: r.url,
          name: rel.name,
          tagName: rel.tagName,
          url: rel.url,
          publishedAt: rel.publishedAt,
          isPrerelease: rel.isPrerelease,
          author: rel.author?.login ?? null,
          descriptionHTML: rel.descriptionHTML,
        })),
    )
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}
