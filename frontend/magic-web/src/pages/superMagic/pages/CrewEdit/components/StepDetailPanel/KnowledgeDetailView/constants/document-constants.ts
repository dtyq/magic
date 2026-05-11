/**
 * 知识库文档相关常量
 * 注意：类型枚举已移至 @/types/crew-knowledge 的 CrewKnowledge namespace
 */

import { CrewKnowledge } from "@/types/crew-knowledge"

/** 文档类型 */
export const DOCUMENT_TYPE = {
	/** 本地文档 */
	LOCAL_DOCUMENT: 1,
	/** 自定义内容 */
	CUSTOM_CONTENT: 2,
	/** 项目文件 */
	PROJECT_FILE: 3,
	/** 企业知识库 */
	ENTERPRISE_KNOWLEDGE: 4,
} as const

/** 切分模式 */
export const FRAGMENT_MODE = {
	/** 自定义 */
	CUSTOM: 1,
	/** 自动 */
	AUTO: 2,
	/** 层级 */
	HIERARCHY: 3,
} as const

/** 文件MIME类型 */
export const MIME_TYPE = {
	/** Markdown */
	MARKDOWN: "text/markdown",
	/** PDF */
	PDF: "application/pdf",
	/** 文本 */
	TEXT: "text/plain",
	/** Word文档 */
	DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	/** 通用二进制 */
	OCTET_STREAM: "application/octet-stream",
} as const

/** 轮询配置 */
export const POLLING_CONFIG = {
	/** 轮询间隔(毫秒) */
	INTERVAL: 3000,
	/** 最大轮询次数 */
	MAX_ATTEMPTS: 60,
	/** 超时提示信息 */
	TIMEOUT_MESSAGE_KEY: "documentCreate.processing.documentProcessingTimeout",
} as const

/** 文件名生成配置 */
export const FILE_NAME_CONFIG = {
	/** 特殊字符替换 */
	SPECIAL_CHAR_REPLACEMENT: "_",
	/** 特殊字符正则 */
	SPECIAL_CHAR_REGEX: /[^a-zA-Z0-9.-]/g,
	/** 随机字符串长度 */
	RANDOM_STRING_LENGTH: 6,
} as const

// 重新导出 CrewKnowledge 枚举，方便使用
export const DOCUMENT_SYNC_STATUS = CrewKnowledge.DocumentSyncStatus
export const STORAGE_TYPE = CrewKnowledge.StorageType
export const FILE_TYPE = CrewKnowledge.DocumentFileType

export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE]
export type FragmentMode = (typeof FRAGMENT_MODE)[keyof typeof FRAGMENT_MODE]
export type DocumentSyncStatus = CrewKnowledge.DocumentSyncStatus
export type StorageType = CrewKnowledge.StorageType
export type FileType = CrewKnowledge.DocumentFileType
export type MimeType = (typeof MIME_TYPE)[keyof typeof MIME_TYPE]

/**
 * 根据文档同步状态计算进度百分比
 * 统一的进度映射策略，适用于所有文档类型
 */
export function calculateProgressFromSyncStatus(
	syncStatus: CrewKnowledge.DocumentSyncStatus,
): number {
	switch (syncStatus) {
		case CrewKnowledge.DocumentSyncStatus.PENDING:
			return 40
		case CrewKnowledge.DocumentSyncStatus.SYNCING:
		case CrewKnowledge.DocumentSyncStatus.REBUILDING:
			return 70
		case CrewKnowledge.DocumentSyncStatus.SYNCED:
			return 100
		case CrewKnowledge.DocumentSyncStatus.SYNC_FAILED:
		case CrewKnowledge.DocumentSyncStatus.DELETE_FAILED:
		case CrewKnowledge.DocumentSyncStatus.DELETED:
			return 0
		default:
			return 30
	}
}
