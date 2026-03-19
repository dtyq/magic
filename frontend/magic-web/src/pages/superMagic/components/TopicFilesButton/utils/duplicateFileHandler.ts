import type { AttachmentItem } from "../hooks/types"

/**
 * 从文件列表中提取公共的文件夹路径前缀
 * 用于文件夹上传时确定实际的目标路径
 *
 * @example
 * files = [File(webkitRelativePath: "A/index.html"), File(webkitRelativePath: "A/src/app.js")]
 * returns "A"
 */
export function extractCommonFolderPath(files: File[]): string {
	if (files.length === 0) return ""

	// 获取第一个文件的 webkitRelativePath
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const firstPath = (files[0] as any).webkitRelativePath || ""

	// 如果没有 webkitRelativePath，说明不是文件夹上传
	if (!firstPath) return ""

	// 提取第一层文件夹名称
	const firstSlashIndex = firstPath.indexOf("/")
	if (firstSlashIndex === -1) return ""

	const commonFolderName = firstPath.substring(0, firstSlashIndex)

	// 验证所有文件都在同一个文件夹下
	const allInSameFolder = files.every((file) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const path = (file as any).webkitRelativePath || ""
		return path.startsWith(commonFolderName + "/")
	})

	return allInSameFolder ? commonFolderName : ""
}

/**
 * 解析文件名，分离文件名和扩展名
 */
export function parseFileName(fileName: string): { name: string; ext: string } {
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex === -1 || lastDotIndex === 0) {
		return { name: fileName, ext: "" }
	}
	return {
		name: fileName.slice(0, lastDotIndex),
		ext: fileName.slice(lastDotIndex),
	}
}

/**
 * 生成唯一文件名
 * 如果文件名已存在，则生成 filename(1).ext, filename(2).ext 等格式
 */
export function generateUniqueFileName(originalName: string, existingNames: Set<string>): string {
	console.log(
		`      🔹 [generateUniqueFileName] 输入: originalName="${originalName}", existingNames=`,
		Array.from(existingNames),
	)

	if (!existingNames.has(originalName)) {
		console.log(`      🔹 文件名不存在，直接返回: "${originalName}"`)
		return originalName
	}

	console.log(`      🔹 文件名已存在，开始生成唯一名称`)

	const { name, ext } = parseFileName(originalName)
	let counter = 1
	let newName = `${name}(${counter})${ext}`

	while (existingNames.has(newName)) {
		counter++
		newName = `${name}(${counter})${ext}`
	}

	console.log(`      🔹 生成唯一名称: "${newName}"`)
	return newName
}

/**
 * 根据目标路径查找目标文件夹中的所有文件相对路径
 * 返回格式：相对路径 -> 文件名的映射
 * 例如：{ "B/C.txt": "C.txt", "index.html": "index.html" }
 */
export function getExistingFilePaths(
	targetPath: string,
	attachments: AttachmentItem[],
): Map<string, string> {
	const existingPaths = new Map<string, string>()

	// 递归收集所有文件的相对路径
	function collectFilePaths(items: AttachmentItem[], currentRelativePath: string = "") {
		items.forEach((item) => {
			const fileName = item.file_name || item.filename || item.name || ""
			if (!fileName) return

			const itemRelativePath = currentRelativePath
				? `${currentRelativePath}/${fileName}`
				: fileName

			if (item.is_directory) {
				// 递归处理子文件夹
				if (item.children && item.children.length > 0) {
					collectFilePaths(item.children, itemRelativePath)
				}
			} else {
				// 添加文件的相对路径
				existingPaths.set(itemRelativePath, fileName)
			}
		})
	}

	// 如果是根目录上传
	if (!targetPath || targetPath === "/" || targetPath === "") {
		collectFilePaths(attachments)
		return existingPaths
	}

	// 清理路径：移除前导和尾随斜杠
	const cleanPath = targetPath.replace(/^\/+|\/+$/g, "")
	const pathParts = cleanPath.split("/").filter(Boolean)

	// 递归查找目标文件夹
	function findTargetFolder(items: AttachmentItem[], parts: string[]): AttachmentItem | null {
		if (parts.length === 0) return null

		for (const item of items) {
			if (item.is_directory) {
				const itemName = item.file_name || item.name || ""
				if (itemName === parts[0]) {
					if (parts.length === 1) {
						// 找到目标文件夹
						return item
					}
					// 继续在子文件夹中查找
					if (item.children && item.children.length > 0) {
						return findTargetFolder(item.children, parts.slice(1))
					}
				}
			}
		}
		return null
	}

	const targetFolder = findTargetFolder(attachments, pathParts)

	if (targetFolder && targetFolder.children) {
		// 递归收集目标文件夹下的所有文件路径
		collectFilePaths(targetFolder.children)
	}

	return existingPaths
}

/**
 * 根据目标路径查找目标文件夹中的所有文件名（兼容旧逻辑，只返回直接子文件）
 * @deprecated 建议使用 getExistingFilePaths 以支持嵌套文件检测
 */
export function getExistingFileNames(
	targetPath: string,
	attachments: AttachmentItem[],
): Set<string> {
	const existingNames = new Set<string>()

	// 如果是根目录上传
	if (!targetPath || targetPath === "/" || targetPath === "") {
		attachments.forEach((item) => {
			if (!item.is_directory) {
				const fileName = item.file_name || item.filename || item.name || ""
				if (fileName) {
					existingNames.add(fileName)
				}
			}
		})
		return existingNames
	}

	// 清理路径：移除前导和尾随斜杠
	const cleanPath = targetPath.replace(/^\/+|\/+$/g, "")
	const pathParts = cleanPath.split("/").filter(Boolean)

	// 递归查找目标文件夹
	function findTargetFolder(items: AttachmentItem[], parts: string[]): AttachmentItem | null {
		if (parts.length === 0) return null

		for (const item of items) {
			if (item.is_directory) {
				const itemName = item.file_name || item.name || ""
				if (itemName === parts[0]) {
					if (parts.length === 1) {
						// 找到目标文件夹
						return item
					}
					// 继续在子文件夹中查找
					if (item.children && item.children.length > 0) {
						return findTargetFolder(item.children, parts.slice(1))
					}
				}
			}
		}
		return null
	}

	const targetFolder = findTargetFolder(attachments, pathParts)

	if (targetFolder && targetFolder.children) {
		targetFolder.children.forEach((item) => {
			if (!item.is_directory) {
				const fileName = item.file_name || item.filename || item.name || ""
				if (fileName) {
					existingNames.add(fileName)
				}
			}
		})
	}

	return existingNames
}

/**
 * 提取文件的相对路径（从 webkitRelativePath 中提取，去除第一层文件夹名）
 * @example
 * webkitRelativePath: "A/B/C.txt" -> "B/C.txt"
 * webkitRelativePath: "A/index.html" -> "index.html"
 * webkitRelativePath: "" -> "" (单文件上传)
 */
function extractFileRelativePath(file: File): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const webkitPath = (file as any).webkitRelativePath || ""

	if (!webkitPath) {
		// 单文件上传，没有相对路径
		return file.name
	}

	// 移除第一层文件夹名称（因为 targetPath 已经包含了）
	const firstSlashIndex = webkitPath.indexOf("/")
	if (firstSlashIndex === -1) {
		return file.name
	}

	return webkitPath.substring(firstSlashIndex + 1)
}

/**
 * 检测待上传文件中的同名文件（支持嵌套路径检测）
 * 返回同名文件的映射：文件相对路径 -> File 对象
 */
export function detectDuplicateFiles(
	files: File[],
	targetPath: string,
	attachments: AttachmentItem[],
): Map<string, File> {
	console.log("🔍 [detectDuplicateFiles] 开始检测同名文件:", {
		targetPath,
		filesCount: files.length,
	})

	// 获取目标路径下所有已存在文件的相对路径
	const existingPaths = getExistingFilePaths(targetPath, attachments)
	console.log("  ↳ 已存在的文件路径:", Array.from(existingPaths.keys()))

	const duplicates = new Map<string, File>()

	files.forEach((file) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const webkitPath = (file as any).webkitRelativePath || ""

		// 获取文件的相对路径
		const fileRelativePath = extractFileRelativePath(file)

		console.log(
			`  ↳ 检查文件: name="${file.name}", webkitPath="${webkitPath}", extractedPath="${fileRelativePath}"`,
		)

		// 检查是否存在同名文件（比较相对路径）
		if (existingPaths.has(fileRelativePath)) {
			console.log(`    ✓ 检测到同名: "${fileRelativePath}"`)
			// 使用相对路径作为 key，以便后续显示完整路径
			duplicates.set(fileRelativePath, file)
		} else {
			console.log(`    ✗ 未检测到同名`)
		}
	})

	console.log("🔍 [detectDuplicateFiles] 检测完成, 同名文件:", Array.from(duplicates.keys()))

	return duplicates
}

/**
 * 创建新的 File 对象（重命名）
 * 保留原文件的 webkitRelativePath，只更新文件名部分
 */
export function renameFile(file: File, newName: string): File {
	const newFile = new File([file], newName, {
		type: file.type,
		lastModified: file.lastModified,
	})

	// 保留并更新 webkitRelativePath
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const originalPath = (file as any).webkitRelativePath || ""

	if (originalPath) {
		// 更新路径中的文件名部分，保持目录结构
		const lastSlashIndex = originalPath.lastIndexOf("/")
		const newPath =
			lastSlashIndex === -1
				? newName // 没有路径，直接使用新文件名
				: `${originalPath.substring(0, lastSlashIndex + 1)}${newName}` // 保留路径部分，更新文件名

		console.log("🔄 [renameFile] 重命名文件:", {
			originalName: file.name,
			newName,
			originalPath,
			newPath,
		})

		// 设置新的 webkitRelativePath
		try {
			Object.defineProperty(newFile, "webkitRelativePath", {
				value: newPath,
				writable: false,
				enumerable: true,
				configurable: true,
			})
		} catch (error) {
			console.warn("Failed to set webkitRelativePath:", error)
		}
	}

	return newFile
}

/**
 * 批量重命名文件
 * @param files 原始文件列表
 * @param renameMap 重命名映射：原文件名 -> 新文件名
 * @returns 重命名后的文件列表
 */
export function renameFilesForUpload(files: File[], renameMap: Map<string, string>): File[] {
	console.log("🔄 [renameFilesForUpload] 开始批量重命名:", {
		filesCount: files.length,
		renameMapSize: renameMap.size,
		renameMapEntries: Array.from(renameMap.entries()),
	})

	return files.map((file) => {
		// 获取文件的相对路径
		const fileRelativePath = extractFileRelativePath(file)

		// 检查是否需要重命名
		const newName = renameMap.get(fileRelativePath)
		if (newName && newName !== file.name) {
			console.log(`  ↳ 重命名: ${fileRelativePath} -> ${newName}`)
			return renameFile(file, newName)
		}
		return file
	})
}

/**
 * 为所有同名文件生成唯一文件名（支持嵌套路径）
 * @param duplicateFiles 同名文件映射（key 是相对路径）
 * @param targetPath 目标路径
 * @param atta
			chments 现有文件列表,
		
 * @returns 重命名映射：相对路径 -> 新文件名
 */
export function generateRenameMapForDuplicates(
	duplicateFiles: Map<string, File>,
	targetPath: string,
	attachments: AttachmentItem[],
): Map<string, string> {
	console.log("🔄 [generateRenameMapForDuplicates] 开始生成重命名映射:", {
		targetPath,
		duplicatesCount: duplicateFiles.size,
		duplicateKeys: Array.from(duplicateFiles.keys()),
		duplicateFiles: Array.from(duplicateFiles.entries()),
	})

	// 获取所有已存在的文件路径
	const existingPaths = getExistingFilePaths(targetPath, attachments)
	console.log("  ↳ 已存在的文件路径:", Array.from(existingPaths.entries()))

	const renameMap = new Map<string, string>()

	// 为了确保连续编号，需要考虑当前批次中的文件
	// 按相对路径分组，构建每个路径下的文件名集合
	const pathFileNames = new Map<string, Set<string>>()

	// 初始化：收集现有文件
	existingPaths.forEach((fileName, relativePath) => {
		// 提取路径部分（去除文件名）
		const lastSlashIndex = relativePath.lastIndexOf("/")
		const pathPart = lastSlashIndex === -1 ? "" : relativePath.substring(0, lastSlashIndex)

		console.log(
			`  ↳ 收集现有文件: relativePath="${relativePath}", fileName="${fileName}", pathPart="${pathPart}"`,
		)

		if (!pathFileNames.has(pathPart)) {
			pathFileNames.set(pathPart, new Set())
		}
		const existingSet = pathFileNames.get(pathPart) || new Set<string>()
		existingSet.add(fileName)
		pathFileNames.set(pathPart, existingSet)
	})

	console.log(
		"  ↳ 按路径分组的文件名集合:",
		Array.from(pathFileNames.entries()).map(([path, set]) => [path, Array.from(set)]),
	)

	duplicateFiles.forEach((file, fileRelativePath) => {
		// 提取路径部分和文件名部分
		const lastSlashIndex = fileRelativePath.lastIndexOf("/")
		const pathPart = lastSlashIndex === -1 ? "" : fileRelativePath.substring(0, lastSlashIndex)
		const fileName =
			lastSlashIndex === -1
				? fileRelativePath
				: fileRelativePath.substring(lastSlashIndex + 1)

		console.log(
			`  ↳ 处理重复文件: fileRelativePath="${fileRelativePath}", pathPart="${pathPart}", fileName="${fileName}"`,
		)

		// 获取该路径下的所有文件名
		if (!pathFileNames.has(pathPart)) {
			pathFileNames.set(pathPart, new Set())
		}
		const existingNamesInPath = pathFileNames.get(pathPart) || new Set<string>()

		console.log(`    → 该路径下已有文件名:`, Array.from(existingNamesInPath))

		// 生成唯一文件名
		const newName = generateUniqueFileName(fileName, existingNamesInPath)
		console.log(`    → 生成新文件名: "${fileName}" -> "${newName}"`)

		renameMap.set(fileRelativePath, newName)

		// 将新文件名加入集合，避免后续文件生成相同的名称
		existingNamesInPath.add(newName)
		pathFileNames.set(pathPart, existingNamesInPath)
	})

	console.log(
		"🔄 [generateRenameMapForDuplicates] 最终重命名映射:",
		Array.from(renameMap.entries()),
	)

	return renameMap
}
