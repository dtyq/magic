import type { ServiceHttpClient, RequestConfig } from "@/infrastructure/network/http/clients"

import { AppMenuItem, GlobalConfig, SettingsAll, GetSettingsGlobalDataResponse } from "../types"
import { LongMemory } from "@/types/longMemory"
import { buildImageProcessQuery } from "@/utils/image-processing"

export const generateGlobalApi = (fetch: ServiceHttpClient) => ({
	getGlobalConfig() {
		return fetch.get<GlobalConfig>("/api/v1/settings/global", {
			enableAuthorizationVerification: false,
		})
	},
	updateGlobalConfig(
		data: Pick<GlobalConfig, "is_maintenance" | "maintenance_type" | "maintenance_description">,
	) {
		return fetch.put("/api/v1/settings/global", data)
	},

	/**
	 * 获取全局配置和默认图标，包含：
	 * /api/v1/settings/global
	 * /api/v1/file/default-icons
	 * @returns GlobalConfig & { default_icons: string }
	 */
	getSettingsAll(options?: Pick<RequestConfig, "skipAppInitWait">) {
		return fetch.get<SettingsAll>("/api/v1/settings/all", {
			headers: {
				"X-Magic-Image-Process": buildImageProcessQuery({
					format: "webp",
				}),
			},
			...options,
		})
	},

	/**
	 * 获取前端展示应用菜单（按组织类型返回可见应用）
	 * GET /api/v1/settings/menu-modules
	 */
	getAppMenuModules() {
		return fetch.get<AppMenuItem[]>("/api/v1/settings/menu-modules")
	},

	/**
	 * 获取用户全局数据，包含：
	 * /api/v1/agents/available
	 * /api/v1/mcp/available/queries
	 * /api/v1/memories/queries
	 * /api/v1/flows/queries/tool-sets
	 * /api/v1/auth/environment
	 * @returns
	 */
	getSettingsGlobalData(data: {
		query_type?: (
			| "available_agents"
			| "available_mcp_servers"
			| "available_tool_sets"
			| "login_code"
			| "memory_list"
		)[]
		memory_list_query?: LongMemory.GetMemoriesListParams
		available_tool_sets_query?: {
			with_builtin: boolean
		}
	}) {
		return fetch.post<GetSettingsGlobalDataResponse>("/api/v1/settings/global/data", data)
	},
})
