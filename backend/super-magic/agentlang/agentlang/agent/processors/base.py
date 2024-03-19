from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional, Any


class BaseSyntaxProcessor(ABC):
    """语法处理器基类

    所有具体的语法处理器都必须继承此类并实现_run方法。
    基类负责统一的参数处理、验证和错误处理。
    """

    def __init__(self, agents_dir: Optional[Path] = None, **kwargs):
        """初始化语法处理器

        Args:
            agents_dir: Agent文件目录，用于解析相对路径
            **kwargs: 其他配置参数
        """
        self.agents_dir = agents_dir
        self.config = kwargs
        self._processed_params: Dict[str, str] = {}
        self._process_dynamic_syntax_func = None  # 用于递归处理的函数引用

    def set_process_function(self, process_func):
        """设置动态语法处理函数，用于递归处理

        Args:
            process_func: 处理动态语法的函数，通常是 SyntaxProcessor.process_dynamic_syntax
        """
        self._process_dynamic_syntax_func = process_func

    def process(self, params: Dict[str, str]) -> str:
        """处理语法并返回结果（模板方法）

        这是一个模板方法，统一处理参数合并、验证，然后调用具体的_run方法。

        Args:
            params: 解析后的参数字典

        Returns:
            str: 处理后的内容

        Raises:
            ValueError: 参数验证失败
            FileNotFoundError: 文件不存在
            IOError: 文件读取失败
            RuntimeError: 处理过程中的其他错误
        """
        # 1. 合并位置参数和键值对参数
        self._processed_params = self.merge_positional_params(params)

        # 2. 验证参数
        required_params = self.get_required_params()
        optional_params = self.get_optional_params()
        self.validate_params(self._processed_params, required_params, optional_params)

        # 3. 调用具体的处理逻辑
        return self._run()

    @abstractmethod
    def _run(self) -> str:
        """具体的语法处理逻辑

        子类需要实现此方法来处理具体的语法。
        可以通过 _get_parameter 方法获取已验证的参数。

        Returns:
            str: 处理后的内容

        Raises:
            ValueError: 处理过程中的业务错误
            FileNotFoundError: 文件不存在
            IOError: 文件读取失败
            RuntimeError: 处理过程中的其他错误
        """
        pass

    def get_required_params(self) -> List[str]:
        """获取必需参数列表

        子类可以重写此方法来定义必需参数。

        Returns:
            List[str]: 必需参数键名列表
        """
        return []

    def get_optional_params(self) -> List[str]:
        """获取可选参数列表

        子类可以重写此方法来定义可选参数。
        如果返回None，则不进行无效参数检查。

        Returns:
            List[str]: 可选参数键名列表，None表示不限制
        """
        return None

    def _get_parameter(self, key: str, default: Any = None) -> Optional[str]:
        """获取已处理的参数值

        Args:
            key: 参数键名
            default: 默认值

        Returns:
            Optional[str]: 参数值，如果参数不存在且default为None，则返回None
        """
        if key in self._processed_params:
            return self._processed_params[key]
        elif default is not None:
            return str(default)
        else:
            return None

    def get_positional_param_mapping(self) -> List[str]:
        """获取位置参数到键名的映射

        Returns:
            List[str]: 位置参数对应的键名列表，按位置顺序排列
                      例如: ["path"] 表示第一个位置参数映射到 "path" 键
                            ["key", "default"] 表示第一个位置参数映射到 "key"，第二个映射到 "default"
        """
        return []

    def merge_positional_params(self, params: Dict[str, str]) -> Dict[str, str]:
        """合并位置参数和键值对参数

        Args:
            params: 原始参数字典，包含位置参数(_pos_0, _pos_1等)和键值对参数

        Returns:
            Dict[str, str]: 合并后的参数字典，位置参数已映射到对应的键名
        """
        result = {}
        param_mapping = self.get_positional_param_mapping()

        # 首先处理位置参数
        for i, key_name in enumerate(param_mapping):
            pos_key = f"_pos_{i}"
            if pos_key in params:
                result[key_name] = str(params[pos_key])

        # 然后添加键值对参数（键值对参数优先级更高，会覆盖位置参数）
        for key, value in params.items():
            if not key.startswith("_pos_"):
                result[key] = str(value)

        return result

    def validate_params(self, params: Dict[str, str], required_keys: list, optional_keys: Optional[list] = None) -> None:
        """验证参数

        Args:
            params: 参数字典
            required_keys: 必需的参数键列表
            optional_keys: 可选的参数键列表

        Raises:
            ValueError: 参数验证失败
        """
        # 检查必需参数
        missing_keys = set(required_keys) - set(params.keys())
        if missing_keys:
            raise ValueError(f"缺少必需参数: {', '.join(missing_keys)}")

        # 检查无效参数
        if optional_keys is not None:
            allowed_keys = set(required_keys + optional_keys)
            invalid_keys = set(params.keys()) - allowed_keys
            if invalid_keys:
                raise ValueError(f"无效参数: {', '.join(invalid_keys)}")

    def get_syntax_name(self) -> str:
        """获取语法名称

        Returns:
            str: 语法名称，如 'include', 'env', 'config'
        """
        # 默认使用类名去掉Processor后缀作为语法名称
        class_name = self.__class__.__name__
        if class_name.endswith('Processor'):
            return class_name[:-9].lower()  # 去掉'Processor'
        return class_name.lower()

    def resolve_path(self, path: str) -> Path:
        """解析文件路径

        Args:
            path: 文件路径

        Returns:
            Path: 解析后的路径对象
        """
        if not path.startswith("/") and self.agents_dir:
            # 相对于agents目录的路径
            return self.agents_dir / path
        return Path(path)
