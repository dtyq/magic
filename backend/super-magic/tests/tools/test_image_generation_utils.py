from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection
from app.core.models.media_model import ImageModelSpec
from app.tools.image_utils.image_generation_utils import (
    detect_image_file_extension,
    resolve_image_model,
    resolve_safe_save_path,
)


async def test_detect_image_file_extension_reads_real_png_format(tmp_path):
    image_path = tmp_path / "generated.jpg"
    Image.new("RGBA", (2, 2), (255, 0, 0, 0)).save(image_path, format="PNG")

    extension = await detect_image_file_extension(str(image_path))

    assert extension == ".png"


async def test_resolve_safe_save_path_uses_given_extension_and_avoids_conflicts(tmp_path):
    save_dir = tmp_path / "images"
    save_dir.mkdir()
    (save_dir / "pink-dot-pattern.png").write_bytes(b"existing")

    path = await resolve_safe_save_path(save_dir, "pink-dot-pattern", ".png")

    assert path == save_dir / "pink-dot-pattern_1.png"


async def test_resolve_image_model_reads_agent_model_context():
    model_context = AgentModelContext()
    model_context.apply_selection(AgentModelSelection(
        configured_text_model_id="mock-text-model",
        text_model_id="mock-text-model",
        image_model=ImageModelSpec.from_values(model_id="mock-image-model"),
    ))
    tool_context = ToolContext()
    tool_context.register_extension("agent_context", type("MockAgentContext", (), {"model_context": model_context})())

    assert await resolve_image_model(tool_context) == "mock-image-model"
