"""
标准输出流实现

提供基于标准输出的流实现，用于数据的读写
"""

import json
import os
import sys
from typing import Optional, TextIO

from app.core.stream import Stream
from agentlang.logger import get_logger

logger = get_logger(__name__)

# Environment variable name for debug log file path
STDOUT_MESSAGE_DEBUG_FILE_ENV = "STDOUT_MESSAGE_DEBUG_FILE"

# Max length for tool.detail field when printing logs (only affects log output, not actual data)
_TOOL_DETAIL_LOG_MAX_LEN = 1000


class StdoutStream(Stream):
    """A Stream implementation for handling data through standard output.

    This class provides a way to write string data to standard output.
    Reading is not supported and will raise an error.

    If the environment variable STDOUT_MESSAGE_DEBUG_FILE is set to a file path,
    the output will also be written to that file for local debugging purposes.
    """

    def __init__(self):
        """Initialize the standard output stream."""
        super().__init__()
        self._stdout = sys.stdout
        self._debug_file: Optional[TextIO] = None
        self._init_debug_file()

    def _init_debug_file(self) -> None:
        """Initialize debug file if environment variable is set.

        The file path is treated as a relative path based on the current working directory.
        """
        debug_file_path = os.environ.get(STDOUT_MESSAGE_DEBUG_FILE_ENV)
        if debug_file_path:
            try:
                # Convert relative path to absolute path based on current working directory
                absolute_path = os.path.abspath(debug_file_path)
                # Ensure parent directory exists
                parent_dir = os.path.dirname(absolute_path)
                if parent_dir and not os.path.exists(parent_dir):
                    os.makedirs(parent_dir, exist_ok=True)
                # Open file in append mode
                self._debug_file = open(absolute_path, "a", encoding="utf-8")
                logger.info(f"Debug file enabled: {absolute_path}")
            except Exception as e:
                logger.warning(f"Failed to open debug file '{debug_file_path}': {e}")
                self._debug_file = None

    def _write_to_debug_file(self, data: str) -> None:
        """Write data to debug file if enabled.

        Only writes the payload field from JSON data for better readability.
        """
        if self._debug_file:
            try:
                # Try to parse JSON and extract payload only
                formatted_data = self._format_json_payload_only(data)
                self._debug_file.write(formatted_data + "\n")
                self._debug_file.write("-" * 80 + "\n")  # Separator for readability
                self._debug_file.flush()
            except Exception as e:
                logger.warning(f"Failed to write to debug file: {e}")

    def _format_json(self, data: str) -> str:
        """Try to format data as JSON, return original if not valid JSON."""
        try:
            parsed = json.loads(data)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            # Not valid JSON, return original data
            return data

    def _truncate_tool_detail_for_log(self, data: str) -> str:
        """Truncate payload.tool.detail field for log printing only.

        The tool.detail field can be very long (e.g. web search results),
        which makes logs hard to read. We replace it with a short preview
        when printing to the logger. The original ``data`` is NOT modified;
        actual stream output and debug file still get the full content.
        """
        try:
            parsed = json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return data

        if not isinstance(parsed, dict):
            return data

        payload = parsed.get("payload")
        if not isinstance(payload, dict):
            return data

        tool = payload.get("tool")
        if not isinstance(tool, dict) or "detail" not in tool:
            return data

        detail = tool.get("detail")
        try:
            detail_str = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)
        except (TypeError, ValueError):
            detail_str = str(detail)

        if len(detail_str) <= _TOOL_DETAIL_LOG_MAX_LEN:
            return data

        truncated = (
            detail_str[:_TOOL_DETAIL_LOG_MAX_LEN]
            + f"...(truncated, total {len(detail_str)} chars)"
        )
        tool["detail"] = truncated
        try:
            return json.dumps(parsed, ensure_ascii=False)
        except (TypeError, ValueError):
            return data

    def _format_json_payload_only(self, data: str) -> str:
        """Try to format only the payload field from JSON data, return original if not valid JSON or no payload."""
        try:
            parsed = json.loads(data)
            # If payload field exists, only format and return payload
            if isinstance(parsed, dict) and "payload" in parsed:
                return json.dumps(parsed["payload"], indent=2, ensure_ascii=False)
            # If no payload field, return formatted full data
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            # Not valid JSON, return original data
            return data

    def close(self) -> None:
        """Close the debug file if it was opened."""
        if self._debug_file:
            try:
                self._debug_file.close()
                self._debug_file = None
            except Exception as e:
                logger.warning(f"Failed to close debug file: {e}")

    def __del__(self):
        """Destructor to ensure debug file is closed."""
        self.close()

    async def read(self, size: Optional[int] = None) -> str:
        """Read is not supported for stdout streams.

        Args:
            size: Ignored.

        Raises:
            NotImplementedError: Always, as reading from stdout is not supported.
        """
        raise NotImplementedError("Reading from stdout is not supported")

    async def write(self, data: str, data_type: str = "json") -> int:
        """Write string data to the standard output using the logger.

        Args:
            data: The string data to be written.
            data_type: The type of data to write to the stream.

        Returns:
            The number of bytes written.

        Raises:
            IOError: When there's an error writing to stdout.
        """
        try:
            logger.info(f"StdoutStream: {self._truncate_tool_detail_for_log(data)}")
            # Write to debug file if enabled
            self._write_to_debug_file(data)
            return len(data)
        except Exception as e:
            raise IOError(f"Failed to write to stdout: {e!s}")
