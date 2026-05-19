import type { FileItem, TabItem } from "../types"

/** 判断当前文件是否为打开方声明的临时预览文件。 */
export function isTemporaryPreviewFile(file: Pick<FileItem, "display_config"> | null | undefined) {
	return file?.display_config?.previewPolicy?.temporary === true
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
	return tabs.filter((tab) => tab.fileData.display_config?.previewPolicy?.persistTab !== false)
}

/** 计算需要写入缓存的激活 tab，避免不可恢复的临时 tab 污染恢复状态。 */
export function resolvePersistedActiveTabId(persistableTabs: TabItem[], activeTab?: TabItem) {
	if (activeTab && activeTab.fileData.display_config?.previewPolicy?.restoreAsActive !== false) {
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
