import { ShareType } from "./types"
import { findFileInTree, calculateActualFileCount } from "./FileSelector/utils"

interface HandleShareTypeChangeOptions {
	currentType: ShareType
	newType: ShareType
	onConfirm: (newType: ShareType) => void
}

/**
 * 递归查找数组中第一个实际文件 (非文件夹)
 * 用于只选中文件夹时，找到第一个实际文件用于显示名称
 */
export function findFirstActualFile(items: any[]): any | null {
	for (const item of items) {
		// 如果是文件，直接返回
		if (!item.is_directory) {
			return item
		}
		// 如果是文件夹，递归查找子级
		if (item.children && Array.isArray(item.children) && item.children.length > 0) {
			const found = findFirstActualFile(item.children)
			if (found) return found
		}
	}
	return null
}

/**
 * 计算分享名称的默认值
 * - 项目分享: 项目分享_{项目名称}
 * - 单文件分享: 文件分享_{文件名称}
 * - 多文件分享: 文件分享_{主入口文件名称} 等 n 个文件
 */
export function calculateDefaultShareName(
	defaultOpenFileId: string | undefined,
	selectedFiles: Array<{ name?: string; fileName?: string }>,
	attachments: Array<{ name?: string; fileName?: string }>,
	t: (key: string, options?: Record<string, unknown>) => string,
	shareProject?: boolean,
	projectName?: string,
): string {
	// 如果是项目分享，返回"项目分享_{项目名称}"
	if (shareProject) {
		return t("share.projectShareName", {
			projectName: projectName || t("common.untitledProject"),
		}) as string
	}

	if (!selectedFiles || selectedFiles.length === 0) {
		return ""
	}

	if (selectedFiles.length === 1) {
		// 单文件分享: 文件分享_文件名称
		const fileName = selectedFiles[0].name || selectedFiles[0].fileName || t("share.untitled")
		return t("share.singleFileShareName", {
			fileName,
		}) as string
	}

	// 多文件分享: 文件分享_主入口文件名称 等 n 个文件
	let mainFileName = t("share.untitled")

	// 优先使用 defaultOpenFileId 对应的文件名
	if (defaultOpenFileId && attachments && attachments.length > 0) {
		const mainFile = findFileInTree(attachments, defaultOpenFileId)
		if (mainFile) {
			mainFileName = (mainFile.name || mainFile.fileName || t("share.untitled")) as string
		}
	} else if (selectedFiles.length > 0) {
		// 关键修复: 过滤掉文件夹，只从实际文件中选择主文件名
		// 因为 selectedFiles 可能包含文件夹，但文件夹不应该用于显示名称
		const actualFiles = selectedFiles.filter((file: any) => !file.is_directory)

		if (actualFiles.length > 0) {
			// 使用第一个实际文件的名称
			mainFileName = actualFiles[0].name || actualFiles[0].fileName || t("share.untitled")
		} else {
			// 如果只选中了文件夹，需要递归查找第一个实际文件
			for (const folder of selectedFiles) {
				if (
					(folder as any).is_directory &&
					(folder as any).children &&
					Array.isArray((folder as any).children)
				) {
					const firstFile = findFirstActualFile((folder as any).children)
					if (firstFile) {
						mainFileName = firstFile.name || firstFile.fileName || t("share.untitled")
						break
					}
				}
			}
		}
	}

	// 使用 calculateActualFileCount 递归计算实际文件数量
	const actualFileCount = calculateActualFileCount(selectedFiles as any[])

	return t("share.multiFileShareName", {
		mainFileName,
		count: actualFileCount, // 使用递归计算的实际文件数
	}) as string
}

/**
 * Generate a random password for share
 * @returns 6-character uppercase alphanumeric password
 */
export function generateSharePassword(): string {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	let result = ""
	for (let i = 0; i < 6; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length))
	}
	return result
}

/**
 * Handle share type change
 * Used by both Modal.tsx (topic sharing) and FileShareModal.tsx (file sharing)
 */
export function handleShareTypeChangeWithConfirm({
	currentType,
	newType,
	onConfirm,
}: HandleShareTypeChangeOptions) {
	if (newType === currentType) return

	// 所有分享类型切换都直接切换，不需要确认
	onConfirm(newType)
}
