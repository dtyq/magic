"""验证 JSON 混淆在 Unicode 与旧接收协议之间无损往返。"""

import json
import re
from pathlib import Path

import pytest
from agentlang.utils.shadow_code import ShadowCode

from app.utils.async_file_utils import async_read_text


@pytest.mark.parametrize(
    "text",
    [
        "안녕하세요! 저는 슈퍼 매직, 업무 전반을 도와드립니다.",
        "中文與日本語 English français Русский العربية ไทย हिन्दी",
        "\u1000\u10d0\u1100\u1200\u13a0\u1401\u1681\u16a0\u1700\u1780",
        "\u0fff\u1000\u17ff\u1800\uc7ff\uc800\ucfff\ud000",
        "\U0003ffff\U00040000\U0004ffff\U00050000\U000fffff\U00100000\U0010ffff",
        "e\u0301\U00020000\U0001d11e\ufffd\uefbc",
        '引号"、反斜杠\\、换行\n、字面量\\uc800',
    ],
)
def test_json_values_round_trip(text):
    """键名、嵌套字段及合法替换字符均保留原始含义。"""
    expected = {"키": text, "nested": [{"content": text}], "empty": "", "flag": True}
    data = json.dumps(expected, ensure_ascii=False)

    shadowed = ShadowCode.shadow_json(data)

    assert shadowed.isascii()
    assert json.loads(ShadowCode.unshadow(shadowed)) == expected


def test_json_representation_is_preserved():
    """只转义实际非 ASCII 字符，不重写数字、空白或已有转义。"""
    data = '{ "n": 123456789012345678901234567890, "f": 1.2300e+04, "literal": "\\\\uc800", "escaped": "\\uc800", "raw": "저" }'
    expected = data.replace('"raw": "저"', '"raw": "\\uc800"')

    assert ShadowCode.unshadow(ShadowCode.shadow_json(data)) == expected
    assert json.loads(expected) == json.loads(data)


def test_ascii_json_uses_identical_legacy_wire_format():
    """纯 ASCII JSON 与旧协议逐字节相同。"""
    data = '{"id":"mock-message","content":"\\uc800","quote":"\\"","flag":false}'

    assert ShadowCode.shadow_json(data) == ShadowCode.shadow(data)


def test_legacy_failure_is_not_hidden_by_the_test_data():
    """合成韩字必须能暴露原方法的不可逆损坏。"""
    data = json.dumps({"content": "저"}, ensure_ascii=False)

    assert json.loads(ShadowCode.unshadow(ShadowCode.shadow(data))) != {"content": "저"}
    assert json.loads(ShadowCode.unshadow(ShadowCode.shadow_json(data))) == {"content": "저"}


def test_all_unicode_scalars_round_trip_in_json():
    """分批覆盖所有 Unicode 标量值，排除不可独立编码的代理项。"""
    for start in range(0, 0x110000, 4096):
        text = "".join(
            chr(codepoint)
            for codepoint in range(start, min(start + 4096, 0x110000))
            if not 0xD800 <= codepoint <= 0xDFFF
        )
        data = json.dumps({"value": text}, ensure_ascii=False)

        assert json.loads(ShadowCode.unshadow(ShadowCode.shadow_json(data))) == {"value": text}


@pytest.mark.asyncio
async def test_php_compatibility_vector_matches_python_encoder():
    """PHP 固定向量必须由当前 Python 编码器生成，防止双端样例漂移。"""
    backend_root = Path(__file__).resolve().parents[3]
    test_file = (
        backend_root / "magic-service/test/Cases/Infrastructure/Util/ShadowCode/ShadowCodeJsonCompatibilityTest.php"
    )
    source = await async_read_text(test_file)
    wire = re.search(r"<<<'SHADOW'\n(.*?)\nSHADOW;", source, re.DOTALL).group(1)
    expected_json = re.search(r"<<<'JSON'\n(.*?)\nJSON;", source, re.DOTALL).group(1)
    data = json.dumps(json.loads(expected_json), ensure_ascii=False, separators=(",", ":"))

    assert ShadowCode.shadow_json(data) == wire


@pytest.mark.asyncio
async def test_shared_v2_vectors_are_decoded_without_loss():
    """Python 读取与 PHP、前端共用的 V2 和旧格式向量。"""
    fixture = Path(__file__).resolve().parents[1] / "fixtures/shadow_code_vectors.json"
    vectors = json.loads(await async_read_text(fixture))
    for vector in vectors["valid"]:
        assert ShadowCode.is_shadowed(vector["v2"])
        assert ShadowCode.unshadow(vector["v2"]) == vector["plain"]
        if vector["v1"] is not None:
            assert ShadowCode.unshadow(vector["v1"]) == vector["plain"]
    for payload in vectors["invalid"]:
        assert ShadowCode.is_shadowed(payload)
        with pytest.raises(ValueError):
            ShadowCode.unshadow(payload)
