import { Marked, Renderer, Token, Tokens } from 'marked';
import { XMarkdownProps } from '../interface';

type ParserOptions = {
  markedConfig?: XMarkdownProps['config'];
  paragraphTag?: string;
  openLinksInNewTab?: boolean;
  components?: XMarkdownProps['components'];
  protectCustomTagNewlines?: boolean;
  escapeRawHtml?: boolean;
};

type ParseOptions = {
  injectTail?: boolean;
};

export const other = {
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeTest: /[&<>"'/]/,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  escapeReplace: /[&<>"'/]/g,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  completeFencedCode: /^ {0,3}(`{3,}|~{3,})([\s\S]*?)\n {0,3}\1[ \n\t]*$/,
};

const escapeReplacements: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};
const getEscapeReplacement = (ch: string) => escapeReplacements[ch];

export function escapeHtml(html: string, encode?: boolean) {
  if (encode) {
    if (other.escapeTest.test(html)) {
      return html.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html)) {
      return html.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }

  return html;
}

// Symbol to mark tokens for tail injection (avoids property name conflicts)
const TAIL_MARKER = Symbol('tailMarker');

// Type for tokens that can be marked for tail injection
type MarkableToken = Token & { [TAIL_MARKER]?: boolean };

class Parser {
  options: ParserOptions;
  markdownInstance: Marked;
  private injectTail = false;

  constructor(options: ParserOptions = {}) {
    this.options = options;
    this.markdownInstance = new Marked();

    this.configureLinkRenderer();
    this.configureParagraphRenderer();
    this.configureCodeRenderer();
    this.configureHtmlEscapeRenderer();
    this.configureTailInjection();
    // User config at last
    this.markdownInstance.use(options.markedConfig || {});
  }

  private configureHtmlEscapeRenderer() {
    if (!this.options.escapeRawHtml) return;

    this.markdownInstance.use({
      renderer: {
        html(this: Renderer, token: Tokens.HTML | Tokens.Tag) {
          const { raw = '', text = '' } = token;

          return escapeHtml(raw || text, true);
        },
      },
    });
  }

  private configureLinkRenderer() {
    if (!this.options.openLinksInNewTab) return;

    this.markdownInstance.use({
      renderer: {
        link(this: Renderer, { href, title, tokens }: Tokens.Link) {
          const text = this.parser.parseInline(tokens);
          const titleAttr = title ? ` title="${title}"` : '';
          return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        },
      },
    });
  }

  private configureParagraphRenderer() {
    const { paragraphTag } = this.options;
    if (!paragraphTag) return;

    this.markdownInstance.use({
      renderer: {
        paragraph(this: Renderer, { tokens }: Tokens.Paragraph) {
          return `<${paragraphTag}>${this.parser.parseInline(tokens)}</${paragraphTag}>\n`;
        },
      },
    });
  }

  private configureCodeRenderer() {
    this.markdownInstance.use({
      renderer: {
        code({ text, raw, lang, escaped, codeBlockStyle }: Tokens.Code): string {
          const infoString = (lang || '').trim();
          const langString = infoString.match(other.notSpaceStart)?.[0];
          const code = `${text.replace(other.endingNewline, '')}\n`;
          const isIndentedCode = codeBlockStyle === 'indented';
          const streamStatus =
            isIndentedCode || other.completeFencedCode.test(raw) ? 'done' : 'loading';

          const escapedCode = escaped ? code : escapeHtml(code, true);
          const classAttr = langString ? ` class="language-${escapeHtml(langString)}"` : '';
          const dataAttrs =
            ` data-block="true" data-state="${streamStatus}"` +
            (infoString ? ` data-lang="${escapeHtml(infoString)}"` : '');

          return `<pre><code${dataAttrs}${classAttr}>${escapedCode}</code></pre>\n`;
        },
      },
    });
  }

  private configureTailInjection() {
    const parser = this;
    this.markdownInstance.use({
      hooks: {
        processAllTokens(tokens) {
          if (!parser.injectTail) return tokens;

          const lastTextToken = parser.findLastTextToken(tokens as Token[]);
          if (lastTextToken) {
            (lastTextToken as MarkableToken)[TAIL_MARKER] = true;
          }
          return tokens;
        },
      },
      renderer: {
        text(this: Renderer, token: Tokens.Text | Tokens.Escape) {
          const text =
            'tokens' in token && token.tokens
              ? this.parser.parseInline(token.tokens)
              : 'text' in token
                ? token.text
                : '';

          // Inject xmd-tail after the marked text token
          if ((token as MarkableToken)[TAIL_MARKER]) {
            return `${text}<xmd-tail></xmd-tail>`;
          }
          return text;
        },
      },
    });
  }

  private protectCustomTags(content: string): {
    protected: string;
    placeholders: Map<string, string>;
  } {
    const placeholders = new Map<string, string>();
    const customTagNames = Object.keys(this.options.components || {});

    if (customTagNames.length === 0) {
      return { protected: content, placeholders };
    }

    let placeholderIndex = 0;
    const tagNamePattern = customTagNames
      .map((name) => name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    const openTagRegex = new RegExp(`<(${tagNamePattern})(?:\\s[^>]*)?>`, 'gi');
    const closeTagRegex = new RegExp(`</(${tagNamePattern})>`, 'gi');

    const positions: Array<{
      index: number;
      type: 'open' | 'close';
      tagName: string;
      match: string;
    }> = [];

    let match = openTagRegex.exec(content);
    while (match !== null) {
      positions.push({
        index: match.index,
        type: 'open',
        tagName: match[1].toLowerCase(),
        match: match[0],
      });
      match = openTagRegex.exec(content);
    }

    closeTagRegex.lastIndex = 0;
    match = closeTagRegex.exec(content);
    while (match !== null) {
      positions.push({
        index: match.index,
        type: 'close',
        tagName: match[1].toLowerCase(),
        match: match[0],
      });
      match = closeTagRegex.exec(content);
    }

    positions.sort((a, b) => a.index - b.index);

    const stack: Array<{ tagName: string; start: number; openTag: string }> = [];
    const result: string[] = [];
    let lastIndex = 0;

    for (const pos of positions) {
      if (pos.type === 'open') {
        // Self-closing tags don't have inner content
        if (!pos.match.endsWith('/>')) {
          stack.push({ tagName: pos.tagName, start: pos.index, openTag: pos.match });
        }
      } else if (
        pos.type === 'close' &&
        stack.length > 0 &&
        stack[stack.length - 1].tagName === pos.tagName
      ) {
        const open = stack.pop()!;
        if (stack.length === 0) {
          const startPos = open.start;
          const endPos = pos.index + pos.match.length;
          const openTag = open.openTag;
          const closeTag = pos.match;
          const innerContent = content.slice(startPos + openTag.length, pos.index);

          if (lastIndex < startPos) {
            result.push(content.slice(lastIndex, startPos));
          }

          if (innerContent.includes('\n\n')) {
            const protectedInner = innerContent.replace(/\n\n/g, () => {
              const ph = `__X_MD_PLACEHOLDER_${placeholderIndex++}__`;
              placeholders.set(ph, '\n\n');
              return ph;
            });
            result.push(openTag + protectedInner + closeTag);
          } else {
            result.push(openTag + innerContent + closeTag);
          }

          lastIndex = endPos;
        }
      }
    }

    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return { protected: result.join(''), placeholders };
  }

  private restorePlaceholders(content: string, placeholders: Map<string, string>): string {
    if (placeholders.size === 0) {
      return content;
    }
    return content.replace(
      /__X_MD_PLACEHOLDER_\d+__/g,
      (match) => placeholders.get(match) ?? match,
    );
  }

  /**
   * Find the last non-empty token in the token tree (reverse search)
   */
  private findLastNonEmptyToken(tokens: Token[]): Token | null {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];

      // Check for list items (list -> items -> list_item)
      if (token.type === 'list' && 'items' in token && Array.isArray(token.items)) {
        for (let j = token.items.length - 1; j >= 0; j--) {
          const item = token.items[j];
          if ('tokens' in item && item.tokens && item.tokens.length > 0) {
            const found = this.findLastNonEmptyToken(item.tokens as Token[]);
            if (found) return found;
          }
        }
      }

      // Depth-first: check nested tokens first
      if ('tokens' in token && token.tokens && token.tokens.length > 0) {
        const found = this.findLastNonEmptyToken(token.tokens as Token[]);
        if (found) return found;
      }

      // Check if this is a valid token with content
      if (token.type === 'text') {
        const textContent = 'text' in token ? token.text : '';
        // Skip empty text tokens
        if (textContent.trim()) {
          return token;
        }
      } else if (token.type === 'html' || token.type === 'tag') {
        return token;
      }
    }
    return null;
  }

  /**
   * Find the last text token in the token tree
   * Returns null if the last non-empty token is not a text type (e.g., HTML/incomplete component)
   */
  private findLastTextToken(tokens: Token[]): Token | null {
    const lastNonEmptyToken = this.findLastNonEmptyToken(tokens);

    // If the last token is not text type, don't inject tail
    // This prevents tail from appearing before incomplete components
    if (!lastNonEmptyToken || lastNonEmptyToken.type !== 'text') {
      return null;
    }

    return lastNonEmptyToken;
  }

  public parse(content: string, parseOptions?: ParseOptions) {
    // Set tail injection flag
    this.injectTail = parseOptions?.injectTail ?? false;

    // Protect custom tags if needed
    if (this.options.protectCustomTagNewlines) {
      const { protected: protectedContent, placeholders } = this.protectCustomTags(content);
      const parsed = this.markdownInstance.parse(protectedContent) as string;
      return this.restorePlaceholders(parsed, placeholders);
    }

    return this.markdownInstance.parse(content) as string;
  }
}

export default Parser;
