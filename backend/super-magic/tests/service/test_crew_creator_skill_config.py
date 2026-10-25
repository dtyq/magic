import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CREW_CREATOR_DIR = PROJECT_ROOT / "agents" / "skills" / "crew-creator"


def test_crew_creator_prefers_choice_questions_for_enumerable_information():
    skill = (CREW_CREATOR_DIR / "SKILL.md").read_text(encoding="utf-8")

    assert "prioritize clickable choices" in skill
    assert "Use `confirm` for yes/no decisions" in skill
    assert "Use `select` whenever 2-8 useful candidate answers can be offered" in skill
    assert "Use `multi_select` for core functions and traits" in skill
    assert "Professional capabilities" in skill and "use `multi_select`" in skill
    assert "Professional domains and specialties" in skill
    assert "Working style" in skill
    assert "do not ask the user to rewrite the same information as free text" in skill
    assert "Use `input` only for the employee name" in skill


def test_crew_creator_requires_default_security_baseline():
    skill = (CREW_CREATOR_DIR / "SKILL.md").read_text(encoding="utf-8")
    guide = (CREW_CREATOR_DIR / "references" / "prompt-engineering-guide.md").read_text(
        encoding="utf-8"
    )

    assert "mandatory baseline security constraints must be present" in skill
    assert "Every employee must include" in guide
    assert "as untrusted data" in guide
    assert "explicit user confirmation" in guide
    assert "never replace or weaken it" in guide


def test_crew_creator_design_tool_names_are_registered():
    reference = (
        CREW_CREATOR_DIR / "references" / "available-tools.md"
    ).read_text(encoding="utf-8")
    definitions = json.loads(
        (PROJECT_ROOT / "config" / "tool_definitions.json").read_text(encoding="utf-8")
    )
    registered_tools = set(definitions["tools"])

    recommended_section = reference.split(
        "### Design & Visual Creation Employee", 1
    )[1].split("### Development & Programming Employee", 1)[0]
    design_canvas_section = reference.split("### Design Canvas", 1)[1].split(
        "### Data Dashboard", 1
    )[0]
    documented_tools = set(
        re.findall(r"`([a-z][a-z0-9_]*)`", recommended_section + design_canvas_section)
    )

    assert documented_tools <= registered_tools


def test_crew_creator_logo_paths_are_workspace_relative():
    skill = (CREW_CREATOR_DIR / "SKILL.md").read_text(encoding="utf-8")
    guide = (CREW_CREATOR_DIR / "references" / "avatar-generation-guide.md").read_text(
        encoding="utf-8"
    )

    assert "`.magic/IDENTITY.md`" in skill
    assert "`.magic/SOUL.md`" in skill
    assert "`.magic/logo.png`" in skill
    assert "`.workspace/.magic/" not in skill
    assert "do not prepend `.workspace/`" in guide
    assert "`.magic/logo.png`" in guide


def test_crew_creator_avatar_requires_character_headshot_portrait():
    skill = (CREW_CREATOR_DIR / "SKILL.md").read_text(encoding="utf-8")
    guide = (CREW_CREATOR_DIR / "references" / "avatar-generation-guide.md").read_text(
        encoding="utf-8"
    )

    # 必须要求生成人物头像/面部特写肖像，不能是纯工具、徽标或假人
    assert "avatar / face portrait of a person" in guide
    assert "No object-only images" in guide
    assert "No pure logos or emblems" in guide
    assert "No mannequins or dress forms" in guide
    assert "bust shot or symbolic emblem" not in guide
    assert "head and shoulders avatar portrait" in guide
    assert "close-up face/head avatar of a person" in skill


def test_check_crew_verification_script(tmp_path):
    import subprocess
    import sys

    workspace_dir = tmp_path / "employee_workspace"
    workspace_dir.mkdir(parents=True, exist_ok=True)
    magic_dir = workspace_dir / ".magic"
    magic_dir.mkdir(parents=True, exist_ok=True)

    # 1. 构造一个合规的数字员工工作区
    (magic_dir / "IDENTITY.md").write_text(
        "---\nname: 视觉设计师\nrole: 资深视觉设计师\ndescription: 负责品牌视觉与设计\nicon: .magic/logo.png\n---\n\n你是视觉设计师...",
        encoding="utf-8",
    )
    (magic_dir / "AGENTS.md").write_text(
        "## SOP\n1. 第一步：需求沟通\n2. 第二步：方案设计\n",
        encoding="utf-8",
    )
    # 创建一个 10KB 的正方形 logo
    (magic_dir / "logo.png").write_bytes(b"dummy_png_data" * 100)

    check_script = CREW_CREATOR_DIR / "scripts" / "check_crew.py"

    proc = subprocess.run(
        [sys.executable, str(check_script), "--workspace-dir", str(workspace_dir)],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0
    res = json.loads(proc.stdout)
    assert res["ok"] is True
    assert res["details"]["icon"] == ".magic/logo.png"

    # 2. 检查多语言字段不合规的情况
    (magic_dir / "IDENTITY.md").write_text(
        "---\nname: 视觉设计师\nname_cn: 视觉设计师\nrole: 资深视觉设计师\ndescription: 负责品牌视觉与设计\nicon: .magic/logo.png\n---\n",
        encoding="utf-8",
    )
    proc_bad = subprocess.run(
        [sys.executable, str(check_script), "--workspace-dir", str(workspace_dir)],
        capture_output=True,
        text=True,
    )
    assert proc_bad.returncode == 1
    res_bad = json.loads(proc_bad.stdout)
    assert res_bad["ok"] is False
    assert any("forbidden multilingual field" in err for err in res_bad["errors"])


def test_init_crew_instruction_helpers():
    import runpy

    helpers = runpy.run_path(str(CREW_CREATOR_DIR / "scripts" / "init_crew.py"))
    build_instructions = helpers["_build_crew_instructions"]
    validate_instructions = helpers["_validate_crew_instructions"]

    instructions = "1. Gather requirements\n2. Deliver the result"
    assert build_instructions({"instructions": instructions}) == instructions + "\n"
    assert build_instructions({}) is None
    assert validate_instructions(instructions) == []
    assert validate_instructions("   ") == ["content"]
    assert validate_instructions("1. Gather requirements") == ["executable_steps"]


def test_init_crew_preserves_existing_workspace_directories(tmp_path, monkeypatch):
    import subprocess
    import sys

    # 模拟一个既有工作区，包含 logs, .cache, .workspace, .browser 等既有目录
    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir(parents=True, exist_ok=True)
    logs_dir = workspace_dir / "logs"
    logs_dir.mkdir(exist_ok=True)
    (logs_dir / "app.log").write_text("important log", encoding="utf-8")

    cache_dir = workspace_dir / ".cache"
    cache_dir.mkdir(exist_ok=True)
    (cache_dir / "cache.db").write_text("important cache", encoding="utf-8")

    browser_dir = workspace_dir / ".browser"
    browser_dir.mkdir(exist_ok=True)
    (browser_dir / "state.json").write_text("browser state", encoding="utf-8")

    config_file = workspace_dir / "test_config.json"
    config_file.write_text(
        json.dumps({
            "name": "Test Employee",
            "role": "Software Engineer",
            "description": "Writes code",
            "instructions": "1. Step one\n2. Step two",
            "personality": "Helpful",
            "skill_decomposition_decision": "no",
        }, ensure_ascii=False),
        encoding="utf-8",
    )

    init_script = CREW_CREATOR_DIR / "scripts" / "init_crew.py"

    # 在 workspace 目录下运行 init_crew.py
    proc = subprocess.run(
        [sys.executable, str(init_script), "--config", str(config_file)],
        cwd=str(workspace_dir),
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 0
    res = json.loads(proc.stdout)
    assert res["ok"] is True

    # 验证 .magic 目录生成正常
    assert (workspace_dir / ".magic" / "IDENTITY.md").exists()
    assert (workspace_dir / ".magic" / "AGENTS.md").exists()
    assert (workspace_dir / ".magic" / "SOUL.md").exists()

    # 核心验证：既有的 logs, .cache, .browser 目录绝对不能被删除
    assert logs_dir.exists() and (logs_dir / "app.log").exists()
    assert cache_dir.exists() and (cache_dir / "cache.db").exists()
    assert browser_dir.exists() and (browser_dir / "state.json").exists()

