import type { HttpClient, RequestConfig } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

/** Project snapshot on Magic Claw responses */
export interface MagicClawProjectExtra {
	id: string
	project_name: string
	project_status: string
}

/** Topic snapshot on Magic Claw responses */
export interface MagicClawTopicExtra {
	id: string
	topic_status: string
}

export interface MagicClawExtra {
	project: MagicClawProjectExtra
	topic: MagicClawTopicExtra
}

export interface MagicClawItem {
	id: string
	code: string
	icon_file_url: string | null
	name: string
	description: string | null
	project_id: string
	extra: MagicClawExtra
}

export interface MagicClawListData {
	total: number
	page: number
	page_size: number
	list: MagicClawItem[]
}

export interface CreateMagicClawBody {
	name: string
	description?: string | null
	icon?: string | null
}

export interface UpdateMagicClawBody {
	name?: string | null
	description?: string | null
	icon?: string | null
}

const MAX_PAGE_SIZE = 100

export function generateMagicClawApi(fetch: HttpClient) {
	return {
		/**
		 * Paginated Magic Claw list (sandbox auth).
		 */
		queryMagicClawList(
			params?: { page?: number; page_size?: number },
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			const page = params?.page ?? 1
			const rawSize = params?.page_size ?? 10
			const page_size = Math.min(Math.max(1, rawSize), MAX_PAGE_SIZE)
			return fetch.post<MagicClawListData>(
				"/api/v1/magic-claw/queries",
				{ page, page_size },
				config,
			)
		},

		createMagicClaw(data: CreateMagicClawBody, config?: Omit<RequestConfig, "url" | "body">) {
			return fetch.post<MagicClawItem>("/api/v1/magic-claw", data, config)
		},

		getMagicClawByCode({ code }: { code: string }, config?: Omit<RequestConfig, "url">) {
			return fetch.get<MagicClawItem>(
				genRequestUrl("/api/v1/magic-claw/${code}", { code }),
				config,
			)
		},

		updateMagicClaw(
			{ code, ...body }: { code: string } & UpdateMagicClawBody,
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			return fetch.put<MagicClawItem>(
				genRequestUrl("/api/v1/magic-claw/${code}", { code }),
				body,
				config,
			)
		},

		deleteMagicClaw({ code }: { code: string }, config?: Omit<RequestConfig, "url">) {
			return fetch.delete<[]>(
				genRequestUrl("/api/v1/magic-claw/${code}", { code }),
				{},
				config,
			)
		},
	}
}
