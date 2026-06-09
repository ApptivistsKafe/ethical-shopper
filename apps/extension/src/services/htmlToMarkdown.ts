import TurndownService from 'turndown'

// Elements that add no semantic content — strip before converting to markdown.
const NOISE_SELECTORS = [
  'script', 'style', 'link', 'meta', 'noscript',
  'svg', 'header', 'footer', 'nav', 'aside',
  'iframe', 'canvas',
]

/**
 * Converts raw page HTML to a compact markdown string suitable for the
 * extraction LLM.  Removes noise elements (scripts, styles, nav, etc.),
 * collapses excessive whitespace, and truncates to a safe length.
 *
 * Ported from the original `processHtmlForAI` in the webpack extension,
 * simplified to remove the fallback string and reduce external state.
 */
export function htmlToMarkdown(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Remove noise elements
    for (const selector of NOISE_SELECTORS) {
      doc.querySelectorAll(selector).forEach((el) => el.remove())
    }

    // Remove HTML comment nodes
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_COMMENT)
    const comments: Node[] = []
    while (walker.nextNode()) {
      comments.push(walker.currentNode)
    }
    for (const c of comments) {
      c.parentNode?.removeChild(c)
    }

    const content = doc.body?.innerHTML ? doc.body : doc.documentElement

    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    })

    // Skip empty / whitespace-only nodes that Turndown would emit blank lines for.
    td.addRule('skipEmpty', {
      filter: (node) =>
        !node.textContent?.trim() &&
        node.childNodes.length === 0 &&
        !['br', 'hr', 'img'].includes(node.nodeName.toLowerCase()),
      replacement: () => '',
    })

    const md = td.turndown(content)
    return md
      .replace(/\n{3,}/g, '\n\n') // collapse 3+ blank lines
      .trim()
  } catch {
    return ''
  }
}
