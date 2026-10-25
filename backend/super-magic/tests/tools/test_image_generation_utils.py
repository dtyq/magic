from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection
from app.core.models.media_model import ImageModelSpec
from app.tools.image_utils.image_generation_utils import (
    detect_image_file_extension,
    get_model_valid_sizes,
    resolve_image_model,
    resolve_safe_save_path,
    snap_to_nearest_valid_size,
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


def _tool_context_with_sizes(sizes):
    model_context = AgentModelContext()
    model_context.apply_selection(AgentModelSelection(
        configured_text_model_id="mock-text-model",
        text_model_id="mock-text-model",
        image_model=ImageModelSpec.from_values(model_id="gpt-image-2", sizes=sizes),
    ))
    tool_context = ToolContext()
    tool_context.register_extension("agent_context", type("MockAgentContext", (), {"model_context": model_context})())
    return tool_context


def test_get_model_valid_sizes_parses_sizes_from_model_context():
    sizes = [{"label": "1:1", "value": "2048x2048", "scale": "2K"}]
    tool_context = _tool_context_with_sizes(sizes)

    assert get_model_valid_sizes(tool_context) == [(2048, 2048)]


def test_get_model_valid_sizes_returns_empty_when_no_agent_context():
    assert get_model_valid_sizes(ToolContext()) == []


def test_snap_to_nearest_valid_size_returns_input_unchanged_when_already_valid():
    valid_sizes = [(2048, 2048), (2560, 1440)]

    assert snap_to_nearest_valid_size("2560x1440", valid_sizes) == "2560x1440"


def test_snap_to_nearest_valid_size_returns_input_unchanged_when_no_valid_sizes():
    assert snap_to_nearest_valid_size("648x585", []) == "648x585"


def test_snap_to_nearest_valid_size_picks_closest_aspect_ratio():
    # gpt-image-2 的 1:1/2:3/3:2 常见档位；648x585 接近 1:1，应 snap 到方形
    valid_sizes = [(1024, 1024), (1024, 1536), (1536, 1024)]

    assert snap_to_nearest_valid_size("648x585", valid_sizes) == "1024x1024"


def test_snap_to_nearest_valid_size_snaps_oversized_reference_dimensions():
    # Azure 报错案例：5000x2335 原始参考图尺寸应 snap 到最接近的 16:9 合法档位
    valid_sizes = [(1024, 1024), (2560, 1440), (1440, 2560)]

    assert snap_to_nearest_valid_size("5000x2335", valid_sizes) == "2560x1440"
