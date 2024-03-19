"""
XML Escape Fixer - Intelligent XML special character detection and fixing

This utility automatically detects and fixes unescaped XML special characters
while avoiding double-escaping already correct entities.
"""

import re
from typing import Tuple, List, Dict


class XMLEscapeFixer:
    """Fix unescaped XML special characters intelligently"""

    # XML entities pattern - matches complete entity references
    ENTITY_PATTERN = re.compile(
        r'&(?:'
        r'(?:amp|lt|gt|quot|apos)|'  # Named entities
        r'#\d+|'                      # Decimal numeric entities
        r'#x[0-9a-fA-F]+'             # Hexadecimal numeric entities
        r');'
    )

    # Special characters that need escaping (except &, handled separately)
    SIMPLE_ESCAPES = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
    }

    @classmethod
    def fix_xml_string(cls, xml_string: str) -> Tuple[str, List[Dict[str, any]]]:
        """
        Fix unescaped XML special characters in the string

        Args:
            xml_string: The XML string to fix

        Returns:
            Tuple of (fixed_string, fixes_list)
            - fixed_string: The corrected XML string
            - fixes_list: List of fixes made, each containing:
                - char: The character that was fixed
                - position: Position in original string
                - context: Surrounding text for context
        """
        fixes = []
        result = xml_string

        # First pass: Fix simple characters (<, >, ", ')
        # We'll track actual changes by comparing before and after
        for char, escaped in cls.SIMPLE_ESCAPES.items():
            if char in result:
                before = result
                # Replace all occurrences (only outside tags)
                result = cls._replace_outside_tags(result, char, escaped)

                # Record actual fixes by comparing before and after
                if result != before:
                    # Find positions where char was actually replaced
                    i = 0
                    while i < len(before):
                        if before[i] == char:
                            # Check if this position was actually fixed
                            if not cls._is_tag_char(before, i):
                                context = cls._get_context(before, i)
                                fixes.append({
                                    'char': char,
                                    'escaped_as': escaped,
                                    'position': i,
                                    'context': context
                                })
                        i += 1

        # Second pass: Fix ampersands (more complex due to entity references)
        result, ampersand_fixes = cls._fix_ampersands(result)
        fixes.extend(ampersand_fixes)

        return result, fixes

    @classmethod
    def _fix_ampersands(cls, text: str) -> Tuple[str, List[Dict[str, any]]]:
        """
        Fix unescaped ampersands while preserving valid entity references

        Args:
            text: The text to fix

        Returns:
            Tuple of (fixed_text, fixes_list)
        """
        fixes = []
        result = []
        i = 0

        while i < len(text):
            if text[i] == '&':
                # Check if this is a valid entity reference
                match = cls.ENTITY_PATTERN.match(text, i)
                if match:
                    # Valid entity, keep as-is
                    result.append(match.group())
                    i = match.end()
                else:
                    # Invalid/incomplete entity, escape it
                    context = cls._get_context(text, i)
                    fixes.append({
                        'char': '&',
                        'escaped_as': '&amp;',
                        'position': i,
                        'context': context
                    })
                    result.append('&amp;')
                    i += 1
            else:
                result.append(text[i])
                i += 1

        return ''.join(result), fixes

    @classmethod
    def _is_inside_tag(cls, text: str, position: int) -> bool:
        """
        Check if the position is inside an XML tag

        Args:
            text: The text to check
            position: The position to check

        Returns:
            True if inside a tag (between < and >)
        """
        # Look backwards for the nearest < or >
        last_open = text.rfind('<', 0, position)
        last_close = text.rfind('>', 0, position)

        # If we found an opening < that's closer than the last >, we're inside a tag
        return last_open > last_close

    @classmethod
    def _is_tag_char(cls, text: str, position: int) -> bool:
        """
        Check if the character at position is part of a tag delimiter (< or >)

        Args:
            text: The text to check
            position: The position to check

        Returns:
            True if this < or > is a tag delimiter
        """
        char = text[position]
        if char not in '<>':
            return False

        # For '<', check if it's the start of a tag
        if char == '<':
            # It's a tag if followed by tag name or closing tag marker
            if position + 1 < len(text):
                next_char = text[position + 1]
                # Tag if followed by letter, /, or !
                if next_char.isalpha() or next_char in ['/', '!', '?']:
                    return True

        # For '>', check if we're currently inside a tag
        elif char == '>':
            # Check if there's an unclosed < before this >
            return cls._is_inside_tag(text, position)

        return False

    @classmethod
    def _replace_outside_tags(cls, text: str, char: str, replacement: str) -> str:
        """
        Replace character with replacement, but only outside XML tags

        Args:
            text: The text to process
            char: The character to replace
            replacement: The replacement string

        Returns:
            The processed text
        """
        result = []
        inside_tag = False
        i = 0

        while i < len(text):
            current_char = text[i]

            # Check if this is a tag delimiter
            if current_char == '<' and cls._is_tag_char(text, i):
                inside_tag = True
                result.append(current_char)
            elif current_char == '>' and cls._is_tag_char(text, i):
                inside_tag = False
                result.append(current_char)
            elif current_char == char and not inside_tag:
                # Only replace if not a tag character
                if char in '<>' and cls._is_tag_char(text, i):
                    result.append(current_char)
                else:
                    result.append(replacement)
            else:
                result.append(current_char)
            i += 1

        return ''.join(result)

    @classmethod
    def _get_context(cls, text: str, position: int, context_length: int = 20) -> str:
        """
        Get surrounding context for a position in text

        Args:
            text: The text
            position: The position
            context_length: How many characters to show on each side

        Returns:
            Context string with the character marked
        """
        start = max(0, position - context_length)
        end = min(len(text), position + context_length + 1)

        before = text[start:position]
        char = text[position]
        after = text[position + 1:end]

        # Add ellipsis if truncated
        prefix = '...' if start > 0 else ''
        suffix = '...' if end < len(text) else ''

        return f"{prefix}{before}[{char}]{after}{suffix}"

    @classmethod
    def format_fixes_message(cls, fixes: List[Dict[str, any]]) -> str:
        """
        Format the fixes into a human-readable message

        Args:
            fixes: List of fixes made

        Returns:
            Formatted message string
        """
        if not fixes:
            return ""

        # Group fixes by character and get escaped form
        char_info = {}
        for fix in fixes:
            char = fix['char']
            escaped = fix['escaped_as']
            if char not in char_info:
                char_info[char] = {'escaped': escaped, 'count': 0}
            char_info[char]['count'] += 1

        # Build message
        parts = []
        for char, info in char_info.items():
            parts.append(f"'{char}' → '{info['escaped']}' ({info['count']}处)")

        return f"XML格式已自动修复: {', '.join(parts)}"
