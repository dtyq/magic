import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.tools.create_slide import CreateSlide


class CreateSlideOrderTest(unittest.IsolatedAsyncioTestCase):
    async def update_slides(self, slides, filename, insert_after):
        config = {"slides": slides, "name": "Presentation",
                  "transitions": {"default": {"effect": "none"},
                                  "slides": {"cover.html": {"effect": "fade", "duration_ms": 400, "easing": "linear"}}}}
        tool = SimpleNamespace(
            base_dir=Path("/presentation"),
            _parse_magic_project_config=AsyncMock(return_value=config),
            _calculate_insert_position=lambda *args: CreateSlide._calculate_insert_position(
                None, *args
            ),
        )
        params = SimpleNamespace(file_path=filename, insert_after_slide=insert_after)
        with (
            patch("app.tools.create_slide.async_exists", AsyncMock(return_value=True)),
            patch("app.tools.create_slide.async_write_text", AsyncMock()) as write,
        ):
            await CreateSlide._update_slides_array(tool, params)
        return config, write

    async def test_existing_slide_keeps_order_without_rewriting_project(self):
        for insert_after in ("", "end.html", "missing.html", "body.html", "cover.html"):
            with self.subTest(insert_after=insert_after):
                original = ["cover.html", "body.html", "end.html"]
                config, write = await self.update_slides(original.copy(), "body.html", insert_after)
                self.assertEqual(config["slides"], original)
                write.assert_not_awaited()

    async def test_new_slide_is_inserted_at_requested_position(self):
        for insert_after, expected in (
            ("", ["new.html", "cover.html", "end.html"]),
            ("cover.html", ["cover.html", "new.html", "end.html"]),
            ("missing.html", ["cover.html", "end.html", "new.html"]),
        ):
            with self.subTest(insert_after=insert_after):
                config, write = await self.update_slides(
                    ["cover.html", "end.html"], "new.html", insert_after
                )
                self.assertEqual(config["slides"], expected)
                self.assertEqual(config["transitions"]["default"], {"effect": "none"})
                self.assertNotIn("new.html", config["transitions"]["slides"])
                write.assert_awaited_once()
                self.assertIn(json.dumps(config, indent=2, ensure_ascii=False), write.call_args.args[1])
