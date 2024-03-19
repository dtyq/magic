import type { AttachmentItem } from "../hooks/types"
import { getExistingFilePaths } from "./duplicateFileHandler"

/**
 * 在文件树中递归查找指定 ID 的 AttachmentItem
 */
function findItemById(id: string, attachments: AttachmentItem[]): AttachmentItem | null {
	for (const item of attachments) {
		if (item.file_id === id) return item
		if (item.children) {
			const found = findItemById(id, item.children)
			if (found) return found
		}
	}
	return null
}

/**
 * 从源文件树中递归提取所有文件的相对路径
 *
 * 关键逻辑：
 * - 如果是文件：直接记录
 * - 如果是文件夹：递归提取所有子文件，构建完整相对路径
 *
 * @example
 * 输入：fileIds = ["folder_A_id"]
 * 文件夹 A 结构：
 *   - A/file1.txt (id: "file1_id")
 *   - A/B/file2.txt (id: "file2_id")
 *
 * 输出：
 * {
 *   "file1_id": { item: {...}, relativePath: "A/file1.txt" },
 *   "file2_id": { item: {...}, relativePath: "A/B/file2.txt" }
 * }
 */
function extractSourceFilesWithPaths(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
): Map<string, { item: AttachmentItem; relativePath: string }> {
	const result = new Map<string, { item: AttachmentItem; relativePath: string }>()

	// 递归收集文件夹内所有文件
	function collectFilesFromFolder(
		folder: AttachmentItem,
		basePath: string,
		result: Map<string, { item: AttachmentItem; relativePath: string }>,
	) {
		if (!folder.children) return

		folder.children.forEach((child) => {
			const childName = child.name || child.file_name || ""
			const childRelativePath = basePath ? `${basePath}/${childName}` : childName

			if (child.is_directory) {
				// 递归处理子文件夹
				collectFilesFromFolder(child, childRelativePath, result)
			} else {
				// 记录文件
				result.set(child.file_id, {
					item: child,
					relativePath: childRelativePath,
				})
			}
		})
	}

	// 处理每个 fileId
	fileIds.forEach((id) => {
		const item = findItemById(id, sourceAttachments)
		if (!item) return

		const itemName = item.name || item.file_name || ""

		if (item.is_directory) {
			// 文件夹：递归提取所有子文件
			collectFilesFromFolder(item, itemName, result)
		} else {
			// 单文件：直接记录
			result.set(item.file_id, {
				item: item,
				relativePath: itemName,
			})
		}
	})

	return result
}

/**
 * 将 AttachmentItem 数组转换为路径字符串
 * @example [{ name: "folder1" }, { name: "folder2" }] => "folder1/folder2"
 */
function buildTargetPathString(targetPath: AttachmentItem[]): string {
	return targetPath
		.map((item) => item.file_name || item.name || "")
		.filter(Boolean)
		.join("/")
}

/**
 * 检测要移动/复制的文件在目标路径下是否存在同名文件
 *
 * @param fileIds 要操作的文件/文件夹 ID 列表
 * @param sourceAttachments 源项目的完整文件树
 * @param targetAttachments 目标项目的完整文件树
 * @param targetPath 目标路径（AttachmentItem 数组）
 * @returns 冲突文件的映射 Map<fileId, { fileName, relativePath }>
 *
 * @example
 * 移动文件夹 A（包含 A/B/file.txt）到 /target/
 * 如果 /target/ 已存在 A/B/file.txt
 * 返回: { "file_id": { fileName: "file.txt", relativePath: "A/B/file.txt" } }
 */
export function detectDuplicateFilesForMove(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetPath: AttachmentItem[],
): Map<string, { fileName: string; relativePath: string }> {
	console.log("🔍 [detectDuplicateFilesForMove] 开始检测同名文件:", {
		fileIds,
		targetPathLength: targetPath.length,
	})

	// 1. 提取所有源文件的相对路径（递归展开文件夹）
	const sourceFilesMap = extractSourceFilesWithPaths(fileIds, sourceAttachments)
	console.log(
		"  ↳ 提取到的源文件:",
		Array.from(sourceFilesMap.entries()).map(([id, { relativePath }]) => ({
			id,
			relativePath,
		})),
	)

	// 2. 获取目标路径下所有已存在文件的相对路径
	const targetPathStr = buildTargetPathString(targetPath)
	console.log("  ↳ 目标路径字符串:", targetPathStr)

	const existingPaths = getExistingFilePaths(targetPathStr, targetAttachments)
	console.log("  ↳ 目标路径下已存在的文件:", Array.from(existingPaths.keys()))

	// 3. 比对找出冲突
	const duplicates = new Map<string, { fileName: string; relativePath: string }>()

	sourceFilesMap.forEach(({ item, relativePath }, fileId) => {
		if (existingPaths.has(relativePath)) {
			const fileName = item.name || item.file_name || ""
			console.log(`    ✓ 检测到冲突: fileId="${fileId}", relativePath="${relativePath}"`)
			duplicates.set(fileId, { fileName, relativePath })
		}
	})

	console.log("🔍 [detectDuplicateFilesForMove] 检测完成, 冲突数量:", duplicates.size)

	return duplicates
}
