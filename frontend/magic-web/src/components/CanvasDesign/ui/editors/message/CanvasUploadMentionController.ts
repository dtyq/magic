import type { RefObject } from "react"
import type { UploadFileResponse } from "../../../public/magic-types"
import type {
	ReferenceResourcePanelFileData,
	ReferenceResourcePanelItem,
} from "../../../public/props"
import type {
	MessageEditorPendingUploadMentionInput,
	MessageEditorRef,
	MessageEditorSelectionRange,
} from "./MessageEditor"

export interface CanvasUploadMentionHandle {
	pendingId: string
	fileName: string
	index: number
	editorSessionId?: string
	active: boolean
}

interface BeginBatchOptions {
	selection?: MessageEditorSelectionRange
	placement?: "cursor" | "documentEnd"
	includeMention?: (file: File, index: number) => boolean
}

interface AllocateBatchOptions {
	includeMention?: (file: File, index: number) => boolean
}

export interface CanvasUploadMentionAllocation {
	handles: CanvasUploadMentionHandle[]
	pendingItems: MessageEditorPendingUploadMentionInput[]
}

/**
 * Owns the short-lived relationship between an upload callback and its editor node.
 * The editor is deliberately accessed through a ref so late callbacks can be ignored
 * after the editor session has been unmounted or replaced.
 */
export class CanvasUploadMentionController {
	private readonly editorRef: RefObject<MessageEditorRef | null>
	private sessionToken = 0
	private readonly handles = new Map<string, CanvasUploadMentionHandle>()

	constructor(editorRef: RefObject<MessageEditorRef | null>) {
		this.editorRef = editorRef
	}

	/**
	 * Allocates pending ids without inserting nodes. Callers that need ordered
	 * text+mention clipboard fragments insert via insertClipboardParts, then upload.
	 */
	public allocateBatch(
		files: File[],
		options?: AllocateBatchOptions,
	): CanvasUploadMentionAllocation {
		const editor = this.editorRef.current
		if (!editor || files.length === 0) return { handles: [], pendingItems: [] }

		const token = this.sessionToken
		const editorSessionId = editor.getSessionId?.()
		const pendingItems: MessageEditorPendingUploadMentionInput[] = []
		const handles: CanvasUploadMentionHandle[] = []
		files.forEach((file, index) => {
			if (options?.includeMention && !options.includeMention(file, index)) return
			const pendingId = `${token}:${createOpaqueId()}`
			const handle: CanvasUploadMentionHandle = {
				pendingId,
				fileName: file.name,
				index,
				editorSessionId,
				active: true,
			}
			handles.push(handle)
			this.handles.set(pendingId, handle)
			pendingItems.push({
				pendingId,
				fileName: file.name,
				fileExtension: getFileExtension(file.name),
				fileSize: file.size,
				progress: 0,
				status: "init",
			})
		})

		return { handles, pendingItems }
	}

	public beginBatch(files: File[], options?: BeginBatchOptions): CanvasUploadMentionHandle[] {
		const editor = this.editorRef.current
		if (!editor || files.length === 0) return []

		const { handles, pendingItems } = this.allocateBatch(files, {
			includeMention: options?.includeMention,
		})
		if (pendingItems.length === 0) return []

		const inserted = editor.insertPendingUploadMentions(pendingItems, {
			selection: options?.selection,
			placement: options?.placement,
			replaceSelection: false,
		})
		if (!inserted) {
			this.abandonHandles(handles)
			return []
		}

		return handles
	}

	public abandonHandles(handles: CanvasUploadMentionHandle[]): void {
		handles.forEach((handle) => {
			handle.active = false
			this.handles.delete(handle.pendingId)
		})
	}

	public updateProgress(handle: CanvasUploadMentionHandle | undefined, progress: number): void {
		if (!this.isCurrent(handle)) return
		this.editorRef.current?.updatePendingUploadMention(handle.pendingId, {
			status: "uploading",
			progress,
		})
	}

	public resolve(
		handle: CanvasUploadMentionHandle | undefined,
		result: UploadFileResponse,
	): boolean {
		if (!this.isCurrent(handle)) return false
		const editor = this.editorRef.current
		if (!editor) return false
		const rawResult = result as UploadFileResponse & Record<string, unknown>
		const data: ReferenceResourcePanelFileData = {
			file_id: String(rawResult.file_id || result.path),
			file_name: result.fileName || getFileName(result.path),
			file_path: result.path,
			relative_file_path: String(rawResult.relative_file_path || result.path),
			file_extension: getFileExtension(result.fileName || result.path),
			...(rawResult.project_id ? { project_id: String(rawResult.project_id) } : {}),
			...(rawResult.source_project_id
				? { source_project_id: String(rawResult.source_project_id) }
				: {}),
			...(rawResult.source_file_id
				? { source_file_id: String(rawResult.source_file_id) }
				: {}),
		}
		const item: ReferenceResourcePanelItem = {
			type: "project_file",
			data,
		}
		const resolved = editor.resolvePendingUploadMention(handle.pendingId, item)
		this.finish(handle)
		return resolved
	}

	public fail(handle: CanvasUploadMentionHandle | undefined, error: Error | string): void {
		if (!this.isCurrent(handle)) return
		// Keep a short chip label aligned with SuperMagic; detailed error stays in logs.
		void error
		this.editorRef.current?.failPendingUploadMention(handle.pendingId, "上传失败")
		this.finish(handle)
	}

	public invalidateSession(): void {
		this.sessionToken += 1
		this.handles.forEach((handle) => {
			handle.active = false
		})
		this.handles.clear()
	}

	private isCurrent(
		handle: CanvasUploadMentionHandle | undefined,
	): handle is CanvasUploadMentionHandle {
		return Boolean(
			handle &&
			handle.active &&
			this.handles.get(handle.pendingId) === handle &&
			(!handle.editorSessionId ||
				this.editorRef.current?.getSessionId?.() === handle.editorSessionId) &&
			Number(handle.pendingId.split(":", 1)[0]) === this.sessionToken,
		)
	}

	private finish(handle: CanvasUploadMentionHandle): void {
		handle.active = false
		this.handles.delete(handle.pendingId)
	}
}

function createOpaqueId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID()
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getFileExtension(fileName: string): string {
	const index = fileName.lastIndexOf(".")
	return index >= 0 ? fileName.slice(index + 1) : ""
}

function getFileName(path: string): string {
	return path.split("/").filter(Boolean).pop() || path
}
