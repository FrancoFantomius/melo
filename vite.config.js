import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        albums: path.resolve(__dirname, 'albums.html'),
        artists: path.resolve(__dirname, 'artists.html'),
        playlists: path.resolve(__dirname, 'playlists.html'),
        podcasts: path.resolve(__dirname, 'podcasts.html'),
        downloads: path.resolve(__dirname, 'downloads.html'),
        search: path.resolve(__dirname, 'search.html'),
        terms: path.resolve(__dirname, 'terms.html'),
        privacy: path.resolve(__dirname, 'privacy.html')
      }
    }
  },
  plugins: [
    handlebars({
      partialDirectory: path.resolve(__dirname, 'templates'),
      context(pagePath) {
        if (pagePath.endsWith('search.html')) return { isSearch: true };
        if (pagePath.endsWith('albums.html')) return { isAlbums: true };
        if (pagePath.endsWith('artists.html')) return { isArtists: true };
        if (pagePath.endsWith('playlists.html')) return { isPlaylists: true };
        if (pagePath.endsWith('podcasts.html')) return { isPodcasts: true };
        if (pagePath.endsWith('downloads.html')) return { isDownloads: true };
        if (pagePath.endsWith('login.html')) return { isLogin: true };
        if (pagePath.endsWith('terms.html')) return { isTerms: true };
        if (pagePath.endsWith('privacy.html')) return { isPrivacy: true };
        return { isHome: true };
      }
    }),
    {
      name: 'sync-version-and-sw',
      buildStart() {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        
        // 1. Sync package.json version to manifest.json files
        const manifestPaths = ['manifest.json', 'public/manifest.json'];
        for (const mPath of manifestPaths) {
          if (fs.existsSync(mPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(mPath, 'utf-8'));
              manifest.version = pkg.version;
              fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2), 'utf-8');
            } catch (e) {
              console.warn(`[Build] Failed to update ${mPath} version:`, e);
            }
          }
        }

        // 2. Sync package.json version to sw.js
        if (fs.existsSync('sw.js')) {
          let swContent = fs.readFileSync('sw.js', 'utf-8');
          const targetCache = `const CACHE_NAME = 'melo-v${pkg.version}';`;
          if (!swContent.includes(targetCache)) {
            swContent = swContent.replace(/^const CACHE_NAME = .*;$/m, targetCache);
            fs.writeFileSync('sw.js', swContent, 'utf-8');
          }
        }
      },
      closeBundle() {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        let swContent = fs.readFileSync('sw.js', 'utf-8');
        swContent = swContent.replace(/^const CACHE_NAME = .*;$/m, `const CACHE_NAME = 'melo-v${pkg.version}';`);

        // Copy languages directory to dist/languages
        const langSrc = path.resolve(__dirname, 'languages');
        const langDist = path.resolve(__dirname, 'dist/languages');
        if (fs.existsSync(langSrc)) {
          fs.mkdirSync(langDist, { recursive: true });
          const langFiles = fs.readdirSync(langSrc);
          for (const file of langFiles) {
            fs.copyFileSync(path.join(langSrc, file), path.join(langDist, file));
          }
        }

        // Collect generated files in dist/
        const distDir = path.resolve(__dirname, 'dist');
        const distAssets = [];

        function collectFiles(dir, prefix = './') {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = prefix + entry.name;
            if (entry.isDirectory()) {
              collectFiles(fullPath, relPath + '/');
            } else if (entry.isFile() && !entry.name.endsWith('sw.js')) {
              distAssets.push(relPath);
            }
          }
        }

        collectFiles(distDir);

        const assetsMatch = swContent.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/);
        if (assetsMatch) {
          const currentAssets = assetsMatch[1]
            .split('\n')
            .map(line => line.trim().replace(/^['"]|['"],?$/g, ''))
            .filter(Boolean);
          const combined = Array.from(new Set([...currentAssets, ...distAssets]));
          swContent = swContent.replace(
            /const ASSETS_TO_CACHE = \[[\s\S]*?\];/,
            `const ASSETS_TO_CACHE = [\n  '${combined.join("',\n  '")}'\n];`
          );
        }

        fs.writeFileSync(path.resolve(__dirname, 'dist/sw.js'), swContent, 'utf-8');
        console.log(`[SW Plugin] Generated dist/sw.js for version ${pkg.version} with ${distAssets.length} static assets.`);
      }
    }
  ]
});
