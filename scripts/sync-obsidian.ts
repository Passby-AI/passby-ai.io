import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { syncVault } from './obsidian/sync.ts';

try {
  const { values } = parseArgs({ options: {
    vault: { type: 'string' }, 'publish-status': { type: 'string' }, strict: { type: 'boolean' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('pnpm sync [--vault <path>] [--publish-status archived] [--strict] [--dry-run]\nLocal config: obsidian.local.json { "vault": "...", "publishStatus": "archived" }');
  } else {
    let config: { vault?: string; publishStatus?: string; publishTag?: unknown } = {};
    try { config = JSON.parse(await readFile('obsidian.local.json', 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (config.publishTag !== undefined) throw new Error('publishTag is no longer supported. Replace it with publishStatus in obsidian.local.json; publishing now matches status only.');
    const vault = values.vault ?? process.env.OBSIDIAN_VAULT ?? config.vault;
    if (typeof vault !== 'string' || !vault.trim()) throw new Error('Set OBSIDIAN_VAULT, obsidian.local.json vault, or --vault <path>. See docs/publishing.md.');
    const report = await syncVault({ root: process.cwd(), vault: path.resolve(vault),
      publishStatus: values['publish-status'] ?? config.publishStatus, strict: values.strict, dryRun: values['dry-run'] });
    for (const warning of report.warnings) console.warn(`WARNING ${warning}`);
    console.log(`${report.dryRun ? 'Dry run' : 'Synced'}: ${report.notes} notes, ${report.assets} attachments, ${report.warnings.length} warnings.`);
  }
} catch (error) {
  console.error(`Obsidian sync failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
