import type { NodeType } from "@feb/user-selector"
import type { AiModel } from "../const/aiModel"

export interface TeamshareUserInfo {
	id: string
	real_name: string
	avatar: string
	organization: string
	description: string
	nick_name: string
	phone: string
	is_remind_change_password: boolean
	platform_type: number
	is_organization_admin: boolean
	is_application_admin: boolean
	identifications: string[]
	shown_identification: null
	workbench_menu_config: {
		workbench: boolean
		application: boolean
		approval: boolean
		assignment: boolean
		cloud_storage: boolean
		knowledge_base: boolean
		message: boolean
		favorite: boolean
	}
	timezone: string
	is_perfect_password: boolean
	state_code: string
	departments: {
		name: string
		level: number
		id: string
	}[][]
}

/** 企业信息 */
export interface EnterpriseInfo {
	code: string
	name: string
	logo: {
		key: string
		name: string
		uid: string
		url: string
	}
	industry_type: string
	number: string
	contact_mobile: string
	contact_user: string
	introduction: string
	/** 是否临时组织, 0: 否, 1: 是 */
	is_temporary: 0 | 1
}

/** 分页参数 */
export interface PageParams {
	page?: number
	page_size?: number
}

/** 分页 */
export interface WithPage<T> extends Partial<PageParams> {
	total: number
	list: T[]
}

/** 分页响应 */
export interface WithPageToken<T> {
	page_token: string
	has_more: boolean
	items: T[]
}

/* 分页参数 */
export interface WithPageStatus<T> {
	page_size: number
	current_page: number
	have_more_page: boolean
	has_more_page: boolean
	list: T[]
	total: number
}

export const enum UserType {
	AI = 0,
	Normal = 1,
}

export interface PathNode {
	department_name: string
	department_id: string
	parent_department_id: string
	path: string
	visible: boolean
}

export const enum StructureUserType {
	// 未知(比如是个人版用户)
	Unknown = 0,

	// 正式员工
	Formal = 1,

	// 实习生
	Intern = 2,

	// 外包
	Outsourcing = 3,

	// 劳务派遣
	LaborDispatch = 4,

	// 顾问
	Consultant = 5,
}

/** 搜索用户类型 */
export const enum SearchUserQueryType {
	/* 只搜索用户信息 */
	OnlyUser = 1,
	/* 搜索用户和部门 */
	UserAndDept = 2,
}

/** 搜索用户参数 */
export interface SearchUserParams {
	query: string
	page_token?: string
	query_type?: SearchUserQueryType
}

/** 获取组织架构成员参数 */
export interface GetOrganizationMembersParams {
	department_id: string
	count?: number
	page_token?: string
	is_recursive?: 0 | 1
}

/** 组织架构成员 */
export interface StructureUserItem {
	/** magic 生态下的用户 ID */
	user_id: string
	/** 钉钉 ID */
	magic_id: string
	/** 组织编码 */
	organization_code: string
	/** 用户类型 */
	user_type: UserType
	/** 描述 */
	description: string
	/** 点赞数 */
	like_num: number
	/** 标签 */
	label: string
	/** 状态 */
	status: 1 | 0
	/** 昵称 */
	nickname: string
	/** 头像 */
	avatar_url: string
	/** 国家编码 */
	country_code: string
	/** 电话 */
	phone: string
	/** 邮箱 */
	email: string
	/** 真实姓名 */
	real_name: string
	/** 员工类型 */
	employee_type: StructureUserType
	/** 员工编号 */
	employee_no: string
	/** 职位 */
	job_title: string
	/** 是否是领导 */
	is_leader: boolean
	/** 路径节点 */
	path_nodes: PathNode[]
	/** 机器人信息 */
	bot_info?: {
		bot_id: string
		flow_code: string
		user_operation: AiModel.OperationTypes
	}
	/** 个人说明书url */
	user_manual: string
}

/** 获取组织架构参数 */
export interface GetOrganizationParams {
	department_id?: string
	sum_type?: 1 | 2
	page_token?: string
}

/** 组织架构 */
export interface StructureItem {
	/** 部门 ID */
	department_id: string
	/** 父部门 ID */
	parent_department_id: string
	/** 名称 */
	name: string
	/** 国际化名称 */
	i18n_name: string
	/** 排序 */
	order: string
	/** 领导用户 ID */
	leader_user_id: string
	/** 组织编码 */
	organization_code: string
	/** 状态 */
	status: string
	/** 路径 */
	path: string
	/** 层级 */
	level: number
	/** 创建时间 */
	created_at: string
	/** 文档 ID */
	document_id: string
	/** 员工总数 */
	employee_sum: number
	/** 是否有子部门 */
	has_child: boolean
}

/**
 * @description 获取天书组织架构
 * @param {Object} params - 接口参数
 * @param {string} params.name - 用户或组织名，支持模糊查询
 * @param {string} params.parent_id - 部门ID
 * @param {string} params.values - 用户或组织ID
 * @param {string} params.with_user - 是否包含用户，0或1
 * @param {string} params.with_user_count - 是否获取组织用户人数，0或1，默认为0。注：必须包含用户with_user=1时参数生效
 * @param {string} params.with_all_user - 是否获取组织用户人数，0或1，默认为0。注：必须包含用户with_user=1时参数生效
 * @param {string} params.with_department - 是否为组织查询，0-否 1-是，默认为0
 */
export interface GetTeamshareOrganizationParams {
	name?: string
	parent_id?: string
	values?: string
	with_user?: 0 | 1
	with_user_count?: 0 | 1
	with_all_user?: 0 | 1
	with_department?: 0 | 1
}

export interface Department {
	id: string
	name: string
	platform_type: string
	type: NodeType
	children: GetTeamshareOrganization[]
	have_children: boolean
	have_children_dept: boolean
	have_children_user: boolean
	user_count: number
}

export interface User {
	id: string
	type: NodeType
	name: string
	avatar: string
	real_name: string
	have_children: boolean
	department_ids: string[]
}

export type GetTeamshareOrganization = (Department & User)[]
