"""把当前 panel 已绑定头像嵌入报告，保留模板插画降级和 AI 模拟说明。"""

from __future__ import annotations

import base64
import json
import re

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import MAX_PERSONAS
from app.tools.persona_research.persona_portraits import PERSONA_ID, portrait_detail, portrait_feedback
from app.core.entity.message.server_message import ToolDetail
from app.tools.persona_research.study_files import (
    StudyFilesError,
    read_json_file,
    resolve_in_workspace,
    resolve_study_dir,
    transcript_lock,
    write_text_file,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_read_bytes, async_read_text, async_realpath, async_stat

REPORT_START = "<!-- persona-portraits:start -->"
REPORT_END = "<!-- persona-portraits:end -->"


class EmbedPersonaPortraitsParams(BaseToolParams):
    study_dir: str = Field(..., description="studies/<slug>; embeds portraits in its existing report.html.")


# 不依赖部署域名、文件签名链接或模板版本。SVG 始终保留，图片失败仅移除覆盖层。
PORTRAIT_SCRIPT = """
(function () {
    var root = document.getElementById('persona-portrait-assets');
    if (!root) return;
    var assets = JSON.parse(root.textContent);
    document.querySelectorAll('[data-persona]').forEach(function (el) {
        var id = el.getAttribute('data-persona-id');
        var matches = id ? assets.filter(function (p) { return p.id === id; }) :
            assets.filter(function (p) { return p.name && p.name === el.getAttribute('data-persona'); });
        if (matches.length !== 1 || !matches[0].src) return;
        var img = new Image();
        img.alt = ''; img.setAttribute('aria-hidden', 'true');
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit';
        img.onload = function () {
            el.style.position = 'relative';
            el.appendChild(img);
        };
        img.onerror = function () { img.remove(); };
        img.src = matches[0].src;
    });
})();
"""


@tool(name="embed_persona_portraits", code_mode_only=True)
class EmbedPersonaPortraits(WorkspaceTool[EmbedPersonaPortraitsParams]):
    """Embed the panel's bound avatars into an existing report as a portable image snapshot."""

    async def execute(self, tool_context: ToolContext, params: EmbedPersonaPortraitsParams) -> ToolResult:
        try:
            base = await async_realpath(self.base_dir)
            study = await resolve_study_dir(base, params.study_dir)
            panel = await read_json_file(study / "panel.json")
            if not panel or not isinstance(panel.get("persona_ids"), list):
                raise StudyFilesError("The study has no saved panel.")
            ids = panel["persona_ids"]
            if len(ids) > MAX_PERSONAS or not all(
                isinstance(pid, str) and re.fullmatch(PERSONA_ID, pid) for pid in ids
            ):
                raise StudyFilesError("The panel contains invalid or too many persona ids.")
            report = await resolve_in_workspace(base, f"{params.study_dir}/report.html")
            assets, missing = [], []
            for persona_id in dict.fromkeys(ids):
                # 单个人设暂时不可读时继续其他头像；空名字不参与按名字猜测。
                try:
                    profile = await read_json_file(await resolve_in_workspace(base, f"personas/{persona_id}.json"))
                except (StudyFilesError, OSError, ValueError):
                    profile = None
                portrait = profile.get("portrait") if profile else None
                asset = {"id": persona_id, "name": profile.get("name", "") if profile else "", "src": ""}
                assets.append(asset)
                if not isinstance(portrait, dict) or not isinstance(portrait.get("file"), str):
                    missing.append(persona_id)
                    continue
                path = portrait["file"]
                # 只嵌入绑定工具自己的小 WebP，不读取任意用户文件或 URL。
                if not re.fullmatch(rf"personas/portraits/{re.escape(persona_id)}/[a-f0-9]{{20}}\.webp", path):
                    missing.append(persona_id)
                    continue
                try:
                    image_path = await resolve_in_workspace(base, path)
                    if (await async_stat(image_path)).st_size > 512_000:
                        raise ValueError("Portrait too large")
                    image = await async_read_bytes(image_path)
                    if not (image[:4] == b"RIFF" and image[8:12] == b"WEBP"):
                        raise ValueError("Invalid WebP")
                    asset["src"] = "data:image/webp;base64," + base64.b64encode(image).decode("ascii")
                except (OSError, ValueError):
                    missing.append(persona_id)
            async with transcript_lock(report):
                html = await async_read_text(report)
                # 重复执行更新同一个快照，不累积脚本；保持引用、模板与模拟说明原样。
                html = re.sub(re.escape(REPORT_START) + r".*?" + re.escape(REPORT_END) + r"\n?", "", html, flags=re.S)
                if not re.search(r"</body\s*>", html, flags=re.I):
                    raise StudyFilesError("report.html must have a closing body element.")
                payload = json.dumps(assets, ensure_ascii=True).replace("<", "\\u003c")
                block = (
                    REPORT_START
                    + '\n<script type="application/json" id="persona-portrait-assets">'
                    + payload
                    + "</script>\n<script>"
                    + PORTRAIT_SCRIPT
                    + "</script>\n"
                    + REPORT_END
                )
                html = re.sub(r"</body\s*>", lambda match: block + "\n" + match.group(), html, count=1, flags=re.I)
                await write_text_file(report, html)
            return ToolResult(
                content=f"Embedded {len(assets) - len(missing)} bound portraits in {params.study_dir}/report.html. SVG fallback retained for: {', '.join(missing) or 'none'}. AI-simulation disclosures and citations are unchanged."
            )
        except (StudyFilesError, OSError, ValueError) as exc:
            return ToolResult.error(f"Report portraits not updated: {exc}")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict | None = None
    ) -> ToolDetail:
        return portrait_detail(result)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict:
        return portrait_feedback(tool_name, result)
