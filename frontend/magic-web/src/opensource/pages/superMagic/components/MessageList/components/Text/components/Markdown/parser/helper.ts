import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"

/**
 * 标准化路径用于对比
 * 处理各种路径格式和编码
 */
function normalizePathForComparison(path: string): string {
	if (!path) return ""

	let normalized = path.trim()

	// 尝试解码 URI，如果失败则使用原始值
	try {
		const decoded = decodeURI(normalized)
		normalized = decoded
	} catch {
		// 解码失败时保持原样
	}

	// 移除开头的 ./
	normalized = normalized.replace(/^\.\//, "/")

	// 确保开头有 /
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`
	}

	// 移除结尾的 / (除了根路径)
	if (normalized.length > 1 && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1)
	}

	return normalized
}

/**
 * 根据相对路径从附件列表中查找文件
 * @param attachments - 附件列表
 * @param relativePath - 相对路径 (例如: "./images/photo.png" 或 "/path/to/file.png")
 * @returns 找到的文件信息或 undefined
 */
export function findAttachmentByPath(
	attachments: AttachmentItem[],
	relativePath: string,
): AttachmentItem | undefined {
	if (!Array.isArray(attachments) || attachments.length === 0) {
		return undefined
	}

	const normalizedSearchPath = normalizePathForComparison(relativePath)

	for (const item of attachments) {
		// 递归搜索子节点
		if (item.children) {
			const found = findAttachmentByPath(item.children, relativePath)
			if (found) return found
		}

		// 检查 relative_file_path 是否匹配
		if (item.relative_file_path) {
			const normalizedItemPath = normalizePathForComparison(item.relative_file_path)
			if (normalizedItemPath === normalizedSearchPath) {
				return item
			}
		}

		// 也检查 path 字段作为备选
		if (item.path) {
			const normalizedItemPath = normalizePathForComparison(item.path)
			if (normalizedItemPath === normalizedSearchPath) {
				return item
			}
		}
	}

	return undefined
}
