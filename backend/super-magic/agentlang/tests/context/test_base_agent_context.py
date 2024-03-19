"""
BaseAgentContext 动态模型ID功能测试

测试动态模型ID的设置、获取、检查和清除功能
"""
import pytest
from agentlang.context.base_agent_context import BaseAgentContext
from agentlang.interface.context import AgentContextInterface


class TestBaseAgentContextDynamicModel:
    """测试BaseAgentContext的动态模型ID管理功能"""

    def setup_method(self):
        """每个测试方法执行前的设置"""
        self.context = BaseAgentContext()
        # 清理之前可能存在的动态模型ID
        self.context.clear_dynamic_model_id()

    def teardown_method(self):
        """每个测试方法执行后的清理"""
        # 清理动态模型ID避免影响其他测试
        self.context.clear_dynamic_model_id()

    def test_initial_dynamic_model_id_state(self):
        """测试初始状态下动态模型ID为None"""
        assert self.context.get_dynamic_model_id() is None
        assert not self.context.has_dynamic_model_id()

    def test_set_and_get_dynamic_model_id(self):
        """测试设置和获取动态模型ID"""
        model_id = "gpt-4-test"

        self.context.set_dynamic_model_id(model_id)

        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

    def test_set_dynamic_model_id_with_spaces(self):
        """测试设置包含空格的动态模型ID"""
        model_id = "  gpt-4-with-spaces  "

        self.context.set_dynamic_model_id(model_id)

        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

    def test_has_dynamic_model_id_with_empty_string(self):
        """测试空字符串时has_dynamic_model_id返回False"""
        # 通过shared_context直接设置为空字符串
        self.context.shared_context.update_field("dynamic_model_id", "")
        assert not self.context.has_dynamic_model_id()

        # 设置为只有空格的字符串
        self.context.shared_context.update_field("dynamic_model_id", "   ")
        assert not self.context.has_dynamic_model_id()

    def test_has_dynamic_model_id_with_none(self):
        """测试None时has_dynamic_model_id返回False"""
        self.context.shared_context.update_field("dynamic_model_id", None)
        assert not self.context.has_dynamic_model_id()

    def test_clear_dynamic_model_id(self):
        """测试清除动态模型ID"""
        # 先设置一个模型ID
        model_id = "test-model-to-clear"
        self.context.set_dynamic_model_id(model_id)

        # 验证设置成功
        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

        # 清除动态模型ID
        self.context.clear_dynamic_model_id()

        # 验证清除成功
        assert self.context.get_dynamic_model_id() is None
        assert not self.context.has_dynamic_model_id()

    def test_multiple_set_operations(self):
        """测试多次设置动态模型ID"""
        model_id_1 = "gpt-4-first"
        model_id_2 = "gpt-4-second"

        # 第一次设置
        self.context.set_dynamic_model_id(model_id_1)
        assert self.context.get_dynamic_model_id() == model_id_1

        # 第二次设置（覆盖第一次）
        self.context.set_dynamic_model_id(model_id_2)
        assert self.context.get_dynamic_model_id() == model_id_2

    def test_dynamic_model_id_persistence_within_instance(self):
        """测试动态模型ID在同一实例中的持久性"""
        model_id = "persistent-test-model"

        # 设置动态模型ID
        self.context.set_dynamic_model_id(model_id)

        # 执行其他操作后验证ID仍然存在
        self.context.set_agent_name("test_agent")
        self.context.set_stream_mode(True)

        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

    def test_dynamic_model_id_shared_between_instances(self):
        """测试使用shared_context后，不同实例间共享动态模型ID状态"""
        context1 = BaseAgentContext()
        context2 = BaseAgentContext()

        # 在第一个实例中设置动态模型ID
        model_id = "shared-test-model"
        context1.set_dynamic_model_id(model_id)

        # 验证第二个实例也能看到这个设置（因为使用shared_context）
        assert context2.get_dynamic_model_id() == model_id
        assert context2.has_dynamic_model_id()

        # 在第二个实例中清除，第一个实例也应该看不到了
        context2.clear_dynamic_model_id()
        assert context1.get_dynamic_model_id() is None
        assert not context1.has_dynamic_model_id()

    def test_dynamic_model_id_with_special_characters(self):
        """测试包含特殊字符的动态模型ID"""
        model_id = "gpt-4-特殊字符-@#$%^&*()"

        self.context.set_dynamic_model_id(model_id)

        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

    def test_dynamic_model_id_with_unicode(self):
        """测试包含Unicode字符的动态模型ID"""
        model_id = "gpt-4-测试-🤖-中文"

        self.context.set_dynamic_model_id(model_id)

        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

    def test_dynamic_model_id_with_very_long_string(self):
        """测试很长的动态模型ID字符串"""
        long_model_id = "very-long-model-id-" + "x" * 1000

        self.context.set_dynamic_model_id(long_model_id)

        assert self.context.get_dynamic_model_id() == long_model_id
        assert len(self.context.get_dynamic_model_id()) == len(long_model_id)

    def test_implements_agent_context_interface(self):
        """测试BaseAgentContext实现了AgentContextInterface接口"""
        assert isinstance(self.context, AgentContextInterface)

        # 验证接口方法存在且可调用
        assert hasattr(self.context, 'set_dynamic_model_id')
        assert callable(self.context.set_dynamic_model_id)

        assert hasattr(self.context, 'get_dynamic_model_id')
        assert callable(self.context.get_dynamic_model_id)

        assert hasattr(self.context, 'has_dynamic_model_id')
        assert callable(self.context.has_dynamic_model_id)

        assert hasattr(self.context, 'clear_dynamic_model_id')
        assert callable(self.context.clear_dynamic_model_id)

    def test_logging_behavior(self):
        """测试动态模型ID操作的日志行为"""
        model_id = "logging-test-model"

        # 这些操作应该产生日志，但我们主要验证不会抛出异常
        self.context.set_dynamic_model_id(model_id)
        self.context.clear_dynamic_model_id()

        # 验证状态正确
        assert self.context.get_dynamic_model_id() is None

    def test_dynamic_model_id_type_safety(self):
        """测试动态模型ID的类型安全性"""
        # 测试正常字符串
        normal_string = "normal-model-id"
        self.context.set_dynamic_model_id(normal_string)
        assert self.context.get_dynamic_model_id() == normal_string

        # 测试空字符串
        empty_string = ""
        self.context.set_dynamic_model_id(empty_string)
        assert self.context.get_dynamic_model_id() == empty_string

    def test_state_consistency_after_operations(self):
        """测试各种操作后状态的一致性"""
        model_id = "consistency-test-model"

        # 初始状态
        assert self.context.get_dynamic_model_id() is None
        assert not self.context.has_dynamic_model_id()

        # 设置后状态
        self.context.set_dynamic_model_id(model_id)
        assert self.context.get_dynamic_model_id() == model_id
        assert self.context.has_dynamic_model_id()

        # 重新设置后状态
        new_model_id = "new-consistency-test-model"
        self.context.set_dynamic_model_id(new_model_id)
        assert self.context.get_dynamic_model_id() == new_model_id
        assert self.context.has_dynamic_model_id()

        # 清除后状态
        self.context.clear_dynamic_model_id()
        assert self.context.get_dynamic_model_id() is None
        assert not self.context.has_dynamic_model_id()


class TestAgentContextInterfaceCompliance:
    """测试AgentContextInterface接口合规性"""

    def test_base_agent_context_implements_all_interface_methods(self):
        """测试BaseAgentContext实现了AgentContextInterface的所有方法"""
        context = BaseAgentContext()

        # 获取接口定义的所有方法
        interface_methods = [
            'set_dynamic_model_id',
            'get_dynamic_model_id',
            'has_dynamic_model_id',
            'clear_dynamic_model_id',
        ]

        # 验证所有接口方法都被实现
        for method_name in interface_methods:
            assert hasattr(context, method_name), f"缺少方法: {method_name}"
            assert callable(getattr(context, method_name)), f"方法不可调用: {method_name}"

    def test_method_signatures_match_interface(self):
        """测试方法签名与接口匹配"""
        import inspect
        context = BaseAgentContext()

        # 测试set_dynamic_model_id的签名
        set_method = getattr(context, 'set_dynamic_model_id')
        set_signature = inspect.signature(set_method)
        set_params = list(set_signature.parameters.keys())
        assert 'model_id' in set_params, "set_dynamic_model_id方法缺少model_id参数"

        # 测试get_dynamic_model_id的签名
        get_method = getattr(context, 'get_dynamic_model_id')
        get_signature = inspect.signature(get_method)
        get_params = list(get_signature.parameters.keys())
        # get方法除了self外不应该有其他参数
        assert len([p for p in get_params if p != 'self']) == 0, "get_dynamic_model_id方法不应该有参数"
