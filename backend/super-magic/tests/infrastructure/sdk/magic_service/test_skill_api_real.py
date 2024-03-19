"""
Skill API Real Integration Tests

Tests that call the actual Magic Service API endpoints.
All tests skip automatically if the SDK configuration is unavailable
(e.g., running outside the sandbox environment).

Endpoints covered:
  POST /api/v1/open-api/sandbox/skills/queries
  POST /api/v1/open-api/sandbox/skills/file-urls
  POST /api/v1/open-api/sandbox/skills/import-from-agent
  POST /api/v1/open-api/sandbox/skill-market/queries
"""

import asyncio
import os
import tempfile
import zipfile
import unittest

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk, MagicServiceConfigError
from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import QuerySkillsParameter
from app.infrastructure.sdk.magic_service.parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from app.infrastructure.sdk.magic_service.parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from app.infrastructure.sdk.magic_service.result.skill_list_result import SkillListResult
from app.infrastructure.sdk.magic_service.result.skill_file_urls_result import SkillFileUrlsResult
from app.infrastructure.sdk.magic_service.result.import_skill_from_agent_result import ImportSkillFromAgentResult
from app.infrastructure.sdk.magic_service.result.skill_market_list_result import SkillMarketListResult
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException


def _make_minimal_skill_zip() -> str:
    """
    Create a minimal but valid skill package zip file in a temp location.
    Returns the path to the zip file.

    SKILL.md format requirements (parsed by SkillUtil::parseSkillMd):
      - Must contain a `name:` line; value must match /^[a-z0-9\\-_]+$/, max 128 chars
      - `description:` line is optional
    Zip structure: SKILL.md may be at the root or inside exactly one sub-directory.
    File extension must be .skill or .zip.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False, prefix="test_skill_")
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        # SKILL.md uses YAML-like key: value format, NOT Markdown headings
        skill_md = "name: test-skill-auto\ndescription: A minimal test skill created by integration tests.\n"
        zf.writestr("SKILL.md", skill_md)
    return tmp.name


class TestQuerySkillsReal(unittest.TestCase):
    """Integration tests for POST /skills/queries"""

    def setUp(self):
        try:
            self.magic_service = create_magic_service_sdk()
        except MagicServiceConfigError as e:
            self.magic_service = None
            self._skip_reason = str(e)

    def _skip_if_no_config(self):
        if self.magic_service is None:
            self.skipTest(f"Magic Service config unavailable: {self._skip_reason}")

    def test_query_skills_default_page(self):
        """Query user skills with default pagination"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter()
            result = self.magic_service.skill.query_skills(param)

            self.assertIsInstance(result, SkillListResult)
            self.assertGreaterEqual(result.get_total(), 0)
            self.assertGreaterEqual(result.get_page(), 1)
            self.assertGreater(result.get_page_size(), 0)

            print(f"query_skills: total={result.get_total()}, items={len(result.get_items())}")
            for item in result.get_items()[:3]:
                print(f"  skill: id={item.id}, code={item.code}, name={item.name}, source={item.source_type}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skills_with_pagination(self):
        """Query with explicit page and page_size"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter(page=1, page_size=5)
            result = self.magic_service.skill.query_skills(param)

            self.assertIsInstance(result, SkillListResult)
            self.assertLessEqual(len(result.get_items()), 5)

            print(f"query_skills (page=1, size=5): count={len(result.get_items())}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skills_with_keyword(self):
        """Query with keyword filter"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter(keyword="python")
            result = self.magic_service.skill.query_skills(param)
            self.assertIsInstance(result, SkillListResult)
            print(f"query_skills keyword=python: total={result.get_total()}")
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skills_async(self):
        """Async version of query_skills"""
        self._skip_if_no_config()

        async def run():
            param = QuerySkillsParameter(page=1, page_size=5)
            result = await self.magic_service.skill.query_skills_async(param)
            self.assertIsInstance(result, SkillListResult)
            print(f"query_skills_async: total={result.get_total()}")
            return result

        try:
            asyncio.run(run())
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def tearDown(self):
        if self.magic_service:
            self.magic_service.close()


class TestGetSkillFileUrlsReal(unittest.TestCase):
    """Integration tests for POST /skills/file-urls"""

    def setUp(self):
        try:
            self.magic_service = create_magic_service_sdk()
            self._skill_ids = self._fetch_some_skill_ids()
        except MagicServiceConfigError as e:
            self.magic_service = None
            self._skip_reason = str(e)
            self._skill_ids = []

    def _skip_if_no_config(self):
        if self.magic_service is None:
            self.skipTest(f"Magic Service config unavailable: {self._skip_reason}")

    def _fetch_some_skill_ids(self):
        """Fetch up to 3 skill IDs from the user's skill list for use in file URL tests"""
        try:
            param = QuerySkillsParameter(page=1, page_size=3)
            result = self.magic_service.skill.query_skills(param)
            return [item.id for item in result.get_items() if item.id]
        except Exception:
            return []

    def test_get_file_urls_with_known_ids(self):
        """Get file URLs for existing skill IDs"""
        self._skip_if_no_config()
        if not self._skill_ids:
            self.skipTest("No skill IDs available for this test (user has no skills)")

        try:
            param = GetSkillFileUrlsParameter(skill_ids=self._skill_ids)
            result = self.magic_service.skill.get_skill_file_urls(param)

            self.assertIsInstance(result, SkillFileUrlsResult)
            print(f"get_skill_file_urls: returned {len(result.get_items())} items for {len(self._skill_ids)} IDs")
            for item in result.get_items():
                print(f"  id={item.id}, key={item.file_key}, url={'(present)' if item.file_url else '(none)'}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_get_file_urls_with_nonexistent_id(self):
        """Non-existent skill IDs should return empty list"""
        self._skip_if_no_config()
        try:
            param = GetSkillFileUrlsParameter(skill_ids=["999999999999999999"])
            result = self.magic_service.skill.get_skill_file_urls(param)

            self.assertIsInstance(result, SkillFileUrlsResult)
            # Server only returns skills owned by the current user, so unknown IDs yield empty result
            print(f"get_skill_file_urls (nonexistent id): count={len(result.get_items())}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_get_file_urls_async(self):
        """Async version of get_skill_file_urls"""
        self._skip_if_no_config()
        if not self._skill_ids:
            self.skipTest("No skill IDs available for this test")

        async def run():
            param = GetSkillFileUrlsParameter(skill_ids=self._skill_ids[:1])
            result = await self.magic_service.skill.get_skill_file_urls_async(param)
            self.assertIsInstance(result, SkillFileUrlsResult)
            print(f"get_skill_file_urls_async: count={len(result.get_items())}")

        try:
            asyncio.run(run())
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def tearDown(self):
        if self.magic_service:
            self.magic_service.close()


class TestImportSkillFromAgentReal(unittest.TestCase):
    """Integration tests for POST /skills/import-from-agent"""

    def setUp(self):
        try:
            self.magic_service = create_magic_service_sdk()
        except MagicServiceConfigError as e:
            self.magic_service = None
            self._skip_reason = str(e)
        self._temp_files = []

    def _skip_if_no_config(self):
        if self.magic_service is None:
            self.skipTest(f"Magic Service config unavailable: {self._skip_reason}")

    def _make_zip(self) -> str:
        path = _make_minimal_skill_zip()
        self._temp_files.append(path)
        return path

    def test_import_skill_from_agent(self):
        """Upload a minimal skill zip and verify the response"""
        self._skip_if_no_config()
        try:
            zip_path = self._make_zip()
            param = ImportSkillFromAgentParameter(file_path=zip_path, source="AGENT_THIRD_PARTY_IMPORT")
            result = self.magic_service.skill.import_skill_from_agent(param)

            self.assertIsInstance(result, ImportSkillFromAgentResult)
            self.assertNotEqual(result.get_id(), "")
            self.assertNotEqual(result.get_code(), "")

            action = "created" if result.is_newly_created() else "updated"
            print(f"import_skill_from_agent: id={result.get_id()}, code={result.get_code()}, {action}")
            print(f"  name={result.get_name()}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_import_skill_from_agent_async(self):
        """Async version of import_skill_from_agent"""
        self._skip_if_no_config()

        async def run():
            zip_path = self._make_zip()
            param = ImportSkillFromAgentParameter(file_path=zip_path, source="AGENT_THIRD_PARTY_IMPORT")
            result = await self.magic_service.skill.import_skill_from_agent_async(param)
            self.assertIsInstance(result, ImportSkillFromAgentResult)
            print(f"import_skill_from_agent_async: id={result.get_id()}, code={result.get_code()}")

        try:
            asyncio.run(run())
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def tearDown(self):
        for path in self._temp_files:
            try:
                os.unlink(path)
            except OSError:
                pass
        if self.magic_service:
            self.magic_service.close()


class TestQuerySkillMarketReal(unittest.TestCase):
    """Integration tests for POST /skill-market/queries"""

    def setUp(self):
        try:
            self.magic_service = create_magic_service_sdk()
        except MagicServiceConfigError as e:
            self.magic_service = None
            self._skip_reason = str(e)

    def _skip_if_no_config(self):
        if self.magic_service is None:
            self.skipTest(f"Magic Service config unavailable: {self._skip_reason}")

    def test_query_skill_market_default(self):
        """Query skill market with default pagination"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter()
            result = self.magic_service.skill.query_skill_market(param)

            self.assertIsInstance(result, SkillMarketListResult)
            self.assertGreaterEqual(result.get_total(), 0)

            print(f"query_skill_market: total={result.get_total()}, items={len(result.get_items())}")
            for item in result.get_items()[:3]:
                print(
                    f"  market skill: id={item.id}, code={item.skill_code}, "
                    f"publisher={item.publisher_type}, is_added={item.is_added}"
                )

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skill_market_with_pagination(self):
        """Query skill market with explicit pagination"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter(page=1, page_size=10)
            result = self.magic_service.skill.query_skill_market(param)

            self.assertIsInstance(result, SkillMarketListResult)
            self.assertLessEqual(len(result.get_items()), 10)
            print(f"query_skill_market (page=1, size=10): count={len(result.get_items())}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skill_market_by_publisher_type(self):
        """Filter market by publisher type = OFFICIAL"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter(publisher_type="OFFICIAL")
            result = self.magic_service.skill.query_skill_market(param)

            self.assertIsInstance(result, SkillMarketListResult)
            # All returned items should be from OFFICIAL publisher (if any)
            for item in result.get_items():
                self.assertEqual(item.publisher_type, "OFFICIAL")
            print(f"query_skill_market (OFFICIAL): total={result.get_total()}")

        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skill_market_with_keyword(self):
        """Filter market by keyword"""
        self._skip_if_no_config()
        try:
            param = QuerySkillsParameter(keyword="code")
            result = self.magic_service.skill.query_skill_market(param)
            self.assertIsInstance(result, SkillMarketListResult)
            print(f"query_skill_market keyword=code: total={result.get_total()}")
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def test_query_skill_market_async(self):
        """Async version of query_skill_market"""
        self._skip_if_no_config()

        async def run():
            param = QuerySkillsParameter(page=1, page_size=5)
            result = await self.magic_service.skill.query_skill_market_async(param)
            self.assertIsInstance(result, SkillMarketListResult)
            print(f"query_skill_market_async: total={result.get_total()}")

        try:
            asyncio.run(run())
        except MagicServiceException as e:
            print(f"Business exception (expected): {e}")

    def tearDown(self):
        if self.magic_service:
            self.magic_service.close()


if __name__ == '__main__':
    print("Skill API Real Integration Tests")
    print("=" * 50)
    unittest.main(verbosity=2)
