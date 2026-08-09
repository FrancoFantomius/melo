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
        if (pagePath.endsWith('search.html')) return { isSearch: true, title: 'Search Music & Podcasts - Melo', description: 'Instant search across artists, albums, tracks, and RSS podcasts on your Jellyfin server.' };
        if (pagePath.endsWith('albums.html')) return { isAlbums: true, title: 'Browse Music Albums - Melo', description: 'Browse and stream music albums from your self-hosted Jellyfin media server.' };
        if (pagePath.endsWith('artists.html')) return { isArtists: true, title: 'Explore Artists - Melo', description: 'Discover artist discographies and stream top tracks on Melo music player.' };
        if (pagePath.endsWith('playlists.html')) return { isPlaylists: true, title: 'Your Playlists - Melo', description: 'Manage and stream customized music playlists powered by Jellyfin.' };
        if (pagePath.endsWith('podcasts.html')) return { isPodcasts: true, title: 'Podcasts & RSS Reader - Melo', description: 'Add, search, and stream RSS podcast feeds directly inside Melo PWA.' };
        if (pagePath.endsWith('login.html')) return { isLogin: true, title: 'Sign In to Jellyfin Server - Melo', description: 'Connect your self-hosted Jellyfin server to stream your music library.' };
        if (pagePath.endsWith('terms.html')) return { isTerms: true, title: 'Terms of Service - Melo', description: 'Terms of Service and Content Liability Disclaimer for Melo Music Player.' };
        if (pagePath.endsWith('privacy.html')) return { isPrivacy: true, title: 'Privacy Policy - Melo', description: 'Privacy Policy for Melo Progressive Web Application.' };
        return { isHome: true, title: 'Melo - Jellyfin Music Player PWA', description: 'Melo is a lightweight Progressive Web App music player powered by Jellyfin backend. Stream music, podcasts, and playlists anywhere.' };
      }
    }),
    {
      name: 'sync-version-and-sw',
      buildStart() {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        
        // 1. Sync package.json version to manifest.json
        if (fs.existsSync('manifest.json')) {
          try {
            const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
            manifest.version = pkg.version;
            fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2), 'utf-8');
          } catch (e) {
            console.warn('[Build] Failed to update manifest.json version:', e);
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
