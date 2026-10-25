import type { FileManagerContext, FileManagerOpenRequest, TabItem } from "../types"

/** 管理器是界面 Tab，不能把它的标识当作文件 ID 发送给文件接口。 */
export function getFileManagerRequest(value: unknown): FileManagerContext | null {
	if (!value || typeof value !== "object" || !("file_manager" in value)) return null
	const context = (value as FileManagerOpenRequest).file_manager
	if (context?.spaceType === "user" && (context.view === "files" || context.view === "memory"))
		return context
	if (context?.spaceType === "project" && context.projectId) return context
	return null
}

export function createFileManagerTab(
	context: FileManagerContext,
	title: string,
	returnTabId?: string,
): TabItem {
	const isProjectRecycle = context.spaceType === "project" && context.area === "recycle"
	return {
		id: `file-manager:${context.spaceType}${isProjectRecycle ? ":recycle" : ""}`,
		type: "file_manager",
		title,
		active: true,
		closeable: true,
		returnTabId,
		fileManager: context,
		fileData: {
			file_id: "",
			file_name: title,
			display_config: {
				previewPolicy: {
					standalone: true,
					persistTab: true,
					restoreAsActive: true,
					syncWithAttachments: false,
					allowShare: false,
					allowVersionHistory: false,
				},
			},
		},
	}
}
