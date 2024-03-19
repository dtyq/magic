"""浏览器验证器"""

import asyncio
import socket
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict
from agentlang.logger import get_logger
from magic_use.magic_browser import MagicBrowser

logger = get_logger(__name__)


class BrowserValidator:
    """浏览器验证器
    
    职责：使用无头浏览器验证 dashboard 页面是否正常渲染
    """
    
    async def validate(self, project_dir: Path) -> Dict[str, Any]:
        """使用无头浏览器验证dashboard页面是否正常渲染
        
        打开dashboard页面，监听DashboardAllCardsRenderComplete事件，
        统计页面是否报错。
        
        Args:
            project_dir: 项目目录路径
            
        Returns:
            Dict[str, Any]: 验证结果，包含是否成功、错误信息等
        """
        browser = None
        http_server = None
        try:
            # 创建无头浏览器实例
            browser = await MagicBrowser.create_for_scraping()
            
            # 准备dashboard页面URL
            index_html_path = project_dir / "index.html"
            if not index_html_path.exists():
                return {
                    "success": False,
                    "error": "index.html file does not exist"
                }
            
            # 启动带有监听脚本的临时HTTP服务器
            http_server, port = self._start_http_server_with_monitor(project_dir, index_html_path)
            dashboard_url = f"http://localhost:{port}/index.html"
            
            # 导航到dashboard页面
            goto_result = await browser.goto(page_id=None, url=dashboard_url)
            if hasattr(goto_result, 'error'):
                return {
                    "success": False,
                    "error": f"Page navigation failed: {goto_result.error}"
                }
            
            # 获取活跃页面ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                return {
                    "success": False,
                    "error": "Unable to get active page ID"
                }
            
            # 等待监听结果（20秒超时）
            try:
                monitor_result = await asyncio.wait_for(
                    browser.evaluate_js(
                        page_id=page_id,
                        js_code="window.dashboardMonitorPromise"
                    ),
                    timeout=20.0
                )
            except asyncio.TimeoutError:
                return {
                    "success": False,
                    "error": "Dashboard validation timeout (20 seconds), page may not have loaded correctly or rendering process is abnormal"
                }
            
            if hasattr(monitor_result, 'error'):
                return {
                    "success": False,
                    "error": f"Failed to execute monitor script: {monitor_result.error}"
                }
            
            # 返回监听结果
            result = monitor_result.result if hasattr(monitor_result, 'result') else {}
            
            # 检查结果是否为空
            if not result:
                logger.info("监听脚本返回空结果")
                return {
                    "success": False,
                    "error": "Monitor script returned empty result, Dashboard may not have loaded correctly or event was not triggered"
                }
            
            # 检查是否有渲染错误或NaN问题
            error_count = result.get('errorCount', 0)
            warning_count = result.get('warningCount', 0)
            nan_check = result.get('nanCheck', {})
            nan_cards = nan_check.get('nanCards', []) if nan_check.get('hasNaN', False) else []
            
            # 简化警告日志记录
            if warning_count > 0:
                logger.info(f"Dashboard有 {warning_count} 个警告")
            
            # 统计总错误数（渲染错误 + NaN错误）
            total_error_count = error_count + len(nan_cards)
            
            if total_error_count > 0:
                errors = result.get('errors', [])
                
                # 简化错误日志记录
                logger.info(f"Dashboard验证失败: {error_count} 个渲染错误, {len(nan_cards)} 个NaN错误")
                
                # 格式化所有错误信息
                error_messages = []
                
                # 添加浏览器验证渲染错误信息
                for error in errors:
                    error_msg = f"{error.get('type', 'UNKNOWN')}: {error.get('message', 'Unknown error')}"
                    if error.get('details'):
                        details = error.get('details')
                        if isinstance(details, dict):
                            detail_info = []
                            for key, value in details.items():
                                if key == 'availableConfigs' and isinstance(value, list):
                                    detail_info.append(f"{key}: {', '.join(value[:5])}{'...' if len(value) > 5 else ''}")
                                else:
                                    detail_info.append(f"{key}: {value}")
                            error_msg += f" (Details: {'; '.join(detail_info)})"
                    error_messages.append(error_msg)
                
                # 添加浏览器验证NaN错误信息
                for nan_card in nan_cards:
                    card_id = nan_card.get('cardId', 'unknown')
                    card_type = nan_card.get('cardType', 'unknown')
                    error_messages.append(f"NaN error: Card '{card_id}' (type: {card_type}) contains NaN values")
                
                # 构建错误摘要
                error_summary_parts = []
                if error_count > 0:
                    error_summary_parts.append(f"{error_count} cards failed to render")
                if nan_cards:
                    error_summary_parts.append(f"{len(nan_cards)} cards contain NaN values")
                
                if error_summary_parts:
                    error_summary = f"Dashboard validation failed: {', '.join(error_summary_parts)}"
                else:
                    # 理论上不应该发生，但为了安全起见
                    error_summary = f"Dashboard validation failed: detected {total_error_count} errors"
                
                # 阻塞执行，返回错误信息（同时包含警告信息）
                return {
                    "success": False,
                    "error": error_summary,
                    "error_details": {
                        "total_cards": result.get('totalCards', 0),
                        "success_count": result.get('successCount', 0),
                        "error_count": error_count,
                        "nan_error_count": len(nan_cards),
                        "total_error_count": total_error_count,
                        "error_messages": error_messages,
                        "nan_cards": nan_cards,
                        "raw_errors": errors
                    },
                    # 即使有错误也要包含警告信息
                    "warningCount": warning_count,
                    "warnings": result.get('warnings', [])
                }
            else:
                # 简化验证成功日志
                logger.info(f"Dashboard验证成功{f', {warning_count} 个警告' if warning_count > 0 else ''}")
            
            # 确保返回结果包含success标识和所有必要信息
            return {
                "success": True,
                "warningCount": warning_count,
                "warnings": result.get('warnings', []),
                "totalCards": result.get('totalCards', 0),
                "successCount": result.get('successCount', 0),
                "errorCount": error_count,
                **result  # 包含原始结果的所有其他字段
            }
            
        except Exception as e:
            logger.error(f"使用浏览器验证dashboard失败: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Browser validation failed: {str(e)}"
            }
        finally:
            # 清理HTTP服务器
            if http_server:
                try:
                    http_server.shutdown()

                except Exception as e:
                    logger.error(f"关闭HTTP服务器失败: {e}")
            
            # 清理浏览器资源
            if browser:
                try:
                    await browser.close()
                except Exception as e:
                    logger.error(f"清理浏览器资源失败: {e}")
    
    def _find_free_port(self) -> int:
        """查找可用的端口"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _start_http_server_with_monitor(self, project_dir: Path, index_html_path: Path) -> tuple:
        """启动带有监听脚本的临时HTTP文件服务
        
        Args:
            project_dir: 项目目录路径
            index_html_path: index.html文件路径
            
        Returns:
            tuple[HTTPServer, int]: HTTP服务器实例和端口号
        """
        # 查找可用端口
        port = self._find_free_port()
        
        # 读取原始HTML内容
        with open(index_html_path, 'r', encoding='utf-8') as f:
            original_html_content = f.read()
        
        # 准备监听脚本
        monitor_script = """
            window.dashboardMonitorPromise = (async () => {
                return new Promise((resolve) => {
                    document.addEventListener('DashboardAllCardsRenderComplete', (event) => {
                        const { totalCards, successCount, errorCount } = event.detail;
                        // 检查页面中是否存在NaN关键字
                        const getNanCheckResult = function() {
                            const nanCards = [];
                            const allElements = document.querySelectorAll('*');
                            for (let element of allElements) {
                                // 检查元素的文本内容是否包含NaN
                                if (element.textContent && element.textContent.includes('NaN')) {
                                    // 查找最近的包含data-card-id的父元素
                                    let cardElement = element;
                                    while (cardElement && !cardElement.getAttribute('data-card-id')) {
                                        cardElement = cardElement.parentElement;
                                    }
                                    if (cardElement && cardElement.getAttribute('data-card-id')) {
                                        const cardId = cardElement.getAttribute('data-card-id');
                                        const cardType = cardElement.getAttribute('data-card-type') || 'unknown';
                                        // 避免重复记录同一个卡片
                                        if (!nanCards.some(card => card.cardId === cardId)) {
                                            nanCards.push({
                                                cardId: cardId,
                                                cardType: cardType
                                            });
                                        }
                                    }
                                }
                            }
                            return {
                                hasNaN: nanCards.length > 0,
                                nanCards: nanCards
                            };
                        }
                        setTimeout(function() {
                            resolve({
                                success: true,
                                totalCards,
                                successCount,
                                errorCount: window.ErrorCollector.errors.length,
                                warningCount: window.ErrorCollector.warnings.length,
                                nanCheck: getNanCheckResult(),
                                errors: window.ErrorCollector.errors.map(item => {
                                    return {
                                        type: item.type,
                                        module: item.source,
                                        category: item.category,
                                        message: item.message,
                                        details: item.details
                                    }
                                }),
                                warnings: window.ErrorCollector.warnings.map(item => {
                                    return {
                                        type: item.type,
                                        module: item.source,
                                        category: item.category,
                                        message: item.message,
                                        details: item.details
                                    }
                                })
                            });
                        }, 500);
                    });
                });
            })();
        """

        ready_script = """
            <script>
                window.magicProjectConfigure({
                    ready: true,
                    language: "en-US",
                });
            </script>
        """
        
        # 在</head>标签之前插入ready_script
        head_close_tag = '</head>'
        if head_close_tag in original_html_content:
            # 找到</head>标签的位置
            head_index = original_html_content.find(head_close_tag)
            if head_index != -1:
                # 分割内容：head之前 + ready_script + head及之后
                before_head = original_html_content[:head_index]
                from_head_onwards = original_html_content[head_index:]
                html_with_ready = before_head + f'    {ready_script.strip()}\n  ' + from_head_onwards
            else:
                # 如果找不到索引，直接使用原内容
                html_with_ready = original_html_content
        else:
            # 如果没有找到</head>标签，直接使用原内容
            html_with_ready = original_html_content
        
        # 在HTML文档顶部注入监听脚本（仅在内存中）
        modified_html_content = f"""<script>{monitor_script}</script>{html_with_ready}"""
        
        # 创建自定义HTTP服务器，对index.html返回修改后的内容
        class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(project_dir), **kwargs)
            
            def do_GET(self):
                # 如果请求的是index.html，返回修改后的内容
                if self.path == '/index.html' or self.path == '/':
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(modified_html_content.encode('utf-8'))
                else:
                    # 其他文件正常处理
                    super().do_GET()
            
            def log_message(self, format, *args):
                # 静默HTTP服务器日志
                pass
        
        server = HTTPServer(('localhost', port), CustomHTTPRequestHandler)
        
        # 在后台线程启动服务器
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        

        return server, port
    def _find_free_port(self) -> int:
        """查找可用的端口"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port
    def _start_http_server_with_monitor(self, project_dir: Path, index_html_path: Path) -> tuple[HTTPServer, int]:
        """启动带有监听脚本的临时HTTP文件服务
        
        Args:
            project_dir: 项目目录路径
            index_html_path: index.html文件路径
            
        Returns:
            tuple[HTTPServer, int]: HTTP服务器实例和端口号
        """
        # 查找可用端口
        port = self._find_free_port()
        
        # 读取原始HTML内容
        with open(index_html_path, 'r', encoding='utf-8') as f:
            original_html_content = f.read()
        
        # 准备监听脚本
        monitor_script = """
            window.dashboardMonitorPromise = (async () => {
                return new Promise((resolve) => {
                    document.addEventListener('DashboardAllCardsRenderComplete', (event) => {
                        const { totalCards, successCount, errorCount } = event.detail;
                        // 检查页面中是否存在NaN关键字
                        const getNanCheckResult = function() {
                            const nanCards = [];
                            const allElements = document.querySelectorAll('*');
                            for (let element of allElements) {
                                // 检查元素的文本内容是否包含NaN
                                if (element.textContent && element.textContent.includes('NaN')) {
                                    // 查找最近的包含data-card-id的父元素
                                    let cardElement = element;
                                    while (cardElement && !cardElement.getAttribute('data-card-id')) {
                                        cardElement = cardElement.parentElement;
                                    }
                                    if (cardElement && cardElement.getAttribute('data-card-id')) {
                                        const cardId = cardElement.getAttribute('data-card-id');
                                        const cardType = cardElement.getAttribute('data-card-type') || 'unknown';
                                        // 避免重复记录同一个卡片
                                        if (!nanCards.some(card => card.cardId === cardId)) {
                                            nanCards.push({
                                                cardId: cardId,
                                                cardType: cardType
                                            });
                                        }
                                    }
                                }
                            }
                            return {
                                hasNaN: nanCards.length > 0,
                                nanCards: nanCards
                            };
                        }
                        setTimeout(function() {
                            resolve({
                                success: true,
                                totalCards,
                                successCount,
                                errorCount: window.ErrorCollector.errors.length,
                                warningCount: window.ErrorCollector.warnings.length,
                                nanCheck: getNanCheckResult(),
                                errors: window.ErrorCollector.errors.map(item => {
                                    return {
                                        type: item.type,
                                        module: item.source,
                                        category: item.category,
                                        message: item.message,
                                        details: item.details
                                    }
                                }),
                                warnings: window.ErrorCollector.warnings.map(item => {
                                    return {
                                        type: item.type,
                                        module: item.source,
                                        category: item.category,
                                        message: item.message,
                                        details: item.details
                                    }
                                })
                            });
                        }, 500);
                    });
                });
            })();
        """

        ready_script = """
            <script>
                window.magicProjectConfigure({
                    ready: true,
                    language: "en-US",
                });
            </script>
        """
        
        # 在</head>标签之前插入ready_script
        head_close_tag = '</head>'
        if head_close_tag in original_html_content:
            # 找到</head>标签的位置
            head_index = original_html_content.find(head_close_tag)
            if head_index != -1:
                # 分割内容：head之前 + ready_script + head及之后
                before_head = original_html_content[:head_index]
                from_head_onwards = original_html_content[head_index:]
                html_with_ready = before_head + f'    {ready_script.strip()}\n  ' + from_head_onwards
            else:
                # 如果找不到索引，直接使用原内容
                html_with_ready = original_html_content
        else:
            # 如果没有找到</head>标签，直接使用原内容
            html_with_ready = original_html_content
        
        # 在HTML文档顶部注入监听脚本（仅在内存中）
        modified_html_content = f"""<script>{monitor_script}</script>{html_with_ready}"""
        
        # 创建自定义HTTP服务器，对index.html返回修改后的内容
        class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(project_dir), **kwargs)
            
            def do_GET(self):
                # 如果请求的是index.html，返回修改后的内容
                if self.path == '/index.html' or self.path == '/':
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(modified_html_content.encode('utf-8'))
                else:
                    # 其他文件正常处理
                    super().do_GET()
            
            def log_message(self, format, *args):
                # 静默HTTP服务器日志
                pass
        
        server = HTTPServer(('localhost', port), CustomHTTPRequestHandler)
        
        # 在后台线程启动服务器
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        

        return server, port

