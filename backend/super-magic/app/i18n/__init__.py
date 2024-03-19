"""统一国际化入口。"""

from .i18n_manager import I18nManager

i18n = I18nManager.instance()

__all__ = ["i18n", "I18nManager"]
