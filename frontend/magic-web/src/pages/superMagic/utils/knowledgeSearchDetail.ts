export type KnowledgeSearchStatus = "success" | "empty" | "error" | string

export interface KnowledgeSearchSnippet {
	rank?: number
	score?: number
	word_count?: number
	text?: string
	file_key?: string
	truncated?: boolean
}

export interface KnowledgeSearchDocument {
	rank?: number
	knowledge_code?: string
	knowledge_base_id?: string
	knowledge_base_name?: string
	document_code?: string
	document_name?: string
	file_key?: string
	snippets?: KnowledgeSearchSnippet[]
}

export interface KnowledgeSearchDetailData {
	type?: "knowledge_search" | string
	schema_version?: number
	status?: KnowledgeSearchStatus
	query?: string
	summary?: {
		document_count?: number
		snippet_count?: number
		shown_document_count?: number
		shown_snippet_count?: number
		message?: string
	}
	documents?: KnowledgeSearchDocument[]
	truncated?: boolean
	error?: {
		code?: string
		message?: string
		[key: string]: unknown
	} | null
	[key: string]: unknown
}

export function getKnowledgeSearchDetailData(
	value: unknown,
): KnowledgeSearchDetailData | undefined {
	const record = toRecord(value)
	if (!record) return undefined

	if (isKnowledgeSearchDetailRecord(record)) {
		return record as KnowledgeSearchDetailData
	}

	const nestedData = record.data
	if (record.type === "knowledge_search" && isRecord(nestedData)) {
		return getKnowledgeSearchDetailData(nestedData) || (nestedData as KnowledgeSearchDetailData)
	}

	return getKnowledgeSearchDetailData(nestedData)
}

export function getKnowledgeSearchDocumentFileKey(document: KnowledgeSearchDocument) {
	if (document.file_key) return document.file_key
	const snippetWithFileKey = document.snippets?.find((snippet) => snippet.file_key)
	return snippetWithFileKey?.file_key
}

export function inferKnowledgeSearchFileExtension(path?: string) {
	if (!path) return undefined
	const normalizedPath = path.trim().split(/[?#]/)[0] || ""
	const fileName = normalizedPath.split("/").pop() || ""
	const extensionStartIndex = fileName.lastIndexOf(".")

	if (extensionStartIndex <= 0 || extensionStartIndex === fileName.length - 1) {
		return undefined
	}

	return fileName.slice(extensionStartIndex + 1).toLowerCase()
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
	if (isRecord(value)) return value
	if (typeof value !== "string") return undefined

	try {
		const parsed = JSON.parse(value)
		return isRecord(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

function isKnowledgeSearchDetailRecord(record: Record<string, unknown>) {
	if (Array.isArray(record.documents)) return true
	if (record.type !== "knowledge_search") return false
	return !!(record.status || record.query || record.summary || record.error)
}
