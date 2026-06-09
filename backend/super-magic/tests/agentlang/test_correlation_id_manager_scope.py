from agentlang.event.correlation_id_manager import CorrelationIdManager, EventPairType


def test_tool_call_correlation_is_isolated_by_scope():
    manager = CorrelationIdManager()

    parent_correlation_id = manager.generate_for_before_event(
        EventPairType.TOOL_CALL,
        "mock-parent-context",
    )
    child_correlation_id = manager.generate_for_before_event(
        EventPairType.TOOL_CALL,
        "mock-child-context",
    )

    assert child_correlation_id != parent_correlation_id
    assert manager.consume_for_after_event(EventPairType.TOOL_CALL, "mock-child-context") == child_correlation_id
    assert manager.consume_for_after_event(EventPairType.TOOL_CALL, "mock-parent-context") == parent_correlation_id


def test_correlation_manager_keeps_global_scope_compatibility():
    manager = CorrelationIdManager()

    first_correlation_id = manager.generate_for_before_event(EventPairType.TOOL_CALL)
    retried_correlation_id = manager.generate_for_before_event(EventPairType.TOOL_CALL)

    assert retried_correlation_id == first_correlation_id
    assert manager.consume_for_after_event(EventPairType.TOOL_CALL) == first_correlation_id
