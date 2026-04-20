"""数据清洗脚本验证器"""

import ast
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List
from agentlang.logger import get_logger

logger = get_logger(__name__)


class DataCleaningValidator:
    """数据清洗脚本验证器
    
    职责：
    1. 验证 data_cleaning.py 中的必需语句；若存在 FILE_DATA_SOURCES，则校验 magic.project.js 中
       dataSources 条目格式（name 与 url 指向的文件名一致）；dataSources 可为空（未跑清洗或未同步前）
    2. 扫描 cleaned_data 目录中的数据文件
    """
    
    async def validate(self, project_dir: Path, magic_project_path: Path) -> None:
        """验证data_cleaning.py中的必需语句和数据源配置
        
        验证要求：
        1. 如果data_cleaning.py不存在，跳过验证
        2. 如果存在但没有FILE_DATA_SOURCES，跳过验证
        3. 如果有FILE_DATA_SOURCES，则必须包含三个必需语句：
           - PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
           - OUTPUT_DIR = os.path.join(PROJECT_ROOT, "cleaned_data")
           - os.makedirs(OUTPUT_DIR, exist_ok=True)
        4. 若 magic.project.js 中 dataSources 非空，则每项须含 name、url，且 name 与 url 指向的文件主名一致
        
        Args:
            project_dir: 项目目录路径
            magic_project_path: magic.project.js文件路径
            
        Raises:
            ValueError: 当验证失败时抛出异常
        """
        data_cleaning_path = project_dir / "data_cleaning.py"
        
        # 如果data_cleaning.py不存在，跳过验证
        if not data_cleaning_path.exists():
            logger.info("data_cleaning.py file does not exist, skipping data cleaning script validation")
            return
        
        try:
            # 执行验证
            result = self._validate_sources(
                str(data_cleaning_path),
                str(magic_project_path)
            )
            
            # 检查验证结果
            if not result["valid"]:
                errors = result.get("errors", [])
                if errors:
                    error_message = "Data cleaning script validation failed:\n  - " + "\n  - ".join(errors)
                    raise ValueError(error_message)
                else:
                    raise ValueError("Data cleaning script validation failed with unknown errors")
            
            # 记录警告信息（如果有）
            warnings = result.get("warnings", [])
            if warnings:
                for warning in warnings:
                    logger.warning(f"Data cleaning script warning: {warning}")
            
            logger.info("Data cleaning script validation passed")
            
        except ValueError:
            # 重新抛出验证错误
            raise
        except Exception as e:
            logger.error(f"Data cleaning script validation process failed: {e}", exc_info=True)
            raise ValueError(f"Failed to validate data cleaning script: {str(e)}")
    
    def _validate_sources(self, data_cleaning_path: str, magic_project_path: str) -> Dict[str, Any]:
        """验证 data_cleaning.py 与 magic.project.js 中的 dataSources 配置（不再使用已废弃的 sources 字段）
        
        使用 Python AST (抽象语法树) 进行精准解析，避免正则表达式的局限性。
        
        Args:
            data_cleaning_path: data_cleaning.py 文件路径
            magic_project_path: magic.project.js 文件路径
        
        Returns:
            Dict[str, Any]: 验证结果，包含以下字段:
                - valid: bool, 是否验证通过
                - errors: List[str], 错误信息列表
                - warnings: List[str], 警告信息列表
                - file_data_sources: Dict[str, str], 从 data_cleaning.py 提取的 FILE_DATA_SOURCES
                - magic_sources: List[Dict], 从 magic.project.js 提取的 dataSources（仅 name、url）
        
        验证规则:
            1. FILE_DATA_SOURCES 格式检查: 必须使用 os.path.join(PROJECT_ROOT, "..", ...) 格式
            2. magic.project.js 须包含 dataSources 数组（可为空）
            3. dataSources 每项须含 name、url；name 须等于 url 路径中文件名的主名（与 scan_cleaned_data 约定一致）
            4. 必需语句检查: 检查 PROJECT_ROOT, OUTPUT_DIR, os.makedirs 语句是否存在
        """
        result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "file_data_sources": {},
            "magic_sources": []
        }
        
        try:
            # 1. 提取 data_cleaning.py 信息
            py_info = self._extract_data_cleaning_info(data_cleaning_path)
            
            if not py_info["success"]:
                result["valid"] = False
                result["errors"].append(
                    f"{py_info['error']}\n"
                    f"Solution: Create data_cleaning.py with required definitions"
                )
                return result
            
            # 2. 如果没有 FILE_DATA_SOURCES，跳过验证
            if not py_info["has_file_data_sources"]:
                logger.info("FILE_DATA_SOURCES not found in data_cleaning.py, skipping validation")
                return result
            
            # 3. 验证必需语句
            if not py_info["has_project_root"]:
                result["valid"] = False
                result["errors"].append(
                    "Missing required statement: PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))\n"
                    "Solution: Define PROJECT_ROOT in data_cleaning.py"
                )
            
            if not py_info["has_output_dir"]:
                result["valid"] = False
                result["errors"].append(
                    "Missing required statement: OUTPUT_DIR = os.path.join(PROJECT_ROOT, \"cleaned_data\")\n"
                    "Solution: Define OUTPUT_DIR in data_cleaning.py"
                )
            
            if not py_info["has_makedirs"]:
                result["valid"] = False
                result["errors"].append(
                    "Missing required statement: os.makedirs(OUTPUT_DIR, exist_ok=True)\n"
                    "Solution: Add this statement to ensure output directory exists"
                )
            
            # 4. 验证 FILE_DATA_SOURCES 不为空
            if not py_info["file_data_sources"]:
                result["valid"] = False
                result["errors"].append(
                    "FILE_DATA_SOURCES is empty or has invalid format\n"
                    "Solution: Define data sources using os.path.join(PROJECT_ROOT, \"..\", \"filename.csv\") format"
                )
                return result
            
            result["file_data_sources"] = py_info["file_data_sources"]
            logger.info(f"Extracted {len(result['file_data_sources'])} data sources from data_cleaning.py using AST")
            
            # 5. 提取 magic.project.js 中 dataSources
            js_info = self._extract_magic_project_data_sources(magic_project_path)
            
            if not js_info["success"]:
                result["valid"] = False
                result["errors"].append(
                    f"{js_info['error']}\n"
                    f"Solution: Ensure magic.project.js defines window.magicProjectConfig with a dataSources array"
                )
                return result
            
            # 6. 校验 dataSources 条目（与 update_data_source_config / scan_cleaned_data 约定一致）
            for source in js_info["data_sources"]:
                source_item = {"name": source["name"], "url": source["url"]}
                result["magic_sources"].append(source_item)
            
            logger.info(f"Extracted {len(result['magic_sources'])} dataSources entries from magic.project.js")
            
            for source in result["magic_sources"]:
                source_name = source["name"]
                source_url = source["url"].replace("\\", "/")
                url_basename = os.path.basename(source_url)
                url_stem = os.path.splitext(url_basename)[0]
                if source_name != url_stem:
                    result["valid"] = False
                    result["errors"].append(
                        f"dataSources name mismatch: entry name '{source_name}' must match file stem "
                        f"of url (expected '{url_stem}' from '{url_basename}')\n"
                        f"Solution: Set name to the filename without extension, e.g. match ./cleaned_data/{url_basename}"
                    )
            
            return result
            
        except Exception as e:
            logger.error(f"Exception during validation: {e}", exc_info=True)
            result["valid"] = False
            result["errors"].append(f"Exception: {str(e)}")
            return result
    
    def _extract_data_cleaning_info(self, data_cleaning_path: str) -> Dict[str, Any]:
        """从 data_cleaning.py 中提取信息（使用 AST）
        
        Args:
            data_cleaning_path: data_cleaning.py 文件路径
        
        Returns:
            Dict[str, Any]: 提取结果，包含:
                - success: bool, 是否成功
                - error: Optional[str], 错误信息
                - has_project_root: bool
                - has_output_dir: bool
                - has_makedirs: bool
                - has_file_data_sources: bool
                - file_data_sources: Dict[str, str]
        """
        result = {
            "success": True,
            "error": None,
            "has_project_root": False,
            "has_output_dir": False,
            "has_makedirs": False,
            "has_file_data_sources": False,
            "file_data_sources": {}
        }
        
        try:
            # 1. 检查文件是否存在
            if not os.path.exists(data_cleaning_path):
                result["success"] = False
                result["error"] = f"File not found: {data_cleaning_path}"
                return result
            
            # 2. 读取并解析文件
            with open(data_cleaning_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            try:
                tree = ast.parse(content, filename=data_cleaning_path)
            except SyntaxError as e:
                result["success"] = False
                result["error"] = f"Python syntax error at line {e.lineno}: {e.msg}"
                return result
            
            # 3. 遍历 AST 提取信息
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            if target.id == 'PROJECT_ROOT':
                                result["has_project_root"] = self._validate_project_root_assignment(node)
                            elif target.id == 'OUTPUT_DIR':
                                result["has_output_dir"] = self._validate_output_dir_assignment(node)
                            elif target.id == 'FILE_DATA_SOURCES':
                                result["has_file_data_sources"] = True
                                sources = self._extract_file_data_sources_from_ast(node)
                                result["file_data_sources"].update(sources)
                
                elif isinstance(node, ast.Expr):
                    if isinstance(node.value, ast.Call):
                        if self._is_makedirs_call(node.value):
                            result["has_makedirs"] = True
            
            return result
            
        except Exception as e:
            result["success"] = False
            result["error"] = f"Exception: {str(e)}"
            return result
    
    def _extract_magic_project_data_sources(self, magic_project_path: str) -> Dict[str, Any]:
        """从 magic.project.js 中提取 dataSources（使用正则 + JSON）
        
        Args:
            magic_project_path: magic.project.js 文件路径
        
        Returns:
            Dict[str, Any]: 提取结果，包含:
                - success: bool, 是否成功
                - error: Optional[str], 错误信息
                - data_sources: List[Dict], dataSources 数组，元素含 name、url
        """
        result = {
            "success": True,
            "error": None,
            "data_sources": []
        }
        
        try:
            # 1. 检查文件是否存在
            if not os.path.exists(magic_project_path):
                result["success"] = False
                result["error"] = f"File not found: {magic_project_path}"
                return result
            
            # 2. 读取文件
            with open(magic_project_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 3. 使用正则提取配置对象
            config_pattern = r'window\.magicProjectConfig\s*=\s*(\{.*?\})\s*;'
            config_match = re.search(config_pattern, content, re.MULTILINE | re.DOTALL)
            
            if not config_match:
                result["success"] = False
                result["error"] = "Cannot find window.magicProjectConfig"
                return result
            
            # 4. 转换为 JSON 并解析
            js_str = config_match.group(1)
            json_str = re.sub(r',(\s*[}\]])', r'\1', js_str)
            json_str = re.sub(r'(\w+)(\s*):', r'"\1"\2:', json_str)
            json_str = json_str.replace("'", '"')
            
            try:
                config = json.loads(json_str)
                if "dataSources" not in config:
                    result["success"] = False
                    result["error"] = "dataSources field is missing in magic.project.js"
                    return result

                data_sources = config.get("dataSources", [])
                
                if not isinstance(data_sources, list):
                    result["success"] = False
                    result["error"] = "dataSources field is not an array"
                    return result
                
                for item in data_sources:
                    if not isinstance(item, dict):
                        result["success"] = False
                        result["error"] = "Each dataSources entry must be an object"
                        return result
                    if "name" not in item or "url" not in item:
                        result["success"] = False
                        result["error"] = "Each dataSources entry must include name and url"
                        return result
                    result["data_sources"].append(
                        {"name": item["name"], "url": item["url"]}
                    )
                
                return result
                
            except json.JSONDecodeError as e:
                result["success"] = False
                result["error"] = f"Invalid JSON format: {str(e)}"
                return result
            
        except Exception as e:
            result["success"] = False
            result["error"] = f"Exception: {str(e)}"
            return result
    
    def _extract_file_data_sources_from_ast(self, assign_node: ast.Assign) -> Dict[str, str]:
        """从 AST 赋值节点中提取 FILE_DATA_SOURCES 字典"""
        result = {}
        
        if not isinstance(assign_node.value, ast.Dict):
            return result
        
        for key, value in zip(assign_node.value.keys, assign_node.value.values):
            # 获取键名
            key_name = None
            if isinstance(key, ast.Constant):
                key_name = key.value
            elif isinstance(key, ast.Str):  # Python 3.7 兼容
                key_name = key.s
            
            if key_name is None:
                continue
            
            # 提取路径
            path_segments = self._extract_path_from_join_call(value)
            if path_segments:
                # 过滤 ".." 并拼接
                actual_segments = [s for s in path_segments if s != ".."]
                if actual_segments:
                    result[key_name] = "/".join(actual_segments)
        
        return result
    
    def _extract_path_from_join_call(self, node) -> List[str]:
        """从 os.path.join() AST 节点中提取路径片段"""
        if not isinstance(node, ast.Call):
            return []
        
        # 检查是否是 os.path.join
        if isinstance(node.func, ast.Attribute):
            if (isinstance(node.func.value, ast.Attribute) and
                isinstance(node.func.value.value, ast.Name) and
                node.func.value.value.id == 'os' and
                node.func.value.attr == 'path' and
                node.func.attr == 'join'):
                
                segments = []
                for arg in node.args:
                    if isinstance(arg, ast.Constant):
                        segments.append(str(arg.value))
                    elif isinstance(arg, ast.Str):  # Python 3.7 兼容
                        segments.append(arg.s)
                return segments
        
        return []
    
    def _validate_project_root_assignment(self, node: ast.Assign) -> bool:
        """验证 PROJECT_ROOT 赋值是否符合要求: os.path.dirname(os.path.abspath(__file__))"""
        value = node.value
        
        if not isinstance(value, ast.Call):
            return False
        
        # 检查外层 dirname
        if not (isinstance(value.func, ast.Attribute) and
                isinstance(value.func.value, ast.Attribute) and
                isinstance(value.func.value.value, ast.Name) and
                value.func.value.value.id == 'os' and
                value.func.value.attr == 'path' and
                value.func.attr == 'dirname'):
            return False
        
        # 检查内层 abspath(__file__)
        if len(value.args) > 0:
            inner_call = value.args[0]
            if isinstance(inner_call, ast.Call):
                if (isinstance(inner_call.func, ast.Attribute) and
                    inner_call.func.attr == 'abspath' and
                    len(inner_call.args) > 0 and
                    isinstance(inner_call.args[0], ast.Name) and
                    inner_call.args[0].id == '__file__'):
                    return True
        
        return False
    
    def _validate_output_dir_assignment(self, node: ast.Assign) -> bool:
        """验证 OUTPUT_DIR 赋值是否符合要求: os.path.join(PROJECT_ROOT, "cleaned_data")"""
        value = node.value
        
        if not isinstance(value, ast.Call):
            return False
        
        # 检查 os.path.join
        if not (isinstance(value.func, ast.Attribute) and
                isinstance(value.func.value, ast.Attribute) and
                isinstance(value.func.value.value, ast.Name) and
                value.func.value.value.id == 'os' and
                value.func.value.attr == 'path' and
                value.func.attr == 'join'):
            return False
        
        # 检查参数
        if len(value.args) >= 2:
            # 第一个参数应该是 PROJECT_ROOT
            if isinstance(value.args[0], ast.Name) and value.args[0].id == 'PROJECT_ROOT':
                # 第二个参数应该是 "cleaned_data"
                second_arg = value.args[1]
                if isinstance(second_arg, ast.Constant) and second_arg.value == 'cleaned_data':
                    return True
                elif isinstance(second_arg, ast.Str) and second_arg.s == 'cleaned_data':
                    return True
        
        return False
    
    def _is_makedirs_call(self, node: ast.Call) -> bool:
        """检查是否是 os.makedirs(OUTPUT_DIR, exist_ok=True) 调用"""
        if not isinstance(node.func, ast.Attribute):
            return False
        
        # 检查 os.makedirs
        if not (isinstance(node.func.value, ast.Name) and
                node.func.value.id == 'os' and
                node.func.attr == 'makedirs'):
            return False
        
        # 检查第一个参数是 OUTPUT_DIR
        if len(node.args) > 0:
            if isinstance(node.args[0], ast.Name) and node.args[0].id == 'OUTPUT_DIR':
                # 检查 exist_ok=True
                for keyword in node.keywords:
                    if keyword.arg == 'exist_ok':
                        if isinstance(keyword.value, ast.Constant) and keyword.value.value is True:
                            return True
                        elif isinstance(keyword.value, ast.NameConstant) and keyword.value.value is True:
                            return True
        
        return False
    
    async def scan_cleaned_data(self, project_dir: Path) -> List[Dict[str, str]]:
        """扫描cleaned_data目录中的CSV数据文件

        Args:
            project_dir: 项目目录路径

        Returns:
            List[Dict[str, str]]: 数据源配置列表
            
        Raises:
            ValueError: 当发现非CSV文件时抛出异常
        """
        cleaned_data_dir = project_dir / "cleaned_data"
        data_source_items = []

        if not cleaned_data_dir.exists():
            return data_source_items

        # 收集所有文件，分别处理CSV和非CSV文件
        csv_files = []
        non_csv_files = []
        
        for file_path in cleaned_data_dir.iterdir():
            if file_path.is_file():
                if file_path.suffix.lower() == '.csv':
                    csv_files.append(file_path)
                else:
                    non_csv_files.append(file_path)

        # 如果发现非CSV文件，收集信息并抛出错误
        if non_csv_files:
            non_csv_file_names = [f.name for f in non_csv_files]
            non_csv_file_list = ", ".join(non_csv_file_names)
            error_msg = f"Found {len(non_csv_files)} non-CSV files in cleaned_data directory: {non_csv_file_list}. According to data cleaning output specifications, this directory should only contain CSV format data files. Please modify the data cleaning script and remove or convert these files to CSV format."
            logger.error(f"数据源配置失败: {error_msg}")
            raise ValueError(error_msg)

        # 处理CSV文件
        for file_path in csv_files:
            # 移除文件后缀作为name
            name_without_suffix = file_path.stem
            data_source_items.append({
                "name": name_without_suffix,
                "url": f"./cleaned_data/{file_path.name}"
            })

        return data_source_items

