"""
HTML Design Style API

API implementation for bundled design style source documents in Magic Service.
Endpoint: /api/v1/open-api/sandbox/html-design-styles/*
Requires SandboxUserAuthMiddleware.
"""

from urllib.parse import quote

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.get_html_design_style_source_parameter import GetHtmlDesignStyleSourceParameter
from ..result.html_design_style_source_result import HtmlDesignStyleSourceResult

_BASE_PATH = "/api/v1/open-api/sandbox/html-design-styles"


class HtmlDesignStyleApi(MagicServiceAbstractApi):
    """HTML design style source API for Magic Service."""

    def get_source(self, parameter: GetHtmlDesignStyleSourceParameter) -> HtmlDesignStyleSourceResult:
        """
        Fetch the raw DESIGN.md source for one bundled html design style.

        Args:
            parameter: GetHtmlDesignStyleSourceParameter with style_code

        Returns:
            HtmlDesignStyleSourceResult containing style_code, content and sha256
        """
        data = self.request_by_parameter(parameter, "GET", self._source_path(parameter))
        return HtmlDesignStyleSourceResult(data)

    async def get_source_async(
        self, parameter: GetHtmlDesignStyleSourceParameter
    ) -> HtmlDesignStyleSourceResult:
        """
        Fetch the raw DESIGN.md source for one bundled html design style (async).

        Args:
            parameter: GetHtmlDesignStyleSourceParameter with style_code

        Returns:
            HtmlDesignStyleSourceResult containing style_code, content and sha256
        """
        data = await self.request_by_parameter_async(parameter, "GET", self._source_path(parameter))
        return HtmlDesignStyleSourceResult(data)

    @staticmethod
    def _source_path(parameter: GetHtmlDesignStyleSourceParameter) -> str:
        return f"{_BASE_PATH}/{quote(parameter.get_style_code(), safe='')}/source"
