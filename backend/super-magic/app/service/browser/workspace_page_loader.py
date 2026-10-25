"""Load a workspace HTML file into any configured Browser backend."""

from __future__ import annotations

import base64
import mimetypes
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup

from app.utils.async_file_utils import (
    async_is_file,
    async_read_bytes,
    async_read_text,
    async_realpath,
)
from magic_use import BrowserClient

_CSS_URL_PATTERN = re.compile(
    r"url\(\s*(?P<quote>['\"]?)(?P<value>[^'\")]+)(?P=quote)\s*\)",
    re.IGNORECASE,
)
_BLOB_URL_SCRIPT = """
(html) => URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
"""


async def build_self_contained_workspace_page(workspace_dir: Path, html_file: Path) -> str:
    """Inline local HTML dependencies so a remote Browser needs no filesystem access."""

    workspace_root = await async_realpath(workspace_dir, strict=True)
    resolved_html = await _resolve_workspace_file(workspace_root, html_file)
    soup = BeautifulSoup(await async_read_text(resolved_html), "html.parser")

    for link in list(soup.find_all("link", href=True)):
        rel_values = {str(value).lower() for value in link.get("rel", [])}
        if "stylesheet" not in rel_values:
            continue
        if not _is_local_reference(str(link["href"])):
            continue
        stylesheet = await _resolve_local_reference(
            workspace_root,
            resolved_html.parent,
            str(link["href"]),
        )
        css = await _inline_css_urls(
            await async_read_text(stylesheet),
            workspace_root,
            stylesheet.parent,
        )
        style = soup.new_tag("style")
        style.string = css
        link.replace_with(style)

    for style in soup.find_all("style"):
        if style.string is not None:
            style.string.replace_with(
                await _inline_css_urls(
                    str(style.string),
                    workspace_root,
                    resolved_html.parent,
                )
            )

    for element in soup.find_all(style=True):
        element["style"] = await _inline_css_urls(
            str(element["style"]),
            workspace_root,
            resolved_html.parent,
        )

    for element in soup.find_all(src=True):
        element["src"] = await _inline_local_reference(
            workspace_root,
            resolved_html.parent,
            str(element["src"]),
        )

    for element in soup.find_all(["image", "use"], href=True):
        element["href"] = await _inline_local_reference(
            workspace_root,
            resolved_html.parent,
            str(element["href"]),
        )

    return soup.decode(formatter=None)


async def load_workspace_page(
    browser: BrowserClient,
    page_id: str,
    workspace_dir: Path,
    html_file: Path,
) -> str:
    """Navigate a Browser page to a self-contained Blob URL created in that Browser."""

    html = await build_self_contained_workspace_page(workspace_dir, html_file)
    target_url = await browser.evaluate(page_id, _BLOB_URL_SCRIPT, html)
    if not isinstance(target_url, str) or not target_url.startswith("blob:"):
        raise RuntimeError("The Browser runtime could not create a local page URL")
    await browser.navigate(page_id, target_url)
    return target_url


async def _inline_css_urls(css: str, workspace_root: Path, base_dir: Path) -> str:
    result: list[str] = []
    offset = 0
    for match in _CSS_URL_PATTERN.finditer(css):
        result.append(css[offset : match.start()])
        reference = match.group("value").strip()
        inlined = await _inline_local_reference(workspace_root, base_dir, reference)
        result.append(f'url("{inlined}")')
        offset = match.end()
    result.append(css[offset:])
    return "".join(result)


async def _inline_local_reference(workspace_root: Path, base_dir: Path, reference: str) -> str:
    if not _is_local_reference(reference):
        return reference
    parsed = urlsplit(reference)
    asset = await _resolve_local_reference(workspace_root, base_dir, reference)
    mime_type = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(await async_read_bytes(asset)).decode("ascii")
    fragment = f"#{parsed.fragment}" if parsed.fragment else ""
    return f"data:{mime_type};base64,{encoded}{fragment}"


def _is_local_reference(reference: str) -> bool:
    parsed = urlsplit(reference)
    return not parsed.scheme and not parsed.netloc and bool(parsed.path)


async def _resolve_local_reference(workspace_root: Path, base_dir: Path, reference: str) -> Path:
    parsed = urlsplit(reference)
    candidate = base_dir / unquote(parsed.path)
    return await _resolve_workspace_file(workspace_root, candidate)


async def _resolve_workspace_file(workspace_root: Path, file_path: Path) -> Path:
    resolved_file = await async_realpath(file_path, strict=True)
    try:
        resolved_file.relative_to(workspace_root)
    except ValueError as exc:
        raise ValueError("Browser files must stay inside the current workspace") from exc
    if not await async_is_file(resolved_file):
        raise FileNotFoundError(f"Browser file does not exist: {resolved_file}")
    return resolved_file
