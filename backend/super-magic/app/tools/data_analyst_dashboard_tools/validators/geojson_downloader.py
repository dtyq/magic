"""GeoJSON 文件下载器"""

import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import aiohttp
import aiofiles
from agentlang.logger import get_logger

logger = get_logger(__name__)

# 全局变量存储地区代码数据
_AREA_CODES_DATA: Optional[Dict[str, Dict[str, str]]] = None


def load_area_codes() -> Dict[str, Dict[str, str]]:
    """加载地区代码数据

    Returns:
        Dict[str, Dict[str, str]]: 地区代码数据
    """
    global _AREA_CODES_DATA

    if _AREA_CODES_DATA is None:
        try:
            # 获取数据文件路径
            data_file = Path(__file__).parent.parent.parent / "geo_data" / "geojson_area_codes.json"

            # 读取JSON数据
            with open(data_file, 'r', encoding='utf-8') as f:
                _AREA_CODES_DATA = json.load(f)

            # 地区代码数据加载完成

        except Exception as e:
            logger.error(f"加载地区代码数据失败: {e}")
            # 提供默认数据
            _AREA_CODES_DATA = {
                "country": {"中国": "china"},
                "province": {},
                "major_city": {}
            }

    return _AREA_CODES_DATA


class GeoJsonDownloader:
    """GeoJSON 文件下载器
    
    职责：
    1. 自动检测地图卡片
    2. 下载 GeoJSON 文件
    3. 转换地区名称为文件名
    """
    
    # GeoJSON.CN API配置
    GEOJSON_VERSION = "1.6.2"
    BASE_URL = "https://file.geojson.cn/china"
    
    async def auto_detect_map_cards(self, project_dir: Path) -> List[str]:
        """自动检测data.js文件中的地图卡片，提取地区名称

        Args:
            project_dir: 项目目录路径

        Returns:
            List[str]: 检测到的地区名称列表
        """
        data_js_path = project_dir / "data.js"

        if not data_js_path.exists():
            return []

        try:
            # 读取文件内容
            with open(data_js_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 提取地区名称列表
            area_names = []
            
            # 方法1: 匹配任何类型卡片中的地图配置模式
            # 匹配: series: [{ type: "map", map: "地区名" }] 或 series: { type: "map", map: "地区名" }
            map_pattern = r'series:\s*\[.*?type:\s*["\']map["\']\s*,.*?map:\s*["\']([^"\']+)["\']'
            matches = re.findall(map_pattern, content, re.DOTALL)
            area_names.extend(matches)

            # 方法2: 匹配单个series对象的地图配置
            # 匹配: series: { type: "map", map: "地区名" }
            single_series_pattern = r'series:\s*\{.*?type:\s*["\']map["\']\s*,.*?map:\s*["\']([^"\']+)["\']'
            single_matches = re.findall(single_series_pattern, content, re.DOTALL)
            area_names.extend(single_matches)

            # 方法3: 最简单有效的匹配，直接查找所有map字段
            # 然后验证它们是否在series配置中
            all_map_pattern = r'map:\s*["\']([^"\']+)["\']'
            all_map_matches = re.findall(all_map_pattern, content)
            
            # 验证每个map字段是否在series配置中
            for map_match in all_map_matches:
                # 检查这个map字段是否在series配置中
                # 通过查找包含这个map字段的series配置
                series_with_map_pattern = rf'series:\s*\[.*?type:\s*["\']map["\']\s*,.*?map:\s*["\']{re.escape(map_match)}["\']'
                if re.search(series_with_map_pattern, content, re.DOTALL):
                    area_names.append(map_match)
                else:
                    # 如果数组匹配失败，尝试单个对象匹配
                    escaped_map_match = re.escape(map_match)
                    single_series_with_map_pattern = f'series:\\s*\\{{.*?type:\\s*["\']map["\']\\s*,.*?map:\\s*["\']{escaped_map_match}["\']'
                    if re.search(single_series_with_map_pattern, content, re.DOTALL):
                        area_names.append(map_match)
                    else:
                        # 如果直接匹配失败，尝试更宽泛的匹配（跨越多层大括号）
                        any_series_with_map_pattern = f'series.*?map:\\s*["\']{escaped_map_match}["\']'
                        if re.search(any_series_with_map_pattern, content, re.DOTALL):
                            area_names.append(map_match)
            
            # 清理和去重
            cleaned_area_names = []
            for area_name in area_names:
                cleaned_name = area_name.strip()
                if cleaned_name and cleaned_name not in cleaned_area_names:
                    cleaned_area_names.append(cleaned_name)

            return cleaned_area_names

        except Exception as e:
            logger.error(f"解析data.js文件失败: {e}", exc_info=True)
            raise ValueError(f"Failed to parse data.js file: {str(e)}")
    
    def convert_name_to_filename(self, area_name: str) -> str:
        """将中文地区名称转换为文件名"""
        # 标准化地区名称
        normalized_name = area_name.strip()

        # 获取地区代码数据
        area_codes = load_area_codes()

        # 遍历第一层（只有3个key：country, province, major_city）
        # 然后直接用 object[key] 定位第二层
        for level_name in area_codes:  # 只遍历3次：country, province, major_city
            level_data = area_codes[level_name]  # 直接获取该级别的数据
            if normalized_name in level_data:  # O(1) 哈希查找
                return level_data[normalized_name]  # 直接返回filename

        # 如果没找到，生成错误信息
        error_msg = f"Cannot find filename for area '{area_name}'. Please use precise area names, such as: 'Guangdong Province', 'Shenzhen City', 'Beijing City', etc."
        raise ValueError(error_msg)
    
    def generate_map_name(self, area_name: str) -> str:
        """生成地图标识名"""
        # 直接使用地区名称作为地图标识名
        return area_name.strip()
    
    async def download_geojson(
        self,
        filename: str,
        target_dir: Path,
        area_name: str = None
    ) -> Tuple[Path, bool]:
        """下载单个地区的GeoJSON文件

        Args:
            filename: 地区文件名（如 "china" 或 "130000/130100"）
            target_dir: 目标目录
            area_name: 地区名称（用于生成本地文件名）

        Returns:
            Tuple[Path, bool]: (文件路径, 是否为新下载的文件)
        """
        # 构建下载URL
        url = f"{self.BASE_URL}/{self.GEOJSON_VERSION}/{filename}.json"

        # 生成本地文件名
        if area_name is None:
            area_name = await self._get_area_name_by_filename(filename)
        else:
            # 清理文件名中的特殊字符
            area_name = area_name.replace("/", "_").replace("\\", "_").replace(":", "_")

        local_filename = f"{area_name}.json"
        file_path = target_dir / local_filename

        # 检查文件是否已存在
        if file_path.exists():
            return file_path, False

        # 下载文件
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status == 200:
                    geojson_data = await response.json()

                    # 保存文件
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(geojson_data, ensure_ascii=False, indent=2))

                    return file_path, True
                else:
                    raise ValueError(f"HTTP {response.status}: Unable to download data for file {filename}, URL: {url}")
    
    async def _get_area_name_by_filename(self, filename: str) -> str:
        """根据文件名获取地区名称"""
        area_codes = load_area_codes()

        # 查找所有级别的名称
        for level_data in area_codes.values():
            for name, stored_filename in level_data.items():
                if stored_filename == filename:
                    return name

        # 如果找不到，使用文件名作为名称
        return f"area_{filename.replace('/', '_')}"

