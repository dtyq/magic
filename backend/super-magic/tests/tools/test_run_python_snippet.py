import ast

from app.tools.run_python_snippet import RunPythonSnippet
from app.tools.run_sdk_snippet import RunSdkSnippet


def test_run_python_snippet_repairs_unescaped_quotes_in_prose_call_argument():
    python_code = (
        'add_body("这是一段包含"关键词甲"的测试正文。")\n'
        'add_heading2("（一）这是一段包含"关键词乙"和"关键词丙"的测试标题）\n'
    )

    repaired = RunPythonSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert "add_body('这是一段包含\"关键词甲\"的测试正文。')" in repaired
    assert "add_heading2('（一）这是一段包含\"关键词乙\"和\"关键词丙\"的测试标题）')" in repaired


def test_run_python_snippet_combines_path_and_prose_repairs():
    python_code = (
        'source_path = "/tmp/包含"关键词甲"的测试材料.docx"\n'
        'add_body("这是一段包含"关键词甲"的测试正文。")\n'
    )

    repaired = RunPythonSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert "source_path = '/tmp/包含\"关键词甲\"的测试材料.docx'" in repaired
    assert "add_body('这是一段包含\"关键词甲\"的测试正文。')" in repaired


def test_run_sdk_snippet_uses_same_python_repair():
    python_code = 'tool.call("write_file", {"path": "/tmp/包含"关键词甲"的测试材料.txt"})\n'

    repaired = RunSdkSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert '/tmp/包含"关键词甲"的测试材料.txt' in repaired
