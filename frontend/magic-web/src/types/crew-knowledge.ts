import type { OperationTypes } from "@/pages/flow/components/AuthControlButton/types"
import type { EmbeddingModelConfig, RetrieveConfig } from "@/pages/vectorKnowledge/types"

/** Crew知识库相关类型 */
export namespace CrewKnowledge {
	/** 分段模式 */
	export enum SegmentationMode {
		/** 通用模式/自定义分段 */
		CUSTOM = 1,
		/** 自动分段 */
		AUTO = 2,
		/** 层级分段 */
		HIERARCHY = 3,
	}

	/** 文本预处理规则 */
	export enum TextPreprocessingRules {
		/** 替换掉连续的空格、换行符和制表符 */
		REPLACE_SPACES = 1,
		/** 删除所有 URL 和电子邮件地址 */
		REMOVE_URLS = 2,
	}

	/** 分段配置 */
	export interface FragmentConfig {
		mode: SegmentationMode
		normal?: {
			text_preprocess_rule: TextPreprocessingRules[]
			segment_rule: {
				separator: string
				chunk_size: number
				chunk_overlap: number
			}
		}
		hierarchy?: {
			max_level: number
			keep_hierarchy_info: boolean
			text_preprocess_rule: TextPreprocessingRules[]
		}
	}

	/** 知识库来源类型 */
	export enum KnowledgeSourceType {
		/** 本地文档 */
		LOCAL_DOCUMENT = 1,
		/** 自定义内容 */
		CUSTOM_CONTENT = 2,
		/** 项目文件 */
		PROJECT_FILE = 3,
		/** 企业知识库 */
		ENTERPRISE_KNOWLEDGE = 4,
	}

	/** 数据源提供方 */
	export enum SourceProvider {
		/** 项目 */
		PROJECT = "project",
		/** 天书云盘 */
		TEAMSHARE = "teamshare",
	}

	/** 根节点类型 */
	export enum RootNodeType {
		/** 项目 */
		PROJECT = "project",
		/** 知识库 */
		KNOWLEDGE_BASE = "knowledge_base",
	}

	/** 同步模式 */
	export enum SyncMode {
		/** 实时同步 */
		REALTIME = "realtime",
		/** 手动同步 */
		MANUAL = "manual",
	}

	/** 绑定目标类型 */
	export enum TargetType {
		/** 文件 */
		FILE = "file",
		/** 文件夹 */
		FOLDER = "folder",
	}

	/** 文档文件类型 */
	export enum DocumentFileType {
		/** 普通文件 */
		NORMAL_FILE = 1,
		/** 第三方平台文件 */
		THIRD_PARTY_FILE = 2,
	}

	/** 存储类型 */
	export enum StorageType {
		/** 私有存储 */
		PRIVATE = "private",
		/** 公共存储 */
		PUBLIC = "public",
	}

	/** 文档同步状态 */
	export enum DocumentSyncStatus {
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

	/** 数据源绑定配置 */
	export interface SourceBinding {
		provider: SourceProvider // 数据源提供方
		root_type: RootNodeType // 根节点类型
		root_ref: string // 项目或知识库引用ID
		workspace_id?: string // 工作区ID（项目文件类型时返回）
		workspace_type?: "normal" | "shared" // 工作区类型（项目文件类型时返回）
		sync_mode: SyncMode // 同步模式
		enabled: boolean
		sync_config: Record<string, unknown>
		targets: SourceBindingTarget[] // 空数组表示绑定整个项目/知识库
	}

	/** 数据源绑定目标 */
	export interface SourceBindingTarget {
		target_type: TargetType // 目标类型
		target_ref: string // 文件或文件夹引用ID
	}

	/** 文档文件信息 */
	export interface DocumentFile {
		name: string // 文件名
		key: string // 存储桶中的文件key
		type: DocumentFileType // 文件类型
		third_file_id?: string // 第三方文件ID(可选)
		file_type?: number // 文件类型
		is_embed?: boolean // 是否嵌入
		url?: string // 文件相对URL，后端返回的时候等于key
		parsing_type?: number // 解析类型：0-快速解析, 1-精确解析
		image_extraction?: boolean // 是否提取图片
		table_extraction?: boolean // 是否提取表格
		image_ocr?: boolean // 是否进行图片OCR识别
	}

	/** 文档策略配置 */
	export interface StrategyConfig {
		parsing_type: number // 解析类型：0-快速解析, 1-精确解析
		image_extraction: boolean // 是否提取图片
		table_extraction: boolean // 是否提取表格
		image_ocr: boolean // 是否进行OCR识别
	}

	/** 临时上传凭证 - STS方式 */
	export interface TemporaryCredentialSTS {
		host: string // OSS端点
		bucket: string // 存储桶名称
		region: string // 区域
		dir: string // 目录前缀
		credentials: {
			AccessKeyId: string
			SecretAccessKey: string
			SessionToken: string
		}
	}

	/** 临时上传凭证 - Policy方式 */
	export interface TemporaryCredentialPolicy {
		host: string // OSS端点
		dir: string // 目录前缀
		policy: string // base64编码的policy
		"x-tos-algorithm": string
		"x-tos-credential": string
		"x-tos-date": string
		"x-tos-signature": string
		"x-tos-server-side-encryption": string
	}

	/** 获取临时凭证参数 */
	export interface GetTemporaryCredentialParams {
		storage: StorageType
		sts: boolean // true-STS方式, false-Policy方式
		content_type: string // 文件MIME类型
	}

	/** 获取临时凭证响应 */
	export interface GetTemporaryCredentialResponse {
		temporary_credential: TemporaryCredentialSTS | TemporaryCredentialPolicy
	}

	/** 上传文件响应 */
	export interface UploadFileResponse {
		path: string // 文件路径
		key: string // 文件key
	}

	/** 创建知识库 - 参数 */
	export interface CreateKnowledgeParams {
		name: string
		description: string
		icon?: string
		enabled: boolean
		fragment_config?: FragmentConfig
		embedding_config?: EmbeddingModelConfig
		retrieve_config?: RetrieveConfig
		source_type: KnowledgeSourceType
		agent_codes?: string[] // 可选,数字员工编码数组
		source_bindings?: SourceBinding[] // 可选,数据源绑定配置(项目文件或企业知识库)
	}

	/** 更新知识库 */
	export interface UpdateKnowledgeParams {
		code: string
		name?: string
		description?: string
		icon?: string
		enabled?: boolean
		embedding_config?: EmbeddingModelConfig
		retrieve_config?: RetrieveConfig
		source_type?: KnowledgeSourceType
		agent_codes?: string[]
		source_bindings?: SourceBinding[] // 可选,数据源绑定配置(用于项目文件或企业知识库的重新绑定)
		fragment_config?: FragmentConfig // 可选,分段配置(用于项目文件或企业知识库)
	}

	/** 单个知识库详情 */
	export interface Detail {
		id: string
		code: string
		version: number
		name: string
		description: string
		icon: string
		type: number
		source_type: KnowledgeSourceType
		enabled: boolean
		sync_status: number
		sync_status_message: string
		model: string
		vector_db: string
		organization_code: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		document_count: number // 文档数量
		expected_count: number // 预期数量
		completed_count: number // 完成数量
		user_operation: OperationTypes
		fragment_config: FragmentConfig
		embedding_config: EmbeddingModelConfig
		retrieve_config: RetrieveConfig
		agent_codes: string[] // 数字员工编码数组
		source_bindings?: SourceBinding[] // 数据源绑定配置
	}

	/** 单个知识库列表项 */
	export interface KnowledgeItem {
		id: string
		code: string
		name: string
		icon: string
		description: string
		type: number
		source_type: KnowledgeSourceType
		enabled: boolean
		sync_status: number
		sync_status_message: string
		model: string
		vector_db: string
		organization_code: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		user_operation: OperationTypes
		document_count: number // 文档数量
		expected_count: number // 预期数量
		completed_count: number // 完成数量
		agent_codes: string[] // 数字员工编码数组
		creator_info?: {
			id: string
			name: string
			avatar: string
		}
		modifier_info?: {
			id: string
			name: string
			avatar: string
		}
	}

	/** 知识库嵌入文档详情 */
	export interface EmbedDocumentDetail {
		id: string
		code: string
		knowledge_base_code: string
		version: number
		name: string
		description: string
		type: number
		doc_type: number
		enabled: boolean
		sync_status: DocumentSyncStatus
		embedding_model: string
		vector_db: string
		organization_code: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		strategy_config?: StrategyConfig // 解析策略配置
		document_file: DocumentFile | null
		fragment_config: FragmentConfig
		embedding_config: EmbeddingModelConfig
		retrieve_config: RetrieveConfig
		creator_info?: {
			id: string
			name: string
			avatar: string
		}
		modifier_info?: {
			id: string
			name: string
			avatar: string
		}
		word_count: number // 字数统计
		sync_status_message: string // 同步状态消息
	}

	/** 添加知识库的文档 */
	export interface AddKnowledgeDocumentParams {
		knowledge_code: string
		name: string
		enabled: boolean
		doc_type: number // 文档类型：1-本地文档, 2-自定义内容, 3-项目文件, 4-企业知识库
		strategy_config?: StrategyConfig // 解析策略配置
		fragment_config?: FragmentConfig // 切分配置
		document_file?: DocumentFile // 文档文件信息
		source_bindings?: SourceBinding[] // 数据源绑定配置
	}

	/** 更新知识库的文档 */
	export interface UpdateKnowledgeDocumentParams {
		knowledge_code: string
		document_code: string
		name: string
		enabled: boolean
		fragment_config?: FragmentConfig
		strategy_config?: StrategyConfig
		document_file?: DocumentFile
	}

	/** 删除知识库的文档 */
	export interface DeleteKnowledgeDocumentParams {
		knowledge_code: string
		document_code: string
	}
}
