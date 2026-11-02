import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  site: 'https://saboot.in',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404')
    })
  ],
  vite: {
    resolve: {
      alias: {
        '@claimproof': fileURLToPath(new URL('../claimproof/src', import.meta.url))
      }
    }
  }
});
