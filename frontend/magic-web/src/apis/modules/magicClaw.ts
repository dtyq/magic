import type { HttpClient, RequestConfig } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"
import { MAGIC_CLAW_STATUS, type MagicClawStatus } from "./magicClawStatus"

export type MagicClawTemplateCode = "openclaw" | "magishock"

export { MAGIC_CLAW_STATUS }
export type { MagicClawStatus }

export interface MagicClawItem {
	id: string
	code: string
	icon_file_url: string | null
	name: string
	description: string | null
	project_id: string
	template_code: MagicClawTemplateCode
	status: MagicClawStatus
	need_upgrade?: boolean
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
	template_code: MagicClawTemplateCode
}

export interface UpdateMagicClawBody {
	name?: string | null
	description?: string | null
	icon?: string | null
}

export interface MagicClawSandboxBody {
	topic_id: string
}

export interface MagicClawSandboxStatusData {
	sandbox_id?: string
	status?: MagicClawStatus | string
}

export interface MagicClawSandboxVersionCheckData {
	current_version: string
	latest_version: string
	needs_update: boolean
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

		getMagicClawSandboxStatus(
			{ topic_id }: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url">,
		) {
			return fetch.get<MagicClawSandboxStatusData>(
				genRequestUrl("/api/v1/magic-claw/sandbox/status?topic_id=${topicId}", {
					topicId: topic_id,
				}),
				config,
			)
		},

		stopMagicClawSandbox(data: MagicClawSandboxBody, config?: Omit<RequestConfig, "url">) {
			return fetch.delete<Record<string, never>>("/api/v1/magic-claw/sandbox", data, config)
		},

		startMagicClawSandbox(
			data: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			return fetch.put<Record<string, never>>(
				"/api/v1/magic-claw/sandbox/start",
				data,
				config,
			)
		},

		upgradeMagicClawSandbox(
			data: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			return fetch.put<Record<string, never>>(
				"/api/v1/magic-claw/sandbox/upgrade",
				data,
				config,
			)
		},

		restartMagicClawSandbox(
			data: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			return fetch.put<Record<string, never>>(
				"/api/v1/magic-claw/sandbox/restart",
				data,
				config,
			)
		},

		checkMagicClawSandboxVersion(
			{ topic_id }: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url">,
		) {
			return fetch.get<MagicClawSandboxVersionCheckData>(
				genRequestUrl("/api/v1/magic-claw/sandbox/version-check?topic_id=${topicId}", {
					topicId: topic_id,
				}),
				config,
			)
		},
	}
}
