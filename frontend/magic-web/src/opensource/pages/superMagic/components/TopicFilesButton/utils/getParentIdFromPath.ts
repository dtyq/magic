import { trim } from "lodash-es"
import { ROOT_FILE_ID } from "../constant"
import { AttachmentItem } from "../hooks"

// 获取父文件夹ID - 从路径中解析
export const getParentIdFromPath = (
	attachments?: AttachmentItem[],
	parentPath?: string,
): string | number | undefined => {
	// 兜底为根路径
	const defaultParentPath = ROOT_FILE_ID
	if (!parentPath || !attachments) return defaultParentPath

	const _parentPath = trim(parentPath, "/")

	// 移除开头的 '/' 并分割路径
	const pathParts = _parentPath.split("/")
	let currentItems = attachments

	// 遍历路径找到对应的文件夹
	for (let i = 0; i < pathParts.length; i++) {
		const part = pathParts[i]
		const foundItem = currentItems.find(
			(item) => item.is_directory && (item.file_name === part || item.name === part),
		)
		if (!foundItem || !foundItem.children) {
			return defaultParentPath
		}
		if (i === pathParts.length - 1) {
			// 最后一级，返回文件夹ID
			return foundItem.file_id || defaultParentPath
		}
		currentItems = foundItem.children as AttachmentItem[]
	}
	return defaultParentPath
}
