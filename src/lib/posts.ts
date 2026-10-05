import { getCollection } from 'astro:content';
import { publishedEntries } from './content-model';
import { assertPageRoute } from './routes';

export async function getPosts() {
  return publishedEntries(await getCollection('posts'));
}

export async function getPages() {
  const pages = publishedEntries(await getCollection('pages'));
  for (const page of pages) assertPageRoute(page.data.slug, page.filePath ?? page.id);
  return pages;
}
