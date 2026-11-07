import { downloadM3Icons, scanIcons } from './download-m3-icons.js';
import { fileURLToPath } from 'url';

export { scanIcons, downloadM3Icons };

export async function generateIconSubset(options = {}) {
  // Seamless replacement of font subsetting with M3 SVG icon downloads
  return await downloadM3Icons(options);
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  downloadM3Icons().catch(err => {
    console.error('[Icon Build] Error downloading M3 icons:', err);
    process.exit(1);
  });
}
