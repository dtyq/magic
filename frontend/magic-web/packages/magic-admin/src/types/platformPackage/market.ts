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
	category_id?: string | null
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
}

/** 员工市场 - 查询参数 */
export interface GetAgentMarketListParams extends Required<PageParams> {
	publish_status?: string
	organization_code?: string
	name_i18n?: string
	publisher_type?: SkillPublisherType
	agent_code?: string
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
