import { getFileContentById } from "@/pages/superMagic/utils/api"
import { flattenAttachments, findMatchingFile } from "../../HTML/utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { DesignData } from "../types"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import type { LayerElement } from "@/components/CanvasDesign/canvas/types"
import { t } from "i18next"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

/**
 * magic.project.js 文件信息
 */
export interface MagicProjectJsFileInfo {
	fileId: string
	content: string
}

/**
 * 统一读取 magic.project.js 文件内容的函数（已知 fileId）
 * 包含重试机制和错误处理
 * @param fileId 文件 ID
 * @param options 可选参数
 * @param options.file_versions 文件版本映射（用于读取历史版本）
 * @returns 文件内容字符串
 * @throws 如果内容为空（重试后仍为空）则抛出错误
 */
export async function loadMagicProjectJsContent(
	fileId: string,
	options?: {
		file_versions?: Record<string, number>
	},
): Promise<string> {
	if (!fileId) {
		throw new Error(t("design.errors.fileIdRequired", { ns: "super" }))
	}

	const maxRetries = 1
	let content: string | null = null
	let retryCount = 0

	while (retryCount <= maxRetries) {
		content = (await getFileContentById(fileId, {
			responseType: "text",
			file_versions: options?.file_versions,
		})) as string | null

		// 检查内容是否为空
		const isEmpty = !content || (typeof content === "string" && content.trim().length === 0)

		if (!isEmpty) {
			// 内容不为空，返回结果
			return content as string
		}

		// 内容为空，检查是否需要重试
		if (retryCount < maxRetries) {
			// 等待1秒后重试
			await new Promise((resolve) => setTimeout(resolve, 1000))
			retryCount++
		} else {
			// 已达到最大重试次数，仍然为空，抛出错误
			throw new Error(t("design.errors.fileContentEmpty", { ns: "super" }))
		}
	}

	// 理论上不会执行到这里，但为了类型安全，抛出错误
	throw new Error(t("design.errors.fileContentEmptyUnknown", { ns: "super" }))
}

/**
 * 将 designData 转换为 magic.project.js 文件内容
 */
export function generateMagicProjectJsContent(designData: DesignData): string {
	const config = {
		version: designData.version || "1.0.0",
		type: designData.type || "design",
		name: designData.name || "",
		canvas: {
			elements: designData.canvas?.elements || [],
		},
	}

	// 将对象转换为格式化的 JSON 字符串，然后包装成 JavaScript 代码
	const jsonString = JSON.stringify(config, null, "\t")
	const result = `window.magicProjectConfig = ${jsonString};`

	return result
}

/**
 * 从 magic.project.js 文件内容中解析出 designData
 * @param content magic.project.js 文件的内容
 * @returns 解析后的 DesignData，如果解析失败则返回 null
 */
export function parseMagicProjectJsContent(content: string): DesignData | null {
	if (!content) {
		return null
	}

	try {
		// 创建一个临时的 window 对象来执行代码，避免污染全局作用域
		const tempWindow: { magicProjectConfig?: unknown } = {}

		// 使用 Function 构造函数来执行代码
		const func = new Function("window", content)
		func(tempWindow)

		// 提取 magicProjectConfig
		const config = tempWindow.magicProjectConfig

		if (!config || typeof config !== "object") {
			return null
		}

		// 转换为 DesignData 格式
		const designData: DesignData = {
			type: (config as { type?: string }).type || "design",
			name: (config as { name?: string }).name || "",
			version: (config as { version?: string }).version || "1.0.0",
			canvas: {
				elements:
					(config as { canvas?: { elements?: LayerElement[] } }).canvas?.elements || [],
			},
		}

		return designData
	} catch (error) {
		return null
	}
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 替换路径中的目录名称
 * @param path 路径字符串
 * @param oldDirName 旧目录名称
 * @param newDirName 新目录名称
 * @returns 替换后的路径
 */
function replaceDirectoryNameInPath(path: string, oldDirName: string, newDirName: string): string {
	if (!path || !oldDirName || !newDirName || oldDirName === newDirName) {
		return path
	}

	// 转义旧目录名中的特殊字符，用于正则表达式匹配
	const escapedOldDirName = escapeRegExp(oldDirName)

	// 替换路径中的目录名称
	// 支持以下格式：
	// - /旧目录名/images/xxx.jpg -> /新目录名/images/xxx.jpg
	// - 旧目录名/images/xxx.jpg -> 新目录名/images/xxx.jpg
	// - /旧目录名/ -> /新目录名/
	// - 路径中间也可能出现：/some/path/旧目录名/images/xxx.jpg -> /some/path/新目录名/images/xxx.jpg

	let updatedPath = path

	// 按优先级顺序替换，确保精确匹配
	// 1. 以 / 开头的路径，目录名在开头：/旧目录名/xxx
	if (updatedPath.startsWith(`/${oldDirName}/`)) {
		updatedPath = updatedPath.replace(
			new RegExp(`^/${escapedOldDirName}/`, "g"),
			`/${newDirName}/`,
		)
		return updatedPath
	}

	// 2. 不以 / 开头的路径，目录名在开头：旧目录名/xxx
	if (updatedPath.startsWith(`${oldDirName}/`)) {
		updatedPath = updatedPath.replace(
			new RegExp(`^${escapedOldDirName}/`, "g"),
			`${newDirName}/`,
		)
		return updatedPath
	}

	// 3. 以 / 开头的完整路径：/旧目录名
	if (updatedPath === `/${oldDirName}`) {
		return `/${newDirName}`
	}

	// 4. 不以 / 开头的完整路径：旧目录名
	if (updatedPath === oldDirName) {
		return newDirName
	}

	// 5. 路径中间出现的目录名（前后都有 /）：/xxx/旧目录名/xxx
	const beforeMiddle = updatedPath
	updatedPath = updatedPath.replace(new RegExp(`/${escapedOldDirName}/`, "g"), `/${newDirName}/`)
	if (beforeMiddle !== updatedPath) {
		return updatedPath
	}

	// 6. 路径末尾的目录名（前面有 /）：/xxx/旧目录名
	const beforeEnd = updatedPath
	updatedPath = updatedPath.replace(new RegExp(`/${escapedOldDirName}$`, "g"), `/${newDirName}`)
	if (beforeEnd !== updatedPath) {
		return updatedPath
	}

	return updatedPath
}

/**
 * 递归替换元素中的路径字段
 * @param element 元素对象
 * @param oldDirName 旧目录名称
 * @param newDirName 新目录名称
 * @returns 是否进行了替换
 */
function replacePathsInElement(
	element: Record<string, unknown>,
	oldDirName: string,
	newDirName: string,
): boolean {
	if (!element || typeof element !== "object") {
		return false
	}

	let hasReplaced = false

	// 处理 ImageElement
	if (element.type === "image") {
		// 替换 src 字段中的路径
		if (element.src && typeof element.src === "string") {
			const originalSrc = element.src as string
			const newSrc = replaceDirectoryNameInPath(originalSrc, oldDirName, newDirName)

			if (newSrc !== originalSrc) {
				element.src = newSrc
				hasReplaced = true
			}
		}

		// 处理 generateImageRequest
		const generateImageRequest = element.generateImageRequest as
			| {
				file_dir?: string
				reference_images?: string[]
			}
			| undefined

		if (generateImageRequest && typeof generateImageRequest === "object") {
			// 替换 file_dir 字段
			if (
				generateImageRequest.file_dir &&
				typeof generateImageRequest.file_dir === "string"
			) {
				const newFileDir = replaceDirectoryNameInPath(
					generateImageRequest.file_dir,
					oldDirName,
					newDirName,
				)
				if (newFileDir !== generateImageRequest.file_dir) {
					generateImageRequest.file_dir = newFileDir
					hasReplaced = true
				}
			}

			// 替换 reference_images 数组中的路径
			if (
				Array.isArray(generateImageRequest.reference_images) &&
				generateImageRequest.reference_images.length > 0
			) {
				const originalRefs = [...generateImageRequest.reference_images]
				generateImageRequest.reference_images = generateImageRequest.reference_images.map(
					(ref: string) => replaceDirectoryNameInPath(ref, oldDirName, newDirName),
				)

				// 检查是否有变化
				const hasChanged = originalRefs.some(
					(ref, index) => ref !== generateImageRequest.reference_images?.[index],
				)
				if (hasChanged) {
					hasReplaced = true
				}
			}
		}
	}

	// 递归处理子元素（Frame、Group 等）
	if (Array.isArray(element.children)) {
		for (const child of element.children) {
			if (replacePathsInElement(child, oldDirName, newDirName)) {
				hasReplaced = true
			}
		}
	}

	return hasReplaced
}

/**
 * 替换 magic.project.js 文件内容中的路径字段
 * 智能识别包含路径的字段，只替换这些字段中的目录名称
 * @param content magic.project.js 文件的内容
 * @param oldName 旧的目录名称
 * @param newName 新的目录名称
 * @returns 替换后的文件内容
 */
export function replaceNameInMagicProjectJsContent(
	content: string,
	oldName: string,
	newName: string,
): string {
	if (!content || !oldName || !newName || oldName === newName) {
		return content
	}

	try {
		// 解析 magic.project.js 内容
		const tempWindow: {
			magicProjectConfig?: {
				name?: string
				canvas?: {
					elements?: LayerElement[]
				}
			}
		} = {}
		const func = new Function("window", content)
		func(tempWindow)

		const config = tempWindow.magicProjectConfig
		if (!config || typeof config !== "object") {
			return content
		}

		let hasReplaced = false

		// 1. 替换顶层 name 字段
		if (config.name === oldName) {
			config.name = newName
			hasReplaced = true
		}

		// 2. 递归替换 canvas.elements 中所有 ImageElement 的路径字段
		if (config.canvas?.elements && Array.isArray(config.canvas.elements)) {
			for (let i = 0; i < config.canvas.elements.length; i++) {
				const element = config.canvas.elements[i]
				const elementRecord = element as unknown as Record<string, unknown>

				if (replacePathsInElement(elementRecord, oldName, newName)) {
					hasReplaced = true
				}
			}
		}

		if (!hasReplaced) {
			return content
		}

		// 重新生成文件内容，保持格式一致
		const jsonString = JSON.stringify(config, null, "\t")
		const updatedContent = `window.magicProjectConfig = ${jsonString};`

		return updatedContent
	} catch (error) {
		// 如果解析失败，返回原内容
		return content
	}
}

/**
 * 从 attachments 中提取 metadata 中的设计数据（用于分享场景）
 * @param attachments 附件列表
 * @param currentFileId 当前文件 ID
 * @returns 如果找到 metadata.canvas 数据，返回 DesignData，否则返回 null
 */
export function extractDesignDataFromMetadata(
	attachments: FileItem[],
	currentFileId: string,
): DesignData | null {
	if (!attachments || !currentFileId) {
		return null
	}

	try {
		// 扁平化附件列表以便查找
		const flatAttachments = flattenAttachmentsList(attachments)

		// 查找当前文件
		const currentFile = flatAttachments.find((item: FileItem) => item.file_id === currentFileId)
		if (!currentFile) {
			return null
		}

		// 如果当前文件是目录，检查其 metadata
		if (currentFile.is_directory && currentFile.metadata) {
			const metadata = currentFile.metadata as {
				version?: string
				type?: string
				name?: string
				canvas?: { elements?: LayerElement[] }
			}

			// 检查是否有 canvas 数据
			if (metadata.canvas && Array.isArray(metadata.canvas.elements)) {
				return {
					type: metadata.type || "design",
					name: metadata.name || "",
					version: metadata.version || "1.0.0",
					canvas: {
						elements: metadata.canvas.elements || [],
					},
				}
			}
		}

		// 如果当前文件不是目录，尝试查找其父目录的 metadata
		const currentFileWithParent = currentFile as FileItem & { parent_id?: string }
		if (currentFileWithParent.parent_id) {
			const parentId = currentFileWithParent.parent_id
			const parentFolder = flatAttachments.find(
				(item: FileItem) => item.file_id === parentId && item.is_directory,
			)

			if (parentFolder?.metadata) {
				const metadata = parentFolder.metadata as {
					version?: string
					type?: string
					name?: string
					canvas?: { elements?: LayerElement[] }
				}

				if (metadata.canvas && Array.isArray(metadata.canvas.elements)) {
					return {
						type: metadata.type || "design",
						name: metadata.name || "",
						version: metadata.version || "1.0.0",
						canvas: {
							elements: metadata.canvas.elements || [],
						},
					}
				}
			}
		}

		return null
	} catch (error) {
		return null
	}
}

/**
 * 查找同目录下的 magic.project.js 文件
 */
export async function findMagicProjectJsFile(params: {
	attachments: FileItem[]
	currentFileId: string
	currentFileName: string
}): Promise<MagicProjectJsFileInfo | null> {
	const { attachments, currentFileId, currentFileName } = params

	if (!attachments || !currentFileId || !currentFileName) {
		return null
	}

	try {
		// 扁平化附件列表以便查找
		const flatAttachments = flattenAttachmentsList(attachments)

		// 获取当前文件信息
		const currentFile = flatAttachments.find((item: FileItem) => item.file_id === currentFileId)
		if (!currentFile) {
			return null
		}

		const currentFileWithParent = currentFile as FileItem & { parent_id?: string }

		// 方法1: 如果当前文件是目录，直接使用其路径作为文件夹路径（最高优先级）
		let fileRelativeFolderPath: string | null = null
		if (currentFile.is_directory && currentFile.relative_file_path) {
			fileRelativeFolderPath = currentFile.relative_file_path
			// 确保以 / 结尾
			if (!fileRelativeFolderPath.endsWith("/")) {
				fileRelativeFolderPath = fileRelativeFolderPath + "/"
			}
		}
		// 方法2: 如果当前文件不是目录，使用 parent_id 查找父目录（最可靠）
		else if (currentFileWithParent.parent_id) {
			const parentId = currentFileWithParent.parent_id
			const parentFolder = flatAttachments.find(
				(item: FileItem) => item.file_id === parentId && item.is_directory,
			)
			if (parentFolder?.relative_file_path) {
				fileRelativeFolderPath = parentFolder.relative_file_path
				// 确保以 / 结尾
				if (!fileRelativeFolderPath.endsWith("/")) {
					fileRelativeFolderPath = fileRelativeFolderPath + "/"
				}
			}
		}

		// 方法3: 如果方法1和2都失败，从 relative_file_path 提取目录
		if (!fileRelativeFolderPath && currentFile.relative_file_path) {
			const relativePath = currentFile.relative_file_path
			const fileName = currentFile.file_name || currentFileName

			// 如果路径以 / 结尾，可能是目录路径
			if (relativePath.endsWith("/")) {
				// 检查是否是 /文件名/ 格式
				if (relativePath.endsWith("/" + fileName + "/")) {
					// 移除末尾的 /文件名/
					fileRelativeFolderPath = relativePath.slice(
						0,
						relativePath.length - fileName.length - 1,
					)
					if (!fileRelativeFolderPath) {
						fileRelativeFolderPath = "/"
					} else if (!fileRelativeFolderPath.endsWith("/")) {
						fileRelativeFolderPath = fileRelativeFolderPath + "/"
					}
				} else {
					// 路径本身就是目录路径，直接使用
					fileRelativeFolderPath = relativePath
				}
			}
			// 如果路径不以 / 结尾，是文件路径
			else {
				// 检查是否以 /文件名 结尾
				if (relativePath.endsWith("/" + fileName)) {
					// 移除末尾的 /文件名
					fileRelativeFolderPath = relativePath.slice(
						0,
						relativePath.length - fileName.length,
					)
				} else {
					// 使用 lastIndexOf 查找最后一个 / 的位置
					const lastSlashIndex = relativePath.lastIndexOf("/")
					if (lastSlashIndex >= 0) {
						fileRelativeFolderPath = relativePath.substring(0, lastSlashIndex + 1)
					} else {
						fileRelativeFolderPath = "/"
					}
				}
			}
		}

		// 如果还是找不到，使用根目录
		if (!fileRelativeFolderPath) {
			fileRelativeFolderPath = "/"
		}

		// 查找同目录下的 magic.project.js 文件
		const allFiles = flattenAttachments(attachments)

		// 构建目标路径：folderPath + magic.project.js
		const targetPath = fileRelativeFolderPath + "magic.project.js"

		// 方法1: 如果当前文件是目录，使用 parent_id 关系查找同目录下的文件（最可靠）
		let magicProjectJsFile: FileItem | undefined
		if (currentFile.is_directory) {
			const currentDirectoryId = currentFile.file_id
			magicProjectJsFile = allFiles.find(
				(file: FileItem) =>
					file.file_name === "magic.project.js" &&
					(file as FileItem & { parent_id?: string }).parent_id === currentDirectoryId,
			)
		}

		// 方法2: 严格匹配路径（如果方法1失败）
		if (!magicProjectJsFile) {
			magicProjectJsFile = allFiles.find(
				(file: FileItem) =>
					file.file_name === "magic.project.js" && file.relative_file_path === targetPath,
			)
		}

		// 方法3: 降级方案：如果精确匹配失败，尝试使用 findMatchingFile
		if (!magicProjectJsFile) {
			magicProjectJsFile = findMatchingFile({
				path: "./magic.project.js",
				allFiles: allFiles,
				htmlRelativeFolderPath: fileRelativeFolderPath,
			})
		}

		if (!magicProjectJsFile) {
			return null
		}

		// 使用统一的读取函数获取文件内容（带重试机制）
		const content = await loadMagicProjectJsContent(magicProjectJsFile.file_id)

		return {
			fileId: magicProjectJsFile.file_id,
			content,
		}
	} catch (error) {
		// 如果是"内容为空"的错误，重新抛出，让调用者处理
		if (error instanceof Error && error.message.includes("文件内容为空")) {
			throw error
		}
		// 其他错误（如文件不存在、网络错误等），返回 null
		return null
	}
}

/**
 * 获取当前 design 文件的目录路径、目录名称和目录 ID
 */
export function getDesignDirectoryInfo(
	currentFile: { id: string; name: string } | undefined,
	attachments: FileItem[] | undefined,
): {
	path: string | null
	name: string | null
	id: string | null
} {
	if (!currentFile?.id || !attachments) {
		return { path: null, name: null, id: null }
	}

	const currentFileItem = attachments.find((item) => item.file_id === currentFile.id)
	if (!currentFileItem) {
		return { path: null, name: null, id: null }
	}

	// 方法1: 如果当前文件是目录，直接使用其路径
	if (currentFileItem.is_directory && currentFileItem.relative_file_path) {
		let path = currentFileItem.relative_file_path
		if (!path.endsWith("/")) {
			path = path + "/"
		}
		const directoryName = currentFileItem.file_name || currentFile.name
		return { path, name: directoryName, id: currentFileItem.file_id }
	}

	// 方法2: 如果当前文件不是目录，从 relative_file_path 提取目录路径
	if (currentFileItem.relative_file_path) {
		const relativePath = currentFileItem.relative_file_path
		const fileName = currentFileItem.file_name || currentFile.name

		if (relativePath.endsWith("/")) {
			// 路径以 / 结尾，可能是目录路径
			if (relativePath.endsWith("/" + fileName + "/")) {
				const directoryPath = relativePath.slice(0, -fileName.length - 1) + "/"
				// 从路径中提取目录名称，并查找目录 ID
				const pathParts = directoryPath.split("/").filter(Boolean)
				const directoryName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null
				// 查找目录 ID
				const directoryItem = attachments.find(
					(item) =>
						item.is_directory &&
						item.relative_file_path === directoryPath &&
						item.file_name === directoryName,
				)
				return {
					path: directoryPath,
					name: directoryName,
					id: directoryItem?.file_id || null,
				}
			}
			// 路径本身就是目录路径，提取目录名称
			const pathParts = relativePath.split("/").filter(Boolean)
			const directoryName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null
			// 查找目录 ID
			const directoryItem = attachments.find(
				(item) =>
					item.is_directory &&
					item.relative_file_path === relativePath &&
					item.file_name === directoryName,
			)
			return {
				path: relativePath,
				name: directoryName,
				id: directoryItem?.file_id || null,
			}
		} else {
			// 路径不以 / 结尾，是文件路径，提取目录部分
			const lastSlashIndex = relativePath.lastIndexOf("/")
			if (lastSlashIndex >= 0) {
				const directoryPath = relativePath.substring(0, lastSlashIndex + 1)
				// 从路径中提取目录名称
				const pathParts = directoryPath.split("/").filter(Boolean)
				const directoryName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null
				// 查找目录 ID（优先使用 parent_id）
				const currentFileWithParent = currentFileItem as FileItem & { parent_id?: string }
				let directoryId: string | null = null
				if (currentFileWithParent.parent_id) {
					const parentFolder = attachments.find(
						(item) =>
							item.file_id === currentFileWithParent.parent_id && item.is_directory,
					)
					if (parentFolder) {
						directoryId = parentFolder.file_id
					}
				}
				// 如果通过 parent_id 没找到，尝试通过路径查找
				if (!directoryId && directoryName) {
					const directoryItem = attachments.find(
						(item) =>
							item.is_directory &&
							item.relative_file_path === directoryPath &&
							item.file_name === directoryName,
					)
					directoryId = directoryItem?.file_id || null
				}
				return { path: directoryPath, name: directoryName, id: directoryId }
			}
			return { path: "/", name: null, id: null }
		}
	}

	// 方法3: 使用 parent_id 查找父目录（最可靠）
	const parentId = (currentFileItem as FileItem & { parent_id?: string }).parent_id
	if (parentId) {
		const parentFolder = attachments.find(
			(item) => item.file_id === parentId && item.is_directory,
		)
		if (parentFolder?.relative_file_path) {
			let path = parentFolder.relative_file_path
			if (!path.endsWith("/")) {
				path = path + "/"
			}
			const directoryName = parentFolder.file_name || null
			return { path, name: directoryName, id: parentFolder.file_id }
		}
	}

	return { path: "/", name: null, id: null }
}

/**
 * 递归收集目录下的所有图片文件
 * @param items 文件列表（嵌套结构）
 * @param targetPath 目标目录路径
 * @param targetDirectoryId 目标目录的 file_id（可选，如果提供则使用 parent_id 关系查找）
 */
export function collectFilesInDirectory(
	items: FileItem[],
	targetPath: string,
	targetDirectoryId?: string,
): FileItem[] {
	const result: FileItem[] = []

	// 规范化目标路径：去掉前导斜杠，确保以斜杠结尾
	const normalizePath = (path: string): string => {
		return path.replace(/^\/+/, "").replace(/\/+$/, "") || ""
	}
	const normalizedTargetPath = normalizePath(targetPath)
	const normalizedTargetPathWithSlash = normalizedTargetPath ? `${normalizedTargetPath}/` : ""

	// 递归处理函数
	const processItem = (item: FileItem, isInTargetDirectory: boolean) => {
		if (item.is_directory) {
			// 规范化当前目录路径
			const normalizedItemPath = normalizePath(item.relative_file_path || "")

			// 检查是否是目标目录本身，或者目标路径是否在当前目录下
			const isTargetDirectory =
				(targetDirectoryId && item.file_id === targetDirectoryId) ||
				normalizedItemPath === normalizedTargetPath ||
				(normalizedTargetPath.startsWith(normalizedItemPath + "/") &&
					normalizedItemPath !== "")

			// 递归处理子文件
			if (item.children) {
				for (const child of item.children) {
					// 如果当前目录是目标目录，则其子文件都在目标目录下
					processItem(child, isTargetDirectory || isInTargetDirectory)
				}
			}
		} else {
			const fileExtension = item.file_extension?.toLowerCase() || ""
			const isImage = IMAGE_EXTENSIONS.includes(fileExtension)

			// 方法1: 如果当前在目标目录下（通过目录层级关系），直接匹配
			let matchedByParentId = false
			if (isInTargetDirectory) {
				matchedByParentId = true
			} else if (targetDirectoryId) {
				// 方法2: 使用 parent_id 关系匹配
				const itemParentId = (item as FileItem & { parent_id?: string }).parent_id
				matchedByParentId = itemParentId === targetDirectoryId
			}

			// 方法3: 使用路径匹配
			let matchedByPath = false
			if (item.relative_file_path) {
				const normalizedFilePath = normalizePath(item.relative_file_path)
				matchedByPath =
					normalizedFilePath === normalizedTargetPath ||
					normalizedFilePath.startsWith(normalizedTargetPathWithSlash)
			}

			const isMatched = matchedByParentId || matchedByPath

			if (isMatched && isImage) {
				result.push(item)
			}
		}
	}

	// 处理所有 items
	for (const item of items) {
		// 规范化当前目录路径
		const normalizedItemPath = normalizePath(item.relative_file_path || "")

		// 检查是否是目标目录本身，或者目标路径是否在当前目录下
		const isTargetDirectory =
			(targetDirectoryId && item.file_id === targetDirectoryId) ||
			normalizedItemPath === normalizedTargetPath ||
			(normalizedTargetPath.startsWith(normalizedItemPath + "/") && normalizedItemPath !== "")

		processItem(item, isTargetDirectory)
	}

	return result
}

/**
 * 元素变更类型
 */
export type ElementChangeType = "added" | "deleted" | "modified"

/**
 * 元素变更信息
 */
export interface ElementChange {
	/** 变更类型 */
	type: ElementChangeType
	/** 元素 ID */
	elementId: string
	/** 旧元素数据（删除或修改时存在） */
	oldElement?: LayerElement
	/** 新元素数据（新增或修改时存在） */
	newElement?: LayerElement
}

/**
 * 设计数据对比结果
 */
export interface DesignDataDiff {
	/** 新增的元素 */
	added: ElementChange[]
	/** 删除的元素 */
	deleted: ElementChange[]
	/** 修改的元素 */
	modified: ElementChange[]
	/** 是否有变更 */
	hasChanges: boolean
}

/**
 * 递归获取所有元素（包括嵌套的子元素）
 */
function getAllElements(elements: LayerElement[] = []): Map<string, LayerElement> {
	const elementMap = new Map<string, LayerElement>()

	function traverse(items: LayerElement[]) {
		for (const item of items) {
			elementMap.set(item.id, item)
			// 处理 Frame 和 Group 的子元素
			if ("children" in item && item.children) {
				traverse(item.children)
			}
		}
	}

	traverse(elements)
	return elementMap
}

/**
 * 深度对比两个元素是否相同
 * 忽略一些不重要的属性差异
 */
function isElementEqual(a: LayerElement, b: LayerElement): boolean {
	// 快速检查：如果 JSON 字符串相同，则认为相同
	try {
		const aStr = JSON.stringify(a)
		const bStr = JSON.stringify(b)
		return aStr === bStr
	} catch {
		return false
	}
}

/**
 * 深度对比两个设计数据，找出新增、删除和修改的元素
 */
export function compareDesignData(oldData: DesignData | null, newData: DesignData): DesignDataDiff {
	const result: DesignDataDiff = {
		added: [],
		deleted: [],
		modified: [],
		hasChanges: false,
	}

	// 如果没有旧数据，所有元素都是新增的
	if (!oldData || !oldData.canvas?.elements) {
		const newElements = getAllElements(newData.canvas?.elements || [])
		newElements.forEach((element) => {
			result.added.push({
				type: "added",
				elementId: element.id,
				newElement: element,
			})
		})
		result.hasChanges = result.added.length > 0
		return result
	}

	// 获取所有元素的扁平映射
	const oldElements = getAllElements(oldData.canvas?.elements || [])
	const newElements = getAllElements(newData.canvas?.elements || [])

	// 找出新增的元素
	newElements.forEach((newElement, id) => {
		if (!oldElements.has(id)) {
			result.added.push({
				type: "added",
				elementId: id,
				newElement,
			})
		}
	})

	// 找出删除的元素
	oldElements.forEach((oldElement, id) => {
		if (!newElements.has(id)) {
			result.deleted.push({
				type: "deleted",
				elementId: id,
				oldElement,
			})
		}
	})

	// 找出修改的元素
	oldElements.forEach((oldElement, id) => {
		const newElement = newElements.get(id)
		if (newElement && !isElementEqual(oldElement, newElement)) {
			result.modified.push({
				type: "modified",
				elementId: id,
				oldElement,
				newElement,
			})
		}
	})

	result.hasChanges =
		result.added.length > 0 || result.deleted.length > 0 || result.modified.length > 0

	return result
}

/**
 * 从文件名中提取基础名称和扩展名
 * @param fileName 文件名
 * @returns 基础名称和扩展名
 * @example
 * splitFileName("image.png") // { baseName: "image", extension: ".png" }
 * splitFileName("document.tar.gz") // { baseName: "document.tar", extension: ".gz" }
 * splitFileName("noext") // { baseName: "noext", extension: "" }
 */
export function splitFileName(fileName: string): { baseName: string; extension: string } {
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex === -1 || lastDotIndex === 0) {
		// 没有扩展名或文件名以点开头
		return { baseName: fileName, extension: "" }
	}
	return {
		baseName: fileName.slice(0, lastDotIndex),
		extension: fileName.slice(lastDotIndex),
	}
}

/**
 * 为文件生成唯一文件名(避免同名冲突)
 * 检测范围: 同批次内的同名文件 + 目标目录下已存在的文件
 *
 * @param files 要上传的文件列表
 * @param existingFiles 目标目录下已存在的文件列表
 * @returns 重命名后的文件数组
 *
 * @example
 * // 同批次内有同名
 * renameFilesForUpload([image.png, image.png], [])
 * // -> [image.png, image(1).png]
 *
 * @example
 * // 与已存在文件同名
 * renameFilesForUpload([image.png], [{file_name: "image.png"}])
 * // -> [image(1).png]
 *
 * @example
 * // 综合情况
 * renameFilesForUpload([image.png, image.png], [{file_name: "image.png"}])
 * // -> [image(1).png, image(2).png]
 */
export function renameFilesForUpload(files: File[], existingFiles: FileItem[]): File[] {
	const usedNames = new Set<string>()
	const renamedFiles: File[] = []

	// 先将已存在的文件名加入已使用集合
	for (const existingFile of existingFiles) {
		if (existingFile.file_name) {
			usedNames.add(existingFile.file_name)
		}
	}

	// 处理每个文件
	for (const file of files) {
		let newFileName = file.name
		let needsRename = false

		// 如果文件名已被使用,生成新的文件名
		if (usedNames.has(newFileName)) {
			const { baseName, extension } = splitFileName(file.name)
			let counter = 1

			// 持续尝试直到找到未使用的文件名
			do {
				newFileName = `${baseName}(${counter})${extension}`
				counter++
			} while (usedNames.has(newFileName))

			needsRename = true
		}

		// 记录使用的文件名
		usedNames.add(newFileName)

		// 如果需要重命名,创建新的 File 对象
		if (needsRename) {
			const renamedFile = new File([file], newFileName, {
				type: file.type,
				lastModified: file.lastModified,
			})
			renamedFiles.push(renamedFile)
		} else {
			renamedFiles.push(file)
		}
	}

	return renamedFiles
}

/**
 * 打包下载多个文件的共用函数
 * @param imageFiles 要下载的文件列表
 * @param downloadMode 下载模式（可选）
 * @param zipFileName zip 文件名（可选，默认为 "design-images.zip"）
 * @returns 返回下载结果，包含成功数量和失败信息
 */
export async function packAndDownloadFiles(
	imageFiles: FileItem[],
	downloadMode?: import("@/pages/superMagic/pages/Workspace/types").DownloadImageMode,
	zipFileName = "design-images.zip",
): Promise<{
	successCount: number
	results: Array<{ success: boolean; fileName: string; error?: unknown }>
}> {
	const { loadJSZip } = await import("@/lib/jszip")
	const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")

	// 加载 JSZip
	const JSZip = await loadJSZip()
	const zip = new JSZip()

	// 获取所有图片文件的下载 URL
	const fileIds = imageFiles.map((file) => file.file_id)
	const downloadUrls = await getTemporaryDownloadUrl({
		file_ids: fileIds,
		download_mode: downloadMode,
	})

	if (!downloadUrls || downloadUrls.length === 0) {
		throw new Error(t("design.errors.cannotGetDownloadUrl"))
	}

	// 创建 fileId 到 downloadUrl 的映射
	const urlMap = new Map<string, string>()
	downloadUrls.forEach((item: { url?: string }, index: number) => {
		if (item?.url && fileIds[index]) {
			urlMap.set(fileIds[index], item.url)
		}
	})

	// 处理文件名冲突
	const usedFileNames = new Set<string>()
	const processedFiles = imageFiles.map((file: FileItem, index: number) => {
		const fileName = file.file_name || file.display_filename || `image-${index + 1}`
		const fileExtension = file.file_extension || "png"
		const baseFileName = fileName.endsWith(`.${fileExtension}`)
			? fileName.slice(0, -fileExtension.length - 1)
			: fileName

		// 如果文件名已存在，添加序号
		let finalFileName = `${baseFileName}.${fileExtension}`
		let counter = 1
		while (usedFileNames.has(finalFileName)) {
			finalFileName = `${baseFileName}-${counter}.${fileExtension}`
			counter++
		}
		usedFileNames.add(finalFileName)

		return {
			file,
			finalFileName,
		}
	})

	// 下载所有图片并添加到 zip
	const downloadPromises = processedFiles.map(async (item) => {
		const downloadUrl = urlMap.get(item.file.file_id)
		if (!downloadUrl) {
			return {
				success: false,
				fileName: item.finalFileName,
				error: t("design.errors.noDownloadLink"),
			}
		}

		try {
			const response = await fetch(downloadUrl)
			if (!response.ok) {
				throw new Error(
					t("design.errors.downloadImageFailed", {
						statusText: response.statusText,
					}),
				)
			}
			const blob = await response.blob()
			zip.file(item.finalFileName, blob)
			return { success: true, fileName: item.finalFileName }
		} catch (error) {
			return { success: false, fileName: item.finalFileName, error }
		}
	})

	const results = await Promise.all(downloadPromises)
	const successCount = results.filter((r) => r?.success).length

	if (successCount === 0) {
		throw new Error(t("design.errors.noDownloadableImages"))
	}

	// 生成 zip 文件
	const zipBlob = await zip.generateAsync({ type: "blob" })

	// 下载 zip 文件
	const url = URL.createObjectURL(zipBlob)
	const link = document.createElement("a")
	link.href = url
	link.download = zipFileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)

	return {
		successCount,
		results,
	}
}

/**
 * 从文件列表中获取 zip 文件名
 * 如果所有文件都在同一个目录下，使用目录名称；否则使用默认名称
 * @param imageFiles 文件列表
 * @param attachments 附件列表（用于查找目录信息）
 * @param currentFile 当前文件（可选，如果提供则优先使用 getDesignDirectoryInfo）
 * @returns zip 文件名
 */
export function getZipFileNameFromFiles(
	imageFiles: FileItem[],
	attachments?: FileItem[],
	currentFile?: { id: string; name: string },
): string {
	// 如果提供了 currentFile，优先使用 getDesignDirectoryInfo（与 CanvasDesignHeader 保持一致）
	if (currentFile?.id && attachments) {
		const directoryInfo = getDesignDirectoryInfo(currentFile, attachments)
		if (directoryInfo.name) {
			return `${directoryInfo.name}-images.zip`
		}
	}

	// 如果没有 currentFile 或无法获取目录信息，从文件列表中推断
	if (imageFiles.length === 0) {
		return "design-images.zip"
	}

	// 规范化路径函数
	const normalizePath = (path: string): string => {
		return path.replace(/^\/+/, "").replace(/\/+$/, "") || ""
	}

	// 方法1: 优先使用 parent_id 查找目录（最可靠）
	const firstFile = imageFiles[0]
	if (firstFile) {
		const firstFileWithParent = firstFile as FileItem & { parent_id?: string }
		if (firstFileWithParent.parent_id && attachments) {
			// 检查所有文件是否都有相同的 parent_id
			const parentId = firstFileWithParent.parent_id
			const allHaveSameParent = imageFiles.every((file) => {
				const fileWithParent = file as FileItem & { parent_id?: string }
				return fileWithParent.parent_id === parentId
			})

			if (allHaveSameParent) {
				const parentFolder = attachments.find(
					(item) => item.file_id === parentId && item.is_directory,
				)
				if (parentFolder?.file_name) {
					return `${parentFolder.file_name}-images.zip`
				}
			}
		}
	}

	// 方法2: 从路径中提取目录名称
	const firstFilePath = firstFile?.relative_file_path
	if (firstFilePath) {
		const firstFileDir = firstFilePath.substring(0, firstFilePath.lastIndexOf("/") + 1)
		const normalizedFirstDir = normalizePath(firstFileDir)

		// 检查所有文件是否都在同一个目录下
		const allInSameDir = imageFiles.every((file) => {
			if (!file.relative_file_path) return false
			const fileDir = file.relative_file_path.substring(
				0,
				file.relative_file_path.lastIndexOf("/") + 1,
			)
			return normalizePath(fileDir) === normalizedFirstDir
		})

		if (allInSameDir && normalizedFirstDir) {
			// 从路径中提取目录名称
			const pathParts = normalizedFirstDir.split("/").filter(Boolean)
			const lastDirName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null

			// 如果最后一个目录名称是 "images"，使用父目录名称（与 getDesignDirectoryInfo 的逻辑保持一致）
			let directoryName = lastDirName
			if (lastDirName === "images" && pathParts.length > 1) {
				directoryName = pathParts[pathParts.length - 2]
			}

			// 如果 attachments 存在，尝试查找目录项以获取准确的目录名称
			if (directoryName && attachments) {
				// 如果最后一个目录是 "images"，优先查找父目录
				if (lastDirName === "images" && pathParts.length > 1) {
					const parentDirName = pathParts[pathParts.length - 2]
					const parentDirPath = pathParts.slice(0, -1).join("/")
					const parentDirectoryItem = attachments.find(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") === parentDirPath &&
							item.file_name === parentDirName,
					)
					if (parentDirectoryItem?.file_name) {
						return `${parentDirectoryItem.file_name}-images.zip`
					}
				}

				// 尝试查找当前目录（如果 directoryName 不是 "images"）
				const directoryItem = attachments.find(
					(item) =>
						item.is_directory &&
						normalizePath(item.relative_file_path || "") === normalizedFirstDir &&
						item.file_name === directoryName,
				)
				if (directoryItem?.file_name) {
					return `${directoryItem.file_name}-images.zip`
				}
			}

			// 如果 directoryName 存在且不是 "images"，使用它
			if (directoryName && directoryName !== "images") {
				return `${directoryName}-images.zip`
			}

			// 如果目录名称是 "images" 且没有找到父目录，使用默认名称
			if (lastDirName === "images") {
				return "design-images.zip"
			}
		}
	}

	return "design-images.zip"
}

/**
 * 规范化路径：移除前导和尾随斜杠，用于路径比较
 */
export function normalizePath(path: string): string {
	if (!path) return ""
	return path.replace(/^\/+|\/+$/g, "")
}

/**
 * 扁平化附件列表（从嵌套结构转为扁平结构）
 * 包括目录本身和所有子文件/目录
 */
export function flattenAttachmentsList(items: FileItem[]): FileItem[] {
	const result: FileItem[] = []
	for (const item of items) {
		// 先添加当前项（包括目录本身）
		result.push(item)
		// 如果当前项是目录且有子项，递归添加子项
		if (item.is_directory && item.children) {
			result.push(...flattenAttachmentsList(item.children))
		}
	}
	return result
}

/**
 * 从 flatAttachments 中根据 src 找到对应的文件
 * @param src 文件路径或 URL
 * @param flatAttachments 已扁平化的附件列表
 */
export function findFileBySrc(src: string, flatAttachments: FileItem[]): FileItem | null {
	if (!src || !flatAttachments || flatAttachments.length === 0) {
		return null
	}
	const normalizedSrc = normalizePath(src)

	// 方法1: 尝试通过 relative_file_path 匹配
	let fileItem = flatAttachments.find((item) => {
		if (!item.relative_file_path || item.is_directory) return false
		const itemPath = normalizePath(item.relative_file_path)
		return itemPath === normalizedSrc
	})

	// 方法2: 如果 src 是 URL，尝试从 URL 中提取路径或文件名
	if (!fileItem && src.includes("/")) {
		// 尝试从 URL 中提取文件名
		const urlParts = src.split("/")
		const fileName = urlParts[urlParts.length - 1]?.split("?")[0] // 移除查询参数

		if (fileName) {
			fileItem = flatAttachments.find((item) => {
				return (
					!item.is_directory &&
					(item.file_name === fileName ||
						item.display_filename === fileName ||
						item.filename === fileName)
				)
			})
		}
	}

	// 方法3: 如果 src 是 file_id，直接匹配
	if (!fileItem && src && !src.includes("/") && !src.includes("\\")) {
		fileItem = flatAttachments.find((item) => {
			return !item.is_directory && item.file_id === src
		})
	}

	return fileItem || null
}

/**
 * 将 FileItem 转换为 AttachmentItem 格式
 */
export function convertFileItemToAttachmentItem(fileItem: FileItem): AttachmentItem {
	return {
		file_id: fileItem.file_id,
		file_name: fileItem.file_name,
		filename: fileItem.filename,
		display_filename: fileItem.display_filename,
		file_extension: fileItem.file_extension,
		is_directory: fileItem.is_directory,
		relative_file_path: fileItem.relative_file_path,
		file_path: fileItem.relative_file_path,
		file_size: fileItem.file_size,
		metadata: fileItem.metadata,
		source: fileItem.source || AttachmentSource.PROJECT_DIRECTORY,
	}
}
