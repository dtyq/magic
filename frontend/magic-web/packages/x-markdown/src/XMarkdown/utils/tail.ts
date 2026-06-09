import type { StreamingOption } from '../interface';

const DEFAULT_TAIL_CONTENT = '▋';

/**
 * Resolve tail content from streaming option
 * @param tail - boolean | { content?: string } | undefined
 * @returns string | null - tail content or null if disabled
 */
const resolveTailContent = (tail?: StreamingOption['tail']): string | null => {
  if (!tail) {
    return null;
  }

  if (typeof tail === 'boolean') {
    return DEFAULT_TAIL_CONTENT;
  }

  return tail.content || DEFAULT_TAIL_CONTENT;
};

export { DEFAULT_TAIL_CONTENT, resolveTailContent };
