import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const languagesDir = path.resolve(rootDir, 'languages');

// Directories and files to ignore during codebase scanning
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.gemini', 'scripts']);

/**
 * Extract all translation keys from HTML, HBS, and JS files in the project.
 */
function extractKeysFromCodebase(dir) {
  const keys = new Set();

  function scanDirectory(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (/\.(html|hbs|js)$/.test(entry.name)) {
        scanFile(fullPath, keys);
      }
    }
  }

  scanDirectory(dir);
  return keys;
}

/**
 * Scan a single file for i18n keys using regex patterns matching melo's i18n engine.
 */
function scanFile(filePath, keysSet) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 1. Explicit data-i18n-* attributes with attribute values:
  // e.g. data-i18n="Key", data-i18n-title="Key", data-i18n-value="Key", etc.
  const attrRegex = /data-i18n(?:-placeholder|-title|-label|-headline|-value)?="([^"]+)"/g;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const val = match[1].trim();
    if (val && val !== 'true' && !val.includes('${')) {
      keysSet.add(val);
    }
  }

  // 2. Elements with exact data-i18n attribute containing inner text (not data-i18n-title/placeholder/etc.):
  // e.g. <span data-i18n>Key Text</span> or <h1 data-i18n="true">Key Text</h1>
  const tagRegex = /<([a-zA-Z0-9-]+)\b[^>]*?(?<![a-zA-Z0-9-])data-i18n(?![a-zA-Z0-9-])(?:\s*=\s*"true"|\s*(?![^>]*=))[^>]*>([\s\S]*?)<\/\1>/g;
  while ((match = tagRegex.exec(content)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && !text.includes('${')) {
      keysSet.add(text);
    }
  }

  // 3. getTranslation('Key') calls in JavaScript files
  const getTranslationRegex = /getTranslation\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = getTranslationRegex.exec(content)) !== null) {
    const val = match[1].trim();
    if (val && !val.includes('${')) {
      keysSet.add(val);
    }
  }
}

/**
 * Main execution function
 */
function main() {
  console.log('🔍 Scanning codebase for translation keys...');
  const codeKeys = extractKeysFromCodebase(rootDir);
  console.log(`Found ${codeKeys.size} unique keys referenced across codebase.\n`);

  if (!fs.existsSync(languagesDir)) {
    console.error(`❌ Languages directory not found: ${languagesDir}`);
    process.exit(1);
  }

  const langFiles = fs.readdirSync(languagesDir).filter(f => f.endsWith('.json'));
  if (langFiles.length === 0) {
    console.error(`❌ No JSON language files found in ${languagesDir}`);
    process.exit(1);
  }

  const languages = {};
  for (const file of langFiles) {
    const langCode = path.basename(file, '.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(languagesDir, file), 'utf-8'));
      languages[langCode] = parsed;
    } catch (err) {
      console.error(`❌ Failed to parse JSON file ${file}:`, err.message);
      process.exit(1);
    }
  }

  const enKeys = Object.keys(languages.en || {});
  let hasErrors = false;

  console.log('--- Translation Files Status ---');
  for (const [code, translations] of Object.entries(languages)) {
    const count = Object.keys(translations).length;
    console.log(`  • ${code}.json: ${count} keys`);
  }
  console.log('');

  // 1. Check if keys from codebase are present in en.json
  const missingFromEn = Array.from(codeKeys).filter(k => !(k in (languages.en || {})));
  if (missingFromEn.length > 0) {
    hasErrors = true;
    console.log(`⚠️  Keys found in codebase but MISSING in en.json (${missingFromEn.length}):`);
    missingFromEn.forEach(k => console.log(`   - "${k}"`));
    console.log('');
  } else {
    console.log('✅ All keys found in codebase are present in en.json.');
  }

  // 2. Check each language JSON against en.json for missing or extra keys
  for (const [code, translations] of Object.entries(languages)) {
    if (code === 'en') continue;

    const missing = enKeys.filter(k => !(k in translations));
    const extra = Object.keys(translations).filter(k => !enKeys.includes(k));

    if (missing.length > 0) {
      hasErrors = true;
      console.log(`\n❌ [${code}.json] Missing ${missing.length} keys present in en.json:`);
      missing.slice(0, 15).forEach(k => console.log(`   - "${k}"`));
      if (missing.length > 15) {
        console.log(`   ... and ${missing.length - 15} more.`);
      }
    }

    if (extra.length > 0) {
      console.log(`\n⚠️ [${code}.json] Extra ${extra.length} keys not in en.json:`);
      extra.slice(0, 15).forEach(k => console.log(`   - "${k}"`));
      if (extra.length > 15) {
        console.log(`   ... and ${extra.length - 15} more.`);
      }
    }
  }

  if (!hasErrors) {
    console.log('\n✨ All translation files are complete and fully synchronized!');
    process.exit(0);
  } else {
    console.log('\n❌ Translation check found missing keys.');
    process.exit(1);
  }
}

main();
