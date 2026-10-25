import type { FileItem, TabItem } from "../types"

type OpenFilePayloadLike = Partial<FileItem> & {
	file_path?: unknown
}

export function normalizeAttachmentPath(path: unknown): string {
	return typeof path === "string" ? path.trim().replace(/^\/+/, "") : ""
}

function getOpenFilePath(file: OpenFilePayloadLike | undefined): string {
	return normalizeAttachmentPath(file?.relative_file_path || file?.file_path)
}

function getOpenFileName(file: OpenFilePayloadLike | undefined, fallbackPath = ""): string {
	return (
		file?.file_name ||
		file?.display_filename ||
		file?.filename ||
		fallbackPath.split("/").pop() ||
		"未命名文件"
	)
}

/** 判断当前文件是否为打开方声明的临时预览文件。 */
export function isTemporaryPreviewFile(file: Pick<FileItem, "display_config"> | null | undefined) {
	return file?.display_config?.previewPolicy?.temporary === true
}

/** 判断当前文件是否由调用方独立提供，不参与项目附件树解析。 */
export function isStandalonePreviewFile(file: Pick<FileItem, "display_config"> | null | undefined) {
	return file?.display_config?.previewPolicy?.standalone === true
}

/** 判断当前文件是否需要参与编辑状态上报和编辑冲突检测。 */
export function isEditingPresenceEnabled(
	displayConfig: FileItem["display_config"] | null | undefined,
) {
	return displayConfig?.previewPolicy?.editingPresence !== false
}

/** 判断当前预览文件是否允许发起文件分享。 */
export function isFileShareAllowed(displayConfig: FileItem["display_config"] | null | undefined) {
	return displayConfig?.previewPolicy?.allowShare !== false
}

/** 判断当前预览文件是否允许查看和切换历史版本。 */
export function isFileVersionHistoryAllowed(
	displayConfig: FileItem["display_config"] | null | undefined,
) {
	return displayConfig?.previewPolicy?.allowVersionHistory !== false
}

function isExplicitOpenFilePayload(file: OpenFilePayloadLike | undefined): file is FileItem {
	if (!file?.file_id || file.is_directory) return false

	const hasFileName = Boolean(file.file_name || file.display_filename || file.filename)
	const hasOpenContext = Boolean(
		file.relative_file_path ||
		file.file_url ||
		file.url ||
		file.content ||
		file.display_config ||
		file.file_extension,
	)

	return hasFileName && hasOpenContext
}

function isExplicitOpenFilePathPayload(
	file: OpenFilePayloadLike | undefined,
): file is OpenFilePayloadLike {
	if (!file || file.file_id || file.is_directory) return false

	const filePath = getOpenFilePath(file)
	if (!filePath) return false

	return Boolean(getOpenFileName(file, filePath))
}

function normalizePendingAttachmentSyncFile(file: FileItem): FileItem {
	return {
		...file,
		file_name: file.file_name || file.display_filename || file.filename || "未命名文件",
		display_config: {
			...(file.display_config || {}),
			previewPolicy: {
				...(file.display_config?.previewPolicy || {}),
				awaitAttachmentSync: true,
			},
		},
	}
}

function normalizePendingAttachmentPathSyncFile(file: OpenFilePayloadLike): FileItem {
	const filePath = getOpenFilePath(file)
	const fileName = getOpenFileName(file, filePath)

	return {
		...file,
		file_id: `pending-attachment-path:${filePath}`,
		file_name: fileName,
		relative_file_path: filePath,
		display_config: {
			...(file.display_config || {}),
			previewPolicy: {
				...(file.display_config?.previewPolicy || {}),
				awaitAttachmentSync: true,
				awaitAttachmentPath: filePath,
				persistTab: false,
				restoreAsActive: false,
			},
		},
	} as FileItem
}

/** Creates a loading-tab file while attachments are syncing. */
export function resolvePendingAttachmentFile({
	file,
	fileId,
	filePayload,
	isAwaitingProjectAttachments,
}: {
	file?: FileItem
	fileId?: string
	filePayload?: OpenFilePayloadLike
	isAwaitingProjectAttachments: boolean
}) {
	if (!isAwaitingProjectAttachments || !filePayload) return null

	if (!fileId && isExplicitOpenFilePathPayload(filePayload)) {
		return normalizePendingAttachmentPathSyncFile(filePayload)
	}

	if (!file && isExplicitOpenFilePayload(filePayload)) {
		return normalizePendingAttachmentSyncFile(filePayload)
	}

	return null
}

/** 按预览策略保留本地内容，其他文件仍按原链路延迟加载。 */
export function resolvePreviewContent(file: FileItem) {
	return file.display_config?.previewPolicy?.keepLocalContent === true
		? (file.content ?? null)
		: null
}

/** 判断当前预览是否参与附件树同步。 */
export function shouldSyncWithAttachments(
	file: Pick<FileItem, "display_config"> | null | undefined,
) {
	return file?.display_config?.previewPolicy?.syncWithAttachments !== false
}

/** 过滤可写入项目 tab 缓存的文件 tab。 */
export function resolvePersistableTabs(tabs: TabItem[]) {
	return tabs.filter(
		(tab) =>
			tab.fileData.space_type !== "user" &&
			tab.fileManager?.spaceType !== "user" &&
			tab.fileData.display_config?.previewPolicy?.persistTab !== false,
	)
}

/** 计算需要写入缓存的激活 tab，避免不可恢复的临时 tab 污染恢复状态。 */
export function resolvePersistedActiveTabId(persistableTabs: TabItem[], activeTab?: TabItem) {
	if (
		activeTab &&
		persistableTabs.some((tab) => tab.id === activeTab.id) &&
		activeTab.fileData.display_config?.previewPolicy?.restoreAsActive !== false
	) {
		return activeTab.id
	}

	let mostRecentTab = persistableTabs[0]

	for (const tab of persistableTabs) {
		const currentActiveAt = tab.active_at || tab.create_at || 0
		const mostRecentActiveAt = mostRecentTab?.active_at || mostRecentTab?.create_at || 0

		if (currentActiveAt > mostRecentActiveAt) {
			mostRecentTab = tab
		}
	}

	return mostRecentTab?.id
}
