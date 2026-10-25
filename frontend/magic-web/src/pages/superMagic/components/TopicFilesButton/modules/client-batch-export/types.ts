import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { ExportIssue } from "@magic/html2pptx"

export type ClientBatchExportFormat = "pdf" | "pptx"

/** Minimal attachment contract kept local so the exporter is not coupled to a UI hook type. */
export interface ClientBatchAttachment {
	file_id?: string
	file_name?: string
	filename?: string
	file_extension?: string
	is_directory?: boolean
	name?: string
	display_filename?: string
	relative_file_path?: string
	parent_id?: string | null
	children?: ClientBatchAttachment[]
	display_config?: unknown
	metadata?: unknown
	[key: string]: unknown
}

export interface ClientBatchDisplayConfig {
	type?: string
	slides?: string[]
	[key: string]: unknown
}

export interface ClientBatchExportTarget {
	/** The selected file or logical project folder. */
	item: ClientBatchAttachment
	/** Nearest directory scope, retained by reference for resource resolution. */
	attachmentScope?: ClientBatchAttachment[]
	/** Children are kept for slide projects so their resources are resolved in context. */
	folderChildren?: ClientBatchAttachment[]
	/** Entry file for a logical slide project. */
	entryFile?: ClientBatchAttachment
	isSlideProject: boolean
}

export interface ClientBatchExportSelection {
	targets: ClientBatchExportTarget[]
	unsupportedItems: ClientBatchAttachment[]
}

export interface ClientBatchExportFailure {
	target: ClientBatchExportTarget
	error: unknown
}

export interface ClientBatchExportArtifact {
	blob: Blob
	fileName: string
}

export interface ClientBatchExportRunResult {
	artifact?: ClientBatchExportArtifact
	/** PPTX files were written directly to a user-selected file or directory. */
	streamedToDisk?: boolean
	successCount: number
	failureCount: number
	failures: ClientBatchExportFailure[]
	warnings: number
	cancelled?: boolean
	/** PDF is an enterprise-provided service; OSS can report it as unavailable. */
	unavailable?: boolean
}

export interface ClientBatchExportRunOptions {
	format: ClientBatchExportFormat
	targets: ClientBatchExportTarget[]
	attachments: ClientBatchAttachment[]
	projectName?: string
	onProgress?: (progress: number) => void
	access?: FileAccessContext
	fileApi?: FileApi
	/** Reports recoverable PPTX page/resource issues to the host notifier. */
	onExportIssue?: (issue: ExportIssue) => void
	/** Cancels the active streaming target and prevents later targets from starting. */
	signal?: AbortSignal
}
