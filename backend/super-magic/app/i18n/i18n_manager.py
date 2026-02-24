"""统一 i18n 核心：单类管理目录扫描、语言上下文、翻译与回退。"""

import json
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Dict, Optional

from agentlang.logger import get_logger
from app.path_manager import PathManager

logger = get_logger(__name__)


class I18nManager:
    """
    单一 i18n 服务。

    - 类级管理 language 上下文与单例实例
    - 实例级在启动时预加载全部翻译，translate() 为纯内存操作，无阻塞
    """

    _DEFAULT_LANGUAGE = "zh_CN"
    _CURRENT_LANGUAGE: ContextVar[Optional[str]] = ContextVar("current_language", default=None)
    _instance: "I18nManager | None" = None

    def __init__(self) -> None:
        # 启动时一次性加载全部翻译到内存，后续 translate() 无任何 I/O
        self._catalog: Dict[str, Dict[str, Dict[str, str]]] = {}
        self._load_all_catalogs()

    @classmethod
    def instance(cls) -> "I18nManager":
        """获取全局唯一 i18n 实例。模块导入时同步创建，无需锁。"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def normalize_language(cls, language: Optional[str]) -> str:
        """将外部 language 归一化为项目内部格式。"""
        if not language:
            return cls._DEFAULT_LANGUAGE
        normalized = language.replace("-", "_")
        # Case-insensitive lookup: match regardless of how the client capitalizes the code.
        aliases = {
            "zh": "zh_CN",
            "zh_cn": "zh_CN",
            "en": "en_US",
            "en_us": "en_US",
        }
        return aliases.get(normalized.lower(), normalized)

    @classmethod
    def set_language(cls, language: str) -> None:
        """设置当前上下文语言。"""
        cls._CURRENT_LANGUAGE.set(cls.normalize_language(language))

    @classmethod
    def get_language(cls) -> str:
        """获取当前上下文语言。"""
        current = cls._CURRENT_LANGUAGE.get()
        return current if current is not None else cls._DEFAULT_LANGUAGE

    @classmethod
    def is_language_manually_set(cls) -> bool:
        """当前上下文是否显式设置过 language。"""
        return cls._CURRENT_LANGUAGE.get() is not None

    @classmethod
    def reset_language(cls) -> None:
        """清理当前上下文语言。"""
        cls._CURRENT_LANGUAGE.set(None)

    @classmethod
    def get_language_display_name(cls, language: Optional[str] = None) -> str:
        """获取可读语言名（用于日志与提示）。"""
        language_code = cls.normalize_language(language) if language is not None else cls.get_language()
        display_name_by_language = {
            "zh_CN": "中文（简体）",
            "en_US": "English (US)",
            "ja": "日本語",
            "ko": "한국어",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español",
            "pt": "Português",
            "ru": "Русский",
        }
        return display_name_by_language.get(language_code, language_code)

    def _load_all_catalogs(self) -> None:
        translations_dir = PathManager.get_translations_dir()
        if not translations_dir.exists():
            logger.warning(f"翻译目录不存在: {translations_dir}")
            return
        for json_file in translations_dir.rglob("*.json"):
            relative = json_file.relative_to(translations_dir)
            category = str(relative.with_suffix("")).replace("/", ".")
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    self._catalog[category] = data
            except Exception as e:
                logger.error(f"加载翻译分类失败: {category}, error={e}")

    @staticmethod
    def _format_text(text: str, **kwargs: Any) -> str:
        # 同时兼容 {name} 与 {{name}}，避免历史文案残留导致裸占位符。
        for key, value in kwargs.items():
            text = text.replace(f"{{{{{key}}}}}", str(value))
            text = text.replace(f"{{{key}}}", str(value))
        return text

    def translate(self, code: str, category: str = "common.messages", **kwargs: Any) -> str:
        catalog = self._catalog.get(category, {})
        text_by_language = catalog.get(code)
        if not isinstance(text_by_language, dict):
            return code
        language = self.get_language()
        text = text_by_language.get(language) or text_by_language.get(self._DEFAULT_LANGUAGE) or code
        if not isinstance(text, str):
            return code
        return self._format_text(text, **kwargs)
