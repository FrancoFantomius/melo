import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default fallback set of known icons in Melo to guarantee completeness
const DEFAULT_ICONS = [
  'account_circle',
  'add',
  'add_notes',
  'album',
  'apartment',
  'apps',
  'archive',
  'arrow_back',
  'arrow_drop_down',
  'arrow_forward',
  'arrow_upward',
  'artist',
  'badge',
  'balance',
  'brightness_auto',
  'calendar_today',
  'check',
  'check_box',
  'check_circle',
  'checklist',
  'chevron_left',
  'chevron_right',
  'close',
  'cloud',
  'cloud_done',
  'cloud_off',
  'cloud_sync',
  'content_copy',
  'dark_mode',
  'delete',
  'delete_sweep',
  'description',
  'devices',
  'download',
  'download_done',
  'downloading',
  'drag_handle',
  'drag_indicator',
  'edit',
  'engineering',
  'equalizer',
  'error',
  'expand_more',
  'favorite',
  'favorite_border',
  'first_page',
  'format_color_reset',
  'forward_10',
  'forward_30',
  'fullscreen',
  'gavel',
  'history',
  'home',
  'image',
  'keep',
  'keyboard',
  'last_page',
  'light_mode',
  'link',
  'lock',
  'lock_reset',
  'logout',
  'lyrics',
  'mail',
  'manage_accounts',
  'menu',
  'more_vert',
  'music_note',
  'note_stack',
  'open_in_new',
  'palette',
  'pause',
  'pause_circle',
  'people',
  'person',
  'person_add',
  'photo_camera',
  'picture_in_picture_alt',
  'play_arrow',
  'play_circle',
  'playlist_add',
  'playlist_play',
  'podcasts',
  'push_pin',
  'queue_music',
  'radio',
  'refresh',
  'repeat',
  'repeat_one',
  'replay_10',
  'restore',
  'schedule',
  'search',
  'security',
  'settings',
  'shield',
  'shuffle',
  'skip_next',
  'skip_previous',
  'speed',
  'sync',
  'tag',
  'translate',
  'unarchive',
  'upload',
  'verified_user',
  'visibility',
  'visibility_off',
  'volume_down',
  'volume_mute',
  'volume_off',
  'volume_up',
  'warning',
  'widgets'
];

// Keywords to ignore that might get picked up by regexes
const IGNORED_NAMES = new Set([
  'leading',
  'trailing',
  'icon',
  'true',
  'false',
  'name',
  'undefined',
  'null',
  'inherit',
  'none',
  'running',
  'paused'
]);

// Special path mappings for icons that differ between Material Symbols and classic Material Icons
const ICON_SPECIAL_PATHS = {
  restore: 'src/action/restore/materialiconsoutlined/24px.svg',
  people: 'src/social/people/materialiconsoutlined/24px.svg'
};

const CLASSIC_CATEGORIES = [
  'action',
  'alert',
  'av',
  'communication',
  'content',
  'device',
  'editor',
  'file',
  'hardware',
  'image',
  'maps',
  'navigation',
  'notification',
  'places',
  'social',
  'toggle'
];

function getAllFiles(dir, extensions = ['.html', '.js', '.css', '.handlebars', '.hbs']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'scripts'
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

function getMaterialComponentsFiles(rootDir) {
  const mcDir = path.join(rootDir, 'node_modules/@francofantomius/material-components');
  if (!fs.existsSync(mcDir)) return [];
  const results = [];

  const scanDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  };

  scanDir(mcDir);
  return results;
}

export function scanIcons() {
  const iconSet = new Set(DEFAULT_ICONS);
  const files = [...getAllFiles(rootDir), ...getMaterialComponentsFiles(rootDir)];

  const patterns = [
    /\b(?:icon|leading-icon|trailing-icon|active-leading-icon|selected-icon|open-icon)=["']([a-zA-Z0-9_-]+)["']/g,
    /<md-icon[^>]*\bname=["']([a-zA-Z0-9_-]+)["']/g,
    /<md-icon[^>]*\bname=\${[^}]*["']([a-zA-Z0-9_-]+)["']\}/g,
    /<md-icon[^>]*>([a-zA-Z0-9_-]+)<\/md-icon>/g,
    /<(?:span|i)[^>]*class=["'][^"']*(?:material-symbols-outlined|material-icons)[^"']*["'][^>]*>\s*([a-zA-Z0-9_-]+)\s*<\/(?:span|i)>/g,
    /\.setAttribute\(\s*["'](?:icon|leading-icon|trailing-icon|selected-icon|active-leading-icon|name)["']\s*,\s*["']([a-zA-Z0-9_-]+)["']\s*\)/g,
    /\.setAttribute\(\s*["'](?:icon|leading-icon|trailing-icon|selected-icon|active-leading-icon|name)["']\s*,\s*[^?\r\n]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /icon:\s*[^?\r\n]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*(?:\([^?\r\n]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']\)|["']([a-zA-Z0-9_-]+)["'])/g,
    /\b(?:icon|iconName)\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:icon|iconName)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /md-icon\[name=["']([a-zA-Z0-9_-]+)["']\]/g,
    /setIcon\([^,]+,\s*["']([a-zA-Z0-9_-]+)["']\)/g,
    /setIcon\([^,]+,\s*[^?\r\n]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']\)/g
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        for (let i = 1; i < match.length; i++) {
          const val = match[i];
          if (val && /^[a-z0-9_]+$/.test(val) && !IGNORED_NAMES.has(val)) {
            iconSet.add(val);
          }
        }
      }
    }
  }

  return Array.from(iconSet).sort();
}

/**
 * Downloads a single SVG icon from Google's material-design-icons repository.
 */
async function downloadIconSvg(iconName) {
  const baseUrl = 'https://raw.githubusercontent.com/google/material-design-icons/master/';
  const candidates = [];

  // Special mapped paths first
  if (ICON_SPECIAL_PATHS[iconName]) {
    candidates.push(baseUrl + ICON_SPECIAL_PATHS[iconName]);
  }

  // Material Symbols Outlined standard sizes
  candidates.push(
    `${baseUrl}symbols/web/${iconName}/materialsymbolsoutlined/${iconName}_24px.svg`,
    `${baseUrl}symbols/web/${iconName}/materialsymbolsoutlined/${iconName}_20px.svg`,
    `${baseUrl}symbols/web/${iconName}/materialsymbolsoutlined/${iconName}_48px.svg`,
    `${baseUrl}symbols/web/${iconName}/materialsymbolsoutlined/${iconName}_wght400_24px.svg`
  );

  // Classic Material Icons outlined and default
  for (const cat of CLASSIC_CATEGORIES) {
    candidates.push(
      `${baseUrl}src/${cat}/${iconName}/materialiconsoutlined/24px.svg`,
      `${baseUrl}src/${cat}/${iconName}/materialicons/24px.svg`
    );
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Melo-M3-Icon-Downloader' }
      });
      if (res.ok) {
        let svg = await res.text();
        // Clean and normalize SVG for M3 CSS color inheritance
        if (!svg.includes('xmlns=')) {
          svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        }
        // Normalize viewBox or ensure scalable width/height
        return svg;
      }
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(`Could not find SVG for icon "${iconName}" in Google repository`);
}

/**
 * Downloads all required M3 icons into public/img/M3icons/
 */
export async function downloadM3Icons(options = {}) {
  const force = Boolean(options.force || (process.argv && process.argv.includes('--force')));
  const neededIcons = scanIcons();
  const outputDir = path.join(rootDir, 'public/img/M3icons');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[M3 Icons] Total icons to verify: ${neededIcons.length}`);

  const iconsToDownload = [];
  for (const icon of neededIcons) {
    const iconFile = path.join(outputDir, `${icon}.svg`);
    if (force || !fs.existsSync(iconFile) || fs.statSync(iconFile).size === 0) {
      iconsToDownload.push(icon);
    }
  }

  if (iconsToDownload.length === 0) {
    console.log(`[M3 Icons] All ${neededIcons.length} icons are already present in public/img/M3icons/.`);
    return neededIcons;
  }

  console.log(`[M3 Icons] Downloading ${iconsToDownload.length} missing icons from Google repository...`);

  // Download with concurrency control (5 concurrent requests)
  const CONCURRENCY = 5;
  const errors = [];
  let completed = 0;

  for (let i = 0; i < iconsToDownload.length; i += CONCURRENCY) {
    const chunk = iconsToDownload.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (icon) => {
        try {
          const svgContent = await downloadIconSvg(icon);
          const iconPath = path.join(outputDir, `${icon}.svg`);
          fs.writeFileSync(iconPath, svgContent, 'utf-8');
          completed++;
        } catch (err) {
          errors.push({ icon, error: err.message });
        }
      })
    );
  }

  console.log(`[M3 Icons] Downloaded ${completed}/${iconsToDownload.length} icons.`);

  if (errors.length > 0) {
    console.warn(`[M3 Icons] Failed to download ${errors.length} icons:`);
    for (const e of errors) {
      console.warn(`  - ${e.icon}: ${e.error}`);
    }
  }

  // Update icons index manifest in public/img/M3icons/icons.json
  const existingFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.svg')).map(f => f.replace(/\.svg$/, ''));
  fs.writeFileSync(
    path.join(outputDir, 'icons.json'),
    JSON.stringify(existingFiles.sort(), null, 2),
    'utf-8'
  );

  return existingFiles;
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  downloadM3Icons().catch(err => {
    console.error('[M3 Icons] Error downloading M3 icons:', err);
    process.exit(1);
  });
}
