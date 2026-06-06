from agentlang.llms.retry_policy import is_non_retryable_model_config_error


def test_missing_model_config_error_is_not_retryable():
    assert is_non_retryable_model_config_error(
        ValueError("找不到模型 ID 为 mock-missing-model 的配置")
    )


def test_model_config_error_is_found_in_exception_chain():
    try:
        raise ValueError("无法为模型 mock-model 创建配置")
    except ValueError as error:
        wrapped = RuntimeError("wrapped")
        wrapped.__cause__ = error

    assert is_non_retryable_model_config_error(wrapped)


def test_transient_runtime_error_is_retryable():
    assert not is_non_retryable_model_config_error(RuntimeError("temporary provider timeout"))
