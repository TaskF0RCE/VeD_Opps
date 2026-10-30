import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Politique de sécurité du contenu, ajoutée seulement au build :
// la page ne peut parler qu'à l'API GitHub et n'exécute que ses propres scripts.
const csp: Plugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      'connect-src https://api.github.com',
      "base-uri 'self'",
      "form-action 'none'",
    ].join('; ')
    return html.replace('<meta charset="UTF-8" />', `$&\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
  },
}

export default defineConfig({
  // Chemins relatifs : le site marche sous https://taskf0rce.github.io/VeD_Opps/ comme en local.
  base: './',
  plugins: [react(), csp],
})
