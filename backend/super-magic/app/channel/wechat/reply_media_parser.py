"""
解析微信最终回复里的媒体引用，转为媒体发送列表。

只识别代码块外的媒体语法，并从可见文本里剥离：
- Markdown 图片：`![alt](path)` 或 `![alt](path "title")`
- HTML 图片：`<img src="path">`
- HTML 视频：`<video src="path"></video>` 或 `<video><source src="path"></video>`

只用于微信场景；网页端由前端直接渲染原始内容。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Markdown 图片：![alt](path) 或 ![alt](path "title")
# [^)\s"']+ 精确匹配路径，不含空格和引号，避免回溯
_MD_IMAGE_RE = re.compile(r'!\[[^\]]*\]\(([^)\s"\']+)(?:\s+"[^"]*")?\)')

# HTML img：src 属性双引号或单引号两种形式
_HTML_IMG_RE = re.compile(
    r'<img\b[^>]*\bsrc=(?:"([^"]+)"|\'([^\']+)\')[^>]*/?>',
    re.IGNORECASE,
)

# video 块跨行收集用：开始标记检测 / 结束标记字符串
_VIDEO_OPEN_RE = re.compile(r"<video\b", re.IGNORECASE)
_VIDEO_CLOSE = "</video>"

# 从 video 块内提取第一个 src 属性（video 标签自身或嵌套 source 标签）
_SRC_RE = re.compile(r'\bsrc=(?:"([^"]+)"|\'([^\']+)\')', re.IGNORECASE)

# 代码块开始/结束行
_FENCE_RE = re.compile(r"^\s*```")

_BLANK_LINE_RE = re.compile(r"\n{3,}")


@dataclass(slots=True)
class ParsedWechatReply:
    text: str
    media_urls: list[str] = field(default_factory=list)

    @property
    def first_media_url(self) -> str | None:
        return self.media_urls[0] if self.media_urls else None


def parse_reply_media(reply_text: str) -> ParsedWechatReply:
    """
    从回复里提取媒体引用，返回剥离媒体后的可见文本和媒体 URL 列表。
    代码块内的内容不处理。
    """
    lines = reply_text.splitlines()
    result_lines: list[str] = []
    media_urls: list[str] = []
    in_fence = False
    i = 0

    while i < len(lines):
        line = lines[i]

        # 代码块开始/结束切换
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            result_lines.append(line)
            i += 1
            continue

        if in_fence:
            result_lines.append(line)
            i += 1
            continue

        # video 块可能跨多行，逐行收集到 </video> 后整体处理
        if _VIDEO_OPEN_RE.search(line):
            video_lines = [line]
            while _VIDEO_CLOSE not in line.lower() and i + 1 < len(lines):
                i += 1
                line = lines[i]
                video_lines.append(line)

            src = _extract_first_src("\n".join(video_lines))
            if src and _is_media_target(src):
                media_urls.append(src)
                # 整块移除，不进入 result_lines
            else:
                result_lines.extend(video_lines)
            i += 1
            continue

        # 行内 Markdown 图片和 HTML img
        line, urls = _extract_inline_media(line)
        media_urls.extend(urls)
        result_lines.append(line)
        i += 1

    visible_text = "\n".join(result_lines).strip()
    visible_text = _BLANK_LINE_RE.sub("\n\n", visible_text)
    return ParsedWechatReply(text=visible_text, media_urls=media_urls)


def _extract_inline_media(line: str) -> tuple[str, list[str]]:
    """从单行文本里提取图片引用，返回剥离后的行和 URL 列表。"""
    urls: list[str] = []

    def _replace_md(m: re.Match) -> str:
        src = m.group(1)
        if _is_media_target(src):
            urls.append(src)
            return ""
        return m.group(0)

    def _replace_img(m: re.Match) -> str:
        src = m.group(1) or m.group(2)
        if src and _is_media_target(src):
            urls.append(src)
            return ""
        return m.group(0)

    line = _MD_IMAGE_RE.sub(_replace_md, line)
    line = _HTML_IMG_RE.sub(_replace_img, line)
    return line, urls


def _extract_first_src(text: str) -> str | None:
    m = _SRC_RE.search(text)
    return (m.group(1) or m.group(2)) if m else None


def _is_media_target(value: str) -> bool:
    if not value:
        return False
    # 显式 URL scheme
    if value.startswith(("https://", "http://", "file://")):
        return True
    # 绝对路径
    if value.startswith("/"):
        return True
    # 相对路径（解析到 workspace），排除 HTML anchor 和其他 URI scheme
    if value.startswith("#") or "://" in value:
        return False
    return True
