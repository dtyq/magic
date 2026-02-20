"""浏览器使用工具

提供原子化的浏览器操作能力，基于模块化操作架构。

# 浏览器工具架构

## 设计理念

UseBrowser工具是一个基于模块化操作架构的浏览器控制工具，它采用了以下设计原则：

1. **模块化操作**：
   - 将所有浏览器操作拆分为原子化的操作单元
   - 每个操作封装为独立函数，具有明确的输入输出
   - 支持动态扩展新的操作类型

2. **统一接口**：
   - 所有操作通过统一的JSON格式参数调用
   - 操作结果遵循标准化的响应格式
   - 自动生成操作文档和示例

3. **资源管理**：
   - 工具上下文中维护浏览器实例的生命周期
   - 支持多页面和会话状态保持
   - 自动截图和状态跟踪

4. **用户体验优化**：
   - 自动生成页面位置描述
   - 智能截图避免重复
   - 友好的错误处理和提示

## 架构组件

本工具依赖以下核心组件：
- **OperationsRegistry**: 操作注册和管理中心
- **Browser**: 底层浏览器控制接口
- **OperationGroup**: 按功能分组的操作集合
- **BaseOperationParams**: 操作参数基类

## 扩展方式

要扩展浏览器工具的能力：
1. 在适当的OperationGroup中添加新操作
2. 操作会被自动注册到OperationsRegistry
3. UseBrowser工具会自动发现并集成新操作
4. 工具描述会自动更新以包含新操作的文档

无需修改UseBrowser核心代码，符合开闭原则。
"""

import asyncio
import hashlib
import json
import math
import os
import traceback
from typing import Any, Dict, Optional

import json_repair
from pydantic import Field, field_validator

from agentlang.config.config import config
from app.core.context.agent_context import AgentContext
from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import BrowserContent, DisplayType, ToolDetail
from app.core.entity.tool.browser_opration import BrowserOperationNames
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from magic_use.magic_browser import MagicBrowser, MagicBrowserConfig, PageStateSuccess, ScreenshotSuccess, MagicBrowserError
from app.tools.use_browser_operations.operations_registry import operations_registry
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams
from app.tools.workspace_tool import WorkspaceTool
from agentlang.utils.file import generate_safe_filename_with_timestamp
from app.core.entity.event.event_context import EventContext

logger = get_logger(__name__)


class UseBrowserParams(BaseToolParams):
    operation: str = Field(
        ...,
        description="Browser operation to execute"
    )
    operation_params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Specific parameters required for the operation, varies by operation type"
    )

    @field_validator('operation_params', mode='before')
    @classmethod
    def parse_operation_params(cls, value):
        """
        Parse operation_params field to handle cases where LLM provides JSON string instead of object

        Args:
            value: The input value for operation_params field

        Returns:
            Dict[str, Any]: Parsed operation_params as dictionary

        Raises:
            ValueError: When JSON string cannot be parsed with detailed error message
        """
        # If it's already a dict, return as is
        if isinstance(value, dict):
            return value

        # If it's None or empty, return empty dict
        if value is None:
            return {}

        # If it's a string, try to parse as JSON
        if isinstance(value, str):
            value = value.strip()
            # If empty string, return empty dict
            if not value:
                return {}

            # Try standard JSON parsing first
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    logger.info(f"Successfully parsed operation_params from JSON string")
                    return parsed
                else:
                    # Parsed successfully but not a dict - provide helpful error
                    raise ValueError(
                        f"operation_params JSON string was parsed successfully but resulted in {type(parsed).__name__} instead of object. "
                        f"Please provide a JSON object like: {{\"key\": \"value\"}} instead of {repr(parsed)}"
                    )
            except json.JSONDecodeError as e:
                logger.info(f"Standard JSON parsing failed for operation_params: {e}, attempting repair")

                # Try JSON repair
                try:
                    logger.info(f"[json_repair] 修复前的原始内容: {value}")
                    parsed = json_repair.repair_json(value, return_objects=True)

                    repaired_json_str = json.dumps(parsed, ensure_ascii=False, indent=2)
                    logger.info(f"[json_repair] 修复后的结果: {repaired_json_str}")

                    if isinstance(parsed, dict):
                        logger.info(f"Successfully repaired and parsed operation_params from malformed JSON string")
                        return parsed
                    else:
                        # Repaired successfully but not a dict - provide helpful error
                        raise ValueError(
                            f"operation_params JSON string was repaired and parsed but resulted in {type(parsed).__name__} instead of object. "
                            f"Please provide a JSON object like: {{\"key\": \"value\"}} instead of {repr(parsed)}"
                        )
                except Exception as repair_error:
                    # Both parsing and repair failed - provide comprehensive error message
                    raise ValueError(
                        f"operation_params contains invalid JSON string that cannot be parsed or repaired. "
                        f"Original error: {e}. Repair error: {repair_error}. "
                        f"Please provide a valid JSON object like: {{\"url\": \"https://example.com\"}} "
                        f"or omit operation_params if no parameters are needed. "
                        f"Your provided string: {repr(value)}"
                    )

        # For other types, provide helpful error message
        raise ValueError(
            f"operation_params must be an object (dict) or a JSON string, not {type(value).__name__}. "
            f"Examples: {{\"url\": \"https://example.com\"}} or \"{{\\\"url\\\": \\\"https://example.com\\\"}}\" "
            f"Your provided value: {repr(value)}"
        )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息

        为特定字段和错误类型提供更友好的错误消息

        Args:
            field_name: 参数字段名称
            error_type: 错误类型

        Returns:
            Optional[str]: 自定义错误信息，None表示使用默认错误信息
        """
        # 特别处理operation_params的类型错误
        if field_name == "operation_params" and "type" in error_type:
            return "operation_params is optional, but if provided, it must be an object (like: {\"url\": \"https://{actual_domain}/foo/bar\"}), not an array or other types. If you want to call the tool without providing any parameters, you can just call use_browser(operation=\"read_as_markdown\")"

        # 特别处理operation缺失的情况
        if field_name == "operation" and error_type == "missing":
            return "missing required parameter: operation (like: \"goto\", \"read_as_markdown\" and so on)"

        return None


@tool()
class UseBrowser(WorkspaceTool[UseBrowserParams], AbstractFileTool):
    """<!--zh
    浏览器使用工具

    提供原子化的浏览器操作能力，基于模块化操作架构。
    -->
    Browser Tool that provides atomic browser operations based on modular operation architecture.

    Typically, you should first call 'goto' to open a webpage, then perform other operations.
    When calling this tool, specify the 'operation' parameter as one of the operations listed below, and provide the required parameters in 'operation_params' object.
    examples:
    use_browser(operation="goto", operation_params={"url": "https://{actual_domain}/foo/bar"})
    use_browser(operation="read_as_markdown")
    """

    def __init__(self, **data):
        super().__init__(**data)
        # 不再在此处动态生成描述
        # 记录上一次截图的页面特征值和路径
        self._last_screenshot_hash: Optional[str] = None
        self._last_screenshot_path: Optional[str] = None

    def get_prompt_hint(self) -> str:
        """生成包含所有可用浏览器操作的详细提示信息 (优化XML格式)"""
        operations_xml_parts = []
        indent_operation = "  "  # 操作级别的缩进
        indent_param = "    "    # 参数级别的缩进
        indent_example = "    "  # 示例级别的缩进

        # 确保注册表已初始化（包括操作组的自动发现）
        operations_registry._ensure_initialized()

        # 获取所有操作
        all_operations = operations_registry.get_all_operations()
        logger.debug(f"获取到 {len(all_operations)} 个操作用于生成工具提示")

        # 按操作名称排序
        sorted_operations = sorted(all_operations.items())

        for name, op_info in sorted_operations:
            # --- 操作描述 (单行化) ---
            desc_text = op_info.get("description", "") or ""
            # 移除换行符，替换为单个空格，并去除首尾空格
            single_line_desc = ' '.join(desc_text.split()).strip()
            desc_xml = f"{indent_param}<description>{single_line_desc}</description>"

            # --- 参数格式化 (每个param一行) ---
            params_xml_parts = []
            params_class = op_info.get("params_class")

            if params_class:
                for field_name, field in params_class.model_fields.items():
                    # 获取字段类型名称
                    field_type = "unknown"
                    annotation_str = str(field.annotation)
                    if annotation_str.startswith("typing.Optional"):
                        field_type = annotation_str.split("[")[1].split("]")[0]
                    elif hasattr(field.annotation, "__name__"):
                        field_type = field.annotation.__name__
                    else:
                        field_type = annotation_str

                    # 是否必需
                    req_opt_attr = 'required="true"' if field.is_required() else 'optional="true"'

                    # 默认值
                    default_attr = ""
                    if not field.is_required() and field.default is not ... and field.default is not None and field.default != '':
                        default_repr = repr(field.default) # repr() 会自动加引号
                        # XML属性值中的引号需要转义
                        escaped_default = default_repr.replace('"', '&quot;').replace("'", "&apos;")
                        default_attr = f' default="{escaped_default}"'

                    # 参数描述 (作为标签内容)
                    param_desc = field.description or ""

                    # 组合参数XML行 (带缩进)
                    param_xml = f'{indent_param}  <param name="{field_name}" type="{field_type}" {req_opt_attr}{default_attr}>{param_desc}</param>'
                    params_xml_parts.append(param_xml)

            if params_xml_parts:
                params_xml = f"{indent_param}<params>\n"
                params_xml += "\n".join(params_xml_parts)
                params_xml += f"\n{indent_param}</params>"
            else:
                params_xml = f"{indent_param}<params />"


            # --- 示例格式化 (完整调用, 带缩进) ---
            examples_xml_parts = []
            # 遍历示例列表
            for example in op_info.get("examples", []):
                try:
                    # 获取示例中的 operation_params，确保是字典
                    example_params = example.get("operation_params", {})
                    if not isinstance(example_params, dict):
                         example_params = {} # 如果不是字典，则置空

                    # 构建单个示例的调用字符串
                    # 构建完整的调用示例字符串
                    if example_params:
                        # 生成紧凑的单行 JSON 字符串 for operation_params
                        params_json = json.dumps(example_params, ensure_ascii=False, separators=(',', ':'))
                        example_call = f'use_browser(operation="{name}", operation_params={params_json})'
                    else:
                        # 如果 operation_params 为空，则省略
                        example_call = f'use_browser(operation="{name}")'

                    # 放入单个 <example> 标签 (带缩进)
                    example_xml = f"{indent_param}<example>\n{indent_example}  {example_call}\n{indent_param}</example>" # 示例调用再缩进2空格
                    examples_xml_parts.append(example_xml)

                except Exception as e:
                    # 记录警告，但不添加此错误示例到输出
                    logger.warning(f"格式化操作 '{name}' 的示例时出错，该示例将不会显示: {e!s}")
                    # 跳过此示例
                    continue

            # 合并所有示例的 XML
            examples_xml = "\n".join(examples_xml_parts) if examples_xml_parts else f"{indent_param}<examples />" # 如果没有示例，显示空标签


            # --- 组合操作XML (带缩进) ---
            operation_xml = f"""{indent_operation}<operation name="{name}">
{desc_xml}
{params_xml}
{examples_xml}
{indent_operation}</operation>"""
            operations_xml_parts.append(operation_xml)

        # --- 拼接完整提示 (带整体缩进) ---
        operations_xml_str = "\n".join(operations_xml_parts)
        hint = f"""<tool name="use_browser">
  <operations>
{operations_xml_str}
  </operations>
  <instructions>
    Please select one of the 'operation' listed above and provide the corresponding 'operation_params' object to call the use_browser tool.
  </instructions>
</tool>"""
        # 注意：移除了日志记录中的换行符，避免日志过长
        logger.debug(f"Generated use_browser tool prompt (Optimized XML)")
        logger.debug(hint)
        return hint

    async def _create_browser(self):
        """创建浏览器实例的工厂函数

        为每次调用创建全新的浏览器实例，采用多实例模式。
        每个工具调用都会获得独立的浏览器实例。

        Returns:
            Browser: 新创建的浏览器实例
        """
        # 创建爬虫优化浏览器实例（自动初始化）
        browser = await MagicBrowser.create_for_scraping()
        logger.info("创建了新的浏览器实例（多实例模式）")

        return browser

    async def _take_screenshot_for_show(self, browser: MagicBrowser) -> Optional[str]:
        """获取浏览器当前活跃页面的截图

        Args:
            browser: 浏览器实例

        Returns:
            Optional[str]: 截图文件路径，如果失败则返回None
        """
        try:
            # 获取当前活跃页面ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                logger.warning("没有活跃的浏览器页面，无法获取截图")
                return None

            # 获取当前页面对象
            page = await browser.get_page_by_id(page_id)
            if not page:
                logger.warning("当前选择的页面不可用，请传入具体的 page_id 或使用 goto 跳转到可用的页面。，无法获取截图")
                return None

            # 获取当前页面标题和URL
            title = await page.title()

            # 如果页面title为空，则不截图
            if not title:
                logger.info("页面标题为空，不进行截图")
                return None

            # 获取当前页面滚动位置
            scroll_position = await page.evaluate("""
                () => {
                    return {
                        x: window.scrollX || window.pageXOffset,
                        y: window.scrollY || window.pageYOffset
                    };
                }
            """)

            # 获取当前页面内容哈希值作为特征值

            # 获取页面内容
            content = await page.text_content('body')

            # 计算内容的哈希值，加入滚动位置作为因子
            hash_content = content + f"|scrollX:{scroll_position['x']}|scrollY:{scroll_position['y']}|"
            page_hash = hashlib.md5(hash_content.encode()).hexdigest()

            # 检查是否与上次截图的页面内容相同
            if page_hash == self._last_screenshot_hash and self._last_screenshot_path:
                # 检查上次截图文件是否存在
                if os.path.exists(self._last_screenshot_path):
                    logger.info(f"页面内容未变化，复用上次截图: {self._last_screenshot_path}")
                    return self._last_screenshot_path

            # 使用generate_safe_filename_with_timestamp创建安全的文件名
            safe_title = generate_safe_filename_with_timestamp(title)

            # 创建截图文件路径
            screenshot_filename = f"{safe_title}_screenshot.png"
            screenshots_dir = self.base_dir / ".browser_screenshots"
            screenshot_path = screenshots_dir / screenshot_filename

            # 确保screenshots目录存在，使用exist_ok=True避免重复检查
            os.makedirs(screenshots_dir, exist_ok=True)

            # 截取当前页面截图
            await page.screenshot(path=str(screenshot_path))
            logger.info(f"浏览器截图已保存到: {screenshot_path}")

            # 更新最后截图的特征值和路径
            self._last_screenshot_hash = page_hash
            self._last_screenshot_path = str(screenshot_path)

            return str(screenshot_path)
        except Exception as e:
            # 打印错误堆栈
            logger.error(traceback.format_exc())
            logger.error(f"获取浏览器截图失败: {e!s}")
            return None

    async def _find_and_validate_operation(self, operation: str) -> Dict[str, Any]:
        """查找和验证操作处理器

        Args:
            operation: 操作名称

        Returns:
            Dict: 包含操作信息的字典，若操作不存在则为None
        """
        operation_info = operations_registry.get_operation(operation)
        if not operation_info:
            logger.warning(f"未找到操作处理器: {operation}")
            all_ops = list(operations_registry.get_all_operations().keys())
            error_msg = f"未知操作: {operation}。可用的操作有: {', '.join(all_ops)}"
            return {"error": error_msg}
        return operation_info

    async def _validate_and_create_op_params(self, browser: MagicBrowser, operation: str,
                                            params_class: Any, operation_params_dict: Dict[str, Any]) -> Any:
        """验证和创建操作参数对象

        Args:
            browser: 浏览器实例
            operation: 操作名称
            params_class: 参数类
            operation_params_dict: 参数字典

        Returns:
            Dict或对象: 参数对象或错误信息
        """
        # 默认使用原始字典
        if not params_class:
            return operation_params_dict

        try:
            # 自动补充 page_id
            if 'page_id' not in operation_params_dict:
                active_page_id = await browser.get_active_page_id()
                if active_page_id:
                    operation_params_dict['page_id'] = active_page_id
                # 如果没有活跃页面且操作需要 page_id（可以通过检查字段是否必需）
                elif 'page_id' in params_class.model_fields and params_class.model_fields['page_id'].is_required():
                    logger.warning(f"操作 {operation} 需要页面ID，但无活跃页面且未提供 page_id 参数")
                    return {"error": f"执行操作 '{operation}' 需要一个页面，但当前没有打开的页面，请先使用 'goto' 操作打开一个网址。"}

            return params_class(**operation_params_dict)
        except Exception as validation_error:
            logger.warning(f"操作 '{operation}' 参数验证失败: {validation_error!s}")
            # 尝试构建更友好的错误消息
            error_msg = f"操作 '{operation}' 的参数无效。"
            if "missing" in str(validation_error).lower():
                import re
                missing_fields = re.findall(r'Field required \[type=missing, input_value=.*', str(validation_error))
                if missing_fields:
                    # 简化处理：提示检查参数
                    error_msg += f" 缺少必填参数，请参考工具说明检查 '{operation}' 操作所需的 'operation_params'。"
                else:
                    error_msg += f" 错误详情: {validation_error!s}"
            elif "extra fields not permitted" in str(validation_error).lower():
                import re
                extra_fields = re.findall(r"Extra inputs are not permitted \(extra='(.*)'\)", str(validation_error))
                if extra_fields:
                    error_msg += f" 不支持的参数: {extra_fields[0]}。请参考工具说明检查 '{operation}' 操作所需的 'operation_params'。"
                else:
                    error_msg += f" 错误详情: {validation_error!s}"
            else:
                error_msg += f" 请检查参数格式。错误详情: {validation_error!s}"

            return {"error": error_msg}

    async def _generate_browser_status_summary(self, browser: MagicBrowser) -> str:
        """生成浏览器状态摘要

        生成当前浏览器所有页面状态的摘要信息

        Args:
            browser: 浏览器实例

        Returns:
            str: 浏览器状态摘要
        """
        try:
            # 获取活跃页面状态
            active_page_id = await browser.get_active_page_id()
            active_page_state_result = {}
            if active_page_id:
                active_page_state_result = await browser.get_page_state(active_page_id)

            # 获取所有页面信息和非活跃页面信息
            all_pages = await browser.get_all_pages()
            inactive_page_infos = []

            # 并行获取非活跃页面信息
            if all_pages:
                tasks = []
                for pid, page in all_pages.items():
                    if pid != active_page_id:
                        async def get_info(p, p_id):
                            try:
                                title = await p.title()
                                url = p.url
                                return {"id": p_id, "title": title, "url": url}
                            except Exception as e:
                                logger.warning(f"获取非活跃页面 {p_id} 信息失败: {e}")
                                return {"id": p_id, "title": "[获取标题失败]", "url": p.url}
                        tasks.append(get_info(page, pid))

                if tasks:
                    inactive_page_infos = await asyncio.gather(*tasks)

            # 构建状态摘要字符串
            status_lines = ["\n\n---", "浏览器状态："]

            # 添加活跃页面信息
            status_lines.append("当前活跃页面：")
            if isinstance(active_page_state_result, PageStateSuccess):
                page_state = active_page_state_result.state
                status_lines.append(f"- 标题：{page_state.title or '[无标题]'}")
                status_lines.append(f"- URL：{page_state.url or '[无URL]'}")

                # 生成人类可读的状态描述
                status_desc = "状态信息不可用"
                if page_state.position_info and page_state.scroll_position:
                    pos_info = page_state.position_info
                    scroll = page_state.scroll_position

                    if scroll.document_height > 0 and scroll.viewport_height > 0:
                        # 获取滚动相关数据
                        current_y = scroll.y
                        doc_height = scroll.document_height
                        viewport_height = scroll.viewport_height
                        remaining_height = max(0, doc_height - (current_y + viewport_height))

                        # 获取水平滚动相关数据 (新增)
                        current_x = scroll.x
                        doc_width = scroll.document_width
                        viewport_width = scroll.viewport_width

                        # 获取位置信息
                        read_percent = pos_info.read_percent
                        remaining_percent = pos_info.remaining_percent
                        current_screen = pos_info.current_screen
                        total_screens = pos_info.total_screens

                        # 构建垂直位置描述
                        vertical_position_desc = f"垂直位置：第{current_screen:.0f}屏/共{total_screens:.0f}屏"

                        # 构建水平位置描述 (新增)
                        horizontal_position_desc = "" # 重新初始化为空字符串
                        if doc_width > viewport_width: # 重新加入检查：仅在需要水平滚动时添加信息
                            # 计算水平屏数
                            total_horizontal_screens = math.ceil(doc_width / viewport_width) if viewport_width > 0 else 1
                            current_horizontal_screen = math.ceil(current_x / viewport_width + 1) if viewport_width > 0 else 1
                            # 确保当前屏不超过总屏数 (处理浮点数精度问题)
                            current_horizontal_screen = min(current_horizontal_screen, total_horizontal_screens)

                            horizontal_position_desc = f"，水平位置：第{current_horizontal_screen:.0f}屏/共{total_horizontal_screens:.0f}屏"

                        # 组合完整位置描述 (修改)
                        position_desc = f"{vertical_position_desc}{horizontal_position_desc}"

                        # 根据垂直滚动位置提供相应的描述
                        if current_y < viewport_height * 0.5:  # 第一屏
                            status_desc = f"{position_desc}，您正处于网页的开始部分，还有约{remaining_percent:.0f}%的内容在下方。"
                        elif remaining_height < viewport_height * 0.5:  # 接近底部
                            status_desc = f"{position_desc}，您处于网页的底部区域，已阅读约{read_percent:.0f}%的内容。"
                        else:  # 中间部分
                            status_desc = f"{position_desc}，您正处于网页约{read_percent:.0f}%的位置，还有约{remaining_percent:.0f}%的内容在下方。"

                        # 内容较多时添加提示
                        remaining_screens = math.ceil(remaining_height / viewport_height)
                        if current_screen > 5 and remaining_screens >= 2:
                            status_desc += " （页面内容较多，可考虑继续滚动或查看其它相关页面）"

                status_lines.append(f"- 状态：{status_desc}")
            elif active_page_id:  # 有活跃ID但获取状态失败
                error_msg = "未知错误"
                if hasattr(active_page_state_result, 'error'):
                    error_msg = active_page_state_result.error
                elif isinstance(active_page_state_result, dict):
                    error_msg = active_page_state_result.get('error', '未知错误')
                status_lines.append(f"- 错误：{error_msg}")
            else:  # 无活跃页面
                status_lines.append("- 无活跃页面")

            # 添加其他页面信息
            status_lines.append("\n其他打开的页面：")
            if inactive_page_infos:
                for info in inactive_page_infos:
                    status_lines.append(f"- {info['title'] or '[无标题]'} ({info['url']})")
            else:
                status_lines.append("- 无")

            status_lines.append("---")

            # 返回状态摘要
            return "\n".join(status_lines)
        except Exception as e:
            logger.error(f"生成浏览器状态摘要时发生错误: {e}", exc_info=True)
            return "\n\n---\n浏览器状态：获取失败\n---"

    async def _generate_visual_focus_summary(self, browser: MagicBrowser) -> str:
        """生成当前视口的视觉焦点分析摘要

        Args:
            browser: MagicBrowser 实例

        Returns:
            str: 格式化的视觉焦点摘要，如果失败或无活跃页面则返回空字符串。
        """
        # 注意: 每次操作都进行视觉分析可能会增加延迟和成本。
        # 未来可优化: 仅在页面发生显著变化时执行，但这需要可靠且低成本的变化检测机制。
        try:
            page_id = await browser.get_active_page_id()
            if not page_id:
                logger.info("无活跃页面，跳过视觉焦点分析。")
                return "" # 没有活跃页面，无法分析

            logger.info(f"开始为页面 {page_id} 生成视觉焦点分析...")
            # 1. 截取当前视口 (使用临时文件)
            screenshot_result = await browser.take_screenshot(page_id=page_id, path=None, full_page=False)

            if isinstance(screenshot_result, ScreenshotSuccess):
                screenshot_path = str(screenshot_result.path)
                logger.info(f"视觉分析截图成功，路径: {screenshot_path}")

                # 2. 调用视觉理解工具
                visual_understanding = VisualUnderstanding()
                query = "请简要描述当前屏幕画面内的网页中的主体内容，并列出几个最值得关注的关键信息点，以便于用户决策下一步要如何操作。当网页中有大量图片等非文本内容时，请简要描述都有哪些图片，图片中的内容是什么，因为用户在常规情况下只能读取文字内容，你需要告诉它网页中存在图片并提醒它调用工具来提取图片中的内容。（注：网页中的可交互元素会被高亮遮罩块自动标注。）"
                vision_params = VisualUnderstandingParams(images=[screenshot_path], query=query)
                vision_result = await visual_understanding.execute_purely(params=vision_params)

                if vision_result.ok and vision_result.content:
                    # 3. 格式化视觉摘要
                    analysis_content = vision_result.content.strip()
                    logger.info(f"页面 {page_id} 视觉焦点分析完成。")
                    return f"\n\n---\n**视觉焦点:**\n{analysis_content}\n---\""
                else:
                    error_msg = vision_result.content or "视觉模型未返回有效内容"
                    logger.warning(f"视觉理解分析失败或无结果: {error_msg}")

            elif isinstance(screenshot_result, MagicBrowserError):
                logger.warning(f"为视觉分析准备截图失败: {screenshot_result.error}")
            else:
                 logger.warning(f"take_screenshot 返回未知类型: {type(screenshot_result)}")

        except Exception as ve:
            logger.error(f"生成视觉焦点分析时发生意外错误: {ve!s}", exc_info=True)

        # 如果任何步骤失败，返回空字符串
        return "" # 返回空字符串表示失败或跳过

    async def _process_operation_result(self, browser: MagicBrowser, handler_result: ToolResult) -> ToolResult:
        """处理操作结果

        Args:
            browser: 浏览器实例
            handler_result: 操作处理器返回的结果

        Returns:
            ToolResult: 处理后的结果
        """
        if not isinstance(handler_result, ToolResult):
            # 致命错误，需要修改代码
            raise ValueError(f"操作处理器返回结果类型错误: {type(handler_result)}")

        # 1. 生成并添加浏览器状态摘要
        browser_status_summary = ""
        try:
            browser_status_summary = await self._generate_browser_status_summary(browser)
        except Exception as e:
            logger.error(f"生成浏览器状态摘要时发生错误: {e}", exc_info=True)
            # 错误不影响原始结果返回，但摘要可能缺失

        # 2. 生成并添加视觉焦点分析 (如果操作成功)
        visual_focus_summary = ""
        # 暂时关闭视觉分析
        # # 只有在操作成功时才进行视觉分析，避免对错误结果进行不必要的分析
        # if handler_result.ok:
        #     try:
        #         visual_focus_summary = await self._generate_visual_focus_summary(browser)
        #     except Exception as e:
        #          logger.error(f"调用视觉焦点分析时发生意外错误: {e!s}", exc_info=True)
        #          # 错误不影响原始结果返回，但视觉分析可能缺失

        # 3. 组合最终结果
        final_content = handler_result.content or "" # 确保 content 是字符串
        # 追加浏览器状态摘要
        if browser_status_summary:
            if final_content:
                final_content += browser_status_summary
            else:
                final_content = browser_status_summary.lstrip()

        # 追加视觉焦点摘要
        if visual_focus_summary:
            if final_content:
                final_content += visual_focus_summary
            else:
                final_content = visual_focus_summary.lstrip()

        handler_result.content = final_content
        return handler_result

    async def execute(
        self,
        tool_context: ToolContext,
        params: UseBrowserParams
    ) -> ToolResult:
        """执行浏览器操作

        Args:
            tool_context: 工具上下文
            params: 操作参数

        Returns:
            ToolResult: 操作结果，content 字段包含用户友好的文本描述
        """
        operation = params.operation
        operation_params_dict = params.operation_params or {}
        logger.info(f"准备执行浏览器操作: {operation}，参数: {operation_params_dict}")

        try:
            # 获取浏览器实例，使用资源管理机制
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            browser: MagicBrowser = await agent_context.get_resource("browser", self._create_browser)

            # --- 查找操作处理器 ---
            operation_info = await self._find_and_validate_operation(operation)
            if "error" in operation_info:
                return ToolResult(error=operation_info["error"])

            handler = operation_info["handler"]
            params_class = operation_info["params_class"]

            # --- 验证和创建操作参数对象 ---
            op_params_result = await self._validate_and_create_op_params(
                browser, operation, params_class, operation_params_dict
            )
            if isinstance(op_params_result, dict) and "error" in op_params_result:
                return ToolResult(error=op_params_result["error"])

            op_params_obj = op_params_result

            # --- 执行操作处理器 ---
            logger.debug(f"调用操作处理器 '{operation}'...")
            handler_result = await handler(browser, op_params_obj)
            logger.debug(f"操作处理器 '{operation}' 返回结果")

            # --- 处理页面状态 ---
            page_id = await browser.get_active_page_id() # 再次获取，因为操作可能改变活动页面

            # --- 截图 ---
            screenshot_path = None
            if page_id:
                screenshot_path = await self._take_screenshot_for_show(browser)
                if screenshot_path:
                    await self._dispatch_file_event(tool_context, filepath=screenshot_path, event_type=EventType.FILE_CREATED, is_screenshot=True)

            # --- 处理操作结果 ---
            final_result = await self._process_operation_result(browser, handler_result)
            return final_result

        except Exception as e:
            logger.error(f"执行浏览器操作 '{operation}' 时发生意外错误: {e!s}", exc_info=True)
            # 返回通用错误消息
            return ToolResult(error=f"Browser operation '{operation}' failed unexpectedly")

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        # 从工具上下文中获取事件上下文
        event_context = tool_context.get_extension_typed("event_context", EventContext)
        # 如果截图了且存在EventContext，则返回截图
        if event_context and event_context.attachments:
            try:
                # 获取当前页面的url
                agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
                browser: MagicBrowser = await agent_context.get_resource("browser", self._create_browser)
                page_id = await browser.get_active_page_id()
                page = await browser.get_page_by_id(page_id)
                url = page.url
                title = await page.title()

                return ToolDetail(
                    type=DisplayType.BROWSER,
                    data=BrowserContent(url=url, title=title, file_key=event_context.attachments[0].file_key)
                )
            except Exception as e:
                logger.error(f"创建工具详情失败: {e!s}")
                return None
        return None

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        operation = arguments.get("operation", "")
        try:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            browser: MagicBrowser = await agent_context.get_resource("browser", self._create_browser)
            page_id = await browser.get_active_page_id()
            page = await browser.get_page_by_id(page_id)
            url = page.url
            title = await page.title()
            return {
                "action": BrowserOperationNames.get_operation_info(operation),
                "remark": title if title else url
            }
        except Exception as e:
            logger.error(f"获取工具调用后的友好动作和备注失败: {e!s}")
            return {
                "action": BrowserOperationNames.get_operation_info(operation),
                "remark": f"执行了 {operation} 操作"
            }
