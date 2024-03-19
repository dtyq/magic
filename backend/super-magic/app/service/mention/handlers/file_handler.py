"""File mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger


class FileHandler(BaseMentionHandler):
    """处理文件类型的mention（file、project_file、upload_file）"""

    def get_type(self) -> str:
        return "file"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """文件类型的mention返回提示文本"""
        return "请优先查看、阅读或理解上述被引用的文件或目录中的内容"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理文件引用（异步）

        Args:
            mention: mention数据
            index: mention序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        file_path = mention.get('file_path', '')
        file_url = mention.get('file_url', '')

        # 标准化文件路径
        file_path = self.normalize_path(file_path)

        context_lines = [f"{index}. [@file_path:{file_path}]"]
        if file_url:
            context_lines.append(f"   - 访问地址: {file_url}")

        logger.info(f"用户prompt添加文件引用: {file_path}")

        return context_lines
