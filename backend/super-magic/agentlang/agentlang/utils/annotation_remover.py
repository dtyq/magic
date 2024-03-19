"""Annotation remover utility

Removes human-oriented annotations from prompts to prepare clean content for LLMs.
Maintains bilingual source files for human readability while delivering
optimized English-only content to language models.
"""
import re
from typing import Optional


# Pre-compiled regex patterns for performance
# Inline format: <!--zh: 中文内容--> (allows whitespace before/after)
_HUMAN_ANNOTATION_INLINE = re.compile(r'<!--zh:.*?-->\s*\n?', re.DOTALL)

# Block format: <!--zh\n中文内容\n--> (allows leading/trailing whitespace)
_HUMAN_ANNOTATION_BLOCK = re.compile(r'<!--zh\s*\n.*?\n\s*-->\s*\n?', re.DOTALL)


def remove_human_annotations(content: Optional[str]) -> str:
    """Remove human-oriented annotations from content

    Supports two annotation formats:
    - Inline: <!--zh: 中文内容--> (for short content)
    - Block:  <!--zh\n中文内容\n--> (for longer content)

    This function removes all human annotations and their wrapper tags,
    leaving only the English content for LLM consumption.

    Args:
        content: Content string potentially containing human annotations

    Returns:
        str: Content with all human annotations removed

    Examples:
        >>> text = "<!--zh: 这是中文-->\\nThis is English\\n"
        >>> remove_human_annotations(text)
        'This is English\\n'

        >>> text = "<!--zh\\n这是多行\\n中文注释\\n-->\\nMulti-line English\\n"
        >>> remove_human_annotations(text)
        'Multi-line English\\n'
    """
    if not content:
        return ""

    # Remove inline annotations first
    content = _HUMAN_ANNOTATION_INLINE.sub('', content)

    # Remove block annotations
    content = _HUMAN_ANNOTATION_BLOCK.sub('', content)

    return content
