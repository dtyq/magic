"""
工具参数处理工具模块
统一处理工具参数的验证和修复
"""

import json
import json_repair
from typing import Dict, Any, List
from agentlang.logger import get_logger

logger = get_logger(__name__)


def parse_multiline_kv(kv_string: str, param_name: str) -> Dict[str, str]:
    """
    解析多行 key:value 格式字符串为字典

    LLM 在输出此格式时会更稳定（相较于复杂的 JSON 格式），在部分场景下更适合使用。

    用于处理工具参数中的多行键值对格式，例如：
    ```
    key1:value1
    key2:value2
    key3:value3
    ```

    Args:
        kv_string: 多行字符串，每行格式为 "key:value"
        param_name: 参数名称，用于错误日志

    Returns:
        Dict[str, str]: 解析后的键值对映射

    Examples:
        >>> parse_multiline_kv("key1:value1\\nkey2:value2", "test")
        {'key1': 'value1', 'key2': 'value2'}

        >>> parse_multiline_kv("", "test")
        {}
    """
    if not kv_string or not kv_string.strip():
        return {}

    result = {}
    lines = kv_string.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if ':' not in line:
            logger.warning(f"{param_name} 包含无效行（缺少冒号）: {line}")
            continue

        key, value = line.split(':', 1)
        key = key.strip()
        value = value.strip()

        if key and value:
            result[key] = value
        else:
            logger.warning(f"{param_name} 包含空键或空值: {line}")

    return result

def fix_stringified_json_with_schema(
    arguments_dict: Dict[str, Any],
    tool_name: str
) -> tuple[Dict[str, Any], int]:
    """
    修复 AI 把 JSON 结构误序列化为字符串的参数错误

    问题场景：AI 把数组/对象参数传成字符串
    - schema 期望: List[str]  AI 传入: "['highlights']"  (错误)
    - schema 期望: Dict       AI 传入: '{"key":"val"}'   (错误)

    修复策略：
    1. 快速预检查：扫描参数值，只有发现疑似问题(字符串以 [ 或 { 开头)才继续
    2. 获取工具 schema，对比期望类型与实际类型
    3. 仅修复类型不匹配的字段：期望 array/object 但传入了 string
    4. 不修复正常情况：参数本身就是 string 类型时保持原值

    修复效果：
    - 修复前: {"types": "['highlights']"}  → Pydantic 报错 list_type
    - 修复后: {"types": ["highlights"]}    → 参数正确，保存到聊天记录，避免历史污染

    性能优化：正常调用(99%)仅 O(n)简单扫描，异常调用(1%)才执行完整检查

    Args:
        arguments_dict: 工具参数字典
        tool_name: 工具名称

    Returns:
        (修复后的字典, 修复的字段数量)
    """
    # 快速预检查：是否存在疑似被字符串化的 JSON(以 [ 或 { 开头的字符串)
    suspicious_fields = []
    for key, value in arguments_dict.items():
        if isinstance(value, str):
            stripped = value.strip()
            if (stripped.startswith('[') or stripped.startswith('{')) and len(stripped) > 1:
                suspicious_fields.append(key)

    # 没有疑似问题，直接返回(绝大多数情况)
    if not suspicious_fields:
        return arguments_dict, 0

    # 发现疑似问题，获取 schema 进行精确检查
    logger.debug(f"工具 '{tool_name}' 发现 {len(suspicious_fields)} 个疑似字段: {suspicious_fields}")

    from agentlang.tools.metadata_provider import get_tool_param
    tool_param = get_tool_param(tool_name)

    if not tool_param:
        logger.debug(f"工具 '{tool_name}' 无参数定义，跳过修复")
        return arguments_dict, 0

    try:
        properties = tool_param["function"]["parameters"].get("properties", {})
    except (KeyError, TypeError):
        return arguments_dict, 0

    if not properties:
        return arguments_dict, 0

    # 只处理疑似字段(而不是所有字段)
    fixed_count = 0
    result = arguments_dict.copy()

    for key in suspicious_fields:
        value = arguments_dict[key]
        field_schema = properties.get(key)

        if not field_schema:
            continue

        expected_type = field_schema.get("type")
        stripped = value.strip()

        # 根据 schema 期望类型尝试修复
        try:
            if expected_type == "array" and stripped.startswith('['):
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    result[key] = parsed
                    fixed_count += 1
                    logger.info(f"工具 '{tool_name}' 参数 '{key}' 修复: 期望 array，解析字符串化 JSON")
                    logger.debug(f"修复前: {value[:100]}...")
                    logger.debug(f"修复后: {parsed}")

            elif expected_type == "object" and stripped.startswith('{'):
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    result[key] = parsed
                    fixed_count += 1
                    logger.info(f"工具 '{tool_name}' 参数 '{key}' 修复: 期望 object，解析字符串化 JSON")
                    logger.debug(f"修复前: {value[:100]}...")
                    logger.debug(f"修复后: {parsed}")

        except (json.JSONDecodeError, ValueError):
            # 解析失败，保持原值
            pass

    return result, fixed_count


def preprocess_tool_call_arguments(tool_call) -> bool:
    """
    预处理单个工具调用的参数

    处理流程：
    1. 修复 JSON 结构问题（语法错误、格式错误等）
    2. 修复字符串化的 JSON 值（基于 schema 智能修复类型错误）
    3. 标准化 JSON 格式并回写

    直接修改 tool_call 对象的 arguments 字段

    Args:
        tool_call: 工具调用对象（ToolCall 类型，避免循环导入）

    Returns:
        bool: 是否进行了任何处理
    """
    arguments_str = tool_call.function.arguments
    original_arguments = arguments_str
    tool_name = tool_call.function.name

    # Quick check: empty object, no processing needed
    if arguments_str == "{}":
        return False

    # Handle empty/whitespace strings: convert to empty object (common in streaming mode)
    # This is a normal case when tools don't require parameters
    if not arguments_str or not arguments_str.strip():
        tool_call.function.arguments = "{}"
        return True

    # Handle empty array: convert to empty object
    if arguments_str == "[]":
        logger.info(f"工具 '{tool_name}' 参数预处理：空数组转换为空对象")
        tool_call.function.arguments = "{}"
        return True

    # 第一步：确保JSON格式正确
    try:
        # 尝试标准JSON解析
        tool_arguments_dict = json.loads(arguments_str)
        if not isinstance(tool_arguments_dict, dict):
            # 解析成功但不是字典，需要修复
            logger.info(f"工具 '{tool_name}' 参数预处理：解析结果不是字典，需要修复")
            raise ValueError("Not a dictionary")
    except (json.JSONDecodeError, ValueError):
        # JSON格式有问题，需要修复
        logger.info(f"工具 '{tool_name}' 参数预处理：JSON格式需要修复")
        logger.info(f"[json_repair] 修复前的原始内容: {arguments_str}")
        try:
            # 使用json_repair修复JSON结构
            tool_arguments_dict = json_repair.repair_json(arguments_str, return_objects=True)

            # 打印修复后的结果
            repaired_json_str = json.dumps(tool_arguments_dict, ensure_ascii=False, indent=2)
            logger.info(f"[json_repair] 修复后的结果: {repaired_json_str}")

            if not isinstance(tool_arguments_dict, dict):
                logger.warning(f"工具 '{tool_name}' 参数预处理：修复后仍非字典，设为空对象")
                tool_call.function.arguments = "{}"
                return True

            logger.debug(f"工具 '{tool_name}' 参数预处理：JSON结构修复完成")
        except Exception as e:
            logger.warning(f"工具 '{tool_name}' 参数预处理：JSON修复失败 {e}，设为空对象")
            tool_call.function.arguments = "{}"
            return True

    # 第1.5步：修复字符串化的 JSON 值（基于 schema 智能修复）
    tool_arguments_dict, fixed_stringified_count = fix_stringified_json_with_schema(
        tool_arguments_dict,
        tool_name
    )
    if fixed_stringified_count > 0:
        logger.info(f"工具 '{tool_name}' 参数预处理：修复了 {fixed_stringified_count} 个字符串化字段")

    # 第二步：标准化并回写
    normalized_json_str = json.dumps(tool_arguments_dict, ensure_ascii=False, separators=(',', ':'))
    tool_call.function.arguments = normalized_json_str

    # 记录处理结果（任何一种处理都算处理过）
    if fixed_stringified_count > 0 or normalized_json_str != original_arguments:
        if normalized_json_str != original_arguments and fixed_stringified_count == 0:
            logger.debug(f"工具 '{tool_name}' 参数预处理：JSON标准化完成")
        return True
    else:
        return False


def preprocess_tool_calls_batch(tool_calls: List) -> int:
    """
    批量预处理工具调用参数

    Args:
        tool_calls: 工具调用列表

    Returns:
        int: 处理的工具调用数量
    """
    processed_count = 0

    for tool_call in tool_calls:
        try:
            if preprocess_tool_call_arguments(tool_call):
                processed_count += 1
        except Exception as e:
            logger.error(f"预处理工具调用时出错: {e}")

    return processed_count
