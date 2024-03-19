"""MCP 事件管理器单元测试

专门测试 app.mcp.event_manager.py 中的功能，
特别是事件过滤逻辑对预先失败结果的处理。
"""

# 设置项目根目录 - 必须在导入项目模块之前
import sys
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

import pytest
from unittest.mock import MagicMock, patch
from app.mcp.event_manager import MCPServerInitResult
from app.core.context.agent_context import AgentContext
from app.core.entity.event.event import AfterMcpInitEventData, McpServerConfigSummary
from agentlang.event.event import Event, EventType


class TestMCPEventManager:
    """测试 MCP 事件管理器"""

    def setup_method(self):
        """每个测试前的设置"""
        self.extension_names = {"NormalServer"}
        self.agent_context = AgentContext()
        self.agent_context.set_task_id("test_task_id")
        self.agent_context.set_sandbox_id("test_sandbox_id")
        self.agent_context.update_metadata({"test": "metadata"})

    def test_mcp_server_init_result_creation(self):
        """测试 MCPServerInitResult 的创建"""
        # 测试成功的结果
        success_result = MCPServerInitResult(
            name="TestServer",
            status="success",
            duration=1.5,
            tools=["tool1", "tool2"],
            tool_count=2,
            error=None,
            label_name="Test Server"
        )

        assert success_result.name == "TestServer"
        assert success_result.status == "success"
        assert success_result.duration == 1.5
        assert success_result.tools == ["tool1", "tool2"]
        assert success_result.tool_count == 2
        assert success_result.error is None
        assert success_result.label_name == "Test Server"

        # 测试失败的结果
        failed_result = MCPServerInitResult(
            name="FailedServer",
            status="failed",
            duration=2.0,
            tools=[],
            tool_count=0,
            error="Connection timeout",
            label_name="Failed Server"
        )

        assert failed_result.name == "FailedServer"
        assert failed_result.status == "failed"
        assert failed_result.duration == 2.0
        assert failed_result.tools == []
        assert failed_result.tool_count == 0
        assert failed_result.error == "Connection timeout"
        assert failed_result.label_name == "Failed Server"

    def test_mcp_server_init_result_to_dict(self):
        """测试 MCPServerInitResult 的 to_dict 方法"""
        result = MCPServerInitResult(
            name="TestServer",
            status="success",
            duration=1.5,
            tools=["tool1", "tool2"],
            tool_count=2,
            error=None,
            label_name="Test Server"
        )

        result_dict = result.to_dict()
        expected_dict = {
            "name": "TestServer",
            "status": "success",
            "duration": 1.5,
            "tools": ["tool1", "tool2"],
            "tool_count": 2,
            "error": None,
            "label_name": "Test Server"
        }

        assert result_dict == expected_dict

    def test_mcp_server_init_result_pre_failed_characteristics(self):
        """测试预先失败的 MCPServerInitResult 的特征"""
        # 创建预先失败的结果
        pre_failed_result = MCPServerInitResult(
            name="PreFailedServer",
            status="failed",
            duration=0.0,  # 预先失败的特征：duration为0
            tools=[],
            tool_count=0,
            error="Configuration error",
            label_name="Pre-Failed Server"
        )

        # 验证预先失败的特征
        assert pre_failed_result.status == "failed"
        assert pre_failed_result.duration == 0.0
        assert pre_failed_result.error is not None
        assert pre_failed_result.error == "Configuration error"
        assert pre_failed_result.tools == []
        assert pre_failed_result.tool_count == 0

    def test_mcp_server_init_result_serialization(self):
        """测试 MCPServerInitResult 的序列化"""
        import json

        # 创建预先失败的结果
        pre_failed_result = MCPServerInitResult(
            name="PreFailedServer",
            status="failed",
            duration=0.0,
            tools=[],
            tool_count=0,
            error="Configuration error",
            label_name="Pre-Failed Server"
        )

        # 测试转换为字典
        result_dict = pre_failed_result.to_dict()

        # 测试 JSON 序列化
        json_str = json.dumps(result_dict)
        parsed = json.loads(json_str)

        assert parsed["name"] == "PreFailedServer"
        assert parsed["status"] == "failed"
        assert parsed["duration"] == 0.0
        assert parsed["error"] == "Configuration error"
        assert parsed["label_name"] == "Pre-Failed Server"

    def test_event_filtering_logic_simulation(self):
        """测试事件过滤逻辑的模拟（基于实际代码逻辑）"""
        # 模拟 trigger_after_mcp_init_event 中的过滤逻辑
        extension_names = {"ActiveServer"}

        # 创建混合结果列表
        all_results = [
            # 正常成功的结果
            MCPServerInitResult(
                name="ActiveServer",
                status="success",
                duration=1.5,
                tools=["tool1", "tool2"],
                tool_count=2,
                error=None,
                label_name="Active Server"
            ),
            # 正常失败的结果
            MCPServerInitResult(
                name="ActiveServer",
                status="failed",
                duration=2.0,
                tools=[],
                tool_count=0,
                error="Connection timeout",
                label_name="Active Server"
            ),
            # 预先失败的结果
            MCPServerInitResult(
                name="PreFailedServer",
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error="Configuration error",
                label_name="Pre-Failed Server"
            ),
            # 不相关的结果
            MCPServerInitResult(
                name="OtherServer",
                status="success",
                duration=1.0,
                tools=["tool3"],
                tool_count=1,
                error=None,
                label_name="Other Server"
            )
        ]

        # 应用过滤逻辑（基于实际的 trigger_after_mcp_init_event 代码）
        filtered_results = []
        for result in all_results:
            # 包含当前正在处理的扩展的结果
            if result.name in extension_names:
                filtered_results.append(result)
            # 也包含预先失败的结果（duration为0.0且状态为failed，说明是预先失败的）
            elif result.status == 'failed' and result.duration == 0.0 and result.error:
                filtered_results.append(result)

        # 验证过滤结果
        assert len(filtered_results) == 3  # ActiveServer的两个结果 + PreFailedServer

        # 验证包含正确的结果
        result_names = [r.name for r in filtered_results]
        assert "ActiveServer" in result_names
        assert "PreFailedServer" in result_names
        assert "OtherServer" not in result_names

        # 验证预先失败的结果被正确识别
        pre_failed_results = [r for r in filtered_results
                            if r.status == 'failed' and r.duration == 0.0]
        assert len(pre_failed_results) == 1
        assert pre_failed_results[0].name == "PreFailedServer"

    def test_event_filtering_edge_cases(self):
        """测试事件过滤的边缘情况"""
        extension_names = {"ActiveServer"}

        # 测试边缘情况
        edge_case_results = [
            # 预先失败但错误为空字符串的结果（应该被过滤掉）
            MCPServerInitResult(
                name="PreFailedEmptyError",
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error="",  # 空错误
                label_name="Pre-Failed Empty Error"
            ),
            # 预先失败但错误为None的结果（应该被过滤掉）
            MCPServerInitResult(
                name="PreFailedNoneError",
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error=None,  # None错误
                label_name="Pre-Failed None Error"
            ),
            # 有效的预先失败结果（应该被包含）
            MCPServerInitResult(
                name="ValidPreFailed",
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error="Valid configuration error",
                label_name="Valid Pre-Failed"
            )
        ]

        # 应用过滤逻辑
        filtered_results = []
        for result in edge_case_results:
            if result.name in extension_names:
                filtered_results.append(result)
            elif result.status == 'failed' and result.duration == 0.0 and result.error:
                filtered_results.append(result)

        # 验证过滤结果
        assert len(filtered_results) == 1  # 只有有效的预先失败结果
        assert filtered_results[0].name == "ValidPreFailed"

    @pytest.mark.asyncio
    async def test_event_manager_with_pre_failed_results(self):
        """测试事件管理器处理预先失败结果的集成场景"""
        from app.mcp.event_manager import trigger_after_mcp_init_event

        # 创建测试数据
        server_configs = [
            {
                "name": "NormalServer",
                "type": "http",
                "source": "client_config",
                "server_options": {
                    "label_name": "Normal Server"
                }
            }
        ]

        server_results = [
            MCPServerInitResult(
                name="NormalServer",
                status="success",
                duration=1.5,
                tools=["tool1"],
                tool_count=1,
                error=None,
                label_name="Normal Server"
            ),
            # 预先失败的结果
            MCPServerInitResult(
                name="PreFailedServer",
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error="Configuration error",
                label_name="Pre-Failed Server"
            )
        ]

        # 模拟事件管理器的状态
        with patch('app.mcp.event_manager._current_processing_extensions', {"NormalServer"}):
            # 模拟 dispatch_event 方法
            mock_dispatch_event = MagicMock()
            self.agent_context.dispatch_event = mock_dispatch_event

            # 调用事件触发函数
            await trigger_after_mcp_init_event(
                agent_context=self.agent_context,
                success=True,
                initialized_count=1,
                server_configs=server_configs,
                mcp_manager=None,
                server_results=server_results
            )

            # 验证事件被正确触发
            mock_dispatch_event.assert_called_once()

            # 获取事件参数
            call_args = mock_dispatch_event.call_args
            event_data = call_args[0][1]  # 第二个参数是事件数据

            # 验证过滤后的结果包含预先失败的结果
            filtered_server_results = event_data.server_results
            assert len(filtered_server_results) == 2  # NormalServer + PreFailedServer

            result_names = [r.name for r in filtered_server_results]
            assert "NormalServer" in result_names
            assert "PreFailedServer" in result_names
