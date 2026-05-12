/**
 * Source Binding 相关类型定义
 * 用于项目文件和企业知识库的数据源绑定
 */

/**
 * 节点类型
 */
export enum SourceBindingNodeType {
	WORKSPACE = "workspace",
	PROJECT = "project",
	KNOWLEDGE_BASE = "knowledge_base",
	FOLDER = "folder",
	FILE = "file",
}

/**
 * 来源类型
 */
export enum SourceType {
	PROJECT = "project",
	ENTERPRISE_KNOWLEDGE_BASE = "enterprise_knowledge_base",
}

/**
 * 父节点类型
 */
export enum ParentType {
	ROOT = "root",
	WORKSPACE = "workspace",
	PROJECT = "project",
	FOLDER = "folder",
	KNOWLEDGE_BASE = "knowledge_base",
}

/**
 * 同步模式
 */
export enum SyncMode {
	REALTIME = "realtime",
	MANUAL = "manual",
}

/**
 * Provider 类型
 */
export enum ProviderType {
	PROJECT = "project",
	TEAMSHARE = "teamshare",
}

/**
 * Root 类型
 */
export enum RootType {
	PROJECT = "project",
	KNOWLEDGE_BASE = "knowledge_base",
}

/**
 * 节点元数据
 */
export interface SourceBindingNodeMetadata {
	/** 文件/文件夹路径 */
	path?: string
	/** 文件大小(字节) */
	size?: number
	/** 文件扩展名 */
	extension?: string
	/** 描述信息 */
	description?: string
	/** 创建时间(Unix时间戳) */
	created_at?: number
	/** 更新时间(Unix时间戳) */
	updated_at?: number
}

/**
 * 来源绑定节点
 */
export interface SourceBindingNode {
	/** 节点类型 */
	node_type: SourceBindingNodeType
	/** 节点引用ID */
	node_ref: string
	/** 节点名称 */
	name: string
	/** 是否可选择(用于绑定) */
	selectable: boolean
	/** 是否有子节点 */
	has_children: boolean
	/** 节点元数据 */
	meta?: SourceBindingNodeMetadata
}

/**
 * 获取来源节点列表的请求参数
 */
export interface GetSourceBindingNodesParams {
	/** 来源类型 */
	source_type: SourceType
	/** 父节点类型 */
	parent_type: ParentType
	/** 父节点引用ID(当 parent_type 不是 root 时必填) */
	parent_ref?: string
	/** Provider(企业知识库时必填) */
	provider?: ProviderType
	/** 页码(默认1) */
	page?: number
	/** 每页数量(默认20) */
	page_size?: number
}

/**
 * 获取来源节点列表的响应
 */
export interface SourceBindingNodesResponse {
	/** 节点列表 */
	list: SourceBindingNode[]
	/** 当前页码 */
	page: number
	/** 每页数量 */
	page_size: number
	/** 总数量 */
	total: number
}

/**
 * 来源绑定目标
 */
export interface SourceBindingTarget {
	/** 目标类型(文件夹或文件) */
	target_type: "folder" | "file"
	/** 目标引用ID */
	target_ref: string
}

/**
 * 来源绑定配置
 */
export interface SourceBindingConfig {
	/** Provider */
	provider: ProviderType
	/** Root 类型 */
	root_type: RootType
	/** Root 引用ID */
	root_ref: string
	/** 同步模式 */
	sync_mode: SyncMode
	/** 是否启用 */
	enabled: boolean
	/** 同步配置(预留) */
	sync_config: Record<string, unknown>
	/** 绑定目标列表(空数组表示绑定整个根节点) */
	targets: SourceBindingTarget[]
}

/**
 * 知识库同步状态
 */
export enum KnowledgeSyncStatus {
	/** 等待同步 */
	PENDING = 0,
	/** 同步成功 */
	SYNCED = 1,
	/** 同步失败 */
	SYNC_FAILED = 2,
	/** 正在同步 */
	SYNCING = 3,
	/** 已删除 */
	DELETED = 4,
	/** 删除失败 */
	DELETE_FAILED = 5,
	/** 正在重建 */
	REBUILDING = 6,
}

/**
 * 知识库同步进度信息
 */
export interface KnowledgeSyncProgress {
	/** 同步状态 */
	sync_status: KnowledgeSyncStatus
	/** 同步状态消息 */
	sync_status_message?: string
	/** 预期文档数量 */
	expected_count: number
	/** 已完成文档数量 */
	completed_count: number
	/** 已物化文档数量 */
	document_count: number
}
