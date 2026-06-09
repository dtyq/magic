from app.core.entity.message.client_message import ChatClientMessage
from app.service.agent_dispatcher import AgentDispatcher


def _chat_payload(**overrides):
    payload = {
        "message_id": "mock-message",
        "type": "chat",
        "prompt": "mock prompt",
    }
    payload.update(overrides)
    return payload


def test_chat_client_message_treats_blank_model_id_as_missing():
    assert ChatClientMessage(**_chat_payload()).model_id is None
    assert ChatClientMessage(**_chat_payload(model_id="")).model_id is None
    assert ChatClientMessage(**_chat_payload(model_id="   ")).model_id is None
    assert ChatClientMessage(**_chat_payload(model_id=" mock-model ")).model_id == "mock-model"


def test_last_dispatch_snapshot_drops_model_selection_fields():
    snapshot = {
        "message_id": "mock-message",
        "model_id": "mock-text-model",
        "dynamic_config": {
            "message_version": "v2",
            "image_model": {"model_id": "mock-image-model"},
            "video_model": {"model_id": "mock-video-model"},
        },
    }

    cleaned = AgentDispatcher._remove_model_selection_fields(snapshot)

    assert cleaned == {
        "message_id": "mock-message",
        "dynamic_config": {
            "message_version": "v2",
        },
    }
