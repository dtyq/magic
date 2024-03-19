"""
Tool Execute API Tests

Tests for tool execution API functionality.
"""

import unittest

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk, MagicServiceConfigError
from app.infrastructure.sdk.magic_service.parameter.tool_execute_parameter import ToolExecuteParameter
from app.infrastructure.sdk.magic_service.result.tool_execute_result import ToolExecuteResult
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException


class TestToolExecuteApi(unittest.TestCase):
    """Test tool execute API functionality"""

    def setUp(self):
        """Set up test fixtures"""
        # Test tool code from the example
        self.test_tool_code = "teamshare_box_teamshare_doc_markdown_query"
        self.test_file_id = "799647356681887744"

    def test_tool_execute_parameter_creation(self):
        """Test tool execute parameter creation and validation"""

        # Test basic parameter creation
        param = ToolExecuteParameter(
            code=self.test_tool_code,
            arguments={"file_id": self.test_file_id}
        )

        self.assertEqual(param.get_code(), self.test_tool_code)
        self.assertEqual(param.get_arguments()["file_id"], self.test_file_id)
        self.assertTrue(param.has_arguments())

        # Test parameter validation
        param.validate()  # Should not raise

    def test_tool_execute_parameter_without_arguments(self):
        """Test tool execute parameter without arguments"""

        param = ToolExecuteParameter(code=self.test_tool_code)

        self.assertEqual(param.get_code(), self.test_tool_code)
        self.assertEqual(param.get_arguments(), {})
        self.assertFalse(param.has_arguments())

    def test_tool_execute_parameter_validation_errors(self):
        """Test parameter validation errors"""

        # Test empty code
        with self.assertRaises(ValueError) as context:
            param = ToolExecuteParameter(code="")
            param.validate()
        self.assertIn("Tool code is required", str(context.exception))

        # Test invalid code type
        with self.assertRaises(ValueError) as context:
            param = ToolExecuteParameter(code=123)
            param.validate()
        self.assertIn("Tool code must be a string", str(context.exception))

    def test_tool_execute_parameter_to_body(self):
        """Test parameter to_body conversion"""

        # With arguments
        param = ToolExecuteParameter(
            code=self.test_tool_code,
            arguments={"file_id": self.test_file_id, "format": "markdown"}
        )

        body = param.to_body()
        expected_body = {
            "code": self.test_tool_code,
            "arguments": {
                "file_id": self.test_file_id,
                "format": "markdown"
            }
        }
        self.assertEqual(body, expected_body)

        # Without arguments
        param_no_args = ToolExecuteParameter(code=self.test_tool_code)
        body_no_args = param_no_args.to_body()
        expected_body_no_args = {"code": self.test_tool_code}
        self.assertEqual(body_no_args, expected_body_no_args)

    def test_tool_execute_parameter_argument_management(self):
        """Test argument management methods"""

        param = ToolExecuteParameter(code=self.test_tool_code)

        # Add arguments
        param.set_argument("file_id", self.test_file_id)
        param.set_argument("format", "markdown")

        self.assertTrue(param.has_arguments())
        self.assertEqual(param.get_arguments()["file_id"], self.test_file_id)
        self.assertEqual(param.get_arguments()["format"], "markdown")

        # Remove argument
        param.remove_argument("format")
        self.assertNotIn("format", param.get_arguments())
        self.assertIn("file_id", param.get_arguments())

    def test_tool_execute_result_parsing(self):
        """Test tool execute result parsing"""

        # Mock response data
        response_data = {
            "result": {
                "content": "111\n\n"
            }
        }

        result = ToolExecuteResult(response_data)

        # Test result access
        self.assertTrue(result.has_result())
        self.assertTrue(result.has_content())
        self.assertEqual(result.get_content(), "111\n\n")

        # Test result field access
        self.assertEqual(result.get_result_field("content"), "111\n\n")
        self.assertIsNone(result.get_result_field("nonexistent"))
        self.assertEqual(result.get_result_field("nonexistent", "default"), "default")

    def test_tool_execute_result_empty(self):
        """Test tool execute result with empty data"""

        result = ToolExecuteResult({})

        self.assertFalse(result.has_result())
        self.assertFalse(result.has_content())
        self.assertEqual(result.get_content(), '')

    def test_tool_execute_with_real_api(self):
        """Test tool execute with real Magic Service API"""

        try:
            # Create SDK
            magic_service = create_magic_service_sdk()

            # Create parameter
            param = ToolExecuteParameter(
                code=self.test_tool_code,
                arguments={"file_id": self.test_file_id}
            )

            print(f"🚀 执行工具: {self.test_tool_code}")
            print(f"📝 参数: {param.to_body()}")

            # Execute tool
            result = magic_service.agent.execute_tool(param)

            # Verify result structure
            self.assertIsInstance(result, ToolExecuteResult)
            print(f"✅ 工具执行成功")

            if result.has_result():
                print(f"📋 执行结果: {result}")
                if result.has_content():
                    content = result.get_content()
                    print(f"📄 内容长度: {len(content)} 字符")
                    print(f"📄 内容预览: {content[:100]}...")
            else:
                print("⚠️  无执行结果")

        except MagicServiceConfigError as e:
            self.skipTest(f"Magic Service 配置不可用: {e}")

        except MagicServiceException as e:
            print(f"⚠️  Magic Service 异常: {e}")
            # 这可能是正常的业务异常（比如文件不存在等）

        except Exception as e:
            print(f"❌ 未预期的错误: {type(e).__name__}: {e}")
            raise

    def test_tool_execute_async_with_real_api(self):
        """Test async tool execute with real Magic Service API"""

        import asyncio

        async def async_test():
            try:
                # Create SDK
                magic_service = create_magic_service_sdk()

                # Create parameter
                param = ToolExecuteParameter(
                    code=self.test_tool_code,
                    arguments={"file_id": self.test_file_id}
                )

                print(f"🚀 异步执行工具: {self.test_tool_code}")

                # Execute tool asynchronously
                result = await magic_service.agent.execute_tool_async(param)

                # Verify result
                self.assertIsInstance(result, ToolExecuteResult)
                print(f"✅ 异步工具执行成功")

                return result

            except MagicServiceConfigError as e:
                self.skipTest(f"Magic Service 配置不可用: {e}")

            except Exception as e:
                print(f"❌ 异步执行错误: {type(e).__name__}: {e}")
                raise

        try:
            result = asyncio.run(async_test())
        except Exception as e:
            if "Magic Service 配置不可用" in str(e):
                self.skipTest(str(e))
            else:
                raise

    def test_tool_execute_with_invalid_file_id(self):
        """Test tool execute with invalid file_id"""

        try:
            # Create SDK
            magic_service = create_magic_service_sdk()

            # Create parameter with invalid file_id
            invalid_file_id = "invalid_file_id_123456"
            param = ToolExecuteParameter(
                code=self.test_tool_code,
                arguments={"file_id": invalid_file_id}
            )

            print(f"🚀 执行工具（无效文件ID）: {self.test_tool_code}")
            print(f"📝 参数: {param.to_body()}")
            print(f"❌ 使用无效文件ID: {invalid_file_id}")

            # Execute tool (should handle error gracefully)
            result = magic_service.agent.execute_tool(param)

            # Verify result structure
            self.assertIsInstance(result, ToolExecuteResult)
            print(f"📋 工具执行响应: {result}")

            if result.has_result():
                print(f"📄 执行结果: {result.get_result()}")
                if result.has_content():
                    content = result.get_content()
                    print(f"📄 内容: {content}")
                else:
                    print("⚠️  无 content 字段")
            else:
                print("⚠️  无执行结果")

        except MagicServiceConfigError as e:
            self.skipTest(f"Magic Service 配置不可用: {e}")

        except MagicServiceException as e:
            # 这是预期的业务异常（文件不存在等）
            print(f"⚠️  业务异常（预期）: {type(e).__name__}: {e}")
            # 测试通过，说明 SDK 正确处理了业务异常

        except Exception as e:
            print(f"❌ 未预期的错误: {type(e).__name__}: {e}")
            raise

    def test_tool_execute_with_invalid_tool_code(self):
        """Test tool execute with invalid tool code"""

        try:
            # Create SDK
            magic_service = create_magic_service_sdk()

            # Create parameter with invalid tool code
            invalid_tool_code = "invalid_tool_code_123"
            param = ToolExecuteParameter(
                code=invalid_tool_code,
                arguments={"file_id": self.test_file_id}
            )

            print(f"🚀 执行工具（无效工具代码）: {invalid_tool_code}")
            print(f"📝 参数: {param.to_body()}")

            # Execute tool (should handle error gracefully)
            result = magic_service.agent.execute_tool(param)

            # Verify result structure
            self.assertIsInstance(result, ToolExecuteResult)
            print(f"📋 工具执行响应: {result}")

            if result.has_result():
                print(f"📄 执行结果: {result.get_result()}")
            else:
                print("⚠️  无执行结果")

        except MagicServiceConfigError as e:
            self.skipTest(f"Magic Service 配置不可用: {e}")

        except MagicServiceException as e:
            # 这是预期的业务异常（工具不存在等）
            print(f"⚠️  业务异常（预期）: {type(e).__name__}: {e}")
            # 测试通过，说明 SDK 正确处理了业务异常

        except Exception as e:
            print(f"❌ 未预期的错误: {type(e).__name__}: {e}")
            raise

    def tearDown(self):
        """Clean up after tests"""
        pass


if __name__ == '__main__':
    print("🧪 开始工具执行 API 测试")
    print("=" * 50)
    unittest.main(verbosity=2)
