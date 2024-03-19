import type { OperationTypes } from "@/opensource/pages/flow/components/AuthControlButton/types"
import type { UserType } from "./user"
import type { GroupConversationType } from "./chat/conversation"

export const enum StructureItemType {
	Department = "department",
	User = "user",
	Group = "group",
	Partner = "partner",
}

export const enum PlatformType {
	DingTalk = "DingTalk",
}

// 部门成员求和类型
export const enum SumType {
	// 计算直属部门成员人数
	CountDirectDepartment = 1,
	// 计算所有子级部门的用户总数
	CountAll = 2,
}

export type WithIdAndDataType<D, T extends StructureItemType> = D & {
	id: string
	dataType: T
}

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
 * 缓存中的部门信息
 *
 */
export interface StructureItemOnCache extends StructureItem {
	/** sum_type 为 2 时的值 */
	employee_sum_deep: number
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
	/** 账户类型 */
	account_type?: number
	/** AI 识别码/工号 */
	ai_code?: string
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
	/**
	 * @deprecated 机器人信息
	 * 请使用 agent_info 代替
	 */
	bot_info?: {
		bot_id: string
		flow_code: string
		user_operation: OperationTypes
	} | null
	/** 机器人信息 */
	agent_info?: {
		bot_id: string
		flow_code: string
		user_operation: OperationTypes
	} | null
	/** 个人说明书url */
	user_manual: string
	/** 拓展字段 */
	option?: object | null
}

export interface GroupInfo {
	id: string
	group_name: string
	group_avatar: string
	group_notice: string
	group_owner: string
	organization_code: string
	group_tag: string
	group_type: GroupConversationType
	group_status: number
}

export type OrganizationData = (StructureItem | StructureUserItem | GroupInfo)[]
