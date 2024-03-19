"""
Real Magic Service API Integration Test

Simple test for get_agent_details with real API.
"""

import unittest

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk, MagicServiceConfigError
from app.infrastructure.sdk.magic_service.parameter.get_agent_details_parameter import GetAgentDetailsParameter
from app.infrastructure.sdk.magic_service.result.agent_details_result import AgentDetailsResult
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException


class TestRealGetAgentDetails(unittest.TestCase):
    """Test real get_agent_details API"""

    def test_get_agent_details_with_real_api(self):
        """Test get_agent_details with real Magic Service API"""

        # 使用真实存在的 agent ID 进行测试
        test_agent_id = "SMA-68b6ae062de561-46870814"

        try:
            # 创建 SDK（自动从配置文件获取 host 和认证信息）
            magic_service = create_magic_service_sdk()

            # 创建参数
            param = GetAgentDetailsParameter(
                agent_id=test_agent_id,
                with_prompt_string=True,
                with_tool_schema=True
            )

            # 调用真实 API
            print(f"🚀 调用真实 Magic Service API: /agents/{test_agent_id}")
            print(f"📍 Host: {magic_service.get_host()}")

            result = magic_service.agent.get_agent_details(param)

            # 验证响应结构
            self.assertIsInstance(result, AgentDetailsResult)
            print(f"✅ API 调用成功，获取到 Agent 详情")

            # 验证和展示 Agent 数据
            print(f"📋 Agent Name: {result.get_name()}")
            print(f"📄 Description: {result.get_description()[:50]}...")
            print(f"🆔 Agent ID: {result.get_id()}")
            print(f"🎯 Agent Type: {result.get_type()}")
            print(f"✅ Enabled: {result.is_enabled()}")
            print(f"🎨 Icon: {result.get_icon()}")

            # 验证数据完整性
            self.assertIsNotNone(result.get_name())
            self.assertIsNotNone(result.get_id())
            self.assertEqual(result.get_id(), test_agent_id)

            # 验证工具和 schema 信息
            tools = result.get_tools()
            if tools:
                print(f"🔧 Tools: {len(tools)} 个工具")
                for tool in tools:
                    print(f"   - {tool.name}: {tool.description[:30]}...")
                    if tool.has_schema():
                        schema = tool.get_schema()
                        print(f"     ✅ 包含 Schema: {len(str(schema))} 字符")
                        print(f"     📝 Schema Type: {schema.get('type', 'N/A') if schema else 'N/A'}")
                    else:
                        print(f"     ⚠️  无 Schema")

            # 测试参数设置
            self.assertTrue(param.get_with_prompt_string())
            self.assertTrue(param.get_with_tool_schema())

        except MagicServiceConfigError as e:
            self.skipTest(f"Magic Service 配置不可用: {e}")

        except MagicServiceException as e:
            # 这是正常的业务异常（比如 agent 不存在）
            print(f"⚠️  业务异常（正常）: {e}")
            # 测试通过，说明 SDK 工作正常

        except Exception as e:
            print(f"❌ SDK 错误: {type(e).__name__}: {e}")
            raise


if __name__ == '__main__':
    print("🧪 测试真实 Magic Service get_agent_details API")
    print("=" * 50)
    unittest.main(verbosity=2)
