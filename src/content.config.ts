import { defineCollection } from 'astro:content';
import { entrySchema } from './lib/content-model';
import { obsidianCollectionLoader } from './lib/content-loader';

function collection(base: string) {
  return defineCollection({
    loader: obsidianCollectionLoader(base),
    schema: entrySchema,
  });
}

export const collections = {
  posts: collection('./src/content/posts'),
  pages: collection('./src/content/pages'),
};
