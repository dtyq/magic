import type { ServiceHttpClient, RequestConfig } from "@/infrastructure/network/http/clients"
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
	created_at?: string | null
	updated_at?: string | null
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

export function generateMagicClawApi(fetch: ServiceHttpClient) {
	return {
		/**
		 * Paginated Magic Claw list (sandbox auth).
		 */
		queryMagicClawList(
			params?: { page?: number; page_size?: number; keyword?: string },
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			const page = params?.page ?? 1
			const rawSize = params?.page_size ?? 10
			const page_size = Math.min(Math.max(1, rawSize), MAX_PAGE_SIZE)
			return fetch.post<MagicClawListData>(
				"/api/v1/magic-claw/queries",
				{ page, page_size, keyword: params?.keyword },
				config,
			)
		},

		createMagicClaw(data: CreateMagicClawBody, config?: Omit<RequestConfig, "url" | "body">) {
			return fetch.post<MagicClawItem>("/api/v1/magic-claw", data, config)
		},

		getMagicClawByCode({ code }: { code: string }, config?: Omit<RequestConfig, "url">) {
			return fetch.get<MagicClawItem>(`/api/v1/magic-claw/${code}`, config)
		},

		updateMagicClaw(
			{ code, ...body }: { code: string } & UpdateMagicClawBody,
			config?: Omit<RequestConfig, "url" | "body">,
		) {
			return fetch.put<MagicClawItem>(`/api/v1/magic-claw/${code}`, body, config)
		},

		deleteMagicClaw({ code }: { code: string }, config?: Omit<RequestConfig, "url">) {
			return fetch.delete<[]>(`/api/v1/magic-claw/${code}`, {}, config)
		},

		getMagicClawSandboxStatus(
			{ topic_id }: MagicClawSandboxBody,
			config?: Omit<RequestConfig, "url">,
		) {
			return fetch.get<MagicClawSandboxStatusData>(
				`/api/v1/magic-claw/sandbox/status?topic_id=${topic_id}`,
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
				`/api/v1/magic-claw/sandbox/version-check?topic_id=${topic_id}`,
				config,
			)
		},
	}
}
