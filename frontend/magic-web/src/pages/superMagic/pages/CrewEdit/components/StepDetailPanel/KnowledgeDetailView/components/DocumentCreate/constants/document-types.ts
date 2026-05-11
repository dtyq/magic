/**
 * 文档类型枚举
 */
export const DOCUMENT_TYPES = {
	LOCAL: "local",
	CUSTOM: "custom",
	PROJECT: "project",
	WIKI: "wiki",
} as const

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES]

/**
 * 文档类型显示名称映射 - 已废弃，使用 i18n key
 * @deprecated 使用 DOCUMENT_TYPE_I18N_KEYS
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
	[DOCUMENT_TYPES.LOCAL]: "Local Documents",
	[DOCUMENT_TYPES.CUSTOM]: "Custom Content",
	[DOCUMENT_TYPES.PROJECT]: "Project",
	[DOCUMENT_TYPES.WIKI]: "Enterprise Wiki",
}

/**
 * 文档类型国际化key映射
 */
export const DOCUMENT_TYPE_I18N_KEYS: Record<DocumentType, string> = {
	[DOCUMENT_TYPES.LOCAL]: "documentCreate.localDocuments.title",
	[DOCUMENT_TYPES.CUSTOM]: "documentCreate.customContent.title",
	[DOCUMENT_TYPES.PROJECT]: "documentCreate.project.title",
	[DOCUMENT_TYPES.WIKI]: "documentCreate.enterpriseWiki.title",
}
