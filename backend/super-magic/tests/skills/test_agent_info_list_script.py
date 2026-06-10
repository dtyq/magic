import json
import runpy
import sys
import types
from pathlib import Path

import pytest


def install_module(monkeypatch, name, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    if "." not in name:
        module.__path__ = []
    monkeypatch.setitem(sys.modules, name, module)
    return module


def install_package_tree(monkeypatch, dotted_name):
    parts = dotted_name.split(".")
    for index in range(1, len(parts) + 1):
        name = ".".join(parts[:index])
        if name in sys.modules:
            continue
        module = types.ModuleType(name)
        if index < len(parts):
            module.__path__ = []
        monkeypatch.setitem(sys.modules, name, module)


def test_agent_info_list_hides_raw_sdk_errors(monkeypatch, capsys):
    install_package_tree(monkeypatch, "_shared")
    install_module(monkeypatch, "_shared.bootstrap")

    install_package_tree(monkeypatch, "app.infrastructure.sdk.magic_service.factory")
    install_package_tree(
        monkeypatch,
        "app.infrastructure.sdk.magic_service.parameter.list_agents_parameter",
    )

    sensitive_error = "GET http://internal.service.local/agents?token=secret failed"

    def create_magic_service_sdk_with_defaults():
        raise RuntimeError(sensitive_error)

    class ListAgentsParameter:
        pass

    monkeypatch.setitem(
        sys.modules,
        "app.infrastructure.sdk.magic_service.factory",
        types.ModuleType("app.infrastructure.sdk.magic_service.factory"),
    )
    sys.modules[
        "app.infrastructure.sdk.magic_service.factory"
    ].create_magic_service_sdk_with_defaults = create_magic_service_sdk_with_defaults

    monkeypatch.setitem(
        sys.modules,
        "app.infrastructure.sdk.magic_service.parameter.list_agents_parameter",
        types.ModuleType("app.infrastructure.sdk.magic_service.parameter.list_agents_parameter"),
    )
    sys.modules[
        "app.infrastructure.sdk.magic_service.parameter.list_agents_parameter"
    ].ListAgentsParameter = ListAgentsParameter

    monkeypatch.setattr(sys, "argv", ["list.py"])
    script = (
        Path(__file__).resolve().parents[2]
        / "agents"
        / "skills"
        / "agent-info"
        / "scripts"
        / "list.py"
    )

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(script), run_name="__main__")

    assert exc_info.value.code == 1
    output = json.loads(capsys.readouterr().out)
    assert output == {"error": "failed to list agents"}
    assert sensitive_error not in json.dumps(output)
