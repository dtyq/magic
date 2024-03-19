"""浏览器操作映射模块

该模块定义了浏览器操作的中文名称和对应的图标

"""

from app.i18n import i18n
from enum import Enum

from agentlang.logger import get_logger

logger = get_logger(__name__)


# 映射字典，方便直接使用字典方式查询
OPERATION_NAME_MAPPING = {
    "goto": "browser.goto",
    "goto_and_read_as_markdown": "browser.goto_and_read",
    "read_as_markdown": "browser.read_as_markdown",
    "visual_query": "browser.visual_query",
    "get_interactive_elements": "browser.get_interactive_elements",
    "find_interactive_element_visually": "browser.find_interactive_element_visually",
    "click": "browser.click",
    "input_text": "browser.input_text",
    "scroll_to": "browser.scroll_to",
}

class BrowserOperationNames(Enum):
    """浏览器操作对应的中文名称

    各个操作的中文名称
    """

    @classmethod
    def get_operation_info(cls, operation_name: str) -> str:
        """获取操作的中文名称和图标

        Args:
            operation_name: 操作名称，如 goto, scroll_page 等

        Returns:
            包含中文名称和图标的字典，如果找不到对应操作则返回 None
        """

        if operation_name not in OPERATION_NAME_MAPPING:
            logger.warning(i18n.translate("browser.unknown_operation", category="tool.messages", operation=operation_name))
            return i18n.translate("browser.unknown_operation", category="tool.messages")
        else:
            message_code = OPERATION_NAME_MAPPING[operation_name]
            return i18n.translate(message_code, category="tool.messages")
