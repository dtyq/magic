"""工具详情工厂模块"""

import json
from typing import Any, Dict, List

from app.core.entity.message.server_message import (
    BrowserContent,
    DisplayType,
    FileContent,
    DeepWriteContent,
    SearchContent,
    SearchGroupItem,
    SearchResultItem,
    TerminalContent,
    ToolDetail,
)
from app.core.entity.tool.tool_result import SearchResult


class ToolDetailFactory:
    """工具详情工厂类，用于创建不同类型的ToolDetail对象"""

    @staticmethod
    def create_search_detail_from_search_results(search_results: Dict[str, List[SearchResult]]) -> ToolDetail:
        """从SearchResult对象创建搜索类型的工具详情

        Args:
            search_results: 搜索结果字典，键为查询词，值为SearchResult对象列表

        Returns:
            ToolDetail: 搜索类型的工具详情
        """
        # 创建多组搜索结果
        search_groups = []

        for query, results in search_results.items():
            result_items = [
                SearchResultItem(
                    title=item.title,
                    url=item.url,
                    snippet=item.snippet or "",
                    icon_url=item.icon_url  # 添加图标URL
                ) for item in results
            ]

            # 将一个关键词及其对应的结果创建为一个SearchGroupItem
            group = SearchGroupItem(keyword=query, results=result_items)

            search_groups.append(group)

        return ToolDetail(type=DisplayType.SEARCH, data=SearchContent(groups=search_groups))

    @staticmethod
    def create_terminal_detail(command: str, output: str, exit_code: int) -> ToolDetail:
        """创建终端类型的工具详情

        Args:
            command: 执行的终端命令
            output: 终端输出内容
            exit_code: 命令执行的退出码

        Returns:
            ToolDetail: 终端类型的工具详情
        """
        return ToolDetail(
            type=DisplayType.TERMINAL, data=TerminalContent(command=command, output=output, exit_code=exit_code)
        )

    @staticmethod
    def create_use_browser_detail(oss_key: str, title: str, url: str = "") -> ToolDetail:
        """创建浏览器截图类型的工具详情

        Args:
            oss_key: 图片在对象存储中的键值
            title: 截图标题
            url: 网页URL (可选)

        Returns:
            ToolDetail: 浏览器类型的工具详情，包含截图
        """
        return ToolDetail(type=DisplayType.BROWSER, data=BrowserContent(url=url, title=title, file_key=oss_key))

    @staticmethod
    def create_deep_write_detail(title: str, reasoning_content: str, content: str) -> ToolDetail:
        """创建深度写作类型的工具详情

        Args:
            title: 深度写作标题
            reasoning_content: 深度写作过程内容
            content: 深度写作结论

        Returns:
            ToolDetail: 深度写作类型的工具详情
        """
        return ToolDetail(
            type=DisplayType.MD,  # 使用 Markdown 格式展示
            data=DeepWriteContent(
                title=title,
                reasoning_content=reasoning_content,
                content=content
            )
        )
