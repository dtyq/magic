const WHITESPACE_REGEX = /\s/;
const TAG_NAME_CHAR_REGEX = /[a-zA-Z0-9-]/;
const VOID_ELEMENTS = new Set<string>([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const COMMENT_START = '<!--';
const COMMENT_END = '-->';
const CDATA_START = '<![CDATA[';
const CDATA_END = ']]>';

export const getTagInstanceId = (tagName: string, instance: number) => `${tagName}-${instance}`;

const skipComment = (html: string, pos: number): number => {
  if (!html.startsWith(COMMENT_START, pos)) {
    return pos;
  }

  const endPos = html.indexOf(COMMENT_END, pos + COMMENT_START.length);
  return endPos === -1 ? html.length : endPos + COMMENT_END.length;
};

const skipCDATA = (html: string, pos: number): number => {
  if (!html.startsWith(CDATA_START, pos)) {
    return pos;
  }

  const endPos = html.indexOf(CDATA_END, pos + CDATA_START.length);
  return endPos === -1 ? html.length : endPos + CDATA_END.length;
};

const parseClosingTag = (html: string, pos: number): { tagName: string; endPos: number } | null => {
  if (html[pos + 1] !== '/') {
    return null;
  }

  let scanPos = pos + 2;
  let tagName = '';

  while (scanPos < html.length && WHITESPACE_REGEX.test(html[scanPos])) {
    scanPos++;
  }

  while (scanPos < html.length && TAG_NAME_CHAR_REGEX.test(html[scanPos])) {
    tagName += html[scanPos];
    scanPos++;
  }

  while (scanPos < html.length && WHITESPACE_REGEX.test(html[scanPos])) {
    scanPos++;
  }

  if (!tagName || html[scanPos] !== '>') {
    return null;
  }

  return { tagName: tagName.toLowerCase(), endPos: scanPos + 1 };
};

const parseOpeningTag = (
  html: string,
  pos: number,
): { tagName: string; endPos: number; foundEnd: boolean; isSelfClosing: boolean } | null => {
  let scanPos = pos + 1;
  let tagName = '';

  while (scanPos < html.length && TAG_NAME_CHAR_REGEX.test(html[scanPos])) {
    tagName += html[scanPos];
    scanPos++;
  }

  if (!tagName) {
    return null;
  }

  let foundEnd = false;
  let isSelfClosing = false;

  while (scanPos < html.length) {
    if (html[scanPos] === '>') {
      foundEnd = true;
      isSelfClosing = html[scanPos - 1] === '/';
      break;
    }

    if (html[scanPos] === '"' || html[scanPos] === "'") {
      const quoteChar = html[scanPos];
      scanPos++;

      while (scanPos < html.length) {
        if (html[scanPos] === '\\' && scanPos + 1 < html.length) {
          scanPos += 2;
          continue;
        }

        if (html[scanPos] === quoteChar) {
          scanPos++;
          break;
        }

        scanPos++;
      }

      continue;
    }

    scanPos++;
  }

  return {
    tagName: tagName.toLowerCase(),
    endPos: foundEnd ? scanPos + 1 : html.length,
    foundEnd,
    isSelfClosing,
  };
};

export function detectUnclosedComponentTags(
  html: string,
  componentNames: Iterable<string>,
): Set<string> {
  const trackedTags = new Set(Array.from(componentNames, (tagName) => tagName.toLowerCase()));

  if (trackedTags.size === 0 || html.length === 0) {
    return new Set();
  }

  const unclosedTags = new Set<string>();
  const tagCounts: Record<string, number> = {};
  const openTagIndexes: Record<string, number[]> = {};

  let pos = 0;
  while (pos < html.length) {
    const afterComment = skipComment(html, pos);
    if (afterComment !== pos) {
      pos = afterComment;
      continue;
    }

    const afterCDATA = skipCDATA(html, pos);
    if (afterCDATA !== pos) {
      pos = afterCDATA;
      continue;
    }

    if (html[pos] !== '<') {
      pos++;
      continue;
    }

    const closingTag = parseClosingTag(html, pos);
    if (closingTag) {
      const pendingIndexes = openTagIndexes[closingTag.tagName];
      if (trackedTags.has(closingTag.tagName) && pendingIndexes?.length) {
        pendingIndexes.pop();
      }
      pos = closingTag.endPos;
      continue;
    }

    const openingTag = parseOpeningTag(html, pos);
    if (!openingTag || !trackedTags.has(openingTag.tagName)) {
      pos++;
      continue;
    }

    tagCounts[openingTag.tagName] = (tagCounts[openingTag.tagName] ?? 0) + 1;
    const instance = tagCounts[openingTag.tagName];

    if (!openingTag.foundEnd) {
      unclosedTags.add(getTagInstanceId(openingTag.tagName, instance));
    } else if (!openingTag.isSelfClosing && !VOID_ELEMENTS.has(openingTag.tagName)) {
      openTagIndexes[openingTag.tagName] ??= [];
      openTagIndexes[openingTag.tagName].push(instance);
    }

    pos = openingTag.endPos;
  }

  for (const [tagName, pendingIndexes] of Object.entries(openTagIndexes)) {
    pendingIndexes.forEach((instance) => {
      unclosedTags.add(getTagInstanceId(tagName, instance));
    });
  }

  return unclosedTags;
}
