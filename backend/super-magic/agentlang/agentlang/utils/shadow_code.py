"""
Shadow Code utility module for string obfuscation and deobfuscation.

This module provides functionality to obfuscate and deobfuscate strings using
byte-level character mapping tables, fully compatible with the PHP ShadowCode implementation.

The implementation processes strings byte by byte in UTF-8 encoding to ensure
complete compatibility with the PHP version.
"""

from typing import Optional
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ShadowCode:
    """
    String obfuscation and deobfuscation utility class.

    This class provides methods to obfuscate strings by mapping each byte
    to a different byte using predefined mapping tables, and to reverse
    the process for deobfuscation.

    The implementation processes strings at the byte level (UTF-8 encoding)
    to ensure full compatibility with the PHP ShadowCode implementation.

    The obfuscated string is prefixed with 'SHADOWED_' to indicate it has been
    processed by this utility.
    """

    # Prefix added to obfuscated strings
    PREFIX = 'SHADOWED_'

    # Character mapping table for obfuscation (ASCII value mapping)
    SHUFFLE_MAP = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        122, 34, 45, 86, 60, 103, 51, 114, 64, 52, 68, 91, 40, 90, 48, 126, 110, 63, 124, 77, 98, 50, 73, 66, 113, 97, 79, 37, 102, 76, 32, 87,
        96, 54, 111, 44, 101, 116, 93, 57, 59, 84, 58, 108, 120, 94, 69, 41, 74, 62, 99, 105, 95, 53, 115, 49, 43, 47, 82, 100, 61, 71, 125, 72, 119, 56,
        83, 81, 42, 109, 35, 46, 92, 89, 75, 112, 55, 67, 70, 85, 118, 117, 39, 104, 33, 65, 121, 38, 123, 88, 107, 78, 80, 106, 36, 127,
        129, 128, 131, 130, 133, 132, 135, 134, 137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155, 154, 157, 156, 159, 158,
        161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172, 175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190,
        193, 192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210, 213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222,
        225, 224, 227, 226, 229, 228, 231, 230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248, 251, 250, 253, 252, 255, 254
    ]

    # Reverse mapping table for deobfuscation
    UNSHUFFLE_MAP = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        62, 116, 33, 102, 126, 59, 119, 114, 44, 79, 100, 88, 67, 34, 103, 89, 46, 87, 53, 38, 41, 85, 65, 108, 97, 71, 74, 72, 36, 92, 81, 49, 40, 117,
        55, 109, 42, 78, 110, 93, 95, 54, 80, 106, 61, 51, 123, 58, 124, 99, 90, 98, 73, 111, 35, 63, 121, 105, 45, 43, 104, 70, 77, 84, 64, 57,
        52, 82, 91, 68, 60, 37, 115, 83, 125, 122, 75, 101, 48, 66, 107, 56, 39, 86, 69, 113, 112, 96, 76, 118, 32, 120, 50, 94, 47, 127,
        129, 128, 131, 130, 133, 132, 135, 134, 137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155, 154, 157, 156, 159, 158,
        161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172, 175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190,
        193, 192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210, 213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222,
        225, 224, 227, 226, 229, 228, 231, 230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248, 251, 250, 253, 252, 255, 254
    ]

    @classmethod
    def shadow(cls, input_string: str) -> str:
        """
        Obfuscate a string using byte-level character mapping.
        
        This method processes the input string byte by byte (like PHP version),
        not character by character, to ensure compatibility with PHP implementation.

        Args:
            input_string: The string to obfuscate

        Returns:
            str: The obfuscated string with PREFIX added
        """
        if not input_string:
            return cls.PREFIX

        try:
            # Convert string to UTF-8 bytes (like PHP processes strings)
            input_bytes = input_string.encode('utf-8')
            
            # Process each byte using the shuffle map
            result_bytes = bytearray()
            for byte_val in input_bytes:
                # Ensure byte value is within valid range
                if byte_val < len(cls.SHUFFLE_MAP):
                    mapped_val = cls.SHUFFLE_MAP[byte_val]
                    result_bytes.append(mapped_val)
                else:
                    # For bytes outside the mapping range, keep them as is
                    result_bytes.append(byte_val)
                    logger.warning(f"Byte value {byte_val} is outside mapping range")

            # Convert result bytes back to string
            obfuscated = result_bytes.decode('utf-8', errors='replace')
            return cls.PREFIX + obfuscated

        except UnicodeDecodeError as e:
            logger.error(f"UTF-8 decode error during obfuscation: {e}")
            raise ValueError(f"Failed to decode obfuscated bytes: {e}")
        except Exception as e:
            logger.error(f"Error during obfuscation: {e}")
            raise ValueError(f"Failed to obfuscate string: {e}")

    @classmethod
    def unshadow(cls, input_string: str) -> str:
        """
        Deobfuscate a string that was previously obfuscated.
        
        This method processes the input string byte by byte (like PHP version),
        not character by character, to ensure compatibility with PHP implementation.

        Args:
            input_string: The obfuscated string to deobfuscate

        Returns:
            str: The original string, or the input unchanged if not obfuscated
        """
        if not input_string:
            return input_string

        # Check if the string has the expected prefix
        if not input_string.startswith(cls.PREFIX):
            return input_string

        try:
            # Remove the prefix
            obfuscated_part = input_string[len(cls.PREFIX):]
            
            # Convert string to UTF-8 bytes (like PHP processes strings)
            input_bytes = obfuscated_part.encode('utf-8')

            # Process each byte using the unshuffle map
            result_bytes = bytearray()
            for byte_val in input_bytes:
                # Ensure byte value is within valid range
                if byte_val < len(cls.UNSHUFFLE_MAP):
                    mapped_val = cls.UNSHUFFLE_MAP[byte_val]
                    result_bytes.append(mapped_val)
                else:
                    # For bytes outside the mapping range, keep them as is
                    result_bytes.append(byte_val)
                    logger.warning(f"Byte value {byte_val} is outside mapping range")

            # Convert result bytes back to string
            return result_bytes.decode('utf-8', errors='replace')

        except UnicodeDecodeError as e:
            logger.error(f"UTF-8 decode error during deobfuscation: {e}")
            raise ValueError(f"Failed to decode deobfuscated bytes: {e}")
        except Exception as e:
            logger.error(f"Error during deobfuscation: {e}")
            raise ValueError(f"Failed to deobfuscate string: {e}")

    @classmethod
    def is_shadowed(cls, input_string: str) -> bool:
        """
        Check if a string has been obfuscated (has the shadow prefix).

        Args:
            input_string: The string to check

        Returns:
            bool: True if the string appears to be obfuscated, False otherwise
        """
        return bool(input_string and input_string.startswith(cls.PREFIX))
