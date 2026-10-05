import { readFile } from 'node:fs/promises';
import { glob, type Loader } from 'astro/loaders';
import { restoreDateStrings } from './frontmatter';

/** Retain Astro's Markdown renderer and watcher, but preserve YAML date spelling. */
export function obsidianCollectionLoader(base: string): Loader {
  const loader = glob({
    pattern: '**/*.md', base,
    // Separate file identities from URL slugs so route collisions remain visible.
    generateId: ({ entry }) => entry.replaceAll('\\', '/'),
  });
  return {
    ...loader,
    name: 'obsidian-compatible-glob',
    async load(context) {
      await loader.load({
        ...context,
        async parseData(entry) {
          if (entry.data.created instanceof Date || entry.data.date instanceof Date || entry.data.updated instanceof Date) {
            if (!entry.filePath) throw new Error(`${entry.id}: missing source path for date normalization`);
            try {
              const source = await readFile(entry.filePath, 'utf8');
              // Astro's generic describes raw data; the collection schema is the
              // authority for the validated output (including Date transforms).
              return context.parseData({ ...entry, data: restoreDateStrings(source, entry.data) as typeof entry.data });
            } catch (error) {
              throw new Error(`${entry.filePath}: ${(error as Error).message}`);
            }
          }
          return context.parseData(entry);
        },
      });
    },
  };
}
