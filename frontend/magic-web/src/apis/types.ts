import { SupportLocales } from "@/constants/locale"
import { Bot, GetUserAvailableAgentListResponse } from "@/types/bot"
import { GetAvailableMCPListResponse, UseableToolSet, WithPage } from "@/types/flow"
import { LongMemory } from "@/types/longMemory"

/** 应用菜单 - 图标类型 */
export const AppMenuIconType = {
	Icon: 1,
	Image: 2,
} as const

/** 应用菜单 - 打开方式 */
export const AppMenuOpenMethod = {
	CurrentWindow: 1,
	NewWindow: 2,
} as const

/** 应用菜单 - 可见范围 */
export const AppMenuDisplayScope = {
	TeamOnly: 0,
	PersonalOnly: 1,
	All: 2,
} as const

/** 应用菜单 - 状态 */
export const AppMenuStatus = {
	Normal: 1,
	Disabled: 2,
} as const

/** 前端展示应用菜单条目 */
export interface AppMenuItem {
	id: string
	name_i18n: Record<SupportLocales, string>
	/** 图标标识（icon_type=1 时使用） */
	icon: string
	/** 图标图片 URL（icon_type=2 时使用） */
	icon_url: string
	/** 1-图标 2-图片 */
	icon_type: 1 | 2
	/** 应用路径 */
	path: string
	/** 1-当前窗口 2-新窗口 */
	open_method: 1 | 2
	/** 排序，越大越靠前 */
	sort_order: number
	/** 0-仅团队 1-仅个人 2-所有 */
	display_scope: 0 | 1 | 2
	/** 1-正常 2-禁用 */
	status: 1 | 2
}

export interface GlobalConfig {
	is_maintenance: boolean
	maintenance_description: string
	need_initial: boolean
}

export interface PlatformConfig {
	name_i18n: Record<SupportLocales, string>
	logo: Record<SupportLocales, string>
	minimal_logo: string | null
	favicon: string | null
	default_language: string
	title_i18n: Record<SupportLocales, string>
	keywords_i18n: Record<SupportLocales, string>
	description_i18n: Record<SupportLocales, string>
}

export interface SettingsAll {
	global_config: GlobalConfig
	defaultIcons: Bot.DefaultIcon["icons"]
	platform_settings: PlatformConfig
}

/**
 * 获取用户全局数据 - 响应
 */
export interface GetSettingsGlobalDataResponse {
	available_agents: GetUserAvailableAgentListResponse
	available_mcp_servers: GetAvailableMCPListResponse
	available_tool_sets: WithPage<UseableToolSet.Item[]>
	login_code: { login_code: string }
	memory_list: LongMemory.GetMemoriesListResponse
}

/** 初始化流程 - 管理员账号数据 */
export interface InitializationAdminAccount {
	phone: string
	password: string
}

/** 初始化流程 - Agent 信息数据 */
export interface InitializationAgentInfo {
	name: string
	description?: string
}

/** 初始化流程 - 服务商配置 */
export interface InitializationServiceProviderConfig {
	url?: string
	api_key?: string
	[key: string]: string | undefined
}

/** 初始化流程 - 服务商模型数据 */
export interface InitializationServiceProviderModel {
	provider_code: string
	model_version: string
	service_provider_config: InitializationServiceProviderConfig
}

/** 初始化流程 - 完整提交数据 */
export interface InitializationData {
	admin_account: InitializationAdminAccount
	agent_info: InitializationAgentInfo
	service_provider_model: InitializationServiceProviderModel
	select_official_agents_codes: string[]
}

/** LLM 连接测试请求 */
export interface LLMConnectivityTestRequest {
	service_provider_config?: InitializationServiceProviderConfig
	model_version?: string
	provider_code?: string
}

/** LLM 连接测试响应 */
export interface LLMConnectivityTestResponse {
	status: boolean
	message: string
}
