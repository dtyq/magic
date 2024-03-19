"""
PDF转换服务

负责处理HTML到PDF的转换和文件上传
"""

import asyncio
import shutil
import threading
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.entity.aigc_metadata import AigcMetadataParams
from app.service.convert_task_manager import task_manager
from app.service.file_convert.base_convert_service import BaseConvertService, ViewportSize

# PDF合并功能依赖 - 只使用 PyMuPDF (现代高性能方案)
try:
    import fitz  # PyMuPDF
except ImportError:
    logger.error("❌ 缺少必需的 PyMuPDF 库")
    raise ImportError("PDF服务需要 PyMuPDF 库，请安装: pip install PyMuPDF")


class PdfConvertService(BaseConvertService):
    """PDF转换服务类"""

    def __init__(self, enable_full_page: bool = False):
        """
        初始化PDF转换服务

        Args:
            enable_full_page: 是否启用长截图模式（完整页面转换）
        """
        super().__init__("PDF")
        self.enable_full_page = enable_full_page
        if enable_full_page:
            logger.info("✅ PDF服务：已启用长截图模式，将转换完整页面内容")

    @staticmethod
    def _check_batch_files_exist(batch_dir: Path) -> bool:
        """
        检查批次目录中是否存在相关文件（PDF服务的实现）

        Args:
            batch_dir: 批次目录路径

        Returns:
            bool: 是否存在相关文件
        """
        try:
            # 检查PDF文件存在
            pdf_dir = batch_dir / "pdf"
            if pdf_dir.exists():
                pdf_files = list(pdf_dir.glob("*.pdf"))
                # 如果有PDF文件，认为是同一组文件
                return len(pdf_files) > 0

            return False

        except Exception as e:
            # 降级为调试日志，减少噪音
            logger.debug(f"检查PDF文件存在失败: {e}")
            return False

    async def _embed_aigc_metadata_with_logging(
        self,
        pdf_path: Path,
        aigc_params: Optional[AigcMetadataParams],
        start_message: str,
        success_message: str,
        error_message: str,
    ) -> None:
        logger.info(start_message)
        try:
            await self.embed_pdf_metadata(str(pdf_path), aigc_params)
            logger.info(success_message)
        except Exception as aigc_error:
            logger.error(error_message)
            logger.error(f"   异常类型: {type(aigc_error).__name__}")
            logger.error(f"   异常消息: {str(aigc_error)}")
            raise

    async def _merge_pdf_files(
        self,
        pdf_files: List[Path],
        output_path: Path,
        project_name: str = "",
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> Optional[Path]:
        """
        合并多个PDF文件为一个PDF文件 - 使用 PyMuPDF 高性能方案

        Args:
            pdf_files: 要合并的PDF文件列表（按顺序）
            output_path: 输出文件路径
            project_name: 项目名称（用于日志）
            aigc_params: AIGC元数据参数对象

        Returns:
            合并后的PDF文件路径，失败时返回None
        """
        if not pdf_files:
            logger.warning("⚠️ 没有PDF文件需要合并")
            return None

        if len(pdf_files) == 1:
            # 只有一个文件，直接移动到目标位置
            try:
                shutil.move(str(pdf_files[0]), str(output_path))
                logger.info(f"📄 单页PDF直接移动: {project_name} -> {output_path.name}")
                return output_path
            except Exception as e:
                logger.error(f"❌ 移动单页PDF失败: {e}")
                return None

        try:
            logger.info(f"🔗 开始合并PDF: {project_name} ({len(pdf_files)} 个页面) - 使用 PyMuPDF")

            # 使用 PyMuPDF 进行高性能合并
            merged_doc = fitz.open()

            # 按顺序添加PDF文件
            for i, pdf_file in enumerate(pdf_files):
                try:
                    if pdf_file.exists() and pdf_file.stat().st_size > 0:
                        # 打开PDF文件
                        source_doc = fitz.open(str(pdf_file))

                        # 将所有页面插入到合并文档中
                        merged_doc.insert_pdf(source_doc)

                        # 关闭源文档
                        source_doc.close()

                        # 只在调试模式下显示详细页面添加信息
                    else:
                        logger.warning(f"  ⚠️ 跳过无效文件: {pdf_file.name}")
                except Exception as e:
                    logger.error(f"  ❌ 添加PDF页面失败 {pdf_file.name}: {e}")
                    continue

            # 保存合并后的PDF
            merged_doc.save(str(output_path))
            merged_doc.close()

            # 验证合并结果
            if output_path.exists() and output_path.stat().st_size > 0:
                logger.info(
                    f"✅ PDF合并成功: {project_name} -> {output_path.name} ({output_path.stat().st_size} bytes)"
                )

                # 嵌入AIGC签名元数据到合并后的PDF文件
                await self._embed_aigc_metadata_with_logging(
                    output_path,
                    aigc_params,
                    start_message=f"📝 开始嵌入AIGC元数据到合并PDF: {output_path}",
                    success_message=f"PDF合并：成功嵌入签名元数据到合并PDF文件 {output_path}",
                    error_message=f"❌ PDF合并后嵌入AIGC元数据失败: {output_path}",
                )

                # 清理临时文件
                for pdf_file in pdf_files:
                    try:
                        if pdf_file.exists():
                            pdf_file.unlink()
                            # 临时文件清理信息降级为调试级别
                    except Exception as e:
                        logger.warning(f"清理临时PDF失败 {pdf_file.name}: {e}")

                return output_path
            else:
                logger.error(f"❌ PDF合并结果无效: {output_path}")
                return None

        except Exception as e:
            logger.error(f"❌ PDF合并失败: {project_name}: {e}")
            logger.error(traceback.format_exc())
            return None

    async def convert_file_keys_to_pdf(
        self,
        file_keys: List[Dict[str, str]],
        task_key: Optional[str] = None,
        sts_credential: Optional[Dict[str, Any]] = None,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> Dict[str, Any]:
        """
        将文件key列表转换为PDF

        Args:
            file_keys: 文件key列表，每个元素包含file_key
            task_key: 任务标识符，会在结果中原样返回
            sts_credential: STS临时凭证，用于上传
            aigc_params: AIGC元数据参数对象

        Returns:
            转换结果字典

        Raises:
            ValueError: 输入参数错误
            RuntimeError: 转换过程中发生不可恢复的错误
        """
        # 通用前置处理：STS解析、file_keys校验、AgentContext初始化、批次目录创建
        sts_cred_obj, batch_id, batch_dir = await self._prepare_conversion_context(
            file_keys=file_keys, sts_credential=sts_credential
        )

        try:
            # 解析文件key到workspace路径
            logger.info("开始解析文件key到workspace路径...")
            try:
                file_path_mapping = await self.resolve_file_keys_to_workspace_paths(file_keys)
            except Exception as e:
                logger.error(f"文件key解析过程中发生错误: {e}")
                raise RuntimeError(f"文件key解析失败: {str(e)}")

            if not file_path_mapping:
                raise RuntimeError("没有找到任何有效的workspace文件，请检查文件key是否正确")

            # PDF转换服务直接确定自己的选项
            options = {}  # 不使用任何默认配置，在转换时动态确定

            logger.info(f"开始处理 {len(file_path_mapping)} 个文件")

            # 1. 分析文件，检测PPT入口文件和按项目分组（使用基类通用方法）
            pdf_projects = await self.analyze_and_group_files(
                file_path_mapping, supported_extensions=[".html", ".htm", ".md"], service_type="PDF转换"
            )

            logger.info(f"文件分析完成，发现 {len(pdf_projects)} 个PDF项目")
            for project_name, project_info in pdf_projects.items():
                logger.info(f"  项目 '{project_name}': {len(project_info['files'])} 个文件")

            if not pdf_projects:
                raise RuntimeError("没有找到任何可转换的PDF项目")

            # 2. 计算文件统计信息和并发数（使用基类通用方法）
            valid_files_count, file_type_counts, optimal_concurrency = self.calculate_file_statistics_and_concurrency(
                pdf_projects, supported_extensions=[".html", ".htm", ".md"], service_type="PDF转换"
            )

            # 3. 执行批量转换
            # 使用全局task_manager实例（如果有task_key）
            task_mgr = None
            if task_key:
                task_mgr = task_manager

            # 开始内存监控
            # self._start_memory_monitoring(task_key)  # 注释掉内存监控日志

            # 4. 使用抽象方法执行项目转换
            try:
                pdf_files, conversion_errors = await self._convert_projects(
                    pdf_projects,
                    batch_dir,
                    options,
                    task_mgr,
                    task_key,
                    valid_files_count,
                    optimal_concurrency,
                    aigc_params,
                )

                # 简化调试信息输出
                if pdf_files:
                    logger.info(f"PDF文件按项目顺序返回，共 {len(pdf_files)} 个文件")

            except Exception as e:
                logger.error(f"并发转换过程中发生错误: {e}")
                raise RuntimeError(f"转换失败: {str(e)}")

            ppt_projects_count = sum(1 for info in pdf_projects.values() if info["is_ppt_entry"] and info["slides"])
            merge_info = f"其中{ppt_projects_count}个PPT项目已合并" if ppt_projects_count > 0 else "无PPT项目合并"
            logger.info(
                f"批量文件转换完成: {len(pdf_files)}/{valid_files_count} 成功 (转换率: {round((len(pdf_files) / valid_files_count) * 100, 2)}%) - 智能处理HTML/Markdown文件，支持PPT项目PDF合并 ({merge_info})"
            )

            # 结束内存监控
            # self._end_memory_monitoring(task_key, len(pdf_files), valid_files_count)  # 注释掉内存监控日志

            # 如果有转换错误，记录到日志
            if conversion_errors:
                logger.warning(f"部分文件转换失败: {len(conversion_errors)} 个错误")
                for error in conversion_errors:
                    logger.warning(f"  - {error}")

            # 如果没有任何文件转换成功，抛出错误
            if not pdf_files:
                error_message = "所有文件转换都失败了"
                if conversion_errors:
                    error_message += f"，错误详情: {'; '.join(conversion_errors)}"
                raise RuntimeError(error_message)

            # 处理转换结果
            try:
                # 使用抽象方法获取服务特定数据
                service_specific_data = await self._get_service_specific_result_data(file_keys, pdf_projects, pdf_files)

                # 🎯 计算实际成功处理的输入文件数量
                # 如果没有转换错误，所有有效文件都成功处理
                if not conversion_errors:
                    actual_processed_files_count = valid_files_count
                else:
                    # 有转换错误的情况下，需要从有效文件中减去失败的文件数量
                    actual_processed_files_count = valid_files_count - len(conversion_errors)

                result = await self._process_conversion_result(
                    converted_files=pdf_files,
                    batch_id=batch_id,
                    batch_dir=batch_dir,
                    valid_files_count=valid_files_count,
                    task_key=task_key,
                    sts_cred_obj=sts_cred_obj,
                    service_specific_data=service_specific_data,
                    conversion_errors=conversion_errors if conversion_errors else None,
                    actual_processed_files_count=actual_processed_files_count,
                )
            except Exception as e:
                logger.error(f"处理转换结果失败: {e}")
                raise RuntimeError(f"结果处理失败: {str(e)}")

            # 在返回结果中加入total_files字段，应该是实际处理的文件总数
            result["total_files"] = valid_files_count  # 实际处理的文件数量，不是输入file_keys数量

            # 如果有部分转换失败，在结果中加入错误信息
            if conversion_errors:
                result["conversion_errors"] = conversion_errors
                result["partial_success"] = True

            # 记录详细的转换统计信息
            ppt_merge_status = "支持PPT项目PDF合并 (PyMuPDF)"
            logger.info(
                f"PDF转换统计 - 输入Keys: {len(file_keys)}, 实际文件(HTML/Markdown): {valid_files_count}, "
                f"输出PDF: {len(pdf_files)}, 转换率: {result['conversion_rate']}% ({ppt_merge_status})"
            )

            return result

        except Exception as e:
            # 记录详细的错误信息
            logger.error(f"PDF转换过程中发生错误: {e}")
            logger.error(traceback.format_exc())
            raise
        finally:
            # 保留临时文件，不再清理
            logger.info(f"保留临时文件在目录: {batch_dir}")

    @staticmethod
    async def _adjust_viewport_for_full_page(page) -> bool:
        """
        长截图模式：动态调整视口以匹配实际页面内容尺寸

        这是关键优化：确保CSS媒体查询和JavaScript获取的视口尺寸
        与实际页面内容匹配，避免响应式布局问题

        Args:
            page: Playwright页面对象

        Returns:
            bool: 是否成功调整视口
        """
        try:
            # 先获取页面的实际内容尺寸
            content_dimensions = await page.evaluate("""
                () => {
                    const body = document.body;
                    const html = document.documentElement;
                    const scrollWidth = Math.max(body.scrollWidth || 0, html.scrollWidth || 0);
                    const scrollHeight = Math.max(body.scrollHeight || 0, html.scrollHeight || 0);
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    return {
                        scrollWidth,
                        scrollHeight,
                        currentViewportWidth: viewportWidth,
                        currentViewportHeight: viewportHeight,
                        needsAdjustment: scrollHeight > viewportHeight
                    };
                }
            """)

            if not content_dimensions.get("needsAdjustment"):
                # 无需调整时不输出日志
                return True

            # 计算合适的视口尺寸
            content_width = content_dimensions["scrollWidth"]
            content_height = content_dimensions["scrollHeight"]

            # 设置合理的限制，避免过大的视口
            max_viewport_width = 3840  # 4K宽度
            max_viewport_height = 30000  # 支持超长页面的截图高度

            target_width = min(max(content_width, 1920), max_viewport_width)
            target_height = min(max(content_height, 1080), max_viewport_height)

            # 只有当尺寸变化显著时才调整（避免频繁调整）
            current_width = content_dimensions["currentViewportWidth"]
            current_height = content_dimensions["currentViewportHeight"]

            width_diff = abs(target_width - current_width)
            height_diff = abs(target_height - current_height)

            if width_diff < 100 and height_diff < 200:
                # 变化不显著时无需输出详细信息
                return True

            # 动态调整视口大小
            await page.set_viewport_size({"width": target_width, "height": target_height})

            # 等待重新布局完成
            await page.wait_for_timeout(500)  # 等待500ms让页面重新布局

            logger.info(
                f"🔧 视口动态调整：{current_width}×{current_height} -> {target_width}×{target_height} "
                f"(内容尺寸: {content_width}×{content_height})"
            )

            return True

        except Exception as e:
            logger.warning(f"视口调整失败，继续使用默认视口: {e}")
            return False

    @staticmethod
    async def _detect_content_dimensions(page, full_page: bool = False) -> Dict[str, Any]:
        """
        检测页面内容的实际尺寸 - 支持视口模式或完整页面模式

        Args:
            page: Playwright页面对象
            full_page: 是否检测完整页面尺寸（长截图模式）

        Returns:
            包含内容尺寸信息的字典
        """
        try:
            # 获取页面的视口和滚动尺寸
            dimensions = await page.evaluate("""
                () => {
                    // 获取视口尺寸（浏览器可见区域）
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // 获取文档的滚动尺寸（完整页面内容）
                    const body = document.body;
                    const html = document.documentElement;
                    const scrollWidth = Math.max(body.scrollWidth || 0, html.scrollWidth || 0);
                    const scrollHeight = Math.max(body.scrollHeight || 0, html.scrollHeight || 0);

                    return {
                        viewportWidth,
                        viewportHeight,
                        scrollWidth,
                        scrollHeight,
                        devicePixelRatio: window.devicePixelRatio || 1,
                        // 检查是否有滚动
                        hasHorizontalScroll: scrollWidth > viewportWidth,
                        hasVerticalScroll: scrollHeight > viewportHeight
                    };
                }
            """)

            # 根据模式决定使用哪个尺寸
            if full_page:
                # 长截图模式：使用完整页面尺寸
                content_width = dimensions["scrollWidth"]
                content_height = dimensions["scrollHeight"]
                mode_desc = "完整页面内容（长截图模式）"
            else:
                # 视口模式：只转换已渲染的可见部分
                content_width = dimensions["viewportWidth"]
                content_height = dimensions["viewportHeight"]
                mode_desc = "仅已渲染可见部分"

            dimensions.update({"contentWidth": content_width, "contentHeight": content_height})

            # 只记录关键的转换尺寸信息
            logger.info(f"PDF转换尺寸: {dimensions['contentWidth']}×{dimensions['contentHeight']} ({mode_desc})")
            return dimensions

        except Exception as e:
            logger.error(f"检测内容尺寸失败: {e}")
            # 返回默认尺寸，与高分辨率视口设置保持一致
            return {
                "contentWidth": 1200,
                "contentHeight": 800,
                "viewportWidth": 1920,  # 与高分辨率视口宽度保持一致
                "viewportHeight": 1080,
                "scrollWidth": 1200,
                "scrollHeight": 800,
                "devicePixelRatio": 1,
                "hasHorizontalScroll": False,
                "hasVerticalScroll": False,
            }

    def _calculate_optimal_pdf_options(self, dimensions: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据内容尺寸直接确定PDF选项，不依赖外部配置

        Args:
            dimensions: 内容尺寸信息

        Returns:
            PDF转换选项（包含是否需要注入CSS的标记）
        """
        content_width = dimensions["contentWidth"]
        content_height = dimensions["contentHeight"]
        has_vertical_scroll = dimensions.get("hasVerticalScroll", False)

        # PDF转换服务的策略：优先使用动态尺寸，完全匹配网页内容
        if content_width > 0 and content_height > 0:
            # 设置合理的尺寸限制
            min_size_px = 400  # 最小400px
            max_width_px = 3840  # 最大宽度3840px (4K宽度)

            # 长截图模式下，高度限制更宽松
            if self.enable_full_page and has_vertical_scroll:
                max_height_px = 30000  # 长截图模式：最大高度30000px
                logger.info("🖼️ 长截图模式：检测到垂直滚动，使用扩展高度限制")
            else:
                max_height_px = 30000  # 统一使用30000px高度限制，支持超长页面

            # 应用尺寸限制
            pdf_width_px = max(min_size_px, min(content_width, max_width_px))
            pdf_height_px = max(min_size_px, min(content_height, max_height_px))

            # 长截图高度限制的重要提示保留
            if self.enable_full_page and content_height > max_height_px:
                logger.warning(f"长截图高度被限制：{content_height}px -> {pdf_height_px}px")

            # 🎯 关键修复：使用CSS @page规则，避免自动分页
            # 构建动态尺寸PDF选项（将由调用方注入对应的@page CSS）
            pdf_options = {
                "print_background": True,
                "prefer_css_page_size": True,  # 🎯 改为True，使用CSS @page规则
                "margin": {"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"},
                "scale": 1.0,
                # 🎯 添加标记，告诉调用方需要注入CSS
                "_inject_page_size": True,
                "_page_width": pdf_width_px,
                "_page_height": pdf_height_px,
            }

            mode_info = "长截图模式" if (self.enable_full_page and has_vertical_scroll) else "动态尺寸"
            logger.info(f"PDF转换配置：{mode_info} {pdf_width_px}×{pdf_height_px}px (使用@page规则)")

        else:
            # 回退到标准A4配置
            pdf_options = {
                "format": "A4",
                "landscape": False,
                "scale": 0.8,
                "print_background": True,
                "prefer_css_page_size": True,
                "margin": {"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"},
            }

            logger.info("PDF转换配置：A4纸张格式")

        # 最终选项的详细信息仅在需要时输出
        return pdf_options

    @staticmethod
    def _normalize_pdf_options(options: Dict[str, Any]) -> Dict[str, Any]:
        """
        将用户友好的参数名转换为Playwright接受的参数名，并过滤掉无效参数

        Args:
            options: 用户友好的参数名

        Returns:
            转换后的参数名
        """
        # Playwright的page.pdf()方法接受的有效参数 (不包括'path'，因为它被单独处理)
        valid_playwright_options = {
            "display_header_footer",
            "footer_template",
            "format",
            "header_template",
            "height",
            "landscape",
            "margin",
            "outline",
            "page_ranges",
            "prefer_css_page_size",
            "print_background",
            "scale",
            "tagged",
            "width",
        }

        # 将用户友好名称映射到Playwright名称
        param_mapping = {
            "printBackground": "print_background",
            "displayHeaderFooter": "display_header_footer",
            "headerTemplate": "header_template",
            "footerTemplate": "footer_template",
            "preferCSSPageSize": "prefer_css_page_size",
            "pageRanges": "page_ranges",
        }

        # 内部标记（需要过滤掉）
        internal_markers = {"_inject_page_size", "_page_width", "_page_height"}

        normalized_options: Dict[str, Any] = {}

        # 单独处理 'orientation'
        if "orientation" in options:
            orientation_value = str(options.get("orientation", "portrait")).lower()
            if orientation_value == "landscape":
                normalized_options["landscape"] = True
            # 'portrait' 是默认值，所以 landscape: False 是可选的

        # 处理其余的参数
        for key, value in options.items():
            if key == "orientation" or key in internal_markers:
                continue  # 跳过orientation和内部标记

            normalized_key = param_mapping.get(key, key)

            # 只添加Playwright支持的有效参数
            if normalized_key in valid_playwright_options:
                normalized_options[normalized_key] = value
            else:
                logger.warning(f"检测到无效的PDF选项，已忽略: '{key}'")

                # PDF选项标准化信息降级为调试级别
        return normalized_options

    async def _convert_files_concurrent(
        self,
        file_path_mapping: Dict[str, Path],
        pdf_dir: Path,
        options: Optional[Dict[str, Any]] = None,
        task_mgr=None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        max_workers: int = 1,
        original_file_order: Optional[List[str]] = None,
        progress_offset: int = 0,
        is_ppt_project: bool = False,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> tuple[List[Path], List[str]]:
        """
        串行处理文件转换为PDF - 避免网络资源竞争，确保外部CSS/JS完全加载

        Args:
            file_path_mapping: 文件路径映射
            pdf_dir: PDF输出目录
            options: PDF转换选项
            task_mgr: 任务管理器
            task_key: 任务键
            valid_files_count: 有效文件数量
            max_workers: 保留此参数以保持兼容性，但已不使用
            original_file_order: 原始文件顺序
            progress_offset: 进度偏移量，用于跨项目累积进度
            is_ppt_project: 是否为PPT项目，PPT项目使用固定1920x1080视口
            aigc_params: AIGC元数据参数对象

        Returns:
            (成功转换的PDF文件列表, 错误信息列表)
        """
        conversion_errors = []

        if options:
            logger.info("PDF转换：检测到外部options参数，当前使用服务默认配置")
        if max_workers != 1:
            logger.debug(f"PDF转换：max_workers={max_workers} 已忽略，当前使用串行处理")

        # 线程安全的进度计数器 - 从progress_offset开始计数，支持跨项目累积
        progress_lock = threading.Lock()
        completed_count = progress_offset  # 🎯 从偏移量开始，而不是从0开始

        # 🔒 进度更新队列和锁，确保串行化进度更新
        progress_update_queue = asyncio.Queue()
        progress_update_lock = asyncio.Lock()

        async def progress_updater():
            """专门的进度更新器，串行化处理所有进度更新请求"""
            if not task_mgr:
                logger.error("进度更新器启动失败：task_mgr为None")
                return

            while True:
                try:
                    update_data = await progress_update_queue.get()
                    if update_data is None:  # 结束信号
                        break

                    task_key_local, conversion_rate, current_progress, valid_files_count_local = update_data

                    for attempt in range(3):  # 最多重试3次
                        try:
                            async with progress_update_lock:
                                success = await task_mgr.update_conversion_rate(
                                    task_key_local, conversion_rate, current_progress, valid_files_count_local
                                )
                                if success:
                                    # 统一进度日志已在task_manager中打印，这里只记录调试信息
                                    logger.debug(f"PDF转换进度更新调用成功 - Task: {task_key_local}")
                                    break
                                else:
                                    logger.warning(
                                        f"PDF转换进度更新失败，尝试第 {attempt + 1} 次重试 - Task: {task_key_local}"
                                    )
                                    if attempt < 2:
                                        await asyncio.sleep(0.1 * (attempt + 1))
                        except Exception as update_error:
                            logger.error(
                                f"PDF转换进度更新异常 (尝试 {attempt + 1}/3): {update_error} - Task: {task_key_local}"
                            )
                            if attempt < 2:
                                await asyncio.sleep(0.1 * (attempt + 1))
                            else:
                                logger.error(f"PDF转换进度更新最终失败: {task_key_local}")

                    progress_update_queue.task_done()
                except Exception as updater_error:
                    logger.error(f"进度更新器发生异常: {updater_error}")

        progress_updater_task = None
        if task_mgr and task_key:
            progress_updater_task = asyncio.create_task(progress_updater())
            logger.info(f"PDF转换进度更新器已启动 - Task: {task_key}")

        # 🎯 优化：移除并发处理，改为串行处理避免网络资源竞争
        # 串行处理确保每个页面都能充分利用网络带宽加载外部资源
        playwright_instance = None
        shared_browser = None
        shared_context = None
        try:
            logger.info("PDF转换：准备共享浏览器实例（支持服务端模式）")
            # 针对PDF转换，使用高分辨率视口尺寸
            # 长截图模式需要动态调整视口高度以匹配内容
            if self.enable_full_page:
                # 长截图模式：使用足够大的视口，避免响应式布局问题
                viewport = ViewportSize(width=1920, height=3000)  # 使用较大的初始视口
                logger.info("PDF转换：启用长截图模式")
            else:
                # 普通模式：标准桌面视口
                viewport = ViewportSize(width=1920, height=1080)
                logger.info("PDF转换：标准模式 1920×1080")

            playwright_instance, shared_browser, shared_context = await self._create_shared_browser_context(
                browser_type="pdf",
                viewport=viewport,
                device_scale_factor=1.0,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                context_options={
                    # 语言和编码设置
                    "locale": "zh-CN",
                    "timezone_id": "Asia/Shanghai",
                    # 额外的上下文选项
                    "extra_http_headers": {
                        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Accept-Charset": "utf-8,*;q=0.5",
                    },
                },
            )
            logger.info("PDF转换：共享浏览器和上下文创建完成，开始串行标签页处理（避免网络资源竞争）")

            async def process_single_file_to_pdf(
                file_key: str, local_file_path: Path
            ) -> tuple[Optional[Path], Optional[str]]:
                """处理单个文件的PDF转换 - 串行处理避免网络资源竞争"""
                nonlocal completed_count
                page = None
                try:
                    # 基础文件处理，减少详细日志
                    if not local_file_path.exists():
                        local_error_msg = f"文件不存在: {local_file_path}"
                        return None, f"文件 {file_key}: {local_error_msg}"

                    file_suffix = local_file_path.suffix.lower()
                    if file_suffix not in [".html", ".htm", ".md"]:
                        local_error_msg = f"跳过非 HTML/Markdown 文件 (文件类型: {file_suffix})"
                        return None, f"文件 {file_key}: {local_error_msg}"

                    page = await shared_context.new_page()
                    page.set_default_timeout(self.PAGE_OPERATION_TIMEOUT)
                    self._bind_page_console_logger(page, debug_info=f"PDF转换-{local_file_path.name}")

                    pdf_options = {}

                    if file_suffix in [".html", ".htm"]:
                        try:
                            # 🎯 使用基类的增强页面加载方法，包含智能外部资源和字体加载优化
                            debug_info = f"PDF转换-{local_file_path.name}"
                            success = await self._load_html_page_standard(page, local_file_path, debug_info)

                            if not success:
                                return None, f"文件 {file_key}: 页面加载失败"

                            # 🎯 PPT项目优化：跳过懒加载滚动，避免改变页面高度
                            if is_ppt_project:
                                logger.info(f"🎯 [{local_file_path.name}] PPT项目跳过懒加载滚动，保持固定1080px高度")
                            else:
                                # 非PPT项目：滚动到底部触发懒加载内容
                                scroll_success = await self._scroll_to_trigger_lazy_loading(page, debug_info=debug_info)
                                if not scroll_success:
                                    logger.warning(f"懒加载触发失败，但继续PDF转换: {local_file_path.name}")

                        except Exception as page_error:
                            error_details = [f"页面加载错误: {str(page_error)}"]
                            detailed_error = "; ".join(error_details)
                            logger.error(f"页面加载失败 {local_file_path}: {detailed_error}")
                            return None, f"文件 {file_key}: 页面加载失败 - {detailed_error}"

                        # 注入打印CSS并启用打印背景色
                        try:
                            await self._inject_print_css(page)
                        except Exception as css_error:
                            logger.debug(f"注入打印CSS失败: {css_error}")

                        # 🎯 PPT项目优化：使用固定视口尺寸，避免底部空白区域
                        if is_ppt_project:
                            try:
                                await page.add_style_tag(
                                    content="""
                                    @page {
                                        size: 1920px 1080px;
                                        margin: 0;
                                    }
                                    @media print {
                                        html, body {
                                            width: 1920px !important;
                                            height: 1080px !important;
                                            overflow: hidden !important;
                                        }
                                    }
                                """
                                )
                            except Exception as css_error:
                                logger.warning(f"PPT项目CSS注入失败: {css_error}")

                            # PPT项目：使用CSS page size控制
                            ppt_pdf_options = {
                                "print_background": True,
                                "prefer_css_page_size": True,  # 🎯 使用CSS的@page规则
                                "margin": {"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"},
                                "scale": 1.0,
                            }
                            pdf_options = self._normalize_pdf_options(ppt_pdf_options)
                        else:
                            # 🎯 长截图模式：动态调整视口以匹配实际内容尺寸
                            if self.enable_full_page:
                                await self._adjust_viewport_for_full_page(page)
                                # 懒加载触发后可能改变页面高度，需要重新调整视口
                                await self._adjust_viewport_for_full_page(page)

                            dimensions = await self._detect_content_dimensions(page, self.enable_full_page)
                            optimal_pdf_options = self._calculate_optimal_pdf_options(dimensions)

                            # 🎯 关键修复：如果需要注入页面尺寸CSS，先注入
                            if optimal_pdf_options.get("_inject_page_size"):
                                page_width = optimal_pdf_options.get("_page_width")
                                page_height = optimal_pdf_options.get("_page_height")
                                try:
                                    await page.add_style_tag(
                                        content=f"""
                                        @page {{
                                            size: {page_width}px {page_height}px;
                                            margin: 0;
                                        }}
                                    """
                                    )
                                    logger.info(
                                        f"🎯 [{local_file_path.name}] 普通HTML注入@page规则: {page_width}×{page_height}px"
                                    )
                                except Exception as css_error:
                                    logger.warning(f"普通HTML CSS注入失败: {css_error}")

                            pdf_options = self._normalize_pdf_options(optimal_pdf_options)

                    elif file_suffix == ".md":
                        # 🎯 修复：为 Markdown 创建临时 HTML 文件，以正确处理相对路径图片
                        temp_html_path = None
                        try:
                            # 1. 转换 Markdown 为 HTML
                            html_with_style = await self._process_markdown_content(local_file_path)

                            # 2. 在 Markdown 文件同一目录创建临时 HTML 文件
                            # 这样相对路径的图片就能正确解析
                            import os
                            import tempfile

                            temp_fd, temp_html_path = tempfile.mkstemp(
                                suffix=".html",
                                prefix=f".tmp_{local_file_path.stem}_",
                                dir=local_file_path.parent,
                                text=True,
                            )

                            # 写入 HTML 内容
                            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                                f.write(html_with_style)

                            temp_html_path = Path(temp_html_path)
                            logger.debug(f"Markdown临时HTML文件: {temp_html_path}")

                            # 3. 使用标准 HTML 加载流程（支持相对路径）
                            debug_info = f"PDF转换-Markdown-{local_file_path.name}"
                            success = await self._load_html_page_standard(page, temp_html_path, debug_info)

                            if not success:
                                return None, f"文件 {file_key}: Markdown页面加载失败"

                        except Exception as md_error:
                            return None, f"文件 {file_key}: Markdown处理失败 - {str(md_error)}"
                        finally:
                            # 4. 清理临时 HTML 文件
                            if temp_html_path and temp_html_path.exists():
                                try:
                                    temp_html_path.unlink()
                                    logger.debug(f"已清理Markdown临时文件: {temp_html_path}")
                                except Exception as cleanup_error:
                                    logger.warning(f"清理Markdown临时文件失败: {cleanup_error}")

                        # 注入打印CSS
                        try:
                            await self._inject_print_css(page)
                        except Exception as css_error:
                            logger.debug(f"注入打印CSS失败: {css_error}")

                        # Markdown文件使用标准A4配置，无边距
                        markdown_pdf_options = {
                            "format": "A4",
                            "landscape": False,
                            "scale": 1.0,
                            "print_background": True,
                            "prefer_css_page_size": True,
                            "margin": {"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"},
                        }
                        pdf_options = self._normalize_pdf_options(markdown_pdf_options)
                        logger.info("Markdown文件：使用A4配置")

                    # 生成带时间戳的PDF文件名 - 与压缩包命名保持一致
                    project_name = self.get_project_directory_from_file_key(file_key)
                    if not project_name:
                        # 如果没有项目目录，使用文件名（不含扩展名）作为项目名
                        # 确保workspace根目录的文件使用文件名而不是目录名
                        project_name = local_file_path.stem

                    pdf_filename = self._generate_timestamped_filename(project_name, "pdf")
                    generated_pdf_path = pdf_dir / pdf_filename
                    try:
                        await page.pdf(path=str(generated_pdf_path), **pdf_options)
                        if not generated_pdf_path.exists() or generated_pdf_path.stat().st_size == 0:
                            return None, f"文件 {file_key}: PDF文件生成失败或文件为空"
                    except Exception as pdf_error:
                        return None, f"文件 {file_key}: PDF生成失败 - {str(pdf_error)}"

                    # 嵌入AIGC签名元数据到PDF文件（必须成功，否则整个转换失败）
                    await self._embed_aigc_metadata_with_logging(
                        generated_pdf_path,
                        aigc_params,
                        start_message=f"📝 开始嵌入AIGC元数据: {generated_pdf_path}",
                        success_message=f"PDF转换：成功嵌入签名元数据到PDF文件 {generated_pdf_path}",
                        error_message=f"❌ PDF嵌入AIGC元数据失败: {generated_pdf_path}",
                    )

                    # 重置 agent idle 时间
                    self.update_agent_activity("PDF转换中")

                    if task_mgr and task_key and progress_updater_task:
                        with progress_lock:
                            completed_count += 1
                            current_progress = completed_count
                            # 🎯 文件转换阶段占90%，避免与后续打包上传冲突
                            pdf_conversion_progress = (current_progress / valid_files_count) * 90
                            conversion_rate = min(pdf_conversion_progress, 90.0)
                        # self._log_memory_usage("文件转换完成", task_key, current_progress, valid_files_count)  # 注释掉内存监控日志
                        await progress_update_queue.put(
                            (task_key, conversion_rate, current_progress, valid_files_count)
                        )

                    return generated_pdf_path, None

                except Exception as conversion_error:
                    error_message = f"文件转换异常 ({type(conversion_error).__name__}): {str(conversion_error)}"
                    logger.error(f"串行转换文件失败 {local_file_path}: {error_message}", exc_info=True)
                    return None, f"文件 {file_key}: {error_message}"
                finally:
                    if page:
                        await page.close()

            valid_file_mapping = {}
            results = []

            # 🎯 串行处理：逐个处理文件，避免网络资源竞争
            for i, (file_key_item, local_file_path_item) in enumerate(file_path_mapping.items()):
                if local_file_path_item.exists() and local_file_path_item.suffix.lower() in [".html", ".htm", ".md"]:
                    valid_file_mapping[file_key_item] = local_file_path_item

            logger.info(f"开始串行PDF转换，共 {len(valid_file_mapping)} 个文件")
            # self._log_memory_usage("串行转换开始", task_key, 0, valid_files_count)  # 注释掉内存监控日志

            try:
                # 串行处理每个文件
                for i, (file_key_item, local_file_path_item) in enumerate(valid_file_mapping.items()):
                    # 每处理5个文件输出一次进度，避免过多日志
                    if i % 5 == 0 or i == len(valid_file_mapping) - 1:
                        logger.info(f"PDF转换进度: {i + 1}/{len(valid_file_mapping)}")
                    result = await process_single_file_to_pdf(file_key_item, local_file_path_item)
                    results.append(result)

            except Exception as e:
                raise RuntimeError(f"串行PDF转换失败: {str(e)}")

            valid_file_keys = list(valid_file_mapping.keys())
            pdf_file_mapping = {}
            for i, result in enumerate(results):
                result_file_key = valid_file_keys[i] if i < len(valid_file_keys) else f"文件{i + 1}"
                if isinstance(result, (Exception, BaseException)):
                    conversion_errors.append(f"{result_file_key}: 处理异常 - {str(result)}")
                    continue
                pdf_path, error_msg = result
                if error_msg:
                    conversion_errors.append(error_msg)
                elif pdf_path:
                    pdf_file_mapping[result_file_key] = pdf_path

            if original_file_order and pdf_file_mapping:
                ordered_pdf_files = [pdf_file_mapping[key] for key in original_file_order if key in pdf_file_mapping]
                pdf_files = ordered_pdf_files
            else:
                pdf_files = list(pdf_file_mapping.values())

            logger.info(f"串行PDF转换完成: {len(pdf_files)}/{len(valid_file_mapping)} 成功")
            # self._log_memory_usage("串行转换完成", task_key, len(pdf_files), valid_files_count)  # 注释掉内存监控日志

            return pdf_files, conversion_errors
        finally:
            if progress_updater_task:
                await progress_update_queue.put(None)
                await progress_updater_task
            await self._close_shared_browser_context(
                playwright_instance, shared_browser, shared_context, log_prefix="PDF转换"
            )

    async def _convert_projects_to_pdf(
        self,
        pdf_projects: Dict[str, Dict[str, Any]],
        pdf_dir: Path,
        options: Optional[Dict[str, Any]] = None,
        task_mgr=None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        max_workers: int = 1,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> tuple[List[Path], List[str]]:
        """
        按项目和智能顺序转换文件为PDF，支持PPT项目合并

        Args:
            pdf_projects: PDF项目字典
            pdf_dir: PDF输出目录
            options: PDF转换选项
            task_mgr: 任务管理器
            task_key: 任务键
            valid_files_count: 有效文件数量
            max_workers: 最大并发数
            aigc_params: AIGC元数据参数对象

        Returns:
            (成功转换的PDF文件列表, 错误信息列表)
        """
        all_pdf_files = []
        all_conversion_errors = []

        # 🎯 维护跨项目的累积进度计数器
        cumulative_processed_files = 0

        for project_name, project_info in pdf_projects.items():
            try:
                logger.info(f"开始处理PDF项目: {project_name}")

                # 使用基类方法准备有序的文件列表
                files_to_convert = self.prepare_ordered_files_for_project(project_info)

                is_ppt_project = project_info["is_ppt_entry"] and project_info["slides"]

                # 如果是PPT入口项目，记录排序信息
                if is_ppt_project:
                    logger.info(
                        f"🎯 PPT入口项目 '{project_name}' 按slides顺序转换: {len(files_to_convert)} 个文件 -> 将合并为单个PDF"
                    )

                # 为项目创建临时的文件路径映射
                project_file_mapping = {}
                for file_path in files_to_convert:
                    # 生成一个临时的file_key
                    temp_key = f"{project_name}_{file_path.name}"
                    project_file_mapping[temp_key] = file_path

                # 为项目转换创建有序的file_keys列表
                project_file_order = list(project_file_mapping.keys())

                # 转换项目文件为独立的PDF
                # 🎯 修复进度计算：使用整个任务的总文件数量，并传递累积进度偏移量
                project_pdf_files, project_errors = await self._convert_files_concurrent(
                    project_file_mapping,
                    pdf_dir,
                    options,
                    task_mgr,
                    task_key,
                    valid_files_count,
                    max_workers,
                    project_file_order,
                    cumulative_processed_files,
                    is_ppt_project,
                    aigc_params,
                )

                # 🎯 更新累积进度计数器
                cumulative_processed_files += len(files_to_convert)

                # 🎯 关键功能：如果是PPT项目且有多个页面，合并为单个PDF
                if is_ppt_project and len(project_pdf_files) > 1:
                    logger.info(f"🔗 PPT项目 '{project_name}' 开始合并 {len(project_pdf_files)} 个PDF页面")

                    # 创建合并后的PDF文件名 - 使用时间戳格式
                    merged_pdf_name = self._generate_timestamped_filename(project_name, "pdf")
                    merged_pdf_path = pdf_dir / merged_pdf_name

                    # 执行PDF合并
                    merged_pdf = await self._merge_pdf_files(
                        project_pdf_files, merged_pdf_path, project_name, aigc_params
                    )

                    if merged_pdf:
                        # 合并成功，用合并后的PDF替换原来的多个PDF
                        all_pdf_files.append(merged_pdf)
                        logger.info(
                            f"✅ PPT项目 '{project_name}' PDF合并成功: {len(project_pdf_files)} 页 -> {merged_pdf.name}"
                        )
                    else:
                        # 合并失败，保留原来的多个PDF
                        all_pdf_files.extend(project_pdf_files)
                        all_conversion_errors.append(f"PPT项目 '{project_name}': PDF合并失败，保留独立页面")
                        logger.warning(
                            f"⚠️ PPT项目 '{project_name}' PDF合并失败，保留 {len(project_pdf_files)} 个独立PDF文件"
                        )
                else:
                    # 普通项目或单页PPT项目，直接添加PDF文件
                    all_pdf_files.extend(project_pdf_files)
                    if is_ppt_project:
                        logger.info(f"📄 PPT项目 '{project_name}' 只有1页，无需合并")

                all_conversion_errors.extend(project_errors)

                final_files_count = 1 if (is_ppt_project and len(project_pdf_files) > 1) else len(project_pdf_files)
                logger.info(
                    f"PDF项目 '{project_name}' 处理完成: {len(project_pdf_files)} 页转换 -> {final_files_count} 个PDF文件"
                )

            except Exception as e:
                logger.error(f"处理PDF项目 '{project_name}' 失败: {e}")
                all_conversion_errors.append(f"项目 '{project_name}': {str(e)}")

        ppt_projects_count = sum(1 for info in pdf_projects.values() if info["is_ppt_entry"] and info["slides"])
        logger.info(
            f"所有PDF项目处理完成: 成功 {len(all_pdf_files)} 个PDF文件 (其中 {ppt_projects_count} 个PPT项目已合并)"
        )
        return all_pdf_files, all_conversion_errors

    async def _convert_projects(
        self,
        projects: Dict[str, Dict[str, Any]],
        output_dir: Path,
        options: Optional[Dict[str, Any]] = None,
        task_mgr=None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        optimal_concurrency: int = 1,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> tuple[List[Path], List[str]]:
        """
        实现抽象方法：执行PDF项目转换

        Args:
            projects: PDF项目字典
            output_dir: 输出目录（对应batch_dir下的pdf子目录）
            options: 转换选项
            task_mgr: 任务管理器
            task_key: 任务键
            valid_files_count: 有效文件数量
            optimal_concurrency: 最优并发数
            aigc_params: AIGC元数据参数对象

        Returns:
            (转换后的PDF文件列表, 错误信息列表)
        """
        # PDF转换需要在output_dir下创建pdf子目录
        # 注意：CDN 资源自动通过 Playwright 路由拦截映射到本地 static/
        pdf_dir = output_dir / "pdf"
        pdf_dir.mkdir(parents=True, exist_ok=True)

        # 调用现有的PDF项目转换逻辑
        return await self._convert_projects_to_pdf(
            projects, pdf_dir, options, task_mgr, task_key, valid_files_count, optimal_concurrency, aigc_params
        )

    async def _get_service_specific_result_data(
        self, file_keys: List[Dict[str, str]], projects: Dict[str, Dict[str, Any]], converted_files: List[Path]
    ) -> Dict[str, Any]:
        """
        实现抽象方法：获取PDF服务特定的结果数据

        Args:
            file_keys: 原始文件键列表
            projects: 项目字典
            converted_files: 转换后的PDF文件列表

        Returns:
            PDF服务特定的结果数据字典
        """
        return {
            "total_urls": len(file_keys)  # PDF服务特有的字段
        }
