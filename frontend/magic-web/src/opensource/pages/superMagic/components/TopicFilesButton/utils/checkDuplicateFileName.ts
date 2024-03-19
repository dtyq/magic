import type { AttachmentItem } from "../hooks/types"

/**
 * 检查文件或文件夹名是否重复
 * @param fileName 文件名或文件夹名
 * @param attachments 附件列表
 * @param parentPath 父路径（可选）
 * @param excludeId 要排除的项目ID（可选，用于重命名时排除自身）
 * @param getItemId 获取项目ID的函数（可选，用于排除逻辑）
 * @returns 是否重复
 */
export function checkDuplicateFileName(
	fileName: string,
	attachments: AttachmentItem[],
	parentPath?: string,
	excludeId?: string,
	getItemId?: (item: AttachmentItem) => string,
): boolean {
	// 获取当前目录下的文件列表
	const getCurrentDirItems = (): AttachmentItem[] => {
		// 如果没有指定父路径，返回根目录的项目
		if (!parentPath) {
			return attachments || []
		}

		// 递归查找指定路径的文件夹
		const findFolder = (
			items: AttachmentItem[],
			targetPath: string,
		): AttachmentItem[] | null => {
			for (const item of items) {
				if (item.is_directory && "children" in item) {
					const folderPath = item.relative_file_path || `/${item.name}`
					if (folderPath === targetPath) {
						return item.children || []
					}
					// 只在路径匹配的情况下递归搜索
					if (targetPath.startsWith(folderPath + "/")) {
						const result = findFolder(item.children || [], targetPath)
						if (result) return result
					}
				}
			}
			return null
		}

		return findFolder(attachments, parentPath) || []
	}

	const currentDirItems = getCurrentDirItems()

	// 只检查当前目录下的直接子项，不递归检查子目录
	return currentDirItems.some((item) => {
		// 排除指定的项目（用于重命名时排除自身）
		if (excludeId && getItemId) {
			const itemId = getItemId(item)
			if (itemId === excludeId) {
				return false
			}
		}

		if (item.is_directory) {
			// 检查文件夹名
			return item.name === fileName
		} else {
			// 检查文件名
			const currentFileName = item.file_name || item.filename || ""
			return currentFileName === fileName
		}
	})
}
