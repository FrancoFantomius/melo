import { downloadM3Icons } from './download-m3-icons.js';

async function main() {
  console.log('[Optimize Build] Starting build optimizations...');
  await downloadM3Icons();
  console.log('[Optimize Build] All optimizations completed successfully.');
}

main().catch(err => {
  console.error('[Optimize Build] Error during optimization:', err);
  process.exit(1);
});
