"""JavaScript 语法验证器"""

import subprocess
from pathlib import Path
from agentlang.logger import get_logger

logger = get_logger(__name__)


class JavascriptSyntaxValidator:
    """JavaScript 语法验证器
    
    职责：使用 node -c 检查 JavaScript 文件的语法是否正确
    """
    
    async def validate(self, project_dir: Path) -> None:
        """使用 node -c 检查 JavaScript 文件语法

        检查 data.js 和 config.js 文件的 JavaScript 语法是否正确

        Args:
            project_dir: 项目目录路径

        Raises:
            ValueError: 当语法检查失败时抛出异常
        """
        js_files = ['data.js', 'config.js']
        syntax_errors = []

        for js_file in js_files:
            js_path = project_dir / js_file
            
            if not js_path.exists():
                syntax_errors.append(f"{js_file} file does not exist")
                continue

            try:
                # 使用 node -c 检查语法
                result = subprocess.run(
                    ['node', '-c', str(js_path)],
                    capture_output=True,
                    text=True,
                    timeout=10  # 10秒超时
                )
                
                if result.returncode != 0:
                    # 语法错误
                    error_output = result.stderr.strip()
                    # 清理错误信息，移除文件路径前缀使其更简洁
                    if str(js_path) in error_output:
                        error_output = error_output.replace(str(js_path), js_file)
                    syntax_errors.append(f"{js_file} syntax error: {error_output}")
                else:
                    logger.debug(f"{js_file} 语法检查通过")
                    
            except subprocess.TimeoutExpired:
                syntax_errors.append(f"{js_file} syntax check timeout")
            except FileNotFoundError:
                syntax_errors.append("Node.js is not installed or not in PATH, unable to perform syntax check")
                break  # 如果 node 不存在，不需要继续检查其他文件
            except Exception as e:
                syntax_errors.append(f"{js_file} syntax check failed: {str(e)}")

        # 如果有语法错误，抛出异常
        if syntax_errors:
            error_message = "JavaScript syntax check failed:\n" + "\n".join(f"- {error}" for error in syntax_errors)
            raise ValueError(error_message)

