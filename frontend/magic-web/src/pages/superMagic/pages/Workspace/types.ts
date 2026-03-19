// 工作区相关类型
import { PathNode } from "@/types/organization"
import type { Key, ReactNode } from "react"
import { ModelItem, ModeModelGroup } from "../../components/MessageEditor/types"
import { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"
import { IconType } from "../../components/AgentSelector/types"
import { SceneItem } from "../../types/skill"

export interface WithPage<T> {
	list: T[]
	total: number
}

export enum TopicMode {
	/** 通用模式 */
	General = "general",
	/** 聊天模式 */
	Chat = "chat",
	/** 数据分析 */
	DataAnalysis = "data_analysis",
	/** PPT */
	PPT = "ppt",
	/** 研报模式 */
	Report = "report",
	/** 录音总结 */
	RecordSummary = "summary",
	/** 空模式 */
	Empty = "",
	/** 设计模式 */
	Design = "design",
	/** 员工主导模式
	 * 不会在员工列表中存在，只用于创建员工时使用
	 */
	AgentManager = "agent-manager",
}

export enum AgentType {
	Official = 1, // 官方/内置智能体
	Custom = 2, // 自定义智能体
	Public = 3, // 公开智能体
}

export interface ModeModelGroupItem {
	group: ModeModelGroup
	models: ModelItem[]
	model_ids: string[]
	image_models?: ModelItem[]
	image_model_ids: string[]
}

export interface ModeModelGroupItemResponse {
	group: ModeModelGroup
	model_ids: string[]
	image_model_ids: string[]
}

export interface ModeItem {
	agent: {
		type: AgentType
		category: "all" | "frequent"
	}
	mode: {
		id: string
		name: string
		identifier: string
		icon: string
		color: string
		icon_url: string
		icon_type: IconType
		sort: number
		placeholder?: string
		playbooks: SceneItem[]
	}
	groups: ModeModelGroupItem[]
}

export interface CrewItem {
	agent: {
		type: AgentType
		category: "all" | "frequent"
	}
	mode: {
		id: string
		name: string
		identifier: string
		icon: string
		color: string
		icon_url: string
		icon_type: IconType
		sort: number
		placeholder?: string
		description?: string
		playbooks: {
			id: string
			name: string
			desc: string
			icon: string
			theme_color: string | null
		}[]
	}
	groups: ModeModelGroupItem[]
}

export interface CrewItemResponse {
	agent: {
		type: AgentType
		category: "all" | "frequent"
	}
	mode: {
		id: string
		name: string
		identifier: string
		icon: string
		color: string
		icon_url: string
		icon_type: IconType
		sort: number
		placeholder?: string
		description?: string
		playbooks: {
			id: string
			name: string
			desc: string
			icon: string
			theme_color: string | null
		}[]
	}
	groups: ModeModelGroupItemResponse[]
}

export enum TaskStatus {
	WAITING = "waiting",
	RUNNING = "running",
	FINISHED = "finished",
	SUSPENDED = "suspended",
	ERROR = "error",
}

/** 工作区状态 */
export enum WorkspaceStatus {
	/** 未运行 */
	WAITING = "waiting",
	/** 运行中 */
	RUNNING = "running",
}

/** 项目状态 */
export enum ProjectStatus {
	/** 未运行 */
	WAITING = "waiting",
	/** 运行中 */
	RUNNING = "running",
}

// 工作区
export interface Workspace {
	id: string
	name: string
	is_archived: 0 | 1 // 0: 未归档，1: 已归档
	current_topic_id: string
	current_project_id: string | null
	workspace_status: WorkspaceStatus
	project_count: number
	status?: "waiting" | "running" | "finished" | "error" // 其实没有这个字段，但是为了兼容旧数据，所以加了这个字段
}

// 话题
export interface Topic {
	id: string
	user_id: string
	chat_topic_id: string
	chat_conversation_id: string
	topic_name: string
	task_status: TaskStatus
	task_mode: string
	project_id: string
	topic_mode: TopicMode
	updated_at: string
	workspace_id: string
	/** Token usage count. null means do not show usage indicator. */
	token_used: number | null
}

// 消息相关类型
export interface MessageContent {
	id: string
	content: string
	sender?: string
	type: string
	attachments?: FileItem[] | []
	sandbox_id: string
	event: string
	task_id: string
	task_mode: "chat" | "plan"
	status: TaskStatus
	steps: MessageStep[]
	tool: MessageTool
	send_timestamp: string
}

// 消息详情相关类型
export interface MessageTool {
	id: string
	name: string
	action: string
	status: TaskStatus
	remark: string
	detail: {
		type: string
		data: string
	}
	attachments: FileItem[]
}

export interface MessageStep {
	id: string
	title: string
	status: TaskStatus
}

export interface MessageDetail {
	id: string
	content: string
	timestamp: string
	sender: string
	steps: {
		title: string
		content: string
	}[]
}

export interface FileItem {
	file_id: Key | null | undefined
	file_size: number | undefined
	file_name: string
	file_key: string | undefined
	key?: string
	name?: string
	size?: number
	path?: string
	filename?: string
	url?: string
	type?: string
	icon?: ReactNode
	color?: string
}

// 任务列表相关类型
export interface TaskProcess {
	id: string
	title: string
	status: TaskStatus
	[key: string]: any
}

export interface TaskData {
	process: TaskProcess[]
	topic_id: string
}

// 项目列表Item
export interface ProjectListItem {
	id: string
	project_status: ProjectStatus
	project_mode: TopicMode | ""
	project_description?: string // 协作项目才有
	workspace_id: string
	work_dir: string
	workspace_name: string
	project_name: string
	current_topic_id: string
	current_topic_status: string
	user_id?: string // 自己的项目才有
	user_organization_code?: string // 自己的项目才有
	created_uid?: string // 自己的项目才有
	updated_uid?: string // 自己的项目才有
	created_at: string
	updated_at: string
	members?: Collaborator[] // 协作项目才有
	member_count?: number // 协作项目才有
	creator?: CollaborationProjectListItem["creator"] // 协作项目才有
	tag: "collaboration" | "" // 用于标识是否是协作项目
	is_pinned?: boolean // 协作项目才有
	last_active_at?: string // 协作项目才有
	user_role?: CollaboratorPermission
	is_bind_workspace?: boolean // 协作项目才有
	bind_workspace_id?: string // 协作项目才有
}

// 创建新项目的响应数据
export interface CreatedProject {
	project: ProjectListItem
	topic: Topic
}

// 项目协作成员
export interface Collaborator {
	id: string
	name: string
	i18n_name: string
	organization_code: string
	avatar_url: string
	type: "User" | "Department"
	user_id?: string
	department_id?: string
	path_nodes: PathNode[]
	role: CollaboratorPermission
	join_method?: CollaborationJoinMethod
}

export interface CollaborationProjectCreator {
	id: string
	user_id: string
	name: string
	avatar_url: string
}

// 项目协作成员列表
export interface CollaborationProjectListItem {
	id: string
	project_status: ProjectStatus
	workspace_id: string
	project_description: string
	work_dir: string
	current_topic_id: string
	current_topic_status: string
	project_mode: TopicMode | ""
	workspace_name: string
	project_name: string
	created_at: string
	updated_at: string
	creator: Omit<CollaborationProjectCreator, "id" | "name"> & { nickname: string }
	members: Collaborator[]
	member_count: number
	tag: "collaboration"
	is_pinned?: boolean
	last_active_at?: string
	is_bind_workspace: boolean
	bind_workspace_id: string
	user_role?: CollaboratorPermission
}

export const enum CollaborationProjectType {
	/**
	 * 自己分享的项目
	 */
	Shared = "shared",
	/**
	 * 别人分享给自己的项目
	 */
	Received = "received",
}

/**
 * 协作邀请方式
 */
export const enum CollaborationJoinMethod {
	Internal = "internal",
	link = "link",
}

/** 消息状态 */
export enum MessageStatus {
	/** 已撤销 */
	REVOKED = "revoked",
}

/** 文件历史版本 */
export interface FileHistoryVersion {
	file_id: string
	/** 编辑类型: 1: 在线编辑; 2: AI编辑 */
	edit_type: 1 | 2
	version: number
	created_at: string
}

/** 文件信息 */
export interface FileInfo {
	file_name: string
	version: number
	organization_code: string
}

/** 下载图片模式 高清+无水印 */
export const enum DownloadImageMode {
	/** 普通模式：下载带水印的图片 */
	NormalDownload = "normal_download",
	/** download和high_quality模式：会下载高清无水印图片 */
	Download = "download",
	HighQuality = "high_quality",
}

/** 消息使用类型 */
export enum MessageUsageType {
	TaskPoints = "task_points",
}
