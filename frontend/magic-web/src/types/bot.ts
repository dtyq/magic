/** 机器人相关类型 */
import type { OperationTypes } from "@/opensource/pages/flow/components/AuthControlButton/types"
import type {
	InsertLocationMap,
	StatusIconKey,
} from "@/opensource/pages/flow/components/QuickInstructionButton/const"
import type { MagicFlow } from "@dtyq/magic-flow/MagicFlow/types/flow"

export interface WithPage<ListType> {
	page: number
	page_size: number
	total: number
	list: ListType
}

export namespace Bot {
	// 用户信息
	export interface User {
		magic_id: string
		id: string
		label: string
		like_num: number
		avatar_url: string
		description: string
		nickname: string
		organization_code: string
		status: number
		user_id: string
		user_type: number
	}

	/** 基础机器人列表 */
	export interface BotItem {
		id: string
		flow_id: string
		bot_version_id: string
		robot_name: string
		robot_avatar: string
		robot_description: string
		organization_code: string
		status: number
		enabled?: boolean
		created_at: string
		created_uid: string
		updated_at: string
		updated_uid: string
		deleted_at?: string
		deleted_uid?: string
		bot_version?: BotVersion
		quote?: number // 引用
		user_operation: OperationTypes
		created_info: {
			magic_id: string
			id: string
			user_id: string
			user_type: number
			user_manual: string
			label: string[]
			like_num: number
			avatar_url: string
			description: string
			nickname: string
			organization_code: string
			status: number
			extra: string
			created_at: string
			updated_at: string
			deleted_at: string
		}
		is_add?: boolean
		user_id?: string
		start_page: boolean
	}

	export type VisibilityConfig = {
		users: {
			id: string
			name?: string
		}[]
		departments: {
			id: string
			name?: string
		}[]
		visibility_type: VisibleRangeType
	}

	/** 机器人版本 */
	export type BotVersion = Omit<BotItem, "status" | "bot_version"> & {
		root_id: string
		version_number: string
		version_name: string
		version_description: string
		release_scope: number
		review_status: number
		approval_status: number
		enterprise_release_status: number
		app_market_status: number
		flow_code: string
		flow_version: string
		magicUserEntity: User
		third_platform_list: Bot.ThirdPartyPlatform[]
		visibility_config: VisibilityConfig
	}

	/** 企业机器人列表 */
	export type OrgBotItem = BotItem & {
		root_id: string
		app_market_status: string
		approval_status: string
		enterprise_release_status: string
		release_scope: number
		review_status: string
		version_description: string
		version_name: string
		version_number: string
		is_add: boolean
	}

	/** 单个机器人详情 */
	export type Detail = {
		botEntity: {
			id: string
			flow_code: string
			root_id: string
			robot_name: string
			robot_avatar: string
			robot_description: string
			organization_code: string
			status: number
			updated_at: string
			updated_uid: string
			created_at: string
			created_uid: string
			user_operation: OperationTypes
			instructs: QuickInstructionList[]
			start_page: boolean
		}
		magicFlowEntity: MagicFlow.Flow & {
			updated_at: string
		}
		magicUserEntity: User
		botVersionEntity: {
			id: string
			flow_code: string
			root_id: string
			robot_name: string
			robot_avatar: string
			robot_description: string
			organization_code: string
			version_number: string
			version_description: string
			release_scope: number
			approval_status: number
			enterprise_release_status: number
			created_at: string
			created_uid: string
			updated_at: string
			updated_uid: string
			instructs: QuickInstructionList[]
		}
	}

	export type GetUserBotListParams = {
		page?: number
		pageSize?: number
		keyword?: string
	}

	export type SaveBotParams = {
		id?: string
		robot_name: string
		robot_avatar: string
		robot_description?: string
		start_page: boolean
	}

	export type SaveInstructParams = {
		bot_id: string
		instructs: QuickInstructionList[]
	}

	export type PublishBotParams = {
		bot_id?: string
		version_number: string
		version_description: string
		release_scope: number
		magic_flow: MagicFlow.Flow
		third_platform_list: Bot.ThirdPartyPlatform[]
		visibility_config: VisibilityConfig
	}

	export type AddFriend = {
		avatar_url: string
		id: string
		nickname: string
		description: string
		label: string
		like_num: number
		magic_id: string
		organization_code: string
		status: number
		user_id: string
		user_name: string
		user_type: number
	}

	export type PublishBot = {
		user: User
	}

	export type DefaultIcon = {
		icons: {
			bot: string
			flow: string
			tool_set: string
			mcp: string
		}
	}

	export type ThirdPartyPlatform = {
		id?: string
		bot_id?: string
		identification: string
		key: string
		type: ThirdPartyPlatformType
		enabled: boolean
		options: {
			app_key: string
			app_secret: string
		}
	}
}

export enum ThirdPartyPlatformType {
	DingTalk = "ding_robot",
	FeiShu = "fei_shu_robot",
	EnterpriseWeChat = "wechat_robot",
}

/* 发布范围 */
export enum ScopeType {
	// 个人
	private = 0,
	// 组织
	organization = 1,
	// 市场
	public = 2,
}

/* 可见范围 */
export enum VisibleRangeType {
	/* 全员可见 */
	AllMember = 1,
	/* 指定成员/部门可见 */
	SpecifiedMemberOrDepartment = 2,
}

/** 快捷指令类型 */
export const enum InstructionType {
	// 单选项
	SINGLE_CHOICE = 1,
	// 开关
	SWITCH = 2,
	// 文本
	TEXT = 3,
	// 状态
	STATUS = 4,
}

/** 快捷指令组类型 */
export const enum InstructionGroupType {
	// 工具栏
	TOOL = 1,
	// 对话框
	DIALOG = 2,
}

/** 快捷指令返回类型 */
export type RespondInstructType = {
	[key: string]: string
}

/** 快捷指令说明 */
export type InstructionExplanation = {
	// 名称
	name: string
	// 描述
	description: string
	// 图片
	image: string
	// 临时图片url
	temp_image_url?: string
}

/** 快捷指令值 */
export type InstructionValue = {
	/** ID */
	id: string
	/** 名称 */
	name: string
	/** 值 */
	value: string
	/** 快捷指令说明 */
	instruction_explanation?: InstructionExplanation
}

/** 快捷指令 */
export interface QuickInstructionBase {
	id: string
	/** 名称 */
	name: string
	/** 描述 */
	description: string
	/** 直接发送指令 */
	send_directly?: boolean
	/** 指令说明 */
	instruction_explanation?: InstructionExplanation
	/** 指令插入位置 */
	insert_location?: InsertLocationMap
	/** 指令常驻 */
	residency?: boolean
	/** 指令类型 区分是：流程指令 还是 会话指令 */
	instruction_type?: InstructionMode
}

/** 单选指令 */
export interface SelectorQuickInstruction extends QuickInstructionBase {
	type: InstructionType.SINGLE_CHOICE
	/** 值 */
	values: InstructionValue[]
	/** 内容 */
	content: string
}

/** 开关指令 */
export interface SwitchQuickInstruction extends QuickInstructionBase {
	type: InstructionType.SWITCH
	/** 开启 */
	on?: string
	/** 关闭 */
	off?: string
	/** 默认值 */
	default_value: "on" | "off"
	/** 内容 */
	content: string
}

/** 文本指令 */
export interface TextQuickInstruction extends QuickInstructionBase {
	type: InstructionType.TEXT
	/** 内容 */
	content: string
}

/** 状态文本颜色 */
export enum StatusTextColor {
	DEFAULT = "default",
	GREEN = "green",
	RED = "red",
	ORANGE = "orange",
}

/** 状态值 */
export type InstructionStatus = {
	/** ID */
	id?: string
	/** 图标 */
	icon: StatusIconKey
	/** 状态文本 */
	status_text: string
	/** 状态文本颜色 */
	text_color: string
	/** 值 */
	value: string
	/** 状态 */
	switch: boolean
}

/** 状态按钮 */
export interface StatusQuickInstruction extends QuickInstructionBase {
	type: InstructionType.STATUS
	/** 默认值 */
	default_value: number
	/** 值 */
	values: InstructionStatus[]
}

/** 快捷指令显示类型 */
export const enum DisplayType {
	// 系统
	SYSTEM = 2,
}

/** 系统指令类型 */
export const enum SystemInstructType {
	// 表情
	EMOJI = 1,
	// 文件
	FILE = 2,
	// 话题
	TOPIC = 3,
	// 定时任务
	TASK = 4,
	// 录音
	RECORD = 5,
}

/** 系统指令映射表 */
export type SystemInstructMap = Record<SystemInstructType, string>

/** 系统指令 */
export interface SystemInstruct extends QuickInstructionBase {
	/** 类型 */
	type: SystemInstructType
	/** 显隐 */
	hidden: boolean
	/** 展示类型 */
	display_type: DisplayType
	/** 图标 */
	icon: StatusIconKey
}

/** 快捷指令模式 */
export const enum InstructionMode {
	// 流程
	Flow = 1,
	// 对话
	Chat = 2,
}

/** 快捷指令 */
export type QuickInstruction =
	| SelectorQuickInstruction
	| SwitchQuickInstruction
	| TextQuickInstruction
	| StatusQuickInstruction
	| SystemInstruct

export type CommonQuickInstruction = Exclude<QuickInstruction, SystemInstruct>

/** 快捷指令组 */
export type QuickInstructionList = {
	position: InstructionGroupType
	items: QuickInstruction[]
}
