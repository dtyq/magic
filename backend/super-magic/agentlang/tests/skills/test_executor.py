"""测试 SkillExecutor"""

import pytest
import json
from pathlib import Path
from agentlang.skills.executor import SkillExecutor
from agentlang.skills.exceptions import SkillExecutionError


class TestSkillExecutor:
    """测试 SkillExecutor 类"""

    @pytest.fixture
    def executor(self):
        """创建 SkillExecutor 实例"""
        return SkillExecutor(timeout=10)

    @pytest.fixture
    def scripts_dir(self, tmp_path):
        """创建测试脚本目录"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 创建简单的 Python 脚本
        py_script = scripts_dir / "test.py"
        py_script.write_text("""
import sys
import json

if len(sys.argv) > 1:
    args = json.loads(sys.argv[1])
    result = {"status": "success", "args": args}
else:
    result = {"status": "success", "args": {}}

print(json.dumps(result))
""")

        # 创建返回文本的 Python 脚本
        text_script = scripts_dir / "text.py"
        text_script.write_text("""
print("Hello from script")
""")

        # 创建失败的脚本
        fail_script = scripts_dir / "fail.py"
        fail_script.write_text("""
import sys
sys.exit(1)
""")

        # 创建 Shell 脚本
        sh_script = scripts_dir / "test.sh"
        sh_script.write_text("""#!/bin/bash
echo "Hello from bash"
echo "ARG1: $SKILL_ARG_ARG1"
""")
        sh_script.chmod(0o755)

        return scripts_dir

    def test_execute_python_script(self, executor, scripts_dir):
        """测试执行 Python 脚本"""
        result = executor.execute(scripts_dir, "test.py", arg1="value1", arg2="value2")

        assert result["status"] == "success"
        assert result["args"]["arg1"] == "value1"
        assert result["args"]["arg2"] == "value2"

    def test_execute_python_script_text_output(self, executor, scripts_dir):
        """测试执行返回文本的 Python 脚本"""
        result = executor.execute(scripts_dir, "text.py")

        assert "Hello from script" in result

    def test_execute_nonexistent_script(self, executor, scripts_dir):
        """测试执行不存在的脚本"""
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "nonexistent.py")
        assert "not found" in str(exc_info.value)

    def test_execute_failed_script(self, executor, scripts_dir):
        """测试执行失败的脚本"""
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "fail.py")
        assert "exit code" in str(exc_info.value)

    def test_execute_unsupported_script_type(self, executor, scripts_dir):
        """测试执行不支持的脚本类型"""
        unsupported = scripts_dir / "test.txt"
        unsupported.write_text("not a script")

        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "test.txt")
        assert "Unsupported script type" in str(exc_info.value)

    def test_execute_shell_script(self, executor, scripts_dir):
        """测试执行 Shell 脚本"""
        result = executor.execute(scripts_dir, "test.sh", arg1="test_value")

        assert "Hello from bash" in result
        assert "test_value" in result

    def test_path_validation(self, executor, tmp_path):
        """测试路径验证"""
        # 创建一个在 skills_dir 外的脚本
        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()
        script = outside_dir / "test.py"
        script.write_text("print('test')")

        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()

        # 应该抛出错误，因为脚本在 skills_dir 外
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(outside_dir, "test.py", skills_dir=skills_dir)
        assert "outside skills directory" in str(exc_info.value)

    def test_timeout(self, tmp_path):
        """测试超时机制"""
        # 创建一个会超时的脚本
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        timeout_script = scripts_dir / "timeout.py"
        timeout_script.write_text("""
import time
time.sleep(10)
print("done")
""")

        # 使用很短的超时时间
        executor = SkillExecutor(timeout=1)

        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "timeout.py")
        assert "timeout" in str(exc_info.value).lower()

    def test_path_traversal_with_double_dots(self, executor, tmp_path):
        """测试路径穿越攻击 - 使用 .. """
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 创建一个在父目录的脚本
        parent_script = tmp_path / "secret.py"
        parent_script.write_text("print('secret')")

        # 尝试使用 .. 访问父目录脚本
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "../secret.py")
        assert "Path traversal not allowed" in str(exc_info.value)

    def test_path_traversal_with_absolute_path(self, executor, tmp_path):
        """测试路径穿越攻击 - 使用绝对路径"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 尝试使用绝对路径
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "/etc/passwd")
        assert "Absolute paths are not allowed" in str(exc_info.value)

    def test_path_traversal_with_current_dir(self, executor, tmp_path):
        """测试路径穿越攻击 - 使用当前目录标记"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 尝试使用 .
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "./test.py")
        assert "Current directory marker not allowed" in str(exc_info.value)

    def test_path_traversal_nested_attack(self, executor, tmp_path):
        """测试路径穿越攻击 - 嵌套路径穿越"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 尝试使用嵌套的 ..
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "subdir/../../secret.py")
        assert "Path traversal not allowed" in str(exc_info.value)

    def test_empty_script_name(self, executor, tmp_path):
        """测试空脚本名称"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "")
        assert "cannot be empty" in str(exc_info.value)

    def test_script_name_too_deep(self, executor, tmp_path):
        """测试脚本路径过深（超过1层子目录）"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 创建多层目录结构
        deep_dir = scripts_dir / "a" / "b" / "c"
        deep_dir.mkdir(parents=True)

        deep_script = deep_dir / "test.py"
        deep_script.write_text("print('test')")

        # 尝试访问超过1层的脚本
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "a/b/c/test.py")
        assert "too deep" in str(exc_info.value)

    def test_subdirectory_script_allowed(self, executor, tmp_path):
        """测试允许一层子目录的脚本"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 创建一层子目录
        subdir = scripts_dir / "utils"
        subdir.mkdir()

        script = subdir / "helper.py"
        script.write_text("""
import sys
import json
print(json.dumps({"status": "success"}))
""")

        # 应该可以访问一层子目录的脚本
        result = executor.execute(scripts_dir, "utils/helper.py")
        assert result["status"] == "success"

    def test_symlink_outside_directory(self, executor, tmp_path):
        """测试符号链接指向外部目录的情况"""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        # 创建外部脚本
        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()
        outside_script = outside_dir / "evil.py"
        outside_script.write_text("print('evil')")

        # 创建符号链接
        symlink = scripts_dir / "link.py"
        try:
            symlink.symlink_to(outside_script)
        except OSError:
            pytest.skip("Symlink creation not supported on this system")

        # 应该被 resolve() 检测并阻止
        with pytest.raises(SkillExecutionError) as exc_info:
            executor.execute(scripts_dir, "link.py")
        assert "outside" in str(exc_info.value).lower()

    def test_skills_dir_validation_success(self, executor, tmp_path):
        """测试 skills_dir 验证 - 正常情况"""
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()

        skill_dir = skills_dir / "my-skill"
        skill_dir.mkdir()

        scripts_dir = skill_dir / "scripts"
        scripts_dir.mkdir()

        script = scripts_dir / "test.py"
        script.write_text("""
import sys
import json
print(json.dumps({"status": "success"}))
""")

        # 应该通过验证
        result = executor.execute(scripts_dir, "test.py", skills_dir=skills_dir)
        assert result["status"] == "success"
