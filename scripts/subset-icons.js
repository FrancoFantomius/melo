import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import subsetFont from 'subset-font';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default fallback set of known icons in Melo and @francofantomius/material-components to guarantee safety
const DEFAULT_ICONS = [
  'account_circle',
  'add',
  'add_notes',
  'album',
  'apartment',
  'archive',
  'arrow_back',
  'arrow_drop_down',
  'arrow_forward',
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
  'expand_more',
  'favorite',
  'favorite_border',
  'format_color_reset',
  'forward_30',
  'history',
  'home',
  'image',
  'keep',
  'keyboard',
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
  'palette',
  'pause',
  'pause_circle',
  'people',
  'person',
  'person_add',
  'photo_camera',
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
  'widgets'
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
    /\.setAttribute\(\s*["'](?:icon|leading-icon|trailing-icon|selected-icon|active-leading-icon|name)["']\s*,\s*[^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /icon:\s*[^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*(?:\([^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']\)|["']([a-zA-Z0-9_-]+)["'])/g,
    /\b(?:icon|iconName)\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:icon|iconName)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /md-icon\[name=["']([a-zA-Z0-9_-]+)["']\]/g,
    /setIcon\([^,]+,\s*["']([a-zA-Z0-9_-]+)["']\)/g,
    /setIcon\([^,]+,\s*[^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']\)/g
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        for (let i = 1; i < match.length; i++) {
          if (match[i] && /^[a-z0-9_]+$/.test(match[i])) {
            iconSet.add(match[i]);
          }
        }
      }
    }
  }

  return Array.from(iconSet).sort();
}

export async function generateIconSubset() {
  const icons = scanIcons();
  console.log(`[Icon Subsetting] Detected ${icons.length} icons across pages and code:`);
  console.log(`  ${icons.join(', ')}`);

  const possibleSourceFonts = [
    path.join(rootDir, 'node_modules/@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-full-normal.woff2'),
    path.join(rootDir, 'node_modules/@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-fill-normal.woff2')
  ];

  const sourceFontPath = possibleSourceFonts.find(p => fs.existsSync(p));
  if (!sourceFontPath) {
    throw new Error('Could not find source Material Symbols font in @fontsource-variable/material-symbols-outlined.');
  }

  const fontBuffer = fs.readFileSync(sourceFontPath);
  const subsetText = icons.join(' ') + ' ' + Array.from(new Set(icons.join(''))).join('');

  const subsetBuffer = await subsetFont(fontBuffer, subsetText, {
    targetFormat: 'woff2'
  });

  const outputDir = path.join(rootDir, 'fonts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'material-symbols-outlined-subset.woff2');
  fs.writeFileSync(outputPath, subsetBuffer);
  // Also write material-symbols-subset.woff2 for backwards compatibility
  fs.writeFileSync(path.join(outputDir, 'material-symbols-subset.woff2'), subsetBuffer);

  const origSizeKB = (fontBuffer.length / 1024).toFixed(1);
  const subsetSizeKB = (subsetBuffer.length / 1024).toFixed(1);
  const savedPercent = (((fontBuffer.length - subsetBuffer.length) / fontBuffer.length) * 100).toFixed(1);

  console.log(`[Icon Subsetting] Generated subset at: ${path.relative(rootDir, outputPath)}`);
  console.log(`[Icon Subsetting] Original: ${origSizeKB} KB -> Subset: ${subsetSizeKB} KB (${savedPercent}% reduction)`);

  // Update css/fonts.css to use local subset font
  const fontsCssPath = path.join(rootDir, 'css/fonts.css');
  const fontsCssContent = `/* Auto-generated by scripts/subset-icons.js */
@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('../fonts/material-symbols-outlined-subset.woff2') format('woff2-variations');
}

@font-face {
  font-family: 'Material Symbols Outlined Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('../fonts/material-symbols-outlined-subset.woff2') format('woff2-variations');
}
`;
  fs.writeFileSync(fontsCssPath, fontsCssContent, 'utf-8');

  // Also maintain fonts/material-symbols.css for backwards compatibility
  const altFontsCssPath = path.join(rootDir, 'fonts/material-symbols.css');
  const altFontsCssContent = `/* Material Symbols Outlined Subset - Generated by scripts/subset-icons.js */
@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('./material-symbols-outlined-subset.woff2') format('woff2-variations'),
       url('./material-symbols-outlined-subset.woff2') format('woff2');
}

@font-face {
  font-family: 'Material Symbols Outlined Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('./material-symbols-outlined-subset.woff2') format('woff2-variations'),
       url('./material-symbols-outlined-subset.woff2') format('woff2');
}
`;
  fs.writeFileSync(altFontsCssPath, altFontsCssContent, 'utf-8');
  console.log(`[Icon Subsetting] Updated css/fonts.css to reference subset font.`);
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateIconSubset().catch(err => {
    console.error('[Icon Subsetting] Error generating icon subset:', err);
    process.exit(1);
  });
}

