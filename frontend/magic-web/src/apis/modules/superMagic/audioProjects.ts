import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"
import type { QueryAudioProjectsParams, QueryAudioProjectsResponse } from "@/types/audioProject"

/** Builds REST helpers for PC audio recording project list queries */
export const generateAudioProjectsApi = (fetch: HttpClient) => ({
	/**
	 * Query audio/summary projects for the recordings list page.
	 * Endpoint: POST /api/v1/super-agent/audio-projects/queries
	 */
	queryAudioProjects(params: QueryAudioProjectsParams) {
		return fetch.post<QueryAudioProjectsResponse>(
			genRequestUrl("/api/v1/super-agent/audio-projects/queries"),
			params,
			// TODO: remove this config after backend handle it
			{ parseJsonLargeIntAsString: true },
		)
	},
})
