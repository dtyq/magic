from app.tools.create_slide import _extract_slide_notes, _upsert_slide_notes


def test_upsert_slide_notes_keeps_notes_outside_the_rendered_slide() -> None:
    content = "<html><body><main>Slide</main></body></html>"

    updated = _upsert_slide_notes(content, "Talk about <this> & that")

    assert "<main>Slide</main>" in updated
    assert _extract_slide_notes(updated) == "Talk about <this> & that"


def test_upsert_slide_notes_replaces_only_the_existing_notes_block() -> None:
    content = '<main data-value="keep">Slide</main><template data-magic-slide-notes>Old</template>'

    updated = _upsert_slide_notes(content, "New")

    assert 'data-value="keep"' in updated
    assert _extract_slide_notes(updated) == "New"


def test_upsert_slide_notes_normalizes_duplicate_notes_blocks() -> None:
    content = (
        "<main>Slide</main>"
        "<template data-magic-slide-notes>Old 1</template>"
        "<template data-magic-slide-notes>Old 2</template>"
    )

    updated = _upsert_slide_notes(content, "New")

    assert updated.count("data-magic-slide-notes") == 1
    assert _extract_slide_notes(updated) == "New"
