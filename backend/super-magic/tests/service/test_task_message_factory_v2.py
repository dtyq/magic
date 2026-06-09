from app.core.entity.factory.task_message_factory_v2 import TaskMessageFactoryV2


class MockAgentContext:
    def get_metadata(self):
        return {"topic_id": "mock_topic_id"}

    def get_task_id(self):
        return "mock_task_id"

    def get_sandbox_id(self):
        return "mock_sandbox_id"


def test_build_inner_message_includes_sandbox_id():
    message = TaskMessageFactoryV2._build_inner_message(
        MockAgentContext(),
        role="assistant",
        correlation_id="mock_correlation_id",
        content="mock content",
    )

    assert message["sandbox_id"] == "mock_sandbox_id"
    assert message["task_id"] == "mock_task_id"
    assert message["topic_id"] == "mock_topic_id"
