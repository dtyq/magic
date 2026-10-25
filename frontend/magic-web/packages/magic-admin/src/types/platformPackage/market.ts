import type { PageParams } from "@admin/types/common"
import type { NameI18N } from "./common"

/** Skill 管理 - 查询参数 */
export interface GetSkillVersionListParams extends Required<PageParams> {
	package_name?: string
	review_status?: string
	publish_status?: string
	publish_target_type?: string
	source_type?: string
	version?: string
	order_by?: "asc" | "desc"
	start_time?: string
	end_time?: string
}

/** Skill 管理 - 列表项 */
export interface SkillVersion {
	id: string
	code: string
	organization_code?: string
	organization?: {
		code?: string
		name?: string
	}
	package_name: string
	name_i18n?: NameI18N
	description_i18n?: NameI18N
	version: string
	publish_status: string
	review_status: string
	publish_target_type: string
	source_type: string
	publisher?: {
		user_id?: string
		nickname?: string
	}
	created_at: string
	published_at?: string | null
}

export type ReviewSkillAction = "APPROVED" | "REJECTED"

export type SkillPublisherType = "USER" | "OFFICIAL" | "OFFICIAL_BUILTIN"

export interface ReviewSkillVersionParams {
	action: ReviewSkillAction
	publisher_type?: SkillPublisherType
}

/** Skill 市场 - 查询参数 */
export interface GetSkillMarketListParams extends Required<PageParams> {
	package_name?: string
	publish_status?: string
	organization_code?: string
	name_i18n?: string
	publisher_type?: SkillPublisherType
	skill_code?: string
	category_ids?: string[]
	order_by?: "asc" | "desc"
	start_time?: string
	end_time?: string
}

/** Skill 市场 - 列表项 */
export interface SkillMarketItem {
	id: string
	package_name?: string
	is_featured?: boolean
	is_hidden?: boolean
	organization_code: string
	organization?: {
		code?: string
		name?: string
	}
	skill_code: string
	skill_version_id: string
	name_i18n?: NameI18N
	description_i18n?: NameI18N
	logo?: string | null
	publisher_id?: string
	publisher_type?: SkillPublisherType
	category_ids?: string[]
	publish_status: string
	install_count?: number
	sort_order?: number
	publisher?: {
		user_id?: string
		nickname?: string
	}
	created_at: string
	updated_at: string
}

/** Skill 市场 - 更新信息参数 */
export interface UpdateSkillMarketInfoParams {
	is_featured?: boolean
	is_hidden?: boolean
	sort_order?: number
	category_ids?: string[]
}

/** 官方 Skill 导入第一阶段的解析结果 */
export interface ParseOfficialSkillResponse {
	import_token: string
	package_name: string
	code: string
	package_description: string
	is_update: boolean
	id?: string | null
	publisher_type?: SkillPublisherType
	version?: string
	is_featured?: boolean
	is_hidden?: boolean
	sort_order?: number
	categories?: Array<{
		id: string
		name: string
	}>
	name_i18n?: NameI18N
	description_i18n?: NameI18N
	source_i18n?: NameI18N
	logo?: string
	market_id?: string | number | null
}

/** 官方 Skill 导入第二阶段的公共字段 */
export interface OfficialSkillImportFields {
	version: string
	name_i18n: NameI18N
	description_i18n: NameI18N
	source_i18n?: NameI18N
	logo?: string
	category_ids?: string[]
	publish_status?: "OFFLINE" | "PUBLISHED"
	is_hidden?: boolean
	is_featured?: boolean
	sort_order?: number
}

export interface ImportOfficialSkillParams extends OfficialSkillImportFields {
	import_token: string
}

export interface ImportOfficialSkillResponse {
	code: string
	version: string
	action: "created" | "updated"
	market_id?: string | number | null
	version_id?: string | number | null
}

export const SkillMarketCategoryStatusMap = {
	hidden: 0,
	visible: 1,
} as const
export type SkillMarketCategoryStatus =
	(typeof SkillMarketCategoryStatusMap)[keyof typeof SkillMarketCategoryStatusMap]

/** Skill 市场分类 - 查询参数 */
export interface GetSkillMarketCategoryListParams {
	status?: SkillMarketCategoryStatus | null
	keyword?: string | null
}

/** Skill 市场分类 - 查询响应 */
export interface SkillMarketCategoryListResponse {
	list: SkillMarketCategoryItem[]
}

export interface SkillMarketCategoryOperator {
	user_id: string
	nickname: string
}

/** Skill 市场分类 */
export interface SkillMarketCategoryItem {
	id: string
	organization_code?: string
	name?: string
	name_i18n?: NameI18N
	logo?: string | null
	sort_order?: number
	status?: SkillMarketCategoryStatus
	skill_count?: number
	creator_id?: string | null
	modifier_id?: string | null
	creator?: SkillMarketCategoryOperator
	modifier?: SkillMarketCategoryOperator
	created_at?: string
	updated_at?: string
}

/** Skill 市场分类 - 创建/更新参数 */
export interface SaveSkillMarketCategoryParams {
	name_i18n?: NameI18N
	logo?: string | null
	sort_order?: number
	status?: SkillMarketCategoryStatus
}

/** 员工市场 - 查询参数 */
export interface GetAgentMarketListParams extends Required<PageParams> {
	publish_status?: string
	organization_code?: string
	name_i18n?: string
	publisher_type?: SkillPublisherType
	agent_code?: string
	category_ids?: string[]
	order_by?: "asc" | "desc"
	start_time?: string
	end_time?: string
}

export interface RoleI18N {
	en_US?: string | string[]
	zh_CN?: string | string[]
}

/** 员工市场 - 列表项 */
export interface AgentMarketItem {
	id: string
	is_featured?: boolean
	is_hidden?: boolean
	organization_code: string
	organization?: {
		code?: string
		name?: string
	}
	agent_code: string
	agent_version_id: string
	name_i18n?: NameI18N
	role_i18n?: RoleI18N
	description_i18n?: NameI18N
	icon?: string | null
	icon_type?: number
	publisher_id?: string
	publisher_type?: SkillPublisherType
	category_id?: string | null
	category?: AdminMarketCategory | null
	category_ids?: string[] | null
	categories?: AdminMarketCategory[] | null
	publish_status: string
	install_count?: number
	sort_order?: number
	publisher?: {
		user_id?: string
		nickname?: string
	}
	created_at: string
	updated_at: string
}

/** 员工市场 - 更新信息参数 */
export interface UpdateAgentMarketInfoParams {
	is_featured?: boolean
	is_hidden?: boolean
	sort_order?: number
	category_ids?: string[]
	category_id?: string | null
}

export const AgentMarketCategoryStatusMap = {
	hidden: 0,
	visible: 1,
} as const
export type AgentMarketCategoryStatus =
	(typeof AgentMarketCategoryStatusMap)[keyof typeof AgentMarketCategoryStatusMap]

/** 员工市场分类 - 查询参数 */
export interface GetAgentMarketCategoryListParams {
	status?: AgentMarketCategoryStatus | null
	name_i18n?: string
	keyword?: string
}

export interface AgentMarketCategoryListResponse {
	list: AgentMarketCategoryItem[]
}

export interface AgentMarketCategoryOperator {
	user_id: string
	nickname: string
}

/** 员工市场分类 - 列表项 */
export interface AgentMarketCategoryItem {
	id: string
	organization_code?: string
	name_i18n?: NameI18N
	logo?: string | null
	sort_order?: number
	agent_count?: number
	status?: AgentMarketCategoryStatus
	creator_id?: string | null
	modifier_id?: string | null
	creator?: AgentMarketCategoryOperator
	modifier?: AgentMarketCategoryOperator
	created_at?: string
	updated_at?: string
}

/** 后台市场列表分类信息 */
export interface AdminMarketCategory {
	id: string
	name_i18n?: NameI18N
	logo?: string | null
	status?: AgentMarketCategoryStatus
}

/** 员工市场分类 - 保存参数 */
export interface SaveAgentMarketCategoryParams {
	name_i18n?: NameI18N
	logo?: string | null
	sort_order?: number
	status?: AgentMarketCategoryStatus
}

/** 员工审核列表 - 查询参数 */
export interface GetAgentVersionReviewListParams extends Required<PageParams> {
	review_status?: string
	publish_status?: string
	publish_target_type?: string
	version?: string
	organization_code?: string
	name_i18n?: string
	order_by?: "asc" | "desc"
	start_time?: string
	end_time?: string
}

/** 员工审核列表 - 列表项 */
export interface AgentVersionReview {
	id: string
	organization_code: string
	organization?: {
		code?: string
		name?: string
	}
	code: string
	name_i18n?: NameI18N
	role_i18n?: RoleI18N
	description_i18n?: NameI18N
	version: string
	publish_status: string
	review_status: string
	publish_target_type: string
	type: number
	is_current_version: boolean
	publisher?: {
		user_id?: string
		nickname?: string
	}
	created_at: string
	published_at?: string | null
}
