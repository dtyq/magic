"""Display/i18n helpers for env-manager tools."""

from app.i18n import i18n

from .service import SCOPE_ALL, SCOPE_PERSONAL, SCOPE_WORKSPACE


def translate_action(tool_name: str) -> str:
    return i18n.translate(tool_name, category="tool.actions")


def translate_message(message_key: str, **kwargs) -> str:
    return i18n.translate(f"env_manager.{message_key}", category="tool.messages", **kwargs)


def translate_scope(scope: str) -> str:
    if scope == SCOPE_PERSONAL:
        return translate_message("scope.personal")
    if scope == SCOPE_WORKSPACE:
        return translate_message("scope.workspace")
    if scope == SCOPE_ALL:
        return translate_message("scope.all")
    return scope


def translate_error(info: dict | None) -> str:
    info = info or {}
    error_code = info.get("error_code") or "unknown"
    context = info.get("error_context") or {}
    message = translate_message(f"error.{error_code}", **context)
    if message == f"env_manager.error.{error_code}":
        return translate_message("error.unknown")
    return message


def get_argument_scope(arguments: dict | None, default: str = SCOPE_PERSONAL) -> str:
    return (arguments or {}).get("scope", default)


def get_argument_key(arguments: dict | None) -> str:
    return (arguments or {}).get("key", "")
