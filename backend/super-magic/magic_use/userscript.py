# magic_use/userscript.py
import dataclasses
from pathlib import Path
from typing import List, Optional


@dataclasses.dataclass(frozen=True)
class Userscript:
    """
    封装一个油猴脚本 (Userscript) 的信息。

    使用 frozen=True 使实例不可变，增加可靠性。
    """
    name: str                  # 脚本名称 (@name)
    file_path: Path            # 脚本源文件路径
    content: str               # 脚本的JS代码内容

    # 可选元数据字段，提供默认值
    version: Optional[str] = None          # 版本号 (@version)
    description: Optional[str] = None      # 描述 (@description)
    match_patterns: List[str] = dataclasses.field(default_factory=list)  # 匹配的URL模式列表 (@match)
    exclude_patterns: List[str] = dataclasses.field(default_factory=list) # 排除的URL模式列表 (@exclude)
    run_at: str = "document-end"          # 注入时机 (@run-at), 默认为 document-end

    def __post_init__(self):
        # 可以在这里添加一些验证逻辑，例如检查 name 和 content 是否为空
        if not self.name:
            raise ValueError("Userscript name cannot be empty.")
        if not self.content:
            raise ValueError("Userscript content cannot be empty.")
        if not self.file_path:
            raise ValueError("Userscript file_path cannot be empty.")
