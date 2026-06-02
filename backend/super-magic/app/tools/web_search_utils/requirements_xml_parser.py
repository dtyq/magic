"""web_search 搜索需求 XML 兜底解析器

当 LLM 生成的搜索需求 XML 格式不正确导致严格解析失败时，提供多种兜底策略尝试提取有效内容。

常见 LLM XML 错误场景：
1. XML 前后有额外文本（如 LLM 输出说明文字包裹 XML）
2. 标签未正确闭合或嵌套错误（如 <limit>10 缺少 </limit>）
3. 根节点名称错误（如 <search> 而非 <requirements>）
4. 纯文本（LLM 完全跳过 XML 直接给出搜索词）
5. 参数在 <query> 文本后截断，缺少 </query> 及后续闭合标签
"""

import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from app.utils.xml_escape_fixer import XMLEscapeFixer


def fallback_parse_requirements_xml(xml_string: str) -> Tuple[List[Dict[str, Any]], str]:
    """兜底解析搜索需求 XML

    依次尝试以下策略：
    1. 从字符串中正则提取 <requirements>...</requirements> 片段后重新解析
    2. 用正则逐个提取 <query> 标签内容
    3. 用正则提取未闭合 <query> 后的文本
    4. 将纯文本按行作为搜索关键词

    Args:
        xml_string: 可能格式不正确的 XML 字符串

    Returns:
        Tuple of (requirements_list, fix_message)
        - requirements_list: 解析出的需求列表
        - fix_message: 描述使用了哪种兜底策略

    Raises:
        ValueError: 所有兜底策略均失败，无法提取任何有效搜索需求
    """
    requirements: List[Dict[str, Any]] = []

    # 策略1: 尝试提取 <requirements>...</requirements> 片段后重新解析
    requirements_match = re.search(
        r'<requirements\b[^>]*>(.*?)</requirements>',
        xml_string,
        re.DOTALL | re.IGNORECASE
    )
    if requirements_match:
        inner_xml = f"<requirements>{requirements_match.group(1)}</requirements>"
        try:
            fixed_xml, _ = XMLEscapeFixer.fix_xml_string(inner_xml.strip())
            root = ET.fromstring(fixed_xml)
            for req_element in root.findall('requirement'):
                req = _extract_requirement_from_element(req_element)
                if req:
                    requirements.append(req)
            if requirements:
                return requirements, "XML格式异常，已通过提取requirements片段兜底解析"
        except ET.ParseError:
            pass

    # 策略2: 用正则逐个提取 <query>...</query> 内容，并补充最后被截断的 <query>
    query_matches = re.findall(r'<query[^>]*>(.*?)</query>', xml_string, re.DOTALL | re.IGNORECASE)
    name_matches = re.findall(r'<name[^>]*>(.*?)</name>', xml_string, re.DOTALL | re.IGNORECASE)
    seen_queries = set()

    if query_matches:
        for i, query_text in enumerate(query_matches):
            query_text = query_text.strip()
            if not query_text:
                continue
            name_text = (
                name_matches[i].strip()
                if i < len(name_matches) and name_matches[i].strip()
                else query_text[:20]
            )
            requirements.append(_build_default_requirement(name=name_text, query=query_text))
            seen_queries.add(query_text)

    # 策略3: <query> 已打开但未闭合，常见于参数在 query 文本后被截断
    open_query_matches = re.findall(r'<query[^>]*>([^<]+)', xml_string, re.DOTALL | re.IGNORECASE)
    if open_query_matches:
        added_unclosed_query = False
        for i, query_text in enumerate(open_query_matches):
            query_text = query_text.strip()
            if not query_text or query_text in seen_queries:
                continue
            name_text = (
                name_matches[i].strip()
                if i < len(name_matches) and name_matches[i].strip()
                else query_text[:20]
            )
            requirements.append(_build_default_requirement(name=name_text, query=query_text))
            seen_queries.add(query_text)
            added_unclosed_query = True
        if requirements:
            if query_matches and added_unclosed_query:
                return requirements, "XML格式异常，已通过正则提取query字段并补充未闭合query兜底解析"
            if added_unclosed_query:
                return requirements, "XML格式异常，已通过未闭合query字段兜底解析"
            return requirements, "XML格式异常，已通过正则提取query字段兜底解析"

    # 策略4: 整个字符串不包含任何 XML 标签，可能 LLM 直接传了纯文本搜索词
    stripped = xml_string.strip()
    if stripped and not re.search(r'<[a-zA-Z/]', stripped):
        lines = [line.strip() for line in stripped.split('\n') if line.strip()]
        for line in lines[:5]:  # 最多取5个
            requirements.append(_build_default_requirement(name=line[:20], query=line))
        if requirements:
            return requirements, "未检测到XML格式，已将纯文本作为搜索关键词兜底处理"

    raise ValueError("兜底解析失败：无法从输入中提取任何有效的搜索需求")


def _extract_requirement_from_element(req_element: ET.Element) -> Optional[Dict[str, Any]]:
    """从 XML Element 中提取单个搜索需求"""
    query_el = req_element.find('query')
    name_el = req_element.find('name')

    if query_el is None or not query_el.text or not query_el.text.strip():
        return None

    query = query_el.text.strip()
    name = name_el.text.strip() if name_el is not None and name_el.text else query[:20]

    # 提取可选字段
    limit = _get_int_field(req_element, 'limit', default=10, min_val=1, max_val=20)
    offset = _get_int_field(req_element, 'offset', default=0, min_val=0)

    language_el = req_element.find('language')
    language = language_el.text.strip() if language_el is not None and language_el.text else 'zh-CN'

    region_el = req_element.find('region')
    region = region_el.text.strip() if region_el is not None and region_el.text else 'CN'

    time_period_el = req_element.find('time_period')
    time_period = time_period_el.text.strip() if time_period_el is not None and time_period_el.text else None

    return {
        'name': name,
        'query': query,
        'limit': limit,
        'offset': offset,
        'language': language,
        'region': region,
        'time_period': time_period,
    }


def _get_int_field(element: ET.Element, field_name: str, default: int, min_val: int = None, max_val: int = None) -> int:
    """安全提取整型字段，解析失败时返回默认值"""
    el = element.find(field_name)
    if el is None or not el.text:
        return default
    try:
        val = int(el.text.strip())
        if min_val is not None and val < min_val:
            return default
        if max_val is not None and val > max_val:
            return default
        return val
    except ValueError:
        return default


def _build_default_requirement(name: str, query: str) -> Dict[str, Any]:
    """构建带默认值的搜索需求字典"""
    return {
        'name': name,
        'query': query,
        'limit': 10,
        'offset': 0,
        'language': 'zh-CN',
        'region': 'CN',
        'time_period': None,
    }
