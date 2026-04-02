import json
import subprocess
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator
from agentlang.tools.tool_result import ToolResult

class SearchResult(BaseModel):
    """单个搜索结果项"""
    title: str
    url: str
    snippet: Optional[str] = None
    source: Optional[str] = None
    icon_url: Optional[str] = None  # 添加网站图标URL字段


class WebSearchToolResult(ToolResult):
    """必应搜索工具的结构化结果"""
    # 存放需要返回给大模型的搜索结果
    output_results: Dict[str, List[SearchResult]] = Field(default_factory=dict)
    # 存放需要返回给客户端的搜索结果
    search_results: Dict[str, List[SearchResult]] = Field(default_factory=dict)

    def set_output_results(self, query: str, results: List[Dict[str, Any]]) -> None:
        """将原始搜索结果转换为结构化的output_results

        Args:
            query: 搜索查询字符串
            results: 原始搜索结果列表
        """
        if query not in self.output_results:
            self.output_results[query] = []

        for result in results:
            search_result = SearchResult(
                title=result.get("title", ""),
                url=result.get("link", ""),
                snippet=result.get("snippet"),
            )
            self.output_results[query].append(search_result)

    def set_search_results(self, query: str, results: List[Dict[str, Any]]) -> None:
        """将原始搜索结果转换为结构化的search_results

        Args:
            query: 搜索查询字符串
            results: 原始搜索结果列表
        """
        if query not in self.search_results:
            self.search_results[query] = []

        for result in results:
            search_result = SearchResult(
                title=result.get("title", ""),
                url=result.get("link", ""),
                snippet=result.get("snippet"),
                source=result.get("source"),
                icon_url=result.get("icon_url", "")  # 添加图标URL，仅用于客户端显示
            )
            self.search_results[query].append(search_result)

    def add_query_results(self, query: str, results: List[SearchResult]) -> None:
        """添加查询结果到search_results

        Args:
            query: 搜索查询字符串
            results: 结构化的搜索结果列表
        """
        self.search_results[query] = results

    def output_results_to_dict(self) -> Dict[str, List[Dict[str, Any]]]:
        """将output_results转换为字典格式

        Returns:
            Dict[str, List[Dict[str, Any]]]: 转换后的字典
        """
        result_dict = {}
        for k, v in self.output_results.items():
            result_dict[k] = []
            for r in v:
                # 转换为字典
                item_dict = r.model_dump()
                # 移除空值字段
                if item_dict.get("snippet") is None:
                    item_dict.pop("snippet", None)
                if item_dict.get("source") is None:
                    item_dict.pop("source", None)
                if item_dict.get("icon_url") is None:
                    item_dict.pop("icon_url", None)
                result_dict[k].append(item_dict)
        return result_dict

class TerminalToolResult(ToolResult):
    """终端命令执行工具的结构化结果"""
    command: str = Field(default="", description="执行的终端命令")
    exit_code: int = Field(default=0, description="命令执行的退出码，0表示成功")

    def set_command(self, command: str) -> None:
        """设置执行的终端命令

        Args:
            command: 终端命令
        """
        self.command = command

    def set_exit_code(self, exit_code: int) -> None:
        """设置命令执行的退出码

        Args:
            exit_code: 退出码，通常0表示成功
        """
        self.exit_code = exit_code

    def _handle_terminal_result(self, process_result: subprocess.CompletedProcess, command: str) -> None:
        """从subprocess执行结果中设置属性

        Args:
            process_result: subprocess.CompletedProcess对象
            command: 执行的命令
        """
        self.command = command
        self.exit_code = process_result.returncode

        # 处理输出
        if process_result.stdout:
            self.content = process_result.stdout.strip()

        if process_result.stderr:
            self.content = process_result.stderr.strip()


class BrowserToolResult(ToolResult):
    """浏览器工具的结构化结果"""
    url: Optional[str] = Field(default=None, description="访问的URL")
    operation: str = Field(default="", description="执行的浏览器操作")
    oss_key: Optional[str] = Field(default=None, description="截图的对象存储键值")
    title: Optional[str] = Field(default=None, description="页面标题")


class WebpageToolResult(ToolResult):
    """网页相关工具的结构化结果，用于知乎、小红书等平台的内容获取工具"""
    url: Optional[str] = Field(default=None, description="内容的原始URL")
    title: Optional[str] = Field(default=None, description="内容标题")

    def set_url(self, url: str) -> None:
        """设置内容URL

        Args:
            url: 内容的原始URL
        """
        self.url = url

    def set_title(self, title: str) -> None:
        """设置内容标题

        Args:
            title: 内容标题
        """
        self.title = title


class DeepWriteToolResult(ToolResult):
    """深度写作工具的结构化结果，对应 deepseek-reasoner 模型输出"""
    reasoning_content: Optional[str] = Field(default=None, description="详细的写作思考过程内容")

    def set_reasoning_content(self, reasoning_content: str) -> None:
        """设置写作思考过程内容

        Args:
            reasoning_content: 详细的写作思考过程内容
        """
        self.reasoning_content = reasoning_content


class YFinanceToolResult(ToolResult):
    """金融数据工具的结构化结果，用于存储 YFinance 查询结果"""

    ticker: Optional[str] = Field(default=None, description="股票代码")
    query_type: Optional[str] = Field(default=None, description="查询类型，如 history, info, news 等")
    time_period: Optional[str] = Field(default=None, description="查询的时间范围")

    def set_ticker(self, ticker: str) -> None:
        """设置股票代码

        Args:
            ticker: 股票代码
        """
        self.ticker = ticker

    def set_query_type(self, query_type: str) -> None:
        """设置查询类型

        Args:
            query_type: 查询类型，如 history, info, news 等
        """
        self.query_type = query_type

    def set_time_period(self, time_period: str) -> None:
        """设置查询的时间范围

        Args:
            time_period: 查询的时间范围，如 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        """
        self.time_period = time_period


class ImageToolResult(ToolResult):
    """图片工具的结构化结果"""
    image_url: Optional[str] = Field(default=None, description="图片的URL（已弃用，请使用images）")
    images: List[str] = Field(default_factory=list, description="图片URL列表")

    def set_image_url(self, image_url: str) -> None:
        """设置单张图片的URL（已弃用，请使用set_images）

        Args:
            image_url: 图片的URL
        """
        self.image_url = image_url
        # 同时兼容旧接口，将图片添加到images列表中
        if image_url and image_url not in self.images:
            self.images.append(image_url)

    def set_images(self, images: List[str]) -> None:
        """设置多张图片的URL列表

        Args:
            images: 图片URL列表
        """
        self.images = images
        # 同时更新image_url以保持向后兼容
        if images:
            self.image_url = images[0]


class VideoToolResult(ToolResult):
    """视频工具的结构化结果"""
    video_url: Optional[str] = Field(default=None, description="视频的URL（已弃用，请使用videos）")
    videos: List[str] = Field(default_factory=list, description="视频路径列表")

    def set_video_url(self, video_url: str) -> None:
        """设置单个视频 URL 或路径。"""
        self.video_url = video_url
        if video_url and video_url not in self.videos:
            self.videos.append(video_url)

    def set_videos(self, videos: List[str]) -> None:
        """设置视频 URL 或路径列表。"""
        self.videos = videos
        if videos:
            self.video_url = videos[0]
