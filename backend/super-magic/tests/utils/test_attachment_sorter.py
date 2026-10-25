"""Tests for AttachmentSorter entry-file prioritization."""

from __future__ import annotations

from app.core.entity.attachment import Attachment, AttachmentTag
from app.utils.attachment_sorter import AttachmentSorter


def _attachment(filename: str, timestamp: int) -> Attachment:
    return Attachment(
        file_key=f"key/{filename}",
        file_tag=AttachmentTag.FINAL,
        file_extension=filename.rsplit(".", 1)[-1],
        filepath=f"/workspace/{filename}",
        filename=filename,
        display_filename=filename,
        file_size=1,
        timestamp=timestamp,
    )


def test_timestamp_order_moves_template_json_ahead_of_newer_preview() -> None:
    attachments = [
        _attachment("previews/thumbnail.png", timestamp=300),
        _attachment("template.json", timestamp=100),
        _attachment("theme.css", timestamp=200),
    ]

    ordered = AttachmentSorter._get_timestamp_ordered_attachments(attachments)

    assert ordered[0].filename == "template.json"
    assert [item.filename for item in ordered[1:]] == [
        "previews/thumbnail.png",
        "theme.css",
    ]


def test_index_file_still_outranks_template_json() -> None:
    attachments = [
        _attachment("template.json", timestamp=300),
        _attachment("deck/index.html", timestamp=100),
        _attachment("previews/thumbnail.png", timestamp=200),
    ]

    ordered = AttachmentSorter._get_timestamp_ordered_attachments(attachments)

    assert ordered[0].filename == "deck/index.html"
