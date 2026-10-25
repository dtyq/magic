from app.tools.media_generator.base import (
    GeneratedImage,
    ImageGenerationRequest,
)
from app.tools.media_generator.handlers import magic_service
from app.tools.media_generator.handlers.magic_service import MagicServiceHandler, _ImageApiPayload


async def test_magic_service_handler_generate_calls_single_api_method(monkeypatch):
    handler = MagicServiceHandler(api_base_url="https://magic.example.com/v2", access_key="ak-test")
    calls = []
    captured = {}

    async def fake_call_api(payload, on_task_created=None):
        calls.append(("call_api", payload))
        captured["on_task_created"] = on_task_created
        return ["https://cdn.example.com/image.png"]

    async def fake_download_images(image_urls):
        calls.append(("download", image_urls))
        return [
            GeneratedImage(
                image_url=image_urls[0],
                temp_file_path="/tmp/image.png",
            )
        ]

    async def on_task_created(task_id, expected_finished_at, started_at):
        """建单回调必须原样透传给轮询方法，由它在建单响应之后触发。"""

    monkeypatch.setattr(handler, "_call_api", fake_call_api)
    monkeypatch.setattr(handler, "_download_images", fake_download_images)

    response = await handler.generate(
        ImageGenerationRequest(
            prompt="生成一张图",
            model="seedream",
            size="1024x1024",
            reference_image_urls=["https://cdn.example.com/ref.png"],
        ),
        on_task_created,
    )

    assert captured["on_task_created"] is on_task_created
    assert calls == [
        (
            "call_api",
            _ImageApiPayload(
                model="seedream",
                prompt="生成一张图",
                images=["https://cdn.example.com/ref.png"],
                n=1,
                size="1024x1024",
            ),
        ),
        ("download", ["https://cdn.example.com/image.png"]),
    ]
    assert response.images[0].image_url == "https://cdn.example.com/image.png"


async def test_magic_service_handler_call_api_submits_task_and_polls(monkeypatch):
    handler = MagicServiceHandler(api_base_url="https://magic.example.com/v2", access_key="ak-test")
    handler._POLL_INTERVAL_SECONDS = 0
    calls = []

    class FakeResponse:
        def __init__(self, status, body):
            self.status = status
            self._body = body
            self.headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def json(self):
            return self._body

        async def text(self):
            return str(self._body)

    class FakeSession:
        def __init__(self):
            self.query_responses = [
                {"id": "IGT-test", "status": "running"},
                {
                    "id": "IGT-test",
                    "status": "succeeded",
                    "response": {
                        "created": 1778743200,
                        "data": [{"url": "https://cdn.example.com/image.png"}],
                    },
                },
            ]

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json, headers, timeout):
            calls.append(("post", url, json, timeout))
            return FakeResponse(
                200,
                {
                    "id": "IGT-test",
                    "status": "running",
                    "expected_finished_at": "2026-05-14T09:21:30+08:00",
                    "started_at": "2026-05-14T09:20:00+08:00",
                },
            )

        def get(self, url, headers, timeout):
            calls.append(("get", url, timeout))
            return FakeResponse(200, self.query_responses.pop(0))

    monkeypatch.setattr(magic_service.aiohttp, "ClientSession", FakeSession)

    created: list[tuple[str, object, object]] = []

    async def on_task_created(task_id, expected_finished_at, started_at):
        created.append((task_id, expected_finished_at, started_at))

    image_urls = await handler._call_api(
        _ImageApiPayload(
            model="seedream",
            prompt="生成一张图",
            images=["https://cdn.example.com/ref.png"],
            n=1,
            size="1024x1024",
        ),
        on_task_created,
    )

    assert image_urls == ["https://cdn.example.com/image.png"]
    # 预期完成时间与起始时间只在建单响应里有，必须在轮询之前就交出去。
    assert created == [
        ("IGT-test", "2026-05-14T09:21:30+08:00", "2026-05-14T09:20:00+08:00")
    ]
    assert calls == [
        (
            "post",
            "https://magic.example.com/v2/images/generation-tasks",
            {
                "model": "seedream",
                "prompt": "生成一张图",
                "images": ["https://cdn.example.com/ref.png"],
                "n": 1,
                "size": "1024x1024",
                "sequential_image_generation": "auto",
            },
            300,
        ),
        ("get", "https://magic.example.com/v2/images/generation-tasks/IGT-test", 300),
        ("get", "https://magic.example.com/v2/images/generation-tasks/IGT-test", 300),
    ]
