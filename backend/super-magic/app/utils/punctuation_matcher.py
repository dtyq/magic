"""
Punctuation matcher utility for detecting and diagnosing punctuation mismatches.

This module helps detect when a string match fails due to Chinese/English punctuation differences.
"""

import re
from typing import Optional, Tuple
import difflib


class PunctuationMatcher:
    """
    Helper class to detect and diagnose punctuation mismatches between strings.
    """

    # Mapping of common Chinese-English punctuation pairs
    PUNCTUATION_PAIRS = {
        '，': ',',   # Chinese comma -> English comma
        '。': '.',   # Chinese period -> English period
        '：': ':',   # Chinese colon -> English colon
        '；': ';',   # Chinese semicolon -> English semicolon
        '！': '!',   # Chinese exclamation -> English exclamation
        '？': '?',   # Chinese question mark -> English question mark
        '（': '(',   # Chinese left paren -> English left paren
        '）': ')',   # Chinese right paren -> English right paren
        '"': '"',    # Chinese left quote -> English double quote
        '"': '"',    # Chinese right quote -> English double quote
        ''': "'",    # Chinese left single quote -> English single quote
        ''': "'",    # Chinese right single quote -> English single quote
        '《': '<',   # Chinese left book title -> English less than
        '》': '>',   # Chinese right book title -> English greater than
        '、': ',',   # Chinese enumeration comma -> English comma
    }

    # Reverse mapping (English -> Chinese)
    # Use the most common Chinese punctuation for each English one
    REVERSE_PAIRS = {
        ',': '，',   # English comma -> Chinese comma (not 、)
        '.': '。',
        ':': '：',
        ';': '；',
        '!': '！',
        '?': '？',
        '(': '（',
        ')': '）',
        '"': '"',    # Default to left quote
        "'": '\u2018',    # Default to left single quote (using unicode to avoid syntax issue)
        '<': '《',
        '>': '》',
    }

    @classmethod
    def normalize_punctuation(cls, text: str, to_english: bool = True) -> str:
        """
        Normalize punctuation in text to either English or Chinese style.

        Args:
            text: Input text
            to_english: If True, convert to English punctuation; if False, convert to Chinese

        Returns:
            Text with normalized punctuation
        """
        if to_english:
            # Convert Chinese -> English
            for cn, en in cls.PUNCTUATION_PAIRS.items():
                text = text.replace(cn, en)
        else:
            # Convert English -> Chinese
            for en, cn in cls.REVERSE_PAIRS.items():
                text = text.replace(en, cn)
        return text

    @classmethod
    def find_punctuation_differences(cls, search_str: str, target_str: str) -> list:
        """
        Find specific positions where punctuation differs between two strings.

        Args:
            search_str: The string being searched for (old_string)
            target_str: The string in the file content

        Returns:
            List of tuples: (position, char_in_search, char_in_target, punctuation_type)
        """
        differences = []

        # Only check if strings are reasonably similar in length
        if abs(len(search_str) - len(target_str)) > len(search_str) * 0.2:
            return differences

        # Use SequenceMatcher to align the strings
        matcher = difflib.SequenceMatcher(None, search_str, target_str)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                # Check if the replacement is just a punctuation change
                search_part = search_str[i1:i2]
                target_part = target_str[j1:j2]

                # Single character replacement
                if len(search_part) == 1 and len(target_part) == 1:
                    search_char = search_part
                    target_char = target_part

                    # Check if it's a Chinese-English punctuation pair
                    if cls.PUNCTUATION_PAIRS.get(search_char) == target_char:
                        differences.append((
                            i1,
                            search_char,
                            target_char,
                            'chinese_to_english'
                        ))
                    elif cls.PUNCTUATION_PAIRS.get(target_char) == search_char:
                        differences.append((
                            i1,
                            search_char,
                            target_char,
                            'english_to_chinese'
                        ))

        return differences

    @classmethod
    def check_fuzzy_match_with_punctuation(cls, search_str: str, content: str,
                                          max_results: int = 3) -> Optional[str]:
        """
        Find strings in content that match search_str except for punctuation.

        Args:
            search_str: The string to search for
            content: The content to search in
            max_results: Maximum number of similar strings to return

        Returns:
            Formatted error message with suggestions, or None if no close matches found
        """
        # Normalize both strings and check if they would match
        search_normalized = cls.normalize_punctuation(search_str, to_english=True)
        content_normalized = cls.normalize_punctuation(content, to_english=True)

        # If normalized versions match, we have a punctuation issue
        if search_normalized in content_normalized:
            # Find the actual match in the original content
            # We need to locate where the match is
            lines = content.split('\n')
            search_lines = search_str.split('\n')

            suggestions = []

            if len(search_lines) == 1:
                # Single line search
                for i, line in enumerate(lines):
                    line_normalized = cls.normalize_punctuation(line, to_english=True)
                    if search_normalized in line_normalized:
                        # Found a line that matches after normalization
                        # Now find punctuation differences
                        differences = cls.find_punctuation_differences(search_str, line)

                        if differences:
                            diff_desc = []
                            for pos, search_char, target_char, punc_type in differences:
                                if punc_type == 'chinese_to_english':
                                    diff_desc.append(
                                        f"Position {pos}: You used Chinese '{search_char}' but file has English '{target_char}'"
                                    )
                                else:
                                    diff_desc.append(
                                        f"Position {pos}: You used English '{search_char}' but file has Chinese '{target_char}'"
                                    )

                            suggestions.append({
                                'line_num': i + 1,
                                'line_content': line[:100],
                                'differences': diff_desc
                            })

                            if len(suggestions) >= max_results:
                                break
            else:
                # Multi-line search - check first line
                search_first_normalized = cls.normalize_punctuation(search_lines[0], to_english=True)

                for i, line in enumerate(lines):
                    line_normalized = cls.normalize_punctuation(line, to_english=True)

                    # Check if first line matches
                    if search_first_normalized in line_normalized:
                        differences = cls.find_punctuation_differences(search_lines[0], line)

                        if differences:
                            diff_desc = []
                            for pos, search_char, target_char, punc_type in differences:
                                if punc_type == 'chinese_to_english':
                                    diff_desc.append(
                                        f"Position {pos}: You used Chinese '{search_char}' but file has English '{target_char}'"
                                    )
                                else:
                                    diff_desc.append(
                                        f"Position {pos}: You used English '{search_char}' but file has Chinese '{target_char}'"
                                    )

                            suggestions.append({
                                'line_num': i + 1,
                                'line_content': line[:100],
                                'differences': diff_desc
                            })

                            if len(suggestions) >= max_results:
                                break

            if suggestions:
                error_msg = "--- PUNCTUATION MISMATCH DETECTED ---\n\n"
                error_msg += "Detected Chinese/English punctuation differences:\n\n"

                for suggestion in suggestions:
                    error_msg += f"Line {suggestion['line_num']}:\n"
                    error_msg += f"  Content: {suggestion['line_content']}...\n"
                    for diff in suggestion['differences']:
                        error_msg += f"  - {diff}\n"
                    error_msg += "\n"

                error_msg += "-> Copy the exact text from the file, preserving the punctuation style.\n\n---\n"

                return error_msg

        return None

    @classmethod
    def try_auto_fix_punctuation(cls, search_str: str, content: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Try to automatically fix punctuation mismatch by finding a unique match.

        Args:
            search_str: The string to search for (with mixed punctuation)
            content: The content to search in

        Returns:
            Tuple of (corrected_string, warning_message) if unique match found,
            or (None, None) if no unique match
        """
        # Normalize both strings
        search_normalized = cls.normalize_punctuation(search_str, to_english=True)
        content_normalized = cls.normalize_punctuation(content, to_english=True)

        # Check if normalized version exists in content
        if search_normalized not in content_normalized:
            return None, None

        # Find all occurrences of the normalized string in normalized content
        normalized_count = content_normalized.count(search_normalized)

        # Only auto-fix if there's exactly one match
        if normalized_count != 1:
            return None, None

        # Find the actual string in the original content
        # We need to locate the substring that normalizes to our search string
        start_pos = content_normalized.index(search_normalized)
        end_pos = start_pos + len(search_normalized)

        # Extract the actual substring from original content
        actual_string = content[start_pos:end_pos]

        # Generate warning message
        # Find punctuation differences
        differences = cls.find_punctuation_differences(search_str, actual_string)

        if not differences:
            # This shouldn't happen, but handle gracefully
            return None, None

        # Build warning message
        warning = (
            "**Auto-Correction Applied: Punctuation Mismatch Fixed**\n\n"
            "Found a string with mixed Chinese/English punctuation marks.\n\n"
        )

        # Show what was corrected
        warning += f"- Your input: `{search_str[:100]}{'...' if len(search_str) > 100 else ''}`\n"
        warning += f"- Matched string: `{actual_string[:100]}{'...' if len(actual_string) > 100 else ''}`\n"
        warning += "- Reason: Punctuation style mismatch detected:\n"

        for pos, search_char, target_char, punc_type in differences:
            if punc_type == 'chinese_to_english':
                warning += f"  * Position {pos}: Chinese '{search_char}' -> English '{target_char}'\n"
            else:
                warning += f"  * Position {pos}: English '{search_char}' -> Chinese '{target_char}'\n"

        warning += "\n**IMPORTANT**: For all future requests, you MUST use the exact punctuation style from the file to avoid repeated corrections."

        return actual_string, warning
