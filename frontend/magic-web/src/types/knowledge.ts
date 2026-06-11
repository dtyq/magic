// import type { KnowledgeStatus } from "@/pages/flow/nodes/KnowledgeSearch/v0/constants"
// import type { KnowledgeType } from "@/pages/flow/nodes/KnowledgeSearch/v0/types"
import type { OperationTypes } from "@/pages/flow/components/AuthControlButton/types"
import type {
	FragmentConfig,
	EmbeddingModelConfig,
	RetrieveConfig,
} from "@/pages/vectorKnowledge/types"
import type { DocumentNodes } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/types/content-node"
import { CrewKnowledge } from "./crew-knowledge"

/** 知识库相关类型 */
export namespace Knowledge {
	/**
	 * 分页响应通用包装类型
	 */
	export interface WithPage<T> {
		list: T
		total: number
		page: number
		page_size: number
	}

	export enum KnowledgeStatus {
		UnVectored = 0,
		Vectoring = 1,
		Vectored = 2,
		VectorFail = 3,
	}

	/** 知识数据类型 */
	export enum KnowledgeType {
		/** 知识库 */
		KnowledgeDatabase = 2,
		/** 云文档 */
		Document = 3,
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
		source_type: 1 | 2 | 3 | 4 // 1-本地文档, 2-自定义内容, 3-项目文件, 4-企业知识库
		agent_codes?: string[] // 可选,数字员工编码数组
		source_bindings?: SourceBinding[] // 可选,数据源绑定配置(项目文件或企业知识库)
	}

	export enum CreateKnowledgeFileType {
		// 文件类型：1-外部文件 2-第三方平台文件
		EXTERNAL_FILE = 1,
		THIRD_PLATFORM_FILE = 2,
	}

	/** 文件平台类型 */
	export enum FilePlatformType {
		TEAMSHARE = "teamshare",
	}

	export interface CreateKnowledgeFile {
		name: string
		key?: string
		type: CreateKnowledgeFileType
		platform_type?: string // 平台类型：第三方平台
		third_file_id: string // 第三方文件ID
		file_type?: TeamshareFileCascadeItemFileType // 后端不需要该字段，用于前端展示文件icon
		parsing_type?: number // 解析类型：0-快速解析, 1-精确解析
		image_extraction?: boolean // 是否提取图片
		table_extraction?: boolean // 是否提取表格
		image_ocr?: boolean // 是否进行图片OCR识别
	}

	/** 创建知识库 - 响应 */
	export interface CreateKnowledgeResult {
		id: string
		code: string
		version: number
		name: string
		description: string
		icon: string
		type: number
		enabled: boolean
		model: string
		vector_db: string
		organization_code: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		is_draft: boolean
		fragment_config: Record<string, unknown>
		embedding_config: Record<string, unknown>
		retrieve_config: Record<string, unknown>
	}

	/** 更新知识库 */
	export interface UpdateKnowledgeParams {
		code: string
		name: string
		description: string
		icon?: string
		enabled: boolean
		embedding_config?: EmbeddingModelConfig
		retrieve_config?: RetrieveConfig
		source_type?: 1 | 2 | 3 | 4
		agent_codes?: string[]
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
		source_type: 1 | 2 | 3 | 4
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
		source_type: 1 | 2 | 3 | 4 // 来源类型
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

	/** 知识库嵌入文档的附件 */
	export interface EmbedDocumentFile {
		name: string
		key: string
		type: CreateKnowledgeFileType
		platform_type: string // 平台类型：第三方平台
		third_file_id: string // 第三方文件ID
		third_file_type: TeamshareFileCascadeItemFileType // 第三方文件类型
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
		sync_status: number // 0-待处理, 1-成功, 2-失败, 3-处理中, 6-重建中
		embedding_model: string
		vector_db: string
		organization_code: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		document_file: DocumentFile | null
		fragment_config: FragmentConfig
		embedding_config: EmbeddingModelConfig
		retrieve_config: RetrieveConfig
		doc_metadata?: DocumentMetadata // 文档元数据
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
	}

	/** 供预览分段的文档详情 */
	export interface PreviewDocumentDetail {
		id: string
		name: string
		key?: string
		type: Knowledge.CreateKnowledgeFileType
		file_type: number
		platform_type?: string
		third_file_id: string
		space_type?: SpaceType
		is_embed: boolean
	}

	/** 添加知识库的文档 */
	export interface AddKnowledgeDocumentParams {
		knowledge_code: string
		name: string
		enabled: boolean
		doc_type: number // 文档类型
		doc_metadata: DocumentMetadata // 文档元数据
		fragment_config?: FragmentConfig // 切分配置
		document_file: DocumentFile // 文档文件信息
	}

	/** 更新知识库的文档 */
	export interface UpdateKnowledgeDocumentParams {
		knowledge_code: string
		document_code: string
		name: string
		enabled: boolean
		fragment_config?: FragmentConfig
	}

	/** 删除知识库的文档 */
	export interface DeleteKnowledgeDocumentParams {
		knowledge_code: string
		document_code: string
	}

	/** 获取知识库源文件打开链接 */
	export interface GetKnowledgeSourceFileLinkParams {
		knowledgeBaseCode: string
		documentCode: string
		fileKey?: string
	}

	export interface KnowledgeSourceFileLink {
		available: boolean
		url?: string
		fileUrl?: string
		file_url?: string
		name?: string
		file_key?: string
		type?: "external" | "third_platform" | "project_file" | string
		source_type?: string
		link_type?: "download" | "web" | string
	}

	/** 分段预览 */
	export interface SegmentPreviewParams {
		fragment_config: FragmentConfig
		document_file: CreateKnowledgeFile
	}

	/**
	 * Crew 专用分段预览参数
	 */
	export interface CrewSegmentPreviewParams {
		strategy_config?: CrewKnowledge.StrategyConfig
		fragment_config: CrewKnowledge.FragmentConfig
		document_file: CreateKnowledgeFile
	}

	/** 单个片段 */
	export interface FragmentItem {
		id: string
		knowledge_base_code: string
		creator: string
		modifier: string
		created_at: string
		updated_at: string
		document_code: string
		document_name: string
		document_type: number
		content: string
		metadata: Record<string, string | number>
		business_id: string
		sync_status: number
		sync_status_message: string
		score: number
		word_count: number
	}

	/**
	 * 文档节点类型枚举
	 */
	export enum DocumentNodeType {
		/** 文档标题 */
		TITLE = "title",
		/** 章节标题 */
		SECTION_TITLE = "section-title",
		/** 章节文本 */
		SECTION_TEXT = "section-text",
		/** 代码块 */
		CODE = "code",
		/** 文本 */
		TEXT = "text",
	}

	/**
	 * 文档节点（用于层级结构展示）
	 */
	export interface DocumentNode {
		/** 节点唯一标识符 */
		id: number
		/** 节点内容类型 */
		type: DocumentNodeType
		/** 层级深度（-1表示非标题内容，0+表示标题层级） */
		level: number
		/** 父节点ID（-1表示根节点） */
		parent: number
		/** 节点文本内容 */
		text: string
		/** 子节点ID数组 */
		children: number[]
	}

	/**
	 * 文档片段列表响应（包含层级结构）
	 */
	export interface FragmentListWithNodes extends WithPage<FragmentItem[]> {
		/** 文档层级结构节点 */
		document_nodes?: DocumentNodes
	}

	export type GetKnowledgeListParams = {
		name: string
		page: number
		pageSize: number
	}

	export type SaveKnowledgeParams = Partial<
		Pick<
			KnowledgeItem,
			"id" | "name" | "description" | "type" | "model" | "enabled" | "vector_db"
		>
	>

	export type MatchKnowledgeParams = Pick<
		KnowledgeItem,
		"name" | "description" | "type" | "model"
	>

	export type GetFragmentListParams = {
		knowledgeBaseCode: string
		documentCode: string
		page: number
		pageSize: number
	}

	export type SaveFragmentParams = Partial<{
		id: string
		knowledge_code: string
		content: string
		metadata: FragmentItem["metadata"]
		business_id: FragmentItem["business_id"]
	}>

	// 天书知识库单个项
	export type KnowledgeDatabaseItem = {
		knowledge_code: string
		knowledge_type: KnowledgeType
		business_id: string
		name: string
		description: string
	}

	// 请求进度的Params
	export type GetTeamshareKnowledgeProgressParams = {
		knowledge_codes: string[]
	}

	export type CreateTeamshareKnowledgeVectorParams = {
		knowledge_id: string
	}

	export interface KnowledgeDatabaseProgress extends KnowledgeDatabaseItem {
		vector_status: KnowledgeStatus
		expected_num: number
		completed_num: number
	}

	// 0: 文生图
	// 1: 图生图
	// 2: 图片增强
	// 3: LLM大语言模型
	// 4.嵌入模型
	export interface GetActiveModelByCategoryParams {
		category: "vlm" | "llm"
		model_type: 0 | 1 | 2 | 3 | 4
	}

	export interface ServiceProvider {
		alias: string
		category: string
		config: {
			ak: string
			api_key: string
			api_version: string
			deployment_name: string
			proxy_url: string
			region: string
			sk: string
			url: string
		}
		created_at: string
		description: string
		icon: string
		id: string
		is_models_enable: boolean
		models: Model[]
		name: string
		provider_code: string
		/**
		 * 1- 普通 2-官方 3-自定义
		 */
		provider_type: number
		service_provider_id: string
		status: number
		translate: string[]
	}

	export interface Model {
		category: string
		config: ModelConfig
		created_at: string
		description: string
		icon: string
		id: string
		model_id: string
		model_type: number
		model_version: string
		name: string
		service_provider_config_id: string
		sort: number
		status: number
		translate: {
			name: {
				en_US: string
				zh_CN: string
			}
		}
		visible_organizations: string[]
	}

	export interface ModelConfig {
		max_tokens: null
		support_deep_think: boolean
		support_embedding: boolean
		support_function: boolean
		support_multi_modal: boolean
		vector_size: number
	}

	export enum SpaceType {
		/** 不限空间 */
		ANY = -1,
		/** 个人云盘 */
		OWN = 1,
		/** 企业云盘 */
		SHARE = 2,
		/** 企业知识库空间 */
		KNOWLEDGE_BASE_SHARE = 8,
	}

	export interface GetTeamshareFileCascadeParams {
		space_type: SpaceType
		parent_id: string
	}

	export interface GetTeamshareFileCascadeChildrenParams {
		space_type: SpaceType
		parent_id: string
		page_size?: number
		last_file_id?: string
	}

	export enum TeamshareFileCascadeItemFileType {
		/** 不限类型 */
		UNLIMITED = -1,
		/** 目录 */
		FOLDER = 0,
		/** 多维表格 */
		MULTI_TABLE = 1,
		/** WORD */
		WORD = 2,
		/** EXCEL */
		EXCEL = 3,
		/** 思维笔记 */
		MIND_NOTE = 4,
		/** PPT */
		PPT = 5,
		/** PDF */
		PDF = 6,
		/** 旧版云文档 */
		OLD_CLOUD_DOCUMENT = 7,
		/** 链接 */
		LINK = 8,
		/** 知识库 */
		KNOWLEDGE_BASE = 9,
		/** 图片 */
		IMAGE = 10,
		/** 视频 */
		VIDEO = 11,
		/** 音频 */
		AUDIO = 12,
		/** 压缩包 */
		COMPRESS = 13,
		/** 未知类型 */
		UN_KNOW = 14,
		/** markdown 格式文件 */
		MD = 15,
		/** 新云文档 */
		CLOUD_DOCUMENT = 16,
		/** keewood页面 */
		KEEWOOD_PAGE = 20,
		/** keewood应用 */
		KEEWOOD_APPLICATION = 21,
		/** 白板 */
		WHITE_BOARD = 22,
		/** CSV */
		CSV = 23,
		/** 神奇应用 */
		MAGIC_APPLICATION = 24,
		/** 思维导图 */
		MIND_MAP = 25,
		/** JSON */
		JSON = 27,
	}

	export interface TeamshareFileCascade {
		page: number
		next_page: boolean
		items: TeamshareFileCascadeItem[]
	}

	export interface TeamshareFileCascadeItem extends TeamshareFileCascadeChildrenItem {
		can_parse_content: boolean
	}

	export interface TeamshareFileCascadeChildrenItem {
		is_template: number
		cover_updated_at: string | null
		organization_code: string
		is_show_navigation_page: number
		properties: {
			url: string
			target_blank: number
		}
		id: string
		file_id: string
		name: string
		file_type: TeamshareFileCascadeItemFileType
		extension: string
		operation: string
		is_favorite: number
		is_quick_file: number
		is_subscribe: number
		path: {
			id: string
			name: string
			type: string
			operation: string
			space_type: number
		}[]
		creator: {
			id: string
			real_name: string
			avatar: string
			description: string
			position: string
			department: string | null
		}
		created_at: string
		modifier: {
			id: string
			real_name: string
			avatar: string
			description: string
			position: string
			department: string | null
		}
		modified_at: string
		recent_opened_at: string
		shared_at: string
		attributes: {
			advanced_permission_status: number
			inherited_permission_status: number
		}
		space_type: SpaceType
		favorite_id: string
	}

	/** 数据源绑定配置 */
	export interface SourceBinding {
		provider: "project" | "teamshare" // 数据源提供方
		root_type: "project" | "knowledge_base" // 根节点类型
		root_ref: string // 项目或知识库引用ID
		sync_mode: "realtime" | "manual" // 同步模式
		enabled: boolean
		sync_config: Record<string, unknown>
		targets: SourceBindingTarget[] // 空数组表示绑定整个项目/知识库
	}

	/** 数据源绑定目标 */
	export interface SourceBindingTarget {
		target_type: "file" | "folder" // 目标类型
		target_ref: string // 文件或文件夹引用ID
	}

	/** 文档元数据 */
	export interface DocumentMetadata {
		source: string // 来源标识,如 "knowledge-demo"
		source_type: "local_upload" | "custom" // 来源类型: local_upload-本地上传, custom-自定义内容
	}

	/** 文档文件信息 */
	export interface DocumentFile {
		name: string // 文件名
		key: string // 存储桶中的文件key
		type: 1 | 2 // 1-普通文件, 2-第三方平台文件
		third_file_id?: string // 第三方文件ID(可选)
		file_type?: number // 文件类型
		is_embed?: boolean // 是否嵌入
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
		storage: "private" | "public"
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
}
