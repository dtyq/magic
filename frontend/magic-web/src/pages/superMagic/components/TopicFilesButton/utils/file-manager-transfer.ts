import type { AttachmentIndex } from "./attachmentIndex"

export const FILE_MANAGER_DRAG_MIME = "application/x-magic-file-manager"

export interface FileManagerTransfer {
	scopeKey: string
	fileIds: string[]
	mode: "move" | "copy"
}

let clipboard: FileManagerTransfer | null = null
let dragging: FileManagerTransfer | null = null
let identity: string | null = null
const listeners = new Set<() => void>()

/** 内部剪贴板只保存会话内文件 ID，不接管系统剪贴板或保存附件树。 */
export const fileManagerTransfer = {
	activateIdentity(value: string) {
		if (identity !== null && identity !== value) {
			this.setClipboard(null)
			dragging = null
		}
		identity = value
	},
	getClipboard: () => clipboard,
	setClipboard(value: FileManagerTransfer | null) {
		clipboard = value
		listeners.forEach((listener) => listener())
	},
	subscribe(listener: () => void) {
		listeners.add(listener)
		return () => {
			listeners.delete(listener)
		}
	},
	getDragging: () => dragging,
	setDragging(value: FileManagerTransfer | null) {
		dragging = value
	},
	completeMove(scopeKey: string, ids: string[]) {
		if (!clipboard || clipboard.scopeKey !== scopeKey) return
		const completed = new Set(ids)
		const fileIds = clipboard.fileIds.filter((id) => !completed.has(id))
		this.setClipboard(fileIds.length ? { ...clipboard, fileIds } : null)
	},
}

/** 父子项一起选中时只处理最上层，避免同一个后代被移动两次。 */
export function getFileManagerTransferIds(ids: Iterable<string>, index: AttachmentIndex): string[] {
	const selected = new Set(ids)
	return [...selected].filter((id) => {
		let entry = index.getEntryById(id)
		if (!entry) return false
		while (entry.parentKey) {
			entry = index.getEntryByKey(entry.parentKey)
			if (!entry) break
			if (entry.item.file_id && selected.has(entry.item.file_id)) return false
		}
		return true
	})
}

/** 顶层项的逻辑父级是当前空间根；不把服务端的 0 等根标记与 UI 根 ID 直接比较。 */
export function getFileManagerChangedIds(
	ids: Iterable<string>,
	index: AttachmentIndex,
	rootId: string,
	targetId: string,
	mode: "move" | "copy",
): string[] {
	return getFileManagerTransferIds(ids, index).filter(
		(id) => mode === "copy" || (index.getParentItemById(id)?.file_id ?? rootId) !== targetId,
	)
}
