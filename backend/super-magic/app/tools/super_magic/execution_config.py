"""Resolve task defaults from the active chat and existing product settings."""

from __future__ import annotations

from dataclasses import dataclass

from .context import ProductConfigurationError, ProductContext


def topic_agent_mode(topic: dict) -> str:
    mode = str(topic.get("topic_mode") or "").strip()
    if mode == "custom_agent":
        code = str(topic.get("agent_code") or "").strip()
        if not code.startswith("SMA-"):
            raise ProductConfigurationError("The topic's custom Agent configuration is unavailable.")
        return code
    return mode


@dataclass(frozen=True)
class TaskConfiguration:
    agent_mode: str
    model_id: str


def _model_id(config: dict) -> str:
    model = config.get("model")
    return str(model.get("model_id") or "").strip() if isinstance(model, dict) else ""


def _available_models(catalog: dict) -> list[str]:
    models = catalog.get("models")
    if not isinstance(models, dict):
        raise ProductConfigurationError("The service returned an invalid model catalog.")
    result = []
    for group in catalog.get("groups", []):
        for identifier in group.get("model_ids", []):
            model = models.get(str(identifier))
            if isinstance(model, dict) and model.get("model_id") and model.get("model_status") == "normal":
                result.append(str(model["model_id"]))
    return list(dict.fromkeys(result))


async def resolve_task_configuration(ctx: ProductContext, topic: dict, project_id: str, topic_id: str) -> TaskConfiguration:
    message = ctx.agent.get_chat_client_message()
    raw_mode = message.agent_mode if message else None
    source_mode = str(raw_mode.value if hasattr(raw_mode, "value") else raw_mode or "").strip()
    if source_mode == "magic":
        source_mode = "general"
    if source_mode == "custom_agent":
        product = ctx.agent.get_super_magic_product_context()
        if product is None:
            raise ProductConfigurationError("The initiating topic's custom Agent is unavailable.")
        source_topic = topic if product.topic.id == topic_id else await ctx.sdk.topic.get_async(ctx.auth, product.topic.id)
        source_mode = topic_agent_mode(source_topic)
        if not source_mode.startswith("SMA-"):
            raise ProductConfigurationError("The initiating topic's custom Agent is unavailable.")

    # 空话题在首次提交时接收配置；已有话题保留自己的员工，不写回话题设置。
    mode = topic_agent_mode(topic) or source_mode
    featured = None
    if not mode:
        project = await ctx.sdk.project.get_async(ctx.auth, project_id)
        mode = str(project.get("project_mode") or "").strip()
        if mode == "custom_agent":
            mode = ""  # 项目没有员工 code，不能把未绑定的 custom_agent 当作可执行配置。
    if not mode:
        featured = await ctx.sdk.task.execution_modes_async(ctx.auth)
        default = str(featured.get("default_agent_code") or "").strip()
        identifiers = {item.get("mode", {}).get("identifier") for item in featured.get("list", [])}
        mode = default if default in identifiers else "general"

    source_model = str(message.model_id or "").strip() if message else ""
    source_model = source_model or ctx.agent.model_context.configured_text_model_id or ""
    # 同模式的发起会话已完成模型选择，可直接继承；不要继承压缩期间的临时模型。
    if mode == source_mode and source_model:
        return TaskConfiguration(mode, source_model)

    # 切换员工时校验模型兼容性，与 Web 一样支持用户自定义文本模型。
    if mode.startswith("SMA-"):
        featured = featured or await ctx.sdk.task.execution_modes_async(ctx.auth)
        entry = next((item for item in featured.get("list", []) if item.get("mode", {}).get("identifier") == mode), None)
        if entry is None:
            raise ProductConfigurationError("The target Agent is not available to the current user.")
        catalog = {"models": featured.get("models"), "groups": entry.get("groups", [])}
    else:
        catalog = await ctx.sdk.task.mode_async(ctx.auth, mode)
    available = _available_models(catalog)
    custom = await ctx.sdk.task.custom_models_async(ctx.auth)
    available.extend(str(item["model_id"]) for item in custom.get("list", [])
                     if item.get("model_type") == 3 and item.get("model_id"))
    if source_model and (source_model == "auto" or source_model in available):
        return TaskConfiguration(mode, source_model)

    # Web 保存的是用户偏好：话题 → 项目 → 模式默认 → 全局默认。
    for key in (topic_id, f"project_id_{project_id}", f"default_{mode}", "default"):
        candidate = _model_id(await ctx.sdk.task.model_config_async(ctx.auth, key))
        if candidate and (candidate == "auto" or candidate in available):
            return TaskConfiguration(mode, candidate)
    return TaskConfiguration(mode, available[0] if available else "auto")
