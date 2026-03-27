"""Developer annotation remover

Removes developer-oriented bilingual annotations from prompts before sending to LLMs.
Source files use <!--zh ... --> blocks to keep Chinese explanations alongside English
content for developer readability; these blocks must be stripped from the LLM context.
"""
import re
from typing import Optional

# Inline format: <!--zh: 中文内容-->
_DEV_ANNOTATION_INLINE = re.compile(r'<!--zh:.*?-->\s*\n?', re.DOTALL)

# Block format: <!--zh\n中文内容\n-->
_DEV_ANNOTATION_BLOCK = re.compile(r'<!--zh\s*\n.*?\n\s*-->\s*\n?', re.DOTALL)


def remove_developer_annotations(content: Optional[str]) -> str:
    """Remove developer-oriented bilingual annotations from content.

    Strips <!--zh: ... --> and <!--zh\\n...\\n--> blocks written for developers,
    leaving only the English content for LLM consumption.

    Examples:
        >>> remove_developer_annotations("<!--zh: 这是中文-->\\nThis is English\\n")
        'This is English\\n'

        >>> remove_developer_annotations("<!--zh\\n多行\\n中文\\n-->\\nEnglish\\n")
        'English\\n'
    """
    if not content:
        return ""
    content = _DEV_ANNOTATION_INLINE.sub('', content)
    content = _DEV_ANNOTATION_BLOCK.sub('', content)
    return content


# 向后兼容别名
remove_human_annotations = remove_developer_annotations
