"""Markdown 资产链接解析与重写。"""

from __future__ import annotations

import posixpath
import re
from pathlib import Path, PurePosixPath
from typing import Iterable


class MarkdownAssetLinkResolver:
    """根据 Markdown 文件位置生成并重写文档资产相对链接。"""

    _IMAGE_LINK_PATTERN = re.compile(r"(!\[[^\]]*\]\()([^)\n]+)(\))")

    @staticmethod
    def asset_link(output_dir: Path, markdown_path: Path, asset_path: str) -> str | None:
        """计算资产相对于目标 Markdown 文件的 POSIX 相对链接。"""
        canonical = MarkdownAssetLinkResolver._canonical_asset_path(asset_path)
        if canonical is None:
            return None
        output_root = output_dir.resolve()
        target = markdown_path.resolve()
        asset_file = (output_root / Path(*PurePosixPath(canonical).parts)).resolve()
        try:
            asset_file.relative_to(output_root)
        except ValueError:
            return None
        return posixpath.relpath(asset_file, start=target.parent).replace("\\", "/")

    @staticmethod
    def matching_links(output_dir: Path, markdown_path: Path, asset_path: str) -> tuple[str, ...]:
        """返回当前 Markdown 文件可能使用的新旧资产链接形式。"""
        canonical = MarkdownAssetLinkResolver._canonical_asset_path(asset_path)
        if canonical is None:
            return ()
        links = [canonical]
        relative = MarkdownAssetLinkResolver.asset_link(output_dir, markdown_path, canonical)
        if relative and relative not in links:
            links.append(relative)
        if f"./{canonical}" not in links:
            links.append(f"./{canonical}")
        if relative and f"./{relative}" not in links:
            links.append(f"./{relative}")
        return tuple(links)

    @staticmethod
    def rewrite_asset_links(
        content: str,
        source_output_dir: Path,
        source_markdown_path: Path,
        target_output_dir: Path,
        target_markdown_path: Path,
        asset_paths: Iterable[str],
    ) -> str:
        """只重写登记资产的图片链接，并按目标 Markdown 位置重新计算路径。"""
        mappings: dict[str, str] = {}
        for asset_path in asset_paths:
            canonical = MarkdownAssetLinkResolver._canonical_asset_path(asset_path)
            if canonical is None:
                continue
            target_link = MarkdownAssetLinkResolver.asset_link(target_output_dir, target_markdown_path, canonical)
            if not target_link:
                continue
            for source_link in MarkdownAssetLinkResolver.matching_links(source_output_dir, source_markdown_path, canonical):
                mappings[source_link] = target_link

        if not mappings:
            return content

        def replace(match: re.Match[str]) -> str:
            raw_url = match.group(2)
            leading = raw_url[: len(raw_url) - len(raw_url.lstrip())]
            trailing = raw_url[len(raw_url.rstrip()):]
            url = raw_url.strip()
            replacement = mappings.get(url)
            if replacement is None:
                return match.group(0)
            return f"{match.group(1)}{leading}{replacement}{trailing}{match.group(3)}"

        return MarkdownAssetLinkResolver._IMAGE_LINK_PATTERN.sub(replace, content)

    @staticmethod
    def _canonical_asset_path(asset_path: str) -> str | None:
        """校验并规范化 output_dir 相对资产路径。"""
        normalized = str(asset_path or "").replace("\\", "/").strip()
        if not normalized:
            return None
        path = PurePosixPath(normalized)
        if path.is_absolute() or ".." in path.parts:
            return None
        canonical = path.as_posix().removeprefix("./")
        return canonical or None
