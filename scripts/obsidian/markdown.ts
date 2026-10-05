import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { slug as headingSlug } from 'github-slugger';
import type { Root, RootContent, PhrasingContent } from 'mdast';

export const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkStringify);
export interface Reference { url: string; image: boolean }

/** Parse Markdown so code, escaped wiki syntax, and ordinary links stay distinct. */
export function transformMarkdown(body: string, resolve: (target: string, embed: boolean) => Reference | undefined,
  warn: (message: string) => void): string {
  const tree = markdown.parse(body);
  function walk(parent: Root | RootContent) {
    if (!('children' in parent)) return;
    const result: RootContent[] = [];
    for (const child of parent.children) {
      if (child.type === 'text' && parent.type !== 'link' && parent.type !== 'linkReference') {
        // Use source spelling: escaped brackets must not turn into links.
        const raw = body.slice(child.position!.start.offset, child.position!.end.offset);
        const pattern = /(?<!\\)(!?)\[\[([^\]\n]+)\]\]/g;
        const matches = [...raw.matchAll(pattern)];
        if (matches.length) {
          let cursor = 0;
          // Parse surrounding inline Markdown to preserve escaped characters.
          const inline = (text: string): PhrasingContent[] => {
            const parsed = markdown.parse(text).children[0];
            return parsed?.type === 'paragraph' ? parsed.children : text ? [{ type: 'text', value: text }] : [];
          };
          for (const match of matches) {
            result.push(...inline(raw.slice(cursor, match.index)));
            const [target, ...labels] = match[2]!.split('|');
            const ref = resolve(target!.trim(), !!match[1]);
            const label = labels.join('|') || target!;
            if (ref) {
              result.push(ref.image && match[1]
                ? { type: 'image', url: ref.url, alt: label }
                : { type: 'link', url: ref.url, children: [{ type: 'text', value: label }] });
            } else result.push({ type: 'text', value: match[0] });
            cursor = match.index! + match[0].length;
          }
          result.push(...inline(raw.slice(cursor)));
          continue;
        }
      }
      if (child.type === 'link' || child.type === 'image' || child.type === 'definition') {
        if (!/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(child.url)) {
          const ref = resolve(child.url, child.type === 'image');
          if (ref) child.url = ref.url;
        }
      }
      if (child.type === 'html') warn('Raw HTML is preserved; attachment URLs inside HTML are not rewritten.');
      walk(child);
      result.push(child);
    }
    // All replacements retain the original block/inline node category.
    parent.children = result as typeof parent.children;
  }
  walk(tree);
  return markdown.stringify(tree);
}

export function headingFragment(value: string): string {
  return value ? `#${encodeURIComponent(headingSlug(value))}` : '';
}
