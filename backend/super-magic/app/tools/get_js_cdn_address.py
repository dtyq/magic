import json
import time
from typing import Any, Dict, List

import aiohttp
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseTool, BaseToolParams, tool


class GetJsCdnAddressParams(BaseToolParams):
    library_name: str = Field(
        ...,
        description="""<!--zh: 要查询的 JavaScript 库名称，如 react、vue、echarts 等-->
JavaScript library name to query, e.g., react, vue, echarts, etc."""
    )


@tool()
class GetJsCdnAddress(BaseTool[GetJsCdnAddressParams]):
    """<!--zh: 获取指定 JavaScript 库的 CDN 地址，从 CDNJS 获取-->
Get CDN address for specified JavaScript library, from CDNJS"""

    async def execute(self, tool_context: ToolContext, params: GetJsCdnAddressParams) -> ToolResult:
        """执行 JS CDN 工具

        Args:
            tool_context: 工具上下文
            params: 工具参数，包含 library_name

        Returns:
            ToolResult: 工具执行结果
        """
        start_time = time.time()

        library_name = params.library_name
        if not library_name:
            return ToolResult(
                error="未提供 JavaScript 库名称",
                execution_time=time.time() - start_time,
            )

        try:
            result = await self._fetch_cdn_info(library_name)
            return ToolResult(
                content=result,
                execution_time=time.time() - start_time,
            )
        except Exception as e:
            return ToolResult(
                error=f"获取 {library_name} 库 CDN 地址失败: {e!s}",
                execution_time=time.time() - start_time,
            )

    async def _fetch_cdn_info(self, library_name: str) -> str:
        """从 CDNJS 获取 JavaScript 库的 CDN 信息

        Args:
            library_name: JavaScript 库名称

        Returns:
            str: 包含 CDN 地址的信息文本
        """
        # 从 API 获取数据
        api_url = f"https://api.cdnjs.com/libraries?search={library_name}&limit=3"

        async with aiohttp.ClientSession() as session:
            async with session.get(api_url) as response:
                if response.status != 200:
                    raise Exception(f"API 请求失败，状态码: {response.status}")

                data = await response.text()
                api_data = json.loads(data)

        # 处理搜索结果
        results = api_data.get("results", [])

        # 尝试精确匹配库名
        exact_matches = [lib for lib in results if lib.get("name") == library_name]
        if exact_matches:
            lib_info = exact_matches[0]
            lib_name = lib_info.get("name", "")
            cdn_url = lib_info.get("latest", "")

            return (
                f"找到 '{library_name}' 库的 CDN: {cdn_url}"
            )

        # 如果没有精确匹配，显示部分匹配
        if results:
            result_text = f"未找到精确匹配的 '{library_name}'，但找到了以下相关 JavaScript 库:\n\n"

            for lib in results:
                lib_name = lib.get("name", "")
                cdn_url = lib.get("latest", "")

                result_text += f"名称: {lib_name}\nCDN 地址: {cdn_url}\n\n"

            return result_text

        return f"未找到与 '{library_name}' 相关的库 CDN 信息"
