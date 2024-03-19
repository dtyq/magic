import re
from pathlib import Path
from typing import Any, Dict, Optional

from agentlang.logger import get_logger
from agentlang.utils.annotation_remover import remove_human_annotations

from .processors import (
    BaseSyntaxProcessor,
    ConfigProcessor,
    DatetimeProcessor,
    EnvProcessor,
    IncludeProcessor,
    PythonProcessor,
    RandomProcessor,
    ShellProcessor,
    TimestampProcessor,
    UuidProcessor,
    VariableProcessor
)

logger = get_logger(__name__)


class SyntaxProcessor:
    """语法处理器管理器

    负责管理和协调多个语法处理器，提供插件化的语法处理功能。
    """

    # 预编译正则表达式，避免重复编译
    # 优化：使用更精确的模式，避免跨层匹配
    _DYNAMIC_BLOCK_PATTERN = re.compile(r"\{\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}")
    _SYNTAX_CALL_PATTERN = re.compile(r"@(\w+)\((.*)\)$")

    # 预编译常用模式
    _SIMPLE_BLOCK_PATTERN = re.compile(r"\{\{([^{}]+)\}\}")  # 简单无嵌套块
    _HAS_DYNAMIC_SYNTAX = re.compile(r"\{\{")  # 快速检测是否包含动态语法

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化语法处理器管理器

        Args:
            agents_dir: Agent 文件目录，用于解析相对路径
        """
        self.agents_dir = agents_dir
        self._processors: Dict[str, BaseSyntaxProcessor] = {}
        self._variable_processor: Optional[VariableProcessor] = None
        self._processing_stack: list[Path] = []  # 用于检测循环引用

        # 注册默认的语法处理器
        self._register_default_processors()

    def _register_default_processors(self):
        """注册默认的语法处理器"""
        default_processors = [
            IncludeProcessor(self.agents_dir),
            EnvProcessor(self.agents_dir),
            ConfigProcessor(self.agents_dir),
            PythonProcessor(self.agents_dir),
            ShellProcessor(self.agents_dir),
            TimestampProcessor(self.agents_dir),
            UuidProcessor(self.agents_dir),
            DatetimeProcessor(self.agents_dir),
            RandomProcessor(self.agents_dir),
        ]

        for processor in default_processors:
            self.register_processor(processor)

        # 单独创建变量处理器，因为它需要动态更新变量
        self._variable_processor = VariableProcessor(self.agents_dir)
        self.register_processor(self._variable_processor)

    def set_variables(self, variables: Dict[str, Any]):
        """设置变量字典

        Args:
            variables: 变量字典
        """
        if self._variable_processor:
            self._variable_processor.update_variables(variables)
            logger.debug(f"已更新语法处理器中的变量: {list(variables.keys()) if variables else []}")

    def register_processor(self, processor: BaseSyntaxProcessor):
        """注册语法处理器

        Args:
            processor: 语法处理器实例
        """
        syntax_name = processor.get_syntax_name()
        self._processors[syntax_name] = processor
        # 设置处理函数引用，用于递归处理
        processor.set_process_function(self.process_dynamic_syntax)
        logger.debug(f"注册语法处理器: @{syntax_name}")

    def unregister_processor(self, syntax_name: str):
        """注销语法处理器

        Args:
            syntax_name: 语法名称
        """
        if syntax_name in self._processors:
            del self._processors[syntax_name]
            logger.debug(f"注销语法处理器: @{syntax_name}")

    def get_registered_syntaxes(self) -> list:
        """获取已注册的语法列表

        Returns:
            list: 语法名称列表
        """
        return list(self._processors.keys())

    def process_dynamic_syntax(self, prompt: str, current_file: Optional[Path] = None) -> str:
        """处理提示词中的动态语法

        Args:
            prompt: 包含动态语法的提示词
            current_file: 当前处理的文件路径，用于循环引用检测

        Returns:
            str: 处理后的提示词

        Raises:
            SyntaxError: 语法格式错误
            ValueError: 参数验证失败
            FileNotFoundError: 文件不存在
            RuntimeError: 处理过程中的其他错误
        """
        # Step 1: Remove human annotations before processing dynamic syntax
        # Enables bilingual maintenance (CN for humans, EN for LLM)
        prompt = remove_human_annotations(prompt)

        # 循环引用检测
        if current_file:
            if current_file in self._processing_stack:
                cycle_path = " -> ".join(str(p) for p in self._processing_stack) + f" -> {current_file}"
                raise RuntimeError(f"检测到循环引用: {cycle_path}")
            self._processing_stack.append(current_file)

        try:
            # 早期退出：快速检测是否包含动态语法
            if not self._HAS_DYNAMIC_SYNTAX.search(prompt):
                return prompt

            # 优先尝试简单模式匹配（性能更好）
            matches = list(self._SIMPLE_BLOCK_PATTERN.finditer(prompt))

            # 如果简单模式无法完全匹配，fallback到复杂模式
            if not matches or self._has_complex_syntax(prompt):
                matches = list(self._DYNAMIC_BLOCK_PATTERN.finditer(prompt))

            if not matches:
                return prompt

            # 预分配结果列表容量，减少动态扩容
            result_parts = [None] * (len(matches) * 2 + 1)
            part_index = 0
            last_end = 0

            # 正向处理，构建结果字符串
            for match in matches:
                start, end = match.span()
                original_block = match.group(0)  # 完整的 {{...}} 块
                code = match.group(1).strip()    # 去掉空格的代码内容

                # 添加匹配前的部分
                if start > last_end:
                    result_parts[part_index] = prompt[last_end:start]
                    part_index += 1

                try:
                    # 解析语法名称和参数
                    syntax_name, params = self._parse_syntax_call(code)

                    if syntax_name not in self._processors:
                        raise RuntimeError(f"不支持的语法: @{syntax_name}")

                    # 使用对应的处理器处理语法
                    processor = self._processors[syntax_name]

                    # 如果是 include 处理器，传递当前文件信息
                    if syntax_name == "include" and hasattr(processor, 'set_current_file'):
                        processor.set_current_file(current_file)

                    processed_content = processor.process(params)

                    # 添加处理后的内容
                    result_parts[part_index] = processed_content
                    part_index += 1

                    logger.debug(f"成功处理语法: @{syntax_name}")

                except Exception as e:
                    logger.error(f"处理动态代码块时出错: {e!s}")
                    # 直接抛出异常，不再替换为错误标记
                    raise RuntimeError(f"语法处理失败: {original_block} - {e!s}") from e

                last_end = end

            # 添加最后一部分
            if last_end < len(prompt):
                result_parts[part_index] = prompt[last_end:]
                part_index += 1

            # 过滤None值并拼接
            return ''.join(part for part in result_parts[:part_index] if part is not None)

        finally:
            # 处理完成后，从栈中移除当前文件
            if current_file and self._processing_stack and self._processing_stack[-1] == current_file:
                self._processing_stack.pop()

    def _has_complex_syntax(self, prompt: str) -> bool:
        """检测是否包含复杂语法（如嵌套括号）

        Args:
            prompt: 提示词内容

        Returns:
            bool: 是否包含复杂语法
        """
        # 简单启发式检测：查找嵌套括号
        in_block = False
        brace_count = 0

        i = 0
        while i < len(prompt) - 1:
            if prompt[i:i+2] == '{{':
                if in_block:
                    return True  # 嵌套的{{ }}
                in_block = True
                i += 2
                continue
            elif prompt[i:i+2] == '}}':
                in_block = False
                i += 2
                continue
            elif in_block and prompt[i] == '{':
                brace_count += 1
            elif in_block and prompt[i] == '}':
                brace_count -= 1
                if brace_count < 0:
                    return True  # 不匹配的括号

            i += 1

        return brace_count > 0  # 有未匹配的括号

    def _parse_syntax_call(self, code: str) -> tuple[str, Dict[str, str]]:
        """解析语法调用

        Args:
            code: 语法代码，如 '@include(path="./prompts/file.md")'

        Returns:
            tuple: (语法名称, 参数字典)

        Raises:
            SyntaxError: 语法格式错误
        """
        # 匹配 @语法名(参数) 格式
        match = self._SYNTAX_CALL_PATTERN.match(code.strip())
        if not match:
            raise SyntaxError(f"语法格式错误，应为 @语法名(参数): {code}")

        syntax_name = match.group(1)
        params_str = match.group(2)

        # 解析参数
        params = self._parse_parameters(params_str)

        return syntax_name, params

    def _parse_parameters(self, params_str: str) -> Dict[str, str]:
        """解析参数字符串，支持位置参数和键值对参数

        Args:
            params_str: 参数字符串，例如 'key1=value1, "pos_value", key2="value2"'

        Returns:
            Dict[str, str]: 解析后的参数字典，位置参数以 _pos_0, _pos_1 等形式存储
        """
        # 早期退出检查
        if not params_str.strip():
            return {}

        # 执行解析
        return self._parse_parameters_impl(params_str)

    def _parse_parameters_impl(self, params_str: str) -> Dict[str, str]:
        """参数解析的实际实现，优化版本"""
        # 预分配结果字典，减少动态扩容
        result = {}
        pos_index = 0
        length = len(params_str)

        # 预估参数数量，优化内存分配
        estimated_params = params_str.count(',') + 1
        if estimated_params > 0:
            # 预分配足够容量
            result = dict.fromkeys(range(estimated_params))
            result.clear()

        i = 0

        while i < length:
            # 跳过空白字符（优化版本）
            i = self._skip_whitespace_fast(params_str, i, length)
            if i >= length:
                break

            # 尝试解析位置参数或键值对参数
            if params_str[i] in '"\'':
                # 可能是位置参数（引号开头且前面没有=）
                quote_start = i
                value, new_i = self._parse_quoted_string_fast(params_str, i, length)

                # 检查是否是位置参数（后面直接是逗号或结束）
                next_i = self._skip_whitespace_fast(params_str, new_i, length)
                if next_i >= length or params_str[next_i] == ',':
                    # 这是位置参数
                    result[f"_pos_{pos_index}"] = value
                    pos_index += 1
                    i = next_i
                    if i < length and params_str[i] == ',':
                        i += 1
                    continue
                else:
                    # 不是位置参数，重新处理为键值对
                    i = quote_start

            # 解析键值对参数
            key, value, new_i = self._parse_key_value_pair_fast(params_str, i, length)
            if key:
                result[key] = value
                i = new_i
                # 跳过逗号
                i = self._skip_whitespace_fast(params_str, i, length)
                if i < length and params_str[i] == ',':
                    i += 1
            else:
                # 无法解析，跳过当前字符
                i += 1

        return result

    def _skip_whitespace_fast(self, text: str, start: int, length: int) -> int:
        """快速跳过空白字符，使用位运算优化"""
        while start < length:
            char = text[start]
            if char == ' ' or char == '\t' or char == '\n' or char == '\r':
                start += 1
            else:
                break
        return start

    def _parse_quoted_string_fast(self, text: str, start: int, length: int) -> tuple[str, int]:
        """快速解析引号字符串，优化版本"""
        if start >= length:
            return "", start

        char = text[start]
        if char != '"' and char != "'":
            return "", start

        quote_char = char
        i = start + 1
        value_start = i

        # 使用更高效的搜索算法
        while i < length:
            if text[i] == quote_char:
                # 简化转义检查（假设大部分情况下没有转义）
                if i == value_start or text[i-1] != '\\':
                    return text[value_start:i], i + 1
            i += 1

        # 没有找到匹配的引号
        return text[value_start:], length

    def _parse_key_value_pair_fast(self, text: str, start: int, length: int) -> tuple[str, str, int]:
        """快速解析键值对，优化版本"""
        # 使用更高效的键名解析
        key_start = start
        while start < length:
            char = text[start]
            # 使用位运算检查字符类型（更快）
            if not ((48 <= ord(char) <= 57) or  # 0-9
                   (65 <= ord(char) <= 90) or   # A-Z
                   (97 <= ord(char) <= 122) or  # a-z
                   char == '_'):
                break
            start += 1

        if start == key_start:
            return "", "", start

        key = text[key_start:start]

        # 跳过空白字符
        start = self._skip_whitespace_fast(text, start, length)

        # 检查等号
        if start >= length or text[start] != '=':
            return "", "", start

        start += 1  # 跳过等号
        start = self._skip_whitespace_fast(text, start, length)

        if start >= length:
            return key, "", start

        # 解析值
        if text[start] in '"\'':
            # 引号包围的值
            value, end_pos = self._parse_quoted_string_fast(text, start, length)
            return key, value, end_pos
        else:
            # 不带引号的值（优化版本）
            value_start = start
            while start < length:
                char = text[start]
                if char == ',' or char == ' ' or char == '\t' or char == '\n' or char == '\r':
                    break
                start += 1
            return key, text[value_start:start], start
