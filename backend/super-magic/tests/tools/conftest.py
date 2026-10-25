import pytest

from app.tools.slide_template_builder import taxonomy_source as taxonomy_source_mod
from app.tools.slide_template_builder.taxonomy import load_taxonomy
from app.tools.slide_template_builder.taxonomy_source import TaxonomySnapshot

ORIGINAL_RESOLVE_TAXONOMY = taxonomy_source_mod.resolve_taxonomy


@pytest.fixture(autouse=True)
def stub_slide_template_taxonomy(monkeypatch):
    async def _resolve(access_context=None):
        return TaxonomySnapshot(catalog=load_taxonomy(), source="fallback")

    monkeypatch.setattr(taxonomy_source_mod, "resolve_taxonomy", _resolve)
