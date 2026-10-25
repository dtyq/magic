"""生成内容策略。"""

from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.generated_media_protocol import generated_media_protocol
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.strategies.content.base_content import BaseContentStrategy
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest


class GeneratedContentStrategy(BaseContentStrategy):
    """处理生成意图并创建待执行的 Content。"""

    source = "generated"

    def plan(self, request: ContentStrategyRequest) -> ContentMutationPlan:
        """创建 pending Content，具体生成仍由应用层能力端口执行。"""
        command = request.command
        content_type = command.content_type
        if generated_media_protocol(content_type) is None:
            raise CanvasDomainError(
                "CONTENT_INPUT_INVALID",
                f"Generated Content is not configured for content_type={content_type}.",
            )
        content = self._build_base_content(request).content
        if not isinstance(content.fields, GeneratedMediaContentFields):
            raise CanvasDomainError("CONTENT_INPUT_INVALID", "Generated Content requires generated media fields.")
        content.fields.mark_pending()
        request_fields = command.generation_parameters.to_dict() if command.generation_parameters else {}
        if content.fields.generated_request_field is None:
            raise CanvasDomainError("CONTENT_INPUT_INVALID", "Generated Content fields do not expose a request field.")
        content.fields.set_generation_request(request_fields)
        return ContentMutationPlan(content)
