import { ORG } from '../config'
import { ExternalLink } from './ui'

const PERMISSIONS: [string, string, string][] = [
  ['Actions', 'Read and write', 'voir la CI et lancer les releases'],
  ['Administration', 'Read and write', 'bouton « Nouveau projet » et réglages de l’onglet Admin'],
  ['Contents', 'Read and write', 'créer les branches de feature'],
  ['Issues', 'Read and write', 'créer les issues et synchroniser les labels'],
  ['Pull requests', 'Read and write', 'ouvrir, approuver et merger les PR'],
  ['Metadata', 'Read-only', 'ajoutée automatiquement par GitHub'],
]

export function TokenGuide() {
  return (
    <div className="guide">
      <ol>
        <li>
          Ouvre <ExternalLink href="https://github.com/settings/personal-access-tokens/new">la page de création d’un fine-grained token</ExternalLink>{' '}
          (GitHub → Settings → Developer settings → Fine-grained tokens).
        </li>
        <li>
          <b>Token name</b> : « VeD Opps – mon PC ». <b>Expiration</b> : 90 jours (tu en recréeras un ensuite).
        </li>
        <li>
          <b>Resource owner</b> : choisis <b>{ORG}</b>, pas ton compte perso. Si {ORG} n’apparaît pas, un Owner doit autoriser les
          fine-grained tokens dans les réglages de l’orga (Settings → Personal access tokens).
        </li>
        <li>
          <b>Repository access</b> : <b>All repositories</b>, pour que les futurs projets soient visibles automatiquement.
        </li>
        <li>
          <b>Permissions → Repositories</b> :
          <table className="perm-table">
            <tbody>
              {PERMISSIONS.map(([name, level, why]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <code>{level}</code>
                  </td>
                  <td>{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <b>Permissions → Organizations</b> : <b>Projects</b> en <code>Read and write</code> (le kanban).
        </li>
        <li>
          Clique sur <b>Generate token</b>, copie-le (il commence par <code>github_pat_</code>) et colle-le ci-dessous. Si GitHub l’indique
          « pending », l’autre Owner doit l’approuver dans Settings → Personal access tokens → Pending requests de l’orga.
        </li>
      </ol>
      <p className="muted">
        🔒 Le token reste dans ce navigateur (localStorage) et n’est envoyé qu’à api.github.com. Ne le partage jamais, ne le commite jamais,
        et clique sur « Déconnexion » sur un ordinateur partagé. Tu peux le révoquer à tout moment sur{' '}
        <ExternalLink href="https://github.com/settings/personal-access-tokens">github.com/settings/personal-access-tokens</ExternalLink>.
      </p>
    </div>
  )
}
