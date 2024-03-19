"""
Skill API Unit Tests

Unit tests covering parameter construction, validation, and result parsing
for all four skill-related API endpoints. No real HTTP calls are made here.
"""

import os
import tempfile
import zipfile
import unittest

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk
from app.infrastructure.sdk.magic_service.api.skill_api import SkillApi
from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import QuerySkillsParameter
from app.infrastructure.sdk.magic_service.parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from app.infrastructure.sdk.magic_service.parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter, SKILL_SOURCE_TYPES
from app.infrastructure.sdk.magic_service.result.skill_list_result import SkillListResult, SkillListItem
from app.infrastructure.sdk.magic_service.result.skill_file_urls_result import SkillFileUrlsResult, SkillFileUrlItem
from app.infrastructure.sdk.magic_service.result.import_skill_from_agent_result import ImportSkillFromAgentResult
from app.infrastructure.sdk.magic_service.result.skill_market_list_result import SkillMarketListResult, SkillMarketListItem
from app.infrastructure.sdk.base import SdkBase


# --------------------------
# Parameter tests
# --------------------------

class TestQuerySkillsParameter(unittest.TestCase):
    """Tests for QuerySkillsParameter"""

    def test_default_creation(self):
        """All fields are optional and default to None"""
        param = QuerySkillsParameter()
        self.assertIsNone(param.page)
        self.assertIsNone(param.page_size)
        self.assertIsNone(param.keyword)
        self.assertIsNone(param.source_type)
        self.assertIsNone(param.publisher_type)

    def test_full_creation(self):
        param = QuerySkillsParameter(
            page=2,
            page_size=50,
            keyword="python",
            source_type="AGENT",
            publisher_type="OFFICIAL",
        )
        self.assertEqual(param.page, 2)
        self.assertEqual(param.page_size, 50)
        self.assertEqual(param.keyword, "python")
        self.assertEqual(param.source_type, "AGENT")
        self.assertEqual(param.publisher_type, "OFFICIAL")

    def test_to_body_excludes_none_fields(self):
        """None fields should not appear in the request body"""
        param = QuerySkillsParameter(page=1, keyword="test")
        body = param.to_body()
        self.assertEqual(body["page"], 1)
        self.assertEqual(body["keyword"], "test")
        self.assertNotIn("page_size", body)
        self.assertNotIn("source_type", body)
        self.assertNotIn("publisher_type", body)

    def test_to_body_empty_when_all_none(self):
        param = QuerySkillsParameter()
        self.assertEqual(param.to_body(), {})

    def test_to_query_params_always_empty(self):
        param = QuerySkillsParameter(page=1)
        self.assertEqual(param.to_query_params(), {})

    def test_validation_page_min(self):
        param = QuerySkillsParameter(page=0)
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("page", str(ctx.exception))

    def test_validation_page_size_min(self):
        param = QuerySkillsParameter(page_size=0)
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("page_size", str(ctx.exception))

    def test_validation_page_size_max(self):
        param = QuerySkillsParameter(page_size=1001)
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("page_size", str(ctx.exception))

    def test_validation_invalid_publisher_type(self):
        param = QuerySkillsParameter(publisher_type="INVALID")
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("publisher_type", str(ctx.exception))

    def test_validation_valid_publisher_types(self):
        """All valid publisher types should pass without error"""
        for pt in ("USER", "OFFICIAL", "VERIFIED_CREATOR", "PARTNER"):
            param = QuerySkillsParameter(publisher_type=pt)
            # Should not raise - skip token check by setting a token
            param.token = "dummy_token"
            param.validate()


class TestGetSkillFileUrlsParameter(unittest.TestCase):
    """Tests for GetSkillFileUrlsParameter"""

    def test_creation(self):
        param = GetSkillFileUrlsParameter(skill_ids=["123", "456"])
        self.assertEqual(param.skill_ids, ["123", "456"])

    def test_to_body(self):
        param = GetSkillFileUrlsParameter(skill_ids=["1", "2", "3"])
        body = param.to_body()
        self.assertEqual(body, {"skill_ids": ["1", "2", "3"]})

    def test_to_query_params_always_empty(self):
        param = GetSkillFileUrlsParameter(skill_ids=["1"])
        self.assertEqual(param.to_query_params(), {})

    def test_validation_empty_list(self):
        param = GetSkillFileUrlsParameter(skill_ids=[])
        param.token = "dummy"
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("skill_ids", str(ctx.exception))

    def test_validation_exceeds_max(self):
        param = GetSkillFileUrlsParameter(skill_ids=[str(i) for i in range(101)])
        param.token = "dummy"
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("100", str(ctx.exception))

    def test_validation_passes_for_valid_list(self):
        param = GetSkillFileUrlsParameter(skill_ids=["111", "222"])
        param.token = "dummy"
        param.validate()  # Should not raise


class TestImportSkillFromAgentParameter(unittest.TestCase):
    """Tests for ImportSkillFromAgentParameter"""

    def _make_temp_zip(self) -> str:
        """
        Create a minimal temporary zip file for testing.
        SKILL.md must use YAML-like `name:` / `description:` format,
        and name must match /^[a-z0-9\\-_]+$/.
        """
        tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        with zipfile.ZipFile(tmp.name, "w") as zf:
            zf.writestr("SKILL.md", "name: test-skill\ndescription: A test skill.\n")
        return tmp.name

    def test_creation(self):
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="AGENT_THIRD_PARTY_IMPORT")
            self.assertEqual(param.file_path, tmp)
            self.assertEqual(param.source, "AGENT_THIRD_PARTY_IMPORT")
        finally:
            os.unlink(tmp)

    def test_to_body_always_empty(self):
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="AGENT_THIRD_PARTY_IMPORT")
            self.assertEqual(param.to_body(), {})
        finally:
            os.unlink(tmp)

    def test_to_query_params_always_empty(self):
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="AGENT_THIRD_PARTY_IMPORT")
            self.assertEqual(param.to_query_params(), {})
        finally:
            os.unlink(tmp)

    def test_validation_file_not_found(self):
        param = ImportSkillFromAgentParameter(
            file_path="/nonexistent/path/skill.zip",
            source="AGENT"
        )
        param.token = "dummy"
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("not found", str(ctx.exception).lower())

    def test_validation_empty_file_path(self):
        param = ImportSkillFromAgentParameter(file_path="", source="AGENT")
        param.token = "dummy"
        with self.assertRaises(ValueError) as ctx:
            param.validate()
        self.assertIn("file_path", str(ctx.exception))

    def test_validation_empty_source(self):
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="")
            param.token = "dummy"
            with self.assertRaises(ValueError) as ctx:
                param.validate()
            self.assertIn("source", str(ctx.exception))
        finally:
            os.unlink(tmp)

    def test_validation_invalid_source(self):
        """Unknown source value should raise ValueError"""
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="AGENT")
            param.token = "dummy"
            with self.assertRaises(ValueError) as ctx:
                param.validate()
            self.assertIn("source", str(ctx.exception))
        finally:
            os.unlink(tmp)

    def test_validation_all_valid_sources(self):
        """All values in SKILL_SOURCE_TYPES should pass validation"""
        tmp = self._make_temp_zip()
        try:
            for source in SKILL_SOURCE_TYPES:
                param = ImportSkillFromAgentParameter(file_path=tmp, source=source)
                param.token = "dummy"
                param.validate()  # Should not raise
        finally:
            os.unlink(tmp)

    def test_validation_passes_for_valid_input(self):
        tmp = self._make_temp_zip()
        try:
            param = ImportSkillFromAgentParameter(file_path=tmp, source="AGENT_THIRD_PARTY_IMPORT")
            param.token = "dummy"
            param.validate()  # Should not raise
        finally:
            os.unlink(tmp)


# --------------------------
# Result tests
# --------------------------

class TestSkillListResult(unittest.TestCase):
    """Tests for SkillListResult and SkillListItem"""

    def _mock_data(self):
        return {
            "list": [
                {
                    "id": "100",
                    "code": "skill-abc",
                    "name": "My Skill",
                    "description": "A test skill",
                    "name_i18n": {"zh_CN": "我的技能", "en_US": "My Skill"},
                    "description_i18n": {"zh_CN": "测试技能", "en_US": "A test skill"},
                    "logo": "https://example.com/logo.png",
                    "source_type": "AGENT",
                    "is_enabled": 1,
                    "pinned_at": None,
                    "need_upgrade": False,
                    "updated_at": "2024-01-01 00:00:00",
                    "created_at": "2024-01-01 00:00:00",
                }
            ],
            "page": 1,
            "page_size": 20,
            "total": 1,
        }

    def test_parsing(self):
        result = SkillListResult(self._mock_data())
        self.assertEqual(result.get_total(), 1)
        self.assertEqual(result.get_page(), 1)
        self.assertEqual(result.get_page_size(), 20)
        self.assertEqual(len(result.get_items()), 1)

    def test_item_fields(self):
        result = SkillListResult(self._mock_data())
        item = result.get_items()[0]
        self.assertIsInstance(item, SkillListItem)
        self.assertEqual(item.id, "100")
        self.assertEqual(item.code, "skill-abc")
        self.assertEqual(item.name, "My Skill")
        self.assertEqual(item.source_type, "AGENT")
        self.assertEqual(item.is_enabled, 1)
        self.assertFalse(item.need_upgrade)
        self.assertIsNone(item.pinned_at)

    def test_to_dict(self):
        result = SkillListResult(self._mock_data())
        d = result.to_dict()
        self.assertIn("list", d)
        self.assertIn("page", d)
        self.assertIn("page_size", d)
        self.assertIn("total", d)
        self.assertEqual(len(d["list"]), 1)

    def test_empty_list(self):
        result = SkillListResult({"list": [], "page": 1, "page_size": 20, "total": 0})
        self.assertEqual(result.get_total(), 0)
        self.assertEqual(result.get_items(), [])

    def test_str_representation(self):
        result = SkillListResult(self._mock_data())
        self.assertIn("1", str(result))


class TestSkillFileUrlsResult(unittest.TestCase):
    """Tests for SkillFileUrlsResult and SkillFileUrlItem"""

    def _mock_list(self):
        return [
            {
                "id": "101",
                "file_key": "skills/abc/v1.zip",
                "file_url": "https://example.com/skills/abc/v1.zip?sign=xxx",
                "source_type": "AGENT",
            },
            {
                "id": "102",
                "file_key": "skills/def/v2.zip",
                "file_url": None,
                "source_type": "STORE",
            },
        ]

    def test_parsing_from_list(self):
        result = SkillFileUrlsResult(self._mock_list())
        self.assertEqual(len(result.get_items()), 2)

    def test_item_fields(self):
        result = SkillFileUrlsResult(self._mock_list())
        item = result.get_items()[0]
        self.assertIsInstance(item, SkillFileUrlItem)
        self.assertEqual(item.id, "101")
        self.assertEqual(item.file_key, "skills/abc/v1.zip")
        self.assertIsNotNone(item.file_url)
        self.assertEqual(item.source_type, "AGENT")

    def test_get_item_by_id(self):
        result = SkillFileUrlsResult(self._mock_list())
        item = result.get_item_by_id("102")
        self.assertIsNotNone(item)
        self.assertIsNone(item.file_url)

    def test_get_item_by_id_not_found(self):
        result = SkillFileUrlsResult(self._mock_list())
        self.assertIsNone(result.get_item_by_id("999"))

    def test_empty_dict_input(self):
        """Handles empty dict {} gracefully (returned by _process_magic_service_response default)"""
        result = SkillFileUrlsResult({})
        self.assertEqual(result.get_items(), [])

    def test_empty_list_input(self):
        result = SkillFileUrlsResult([])
        self.assertEqual(result.get_items(), [])

    def test_to_list(self):
        result = SkillFileUrlsResult(self._mock_list())
        lst = result.to_list()
        self.assertEqual(len(lst), 2)
        self.assertIn("file_key", lst[0])

    def test_item_to_dict(self):
        item = SkillFileUrlItem({
            "id": "1", "file_key": "k", "file_url": "u", "source_type": "AGENT"
        })
        d = item.to_dict()
        self.assertEqual(d["id"], "1")
        self.assertEqual(d["file_key"], "k")
        self.assertEqual(d["file_url"], "u")


class TestImportSkillFromAgentResult(unittest.TestCase):
    """Tests for ImportSkillFromAgentResult"""

    def _mock_data_create(self):
        return {
            "id": "200",
            "code": "skill-new",
            "name": {"zh_CN": "新技能", "en_US": "New Skill"},
            "description": {"zh_CN": "描述", "en_US": "Desc"},
            "is_create": True,
        }

    def _mock_data_update(self):
        return {
            "id": "201",
            "code": "skill-existing",
            "name": {},
            "description": {},
            "is_create": False,
        }

    def test_parsing_create(self):
        result = ImportSkillFromAgentResult(self._mock_data_create())
        self.assertEqual(result.get_id(), "200")
        self.assertEqual(result.get_code(), "skill-new")
        self.assertTrue(result.is_newly_created())

    def test_parsing_update(self):
        result = ImportSkillFromAgentResult(self._mock_data_update())
        self.assertFalse(result.is_newly_created())
        self.assertEqual(result.get_id(), "201")

    def test_name_is_i18n_dict(self):
        result = ImportSkillFromAgentResult(self._mock_data_create())
        self.assertIsInstance(result.get_name(), dict)
        self.assertEqual(result.get_name()["en_US"], "New Skill")

    def test_to_dict(self):
        result = ImportSkillFromAgentResult(self._mock_data_create())
        d = result.to_dict()
        self.assertIn("id", d)
        self.assertIn("code", d)
        self.assertIn("is_create", d)

    def test_str_representation(self):
        result = ImportSkillFromAgentResult(self._mock_data_create())
        s = str(result)
        self.assertIn("skill-new", s)
        self.assertIn("created", s)


class TestSkillMarketListResult(unittest.TestCase):
    """Tests for SkillMarketListResult and SkillMarketListItem"""

    def _mock_data(self):
        return {
            "list": [
                {
                    "id": "300",
                    "skill_code": "market-skill-abc",
                    "user_skill_code": "",
                    "name": "Market Skill",
                    "description": "A market skill",
                    "name_i18n": {"zh_CN": "市场技能"},
                    "description_i18n": {},
                    "logo": "",
                    "publisher_type": "OFFICIAL",
                    "publisher": {"name": "OFFICIAL", "avatar": ""},
                    "publish_status": "PUBLISHED",
                    "is_added": False,
                    "need_upgrade": False,
                    "created_at": "2024-01-01 00:00:00",
                    "updated_at": "2024-01-01 00:00:00",
                },
                {
                    "id": "301",
                    "skill_code": "market-skill-def",
                    "user_skill_code": "my-skill-def",
                    "name": "Added Skill",
                    "description": "Already added",
                    "name_i18n": {},
                    "description_i18n": {},
                    "logo": "https://example.com/logo.png",
                    "publisher_type": "USER",
                    "publisher": {"name": "Alice", "avatar": "https://example.com/avatar.png"},
                    "publish_status": "PUBLISHED",
                    "is_added": True,
                    "need_upgrade": True,
                    "created_at": "2024-02-01 00:00:00",
                    "updated_at": "2024-02-01 00:00:00",
                },
            ],
            "page": 1,
            "page_size": 20,
            "total": 2,
        }

    def test_parsing(self):
        result = SkillMarketListResult(self._mock_data())
        self.assertEqual(result.get_total(), 2)
        self.assertEqual(len(result.get_items()), 2)

    def test_item_fields_not_added(self):
        result = SkillMarketListResult(self._mock_data())
        item = result.get_items()[0]
        self.assertIsInstance(item, SkillMarketListItem)
        self.assertEqual(item.id, "300")
        self.assertEqual(item.skill_code, "market-skill-abc")
        self.assertEqual(item.user_skill_code, "")
        self.assertEqual(item.publisher_type, "OFFICIAL")
        self.assertFalse(item.is_added)
        self.assertFalse(item.need_upgrade)

    def test_item_fields_already_added(self):
        result = SkillMarketListResult(self._mock_data())
        item = result.get_items()[1]
        self.assertTrue(item.is_added)
        self.assertTrue(item.need_upgrade)
        self.assertEqual(item.user_skill_code, "my-skill-def")
        self.assertEqual(item.publisher["name"], "Alice")

    def test_to_dict(self):
        result = SkillMarketListResult(self._mock_data())
        d = result.to_dict()
        self.assertIn("list", d)
        self.assertEqual(len(d["list"]), 2)
        self.assertEqual(d["total"], 2)

    def test_str_representation(self):
        result = SkillMarketListResult(self._mock_data())
        self.assertIn("2", str(result))


# --------------------------
# SDK structure tests
# --------------------------

class TestSkillApiStructure(unittest.TestCase):
    """Tests for SkillApi structure and method existence"""

    def setUp(self):
        self.magic_service = create_magic_service_sdk(
            base_url="https://httpbin.org",
            use_agentlang_logger=False,
        )

    def test_skill_api_accessible(self):
        self.assertIsInstance(self.magic_service.skill, SkillApi)

    def test_skill_api_inherits_sdk_base(self):
        self.assertIsInstance(self.magic_service.skill.sdk_base, SdkBase)

    def test_required_methods_exist(self):
        api = self.magic_service.skill
        methods = [
            "query_skills",
            "query_skills_async",
            "get_skill_file_urls",
            "get_skill_file_urls_async",
            "import_skill_from_agent",
            "import_skill_from_agent_async",
            "query_skill_market",
            "query_skill_market_async",
        ]
        for method in methods:
            self.assertTrue(hasattr(api, method), f"Missing method: {method}")
            self.assertTrue(callable(getattr(api, method)), f"Not callable: {method}")

    def test_query_skills_validates_parameter(self):
        """Invalid parameter should raise ValueError before any HTTP call"""
        param = QuerySkillsParameter(page=0)  # invalid
        param.token = "dummy"
        with self.assertRaises(ValueError):
            self.magic_service.skill.query_skills(param)

    def test_get_skill_file_urls_validates_parameter(self):
        param = GetSkillFileUrlsParameter(skill_ids=[])  # empty - invalid
        param.token = "dummy"
        with self.assertRaises(ValueError):
            self.magic_service.skill.get_skill_file_urls(param)

    def test_import_skill_validates_file_not_found(self):
        param = ImportSkillFromAgentParameter(
            file_path="/nonexistent/skill.zip",
            source="AGENT_THIRD_PARTY_IMPORT"
        )
        param.token = "dummy"
        with self.assertRaises(ValueError):
            self.magic_service.skill.import_skill_from_agent(param)

    def tearDown(self):
        self.magic_service.close()


if __name__ == '__main__':
    print("Skill API Unit Tests")
    print("=" * 50)
    unittest.main(verbosity=2)
