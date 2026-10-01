import { Marked, type Tokens } from "marked";

/**
 * Chapter markdown → HTML. Raw HTML in the source is escaped, links are
 * restricted to http(s)/mailto/relative, images are lazy.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (href: string) => (/^(https?:|mailto:|\/(?!\/)|#)/i.test(href) ? href : "#");

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.text);
    },
    link(token: Tokens.Link) {
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${escapeHtml(safeUrl(token.href))}" rel="nofollow noopener">${text}</a>`;
    },
    image(token: Tokens.Image) {
      return `<img src="${escapeHtml(safeUrl(token.href))}" alt="${escapeHtml(token.text)}" loading="lazy" decoding="async" />`;
    },
  },
});

export function renderMarkdown(source: string): string {
  return md.parse(source, { async: false }) as string;
}

/** Rough reading time for Mongolian prose (~180 words/min). */
export function readingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
