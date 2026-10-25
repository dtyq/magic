import type { TimeRangeValue } from "@magic-admin-v2/components/time-filter-panel"

/** 发布审核列表每页条数 */
export const publishReviewPageSize = 20

/** 筛选项“全部”的内部值，不会提交给接口 */
export const publishReviewSelectAllValue = "all"

/** 平台与企业发布审核可能出现的审核状态 */
export const publishReviewStatus = {
	pending: "PENDING",
	underReview: "UNDER_REVIEW",
	approved: "APPROVED",
	rejected: "REJECTED",
} as const

/** 平台与企业发布审核可能出现的发布状态 */
export const publishReviewPublishStatus = {
	unpublished: "UNPUBLISHED",
	publishing: "PUBLISHING",
	published: "PUBLISHED",
	offline: "OFFLINE",
} as const

/** 平台与企业发布审核可能出现的发布目标 */
export const publishReviewTargetType = {
	private: "PRIVATE",
	member: "MEMBER",
	organization: "ORGANIZATION",
	market: "MARKET",
} as const

/** 发布审核对象类型 */
export type PublishReviewKind = "employee" | "skill"

/** 发布审核场景：平台管理或企业内部管理 */
export type PublishReviewVariant = "platform" | "internal"

/** 列表创建时间排序方向 */
export type PublishReviewOrderBy = "asc" | "desc"

/** 审核操作 */
export type PublishReviewAction = "APPROVED" | "REJECTED"

/** 平台审核通过时指定的发布者类型 */
export type PublishReviewPublisherType = "USER" | "OFFICIAL" | "OFFICIAL_BUILTIN"

/** 员工审核列表支持的组合搜索字段 */
export type EmployeeReviewSearchField = "name_i18n" | "organization_code" | "version"

/** Skill 审核列表支持的组合搜索字段 */
export type SkillReviewSearchField = "package_name" | "skill_name" | "version"

/** 发布审核列表支持的组合搜索字段 */
export type PublishReviewSearchField = EmployeeReviewSearchField | SkillReviewSearchField

/** 多语言名称或描述 */
export type NameI18n = {
	default?: string
	en_US?: string
	zh_CN?: string
}

/** 员工角色的多语言文本，接口可能返回单个字符串或字符串数组 */
export type RoleI18n = {
	en_US?: string | string[]
	zh_CN?: string | string[]
}

/** 审核记录所属组织信息 */
export type PublishReviewOrganization = {
	code?: string
	name?: string
}

/** 审核记录发布者信息 */
export type PublishReviewPublisher = {
	nickname?: string
	user_id?: string
}

/** 发布到成员时的成员或部门范围。 */
export type PublishReviewTargetItem = {
	id?: string
	name?: string
}

export type PublishReviewTargetValue = {
	departments?: PublishReviewTargetItem[]
	users?: PublishReviewTargetItem[]
}

/** 分页列表响应 */
export type WithPage<T> = {
	list: T[]
	total: number
}

/** 发布审核列表通用查询参数 */
export type BaseReviewListParams = {
	page: number
	page_size: number
	review_status?: string
	publish_status?: string
	publish_target_type?: string
	version?: string
	order_by?: PublishReviewOrderBy
	start_time?: string
	end_time?: string
}

/** 员工审核列表 - 查询参数 */
export type AgentReviewListParams = BaseReviewListParams & {
	organization_code?: string
	name_i18n?: string
}

/** Skill 审核列表 - 查询参数 */
export type SkillReviewListParams = BaseReviewListParams & {
	package_name?: string
	skill_name?: string
	source_type?: string
}

/** 发布审核页面筛选表单状态 */
export type PublishReviewFilterDraft = {
	end_time: string
	name_i18n: string
	order_by: PublishReviewOrderBy
	organization_code: string
	package_name: string
	publish_status: string
	publish_target_type: string
	review_status: string
	search_field: PublishReviewSearchField
	search_value: string
	skill_name: string
	source_type: string
	start_time: string
	time_range: TimeRangeValue | null
	version: string
}

/** 员工审核列表 - 列表项 */
export type AgentVersionReviewItem = {
	code: string
	created_at: string
	description_i18n?: NameI18n
	id: string
	is_current_version: boolean
	name_i18n?: NameI18n
	organization?: PublishReviewOrganization
	organization_code: string
	publish_status: string
	publish_target_type: string
	publish_target_value?: PublishReviewTargetValue | null
	published_at?: string | null
	publisher?: PublishReviewPublisher
	review_status: string
	role_i18n?: RoleI18n
	type: number
	version: string
}

/** Skill 审核列表 - 列表项 */
export type SkillVersionReviewItem = {
	code: string
	created_at: string
	description_i18n?: NameI18n
	id: string
	name_i18n?: NameI18n
	organization?: PublishReviewOrganization
	organization_code?: string
	package_name: string
	publish_status: string
	publish_target_type: string
	publish_target_value?: PublishReviewTargetValue | null
	published_at?: string | null
	publisher?: PublishReviewPublisher
	review_status: string
	source_type: string
	version: string
}

/** 员工或 Skill 版本审核参数 */
export type ReviewVersionParams = {
	action: PublishReviewAction
	publisher_type?: PublishReviewPublisherType
	review_remark?: string | null
}
