from .magicbase_base_parameter import MagicBaseBaseParameter


class ResolveMicroAppParameter(MagicBaseBaseParameter):
    """Authentication carrier for app_id to project resolution."""

    def __init__(self, authorization: str | None = None, organization_code: str | None = None):
        super().__init__(project_id="1", authorization=authorization, organization_code=organization_code)
