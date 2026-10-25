import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

// ======================== Types ========================

/** Raw DESIGN.md source for one bundled html design style. */
export interface HtmlDesignStyleSourceResponse {
	style_code: string
	content: string
	sha256: string
}

export interface GetHtmlDesignStyleSourceParams {
	styleCode: string
}

// ======================== API ========================

export function generateHtmlDesignStylesApi(fetch: HttpClient) {
	return {
		/**
		 * Get the raw DESIGN.md source for a bundled design style.
		 * Endpoint: GET /api/v1/super-magic/html-design-styles/{styleCode}/source
		 */
		getSource({ styleCode }: GetHtmlDesignStyleSourceParams) {
			return fetch.get<HtmlDesignStyleSourceResponse>(
				genRequestUrl("/api/v1/super-magic/html-design-styles/${styleCode}/source", {
					styleCode: encodeURIComponent(styleCode),
				}),
			)
		},
	}
}

export type HtmlDesignStylesApi = ReturnType<typeof generateHtmlDesignStylesApi>
