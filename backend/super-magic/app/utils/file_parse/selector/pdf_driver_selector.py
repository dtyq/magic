"""Intelligent PDF driver selector based on document characteristics."""

from pathlib import Path
from typing import Union, List, Optional, Dict, Any
import fitz  # PyMuPDF

from agentlang.logger import get_logger
from .interfaces.driver_selector_interface import DriverSelectorInterface
from ..driver.interfaces.file_parser_driver_interface import FileParserDriverInterface

logger = get_logger(__name__)


class PdfDriverSelector(DriverSelectorInterface):
    """基于文档特征的 PDF 驱动智能选择器

    选择器分析 PDF 文档并选择最优驱动器，以平衡处理速度、质量和 token 消耗。

    驱动器类型说明：
    ==================

    1. Visual Driver (优先级 3) - 最高质量但最慢且最昂贵
       * 使用 AI 视觉理解模型进行页面分析
       * 适合复杂的视觉内容、图表、图片
       * 推荐页数：1-10 页
       * 降级链: Visual → Local

    2. OCR Driver (优先级 2) - 质量和速度平衡
       * 使用 Magic Service OCR 和图像处理
       * 处理扫描文档和复杂布局效果好
       * 推荐页数：11-50 页
       * 降级链: OCR → Local

    3. Local Driver (优先级 1) - 最快但仅基础文本提取
       * 使用 PyMuPDF 本地处理
       * 适合纯文本文档，无复杂视觉内容
       * 推荐页数：50+ 页或离线处理
       * 降级链: Local → 无降级

    决策规则优先级（按顺序执行）：
    ================================

    规则 1: 超大文件 (>100MB)
            → 使用 Local Driver（性能考虑，避免上传和处理大文件）

    规则 2: 高文本密度 + 页数 ≤50
            → 使用 OCR Driver（文本为主，无需视觉理解）

    规则 3: 低文本密度 + 页数 ≤10
            → 使用 Visual Driver（图片/图表为主，需要更好的内容理解）

    规则 4: 小文档 (≤10页)
            → 使用 Visual Driver（文档较小，追求最佳质量）

    规则 5: 中等文档 (11-50页)
            → 使用 OCR Driver（平衡质量和速度）

    规则 6: 大文档 (>50页)
            → 使用 Local Driver（快速处理，避免高额 token 消耗）

    关键特征分析：
    ==============

    系统会分析 PDF 的以下特征来做决策：

    1. 页数 (page_count)
       - 影响处理时间和 token 成本
       - 阈值：≤10页（小文档）、11-50页（中等文档）、>50页（大文档）

    2. 文件大小 (file_size_mb)
       - 超大文件强制使用本地处理
       - 阈值：>100MB 强制使用 Local Driver

    3. 是否包含图片 (has_images)
       - 影响驱动选择策略
       - 有图片的文档更适合使用 Visual 或 OCR Driver

    4. 文本密度 (text_density)
       - 根据平均每页字符数判断
       - 高密度 (high)：>2000 字符/页 → 文本为主的文档
       - 中密度 (medium)：500-2000 字符/页 → 混合内容
       - 低密度 (low)：<500 字符/页 → 图片/图表为主

    5. 平均每页字符数 (avg_chars_per_page)
       - 用于计算文本密度
       - 反映文档的文本含量

    降级规则：
    ==========

    - 只允许降级到 Local 驱动（作为兜底方案）
    - 不允许 OCR 和 Visual 之间互相降级
    - 每个驱动最多只有一个降级目标
    - 降级链最大长度为 2（主驱动 + Local）

    降级链：
    - Visual 失败 → 降级到 Local
    - OCR 失败 → 降级到 Local
    - Local 失败 → 无降级（直接失败）

    配置参数：
    ==========

    可通过参数覆盖默认阈值：
    - visual_max_pages: Visual Driver 最大页数阈值（默认：10）
    - ocr_max_pages: OCR Driver 最大页数阈值（默认：50）
    - large_file_size_mb: 大文件阈值（默认：100MB）

    使用示例：
    ==========

    ```python
    selector = PdfDriverSelector()

    # 自动选择（根据文档特征）
    drivers = await selector.select_driver(file_path, available_drivers)

    # 强制指定驱动类型
    drivers = await selector.select_driver(
        file_path,
        available_drivers,
        force_driver_type='visual'  # 返回 [Visual, Local]
    )

    # 自定义阈值
    drivers = await selector.select_driver(
        file_path,
        available_drivers,
        visual_max_pages=20,  # 扩大 Visual 驱动适用范围
        ocr_max_pages=100     # 扩大 OCR 驱动适用范围
    )
    ```
    """

    # Page count thresholds for driver selection
    VISUAL_MAX_PAGES = 10
    OCR_MAX_PAGES = 50

    # File size threshold (in MB)
    LARGE_FILE_SIZE_MB = 100

    def __init__(self):
        """Initialize PDF driver selector."""
        pass

    async def select_driver(
        self,
        file_path: Union[str, Path],
        available_drivers: List[FileParserDriverInterface],
        force_driver_type: Optional[str] = None,
        **kwargs
    ) -> List[FileParserDriverInterface]:
        """根据 PDF 文档特征选择最优驱动器

        Args:
            file_path: PDF 文件路径
            available_drivers: 可用的 PDF 驱动器列表
            force_driver_type: 强制使用的驱动器类型:
                - 'visual': 强制使用视觉理解驱动（降级链: Visual → Local）
                - 'ocr': 强制使用 OCR 驱动（降级链: OCR → Local）
                - 'local': 强制使用本地驱动（无降级）
                - None: 根据文档特征自动选择
            **kwargs: 其他参数:
                - visual_max_pages (int): 覆盖视觉驱动最大页数阈值
                - ocr_max_pages (int): 覆盖 OCR 驱动最大页数阈值
                - large_file_size_mb (float): 覆盖大文件阈值

        Returns:
            List[FileParserDriverInterface]: 按优先级排序的驱动器列表（最多2个：主驱动 + Local降级）

        Note:
            降级规则:
            - Visual 失败 → 降级到 Local
            - OCR 失败 → 降级到 Local
            - Local 失败 → 无降级（直接失败）
            - 不允许 OCR 和 Visual 之间互相降级
        """
        file_path_obj = Path(file_path)

        # Check if file exists
        if not file_path_obj.exists():
            logger.warning(f"PDF file does not exist: {file_path}")
            return available_drivers

        # If force_driver_type is specified, return only that driver type
        if force_driver_type:
            return self._filter_drivers_by_type(available_drivers, force_driver_type)

        # Analyze PDF characteristics
        pdf_info = await self.analyze_file(file_path_obj)

        if not pdf_info:
            logger.warning("Failed to analyze PDF, using default driver order")
            return available_drivers

        # Get thresholds (allow override via kwargs)
        visual_max = kwargs.get('visual_max_pages', self.VISUAL_MAX_PAGES)
        ocr_max = kwargs.get('ocr_max_pages', self.OCR_MAX_PAGES)
        large_size_mb = kwargs.get('large_file_size_mb', self.LARGE_FILE_SIZE_MB)

        # Select optimal driver based on characteristics
        optimal_driver_type = self.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=visual_max,
            ocr_max_pages=ocr_max,
            large_file_size_mb=large_size_mb
        )


        # Reorder drivers with optimal driver first, others as fallback
        return self._reorder_drivers(available_drivers, optimal_driver_type)

    async def analyze_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """分析 PDF 文件特征

        Args:
            file_path: PDF 文件路径

        Returns:
            Optional[Dict[str, Any]]: PDF 特征字典或失败时返回 None:
                - page_count (int): 页数
                - file_size_mb (float): 文件大小（MB）
                - has_images (bool): 是否包含图片
                - text_density (str): 文本密度 (high/medium/low)
                - avg_chars_per_page (float): 平均每页字符数
        """
        try:
            # Open PDF document
            doc = fitz.open(str(file_path))
            page_count = doc.page_count

            # Get file size
            file_size_bytes = file_path.stat().st_size
            file_size_mb = file_size_bytes / (1024 * 1024)

            # Analyze first few pages for content characteristics
            has_images = False
            text_chars_count = 0
            pages_to_sample = min(3, page_count)

            for page_num in range(pages_to_sample):
                page = doc[page_num]

                # Check for images
                images = page.get_images()
                if images:
                    has_images = True

                # Count text characters
                text = page.get_text()
                text_chars_count += len(text.strip())

            doc.close()

            # Estimate text density
            avg_chars_per_page = text_chars_count / pages_to_sample if pages_to_sample > 0 else 0
            if avg_chars_per_page > 2000:
                text_density = 'high'
            elif avg_chars_per_page > 500:
                text_density = 'medium'
            else:
                text_density = 'low'

            return {
                'page_count': page_count,
                'file_size_mb': file_size_mb,
                'has_images': has_images,
                'text_density': text_density,
                'avg_chars_per_page': avg_chars_per_page
            }

        except Exception as e:
            logger.error(f"Failed to analyze PDF: {e}")
            return None

    def determine_optimal_driver_type(
        self,
        file_info: Dict[str, Any],
        **kwargs
    ) -> str:
        """根据 PDF 特征确定最优驱动器类型

        Args:
            file_info: PDF 特征字典
            **kwargs: 决策参数:
                - visual_max_pages (int): 视觉驱动最大页数
                - ocr_max_pages (int): OCR 驱动最大页数
                - large_file_size_mb (float): 大文件阈值

        Returns:
            str: 最优驱动器类型 ('visual', 'ocr', 'local')
        """
        page_count = file_info['page_count']
        file_size_mb = file_info['file_size_mb']
        text_density = file_info['text_density']

        visual_max_pages = kwargs.get('visual_max_pages', self.VISUAL_MAX_PAGES)
        ocr_max_pages = kwargs.get('ocr_max_pages', self.OCR_MAX_PAGES)
        large_file_size_mb = kwargs.get('large_file_size_mb', self.LARGE_FILE_SIZE_MB)

        # Rule 1: Very large files should use local driver
        if file_size_mb > large_file_size_mb:
            logger.info(
                f"Large file ({file_size_mb:.2f} MB > {large_file_size_mb} MB), "
                "selecting local driver for performance"
            )
            return 'local'

        # Rule 2: High text density documents should use OCR driver
        if text_density == 'high' and page_count <= ocr_max_pages:
            logger.info(
                f"High text density document with {page_count} pages, "
                "selecting OCR driver (no visual understanding needed)"
            )
            return 'ocr'

        # Rule 3: Low text density documents should use visual driver
        if text_density == 'low' and page_count <= visual_max_pages:
            logger.info(
                f"Low text density with {page_count} pages, "
                "selecting visual driver for better content understanding"
            )
            return 'visual'

        # Rule 4: Small documents use visual driver
        if page_count <= visual_max_pages:
            logger.info(
                f"Small document ({page_count} pages), "
                "selecting visual driver for best quality"
            )
            return 'visual'

        # Rule 5: Medium documents use OCR driver
        if page_count <= ocr_max_pages:
            logger.info(
                f"Medium document ({page_count} pages), "
                "selecting OCR driver for balanced quality and speed"
            )
            return 'ocr'

        # Rule 6: Large documents use local driver
        logger.info(
            f"Large document ({page_count} pages), "
            "selecting local driver for fast processing"
        )
        return 'local'

    def _filter_drivers_by_type(
        self,
        drivers: List[FileParserDriverInterface],
        driver_type: str
    ) -> List[FileParserDriverInterface]:
        """Filter drivers by type name with proper fallback chain.

        Fallback rules:
        - 'visual' or 'ocr': Return [requested driver, Local driver]
        - 'local': Return [Local driver] only (no fallback)
        """
        type_mapping = {
            'visual': 'PdfVisualDriver',
            'ocr': 'PdfOcrDriver',
            'local': 'PdfLocalDriver'
        }

        target_class_name = type_mapping.get(driver_type.lower())
        if not target_class_name:
            logger.warning(f"Unknown driver type: {driver_type}, returning all drivers")
            return drivers

        # Find requested driver
        target_driver = None
        local_driver = None

        for driver in drivers:
            if driver.__class__.__name__ == target_class_name:
                target_driver = driver
            elif driver.__class__.__name__ == 'PdfLocalDriver':
                local_driver = driver

        if not target_driver:
            logger.warning(
                f"No driver found for type {driver_type}, returning all drivers as fallback"
            )
            return drivers

        # Build result with fallback chain
        result = [target_driver]

        # Add Local driver as fallback for Visual and OCR
        if driver_type.lower() in ('visual', 'ocr') and local_driver and local_driver != target_driver:
            result.append(local_driver)
            logger.debug(f"Forced driver type {driver_type} with fallback to Local")

        return result

    def _reorder_drivers(
        self,
        drivers: List[FileParserDriverInterface],
        optimal_type: str
    ) -> List[FileParserDriverInterface]:
        """Reorder drivers to prioritize the optimal type with proper fallback chain.

        Fallback rules (only 2 levels allowed):
        - Visual → Local
        - OCR → Local
        - Local → No fallback

        Not allowed:
        - OCR ↔ Visual (no cross-fallback between OCR and Visual)
        """
        type_mapping = {
            'visual': 'PdfVisualDriver',
            'ocr': 'PdfOcrDriver',
            'local': 'PdfLocalDriver'
        }

        optimal_class_name = type_mapping.get(optimal_type.lower())
        if not optimal_class_name:
            return drivers

        # Separate drivers by type
        optimal_driver = None
        local_driver = None

        for driver in drivers:
            driver_class_name = driver.__class__.__name__
            if driver_class_name == optimal_class_name:
                optimal_driver = driver
            elif driver_class_name == 'PdfLocalDriver':
                local_driver = driver

        # Build fallback chain based on optimal type
        result = []

        if optimal_driver:
            result.append(optimal_driver)

            # Only add Local driver as fallback for Visual and OCR
            # Local driver has no fallback
            if optimal_type.lower() in ('visual', 'ocr') and local_driver:
                result.append(local_driver)
                logger.debug(f"Fallback chain: {optimal_type} → Local")
        elif local_driver:
            # If optimal driver not found, use local as fallback
            result.append(local_driver)
            logger.warning(f"Optimal driver {optimal_type} not found, using Local driver")

        # If result is empty, return original drivers as last resort
        if not result:
            logger.warning("No suitable drivers found, returning original driver list")
            return drivers

        return result


# Global singleton instance
_pdf_driver_selector_instance: Optional[PdfDriverSelector] = None


def get_pdf_driver_selector() -> PdfDriverSelector:
    """Get the singleton PdfDriverSelector instance.

    Returns:
        PdfDriverSelector: The singleton instance
    """
    global _pdf_driver_selector_instance

    if _pdf_driver_selector_instance is None:
        _pdf_driver_selector_instance = PdfDriverSelector()
        logger.info("Created PdfDriverSelector singleton instance")

    return _pdf_driver_selector_instance
