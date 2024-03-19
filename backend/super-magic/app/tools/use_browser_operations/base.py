"""浏览器操作基础模块

定义了浏览器操作的基础类和装饰器

# 浏览器操作架构设计

## 设计理念

本模块实现了一个模块化、可扩展的浏览器操作架构，主要设计目标包括：
- 减少每个操作声明的代码量
- 提高代码可维护性
- 支持更灵活的操作扩展
- 保持功能完整性和兼容性

## 核心组件

1. **参数模型化**:
   - 使用Pydantic模型替代手写JSONSchema
   - 利用类型注解自动生成参数验证
   - 基础参数类(BaseOperationParams)提取公共参数

2. **操作装饰器(@operation)**:
   - 自动从方法文档提取描述
   - 自动识别参数类型
   - 自动生成操作示例
   - 简化操作注册过程

3. **操作组织与分组**:
   - OperationGroup基类用于组织相关操作
   - 按功能分类操作到不同模块
   - 插件式架构支持动态加载

4. **统一结果格式**:
   - 提供标准化的结果格式
   - 统一错误处理和返回结构

## 扩展操作

要添加新的浏览器操作：
1. 在合适的操作组模块中定义参数类，继承BaseOperationParams
2. 实现操作方法并使用@operation装饰器注册
3. 无需额外配置，操作会被自动发现和注册

## 相关文件

- base.py: 基础类和装饰器定义
- operations_registry.py: 操作注册和管理
- [各操作组模块].py: 按功能分组的具体操作实现
"""

import functools
import inspect
from abc import ABC
from typing import Any, Callable, ClassVar, Dict, Optional, Union, List

from pydantic import BaseModel, Field

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

# 日志记录器
logger = get_logger(__name__)


class BaseOperationParams(BaseModel):
    """基础操作参数模型

    所有操作参数模型的基类，定义了共同的参数
    """
    page_id: Optional[str] = Field(
        "",
        description="id of the page being operated, currently active page default"
    )


def operation(
    name: Optional[str] = None,
    example: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
):
    """操作注册装饰器

    用于注册浏览器操作并提取参数类型信息

    Args:
        name: 操作名称，默认使用函数名（去除前导下划线）
        example: 操作示例，如果不提供则尝试自动生成
    """
    def decorator(func: Callable):
        # 获取函数的第一个类型注解参数(除self和browser外)
        sig = inspect.signature(func)
        params_class = None
        for param_name, param in list(sig.parameters.items())[2:]:  # 跳过self和browser
            if param.annotation != inspect.Parameter.empty:
                params_class = param.annotation
                break

        @functools.wraps(func)
        async def wrapper(self, browser, params, *args, **kwargs):
            # 验证参数
            if params_class and not isinstance(params, params_class):
                # 尝试转换
                try:
                    params = params_class(**params)
                except Exception as e:
                    # 转换错误时提供更友好的错误信息
                    logger.debug(f"参数验证失败: {e!s}")

                    # 创建友好的错误消息
                    error_msg = self._generate_friendly_validation_error(e, name or func.__name__.lstrip('_'), params_class)

                    # 返回友好的错误结果 - 使用ToolResult
                    return ToolResult(error=error_msg)

            return await func(self, browser, params, *args, **kwargs)

        # 存储操作元数据
        operation_name = name or func.__name__.lstrip('_')
        wrapper.operation_name = operation_name
        wrapper.params_class = params_class
        wrapper.description = func.__doc__ if func.__doc__ else "" # 恢复为使用完整 docstring
        wrapper.is_operation = True  # 标记为操作

        # 处理示例，确保始终为列表
        examples = []
        if example:
            if isinstance(example, list):
                examples.extend(example)
            elif isinstance(example, dict):
                examples.append(example)
            else:
                logger.warning(f"操作 '{operation_name}' 的示例格式无效，应为字典或字典列表")
        elif params_class:
            # 自动生成示例
            try:
                # 创建示例参数 - 只包含有默认值的字段
                example_params = {}
                required_fields = []

                # 收集字段信息
                for field_name, field in params_class.model_fields.items():
                    # 只添加有默认值的非必填字段
                    if field.default is not None and field.default is not ...:
                        example_params[field_name] = field.default
                    elif field.is_required():
                        required_fields.append(field_name)

                # 为必填字段添加合理的占位符
                if required_fields:
                    # 常见字段的示例值
                    common_field_examples = {
                        "url": "https://{actual_domain}/article/12345",
                        "selector": "#abcdefg",
                        "text": "示例文本",
                        "query": "搜索关键词"
                    }

                    # 为必填字段添加示例值
                    for field in required_fields:
                        if field in common_field_examples:
                            example_params[field] = f"<{common_field_examples[field]}>"

                # 创建最终示例
                generated_example = {
                    "operation": operation_name,
                    "operation_params": example_params
                }

                # 如果有必填字段但未提供示例值，添加提示
                if required_fields and not any(field in example_params for field in required_fields):
                    generated_example["required_fields"] = required_fields
                    generated_example["note"] = f"需要提供: {', '.join(required_fields)}"
                examples.append(generated_example)

            except Exception as e:
                logger.debug(f"生成操作示例失败: {e!s}")
                # 如果没有提供示例且无法自动生成，则保持 examples 列表为空
                pass
        else:
            # 如果没有提供示例且无法自动生成，则保持 examples 列表为空
            pass

        wrapper.examples = examples # 始终存储为列表

        return wrapper
    return decorator


class OperationGroup(ABC):
    """操作组基类

    用于组织相关操作的基类
    """
    # 组信息
    group_name: ClassVar[str] = "base"
    group_description: ClassVar[str] = "基础操作组"

    def __init__(self):
        """初始化操作组，注册操作"""
        # 注册表 - 实例变量
        self.operations: Dict[str, Dict[str, Any]] = {}
        logger.debug(f"初始化操作组: {self.__class__.group_name}")
        self.register_operations()

    def register_operations(self):
        """注册该组中的所有操作"""
        # 查找带有 is_operation 标记的实例方法
        for name, method in inspect.getmembers(self, inspect.ismethod):
            if hasattr(method, 'is_operation') and method.is_operation:
                op_name = method.operation_name
                self.operations[op_name] = {
                    "handler": method,
                    "params_class": getattr(method, 'params_class', None),
                    "description": method.description,
                    "examples": getattr(method, 'examples', []) # 获取示例列表
                }
                logger.debug(f"注册操作: {op_name} (来自 {self.__class__.group_name})")

    def get_operations(self) -> Dict[str, Dict[str, Any]]:
        """获取该组中的所有操作"""
        return self.operations

    def _generate_friendly_validation_error(self, error, operation_name, params_class):
        """生成友好的参数验证错误消息

        Args:
            error: 原始错误
            operation_name: 操作名称
            params_class: 参数类

        Returns:
            str: 友好的错误消息
        """
        # 处理pydantic验证错误
        if hasattr(error, 'errors') and callable(getattr(error, 'errors')):
            try:
                error_details = error.errors()

                # 检查是否有缺失字段
                missing_fields = []
                type_errors = []
                other_errors = []

                for err in error_details:
                    err_type = err.get("type", "")
                    field_path = ".".join(str(loc) for loc in err.get("loc", []))

                    if err_type == "missing":
                        missing_fields.append(field_path)
                    elif "type" in err_type:
                        type_errors.append((field_path, err))
                    else:
                        other_errors.append((field_path, err))

                # 处理缺失字段
                if missing_fields:
                    missing_fields_str = ", ".join(missing_fields)
                    error_msg = f"操作 '{operation_name}' 缺少必填参数: {missing_fields_str}"

                    # 添加必填字段的说明
                    if params_class and hasattr(params_class, 'model_fields'):
                        error_msg += "\n\n以下是必填参数的说明:"
                        for field in missing_fields:
                            if field in params_class.model_fields:
                                field_obj = params_class.model_fields[field]
                                field_desc = field_obj.description or "无描述"
                                error_msg += f"\n- {field}: {field_desc}"

                    return error_msg

                # 处理类型错误
                if type_errors:
                    errors_desc = []
                    for field_path, err in type_errors:
                        # 获取预期类型
                        expected_type = "正确格式"
                        if "expected_type" in err.get("ctx", {}):
                            expected_type = err["ctx"]["expected_type"]

                        # 获取实际值类型
                        received_type = "不正确的类型"
                        if "input_type" in err.get("ctx", {}):
                            received_type = err["ctx"]["input_type"]

                        errors_desc.append(f"'{field_path}' 应为 {expected_type} 类型，当前为 {received_type}")

                    return f"操作 '{operation_name}' 参数类型错误: " + "; ".join(errors_desc)

                # 处理其他验证错误
                if other_errors:
                    errors_desc = []
                    for field_path, err in other_errors:
                        msg = err.get("msg", "验证失败")
                        errors_desc.append(f"'{field_path}': {msg}")

                    return f"操作 '{operation_name}' 参数验证失败: " + "; ".join(errors_desc)

            except Exception as e:
                logger.debug(f"解析验证错误详情失败: {e!s}")

        # 如果无法处理为结构化错误，提供一般性的错误消息
        if "dict" in str(error).lower() and "list" in str(error).lower():
            return f"操作 '{operation_name}' 的参数必须是对象(字典)格式，而不是数组或其他类型"

        if "missing" in str(error).lower():
            return f"操作 '{operation_name}' 缺少必填参数，请检查参数完整性"

        if "validation error" in str(error).lower():
            return f"操作 '{operation_name}' 参数验证失败，请检查参数类型和格式"

        # 默认消息
        return f"操作 '{operation_name}' 参数错误: {error!s}"

    # --- 新增: 页面验证辅助方法 ---
    async def _get_validated_page(self, browser: 'MagicBrowser', params: BaseOperationParams) -> tuple[Optional['Page'], Optional[ToolResult]]:
        """获取并验证页面对象。

        处理 page_id 获取逻辑，并检查页面是否存在且未关闭。
        如果页面无效，直接返回包含错误信息的 ToolResult。

        Args:
            browser: MagicBrowser 实例 (使用前向引用避免循环导入)
            params: 操作参数对象

        Returns:
            tuple: (Page对象 | None, ToolResult | None)
        """
        page_id = params.page_id
        error_reason = ""
        page: Optional['Page'] = None # 明确类型

        try:
            if not page_id:
                page_id = await browser.get_active_page_id() # get_active_page_id 内部已检查
                if not page_id:
                    error_reason = "没有活动的页面"
                else:
                    page = await browser.get_page_by_id(page_id)
                    if not page: # 再次确认活动页面是否有效
                        error_reason = f"活动的页面 {page_id} 已失效或关闭"
            else:
                # 提供了 page_id，直接获取并验证
                page = await browser.get_page_by_id(page_id)
                if not page:
                    error_reason = f"指定的页面 {page_id} 不存在或已关闭"

            # 如果有错误，返回 ToolResult
            if error_reason:
                error_msg = f"{error_reason}，请确认页面 ID 是否正确，或先使用 goto 打开一个页面。"
                logger.warning(f"页面验证失败 ({params.__class__.__name__}): {error_msg}")
                return None, ToolResult(error=error_msg)

            # 页面有效，返回页面对象
            return page, None

        except Exception as e:
            # 捕获 browser 调用可能出现的意外错误
            logger.error(f"验证页面时发生意外错误: {e}", exc_info=True)
            return None, ToolResult(error=f"获取或验证页面时发生内部错误: {e}")

    # --- 结束新增 ---

# 动态导入操作组
