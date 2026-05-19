import { getFileContentById } from "@/pages/superMagic/utils/api"
import { flattenAttachments, findMatchingFile } from "../../HTML/utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { DesignData } from "../types"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import type { LayerElement } from "@/components/CanvasDesign/canvas/types"
import { t } from "i18next"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectAttachmentMentionNode } from "@/components/CanvasDesign/types"
import { ImageFormat, ImageProcessOptions } from "@/utils/image-processing"
import {
	ImageGenerationTaskMeta,
	ImageGenerationTaskTypeMap,
} from "@/components/CanvasDesign/types.magic"
import {
	normalizeDesignAttachmentPathForCanvas,
	rewriteLayerElementsPathsForMagicProjectSave,
	resolveDesignDslPathCandidatesToWorkspaceRelative,
	normalizeMagicProjectDirToBase,
} from "./designDslPathUtils"
import { getDesignProjectCurrentFileByProjectPath } from "./toolDesignProjectInfo"
import type { DesignAttachmentIndex } from "./designAttachmentIndex"
import { cloneDeep } from "lodash-es"

function layerTreeHasImageOrVideo(elements: LayerElement[] | undefined): boolean {
	if (!elements?.length) return false
	for (const el of elements) {
		const elementType = (el as { type?: string }).type
		if (elementType === "image" || elementType === "video") return true
		const children = (el as { children?: LayerElement[] }).children
		if (children?.length && layerTreeHasImageOrVideo(children)) return true
	}
	return false
}

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
 * @param options.projectBasePath 画布目录在项目中的路径段（与 magic.project.js 同级），存在时把画布内资源写成 `./images/...`
 */
export function generateMagicProjectJsContent(
	designData: DesignData,
	options?: { projectBasePath?: string },
): string {
	const rawElements = designData.canvas?.elements || []
	let elements = rawElements
	const basePath = options?.projectBasePath?.trim()
	if (basePath) {
		if (layerTreeHasImageOrVideo(rawElements)) {
			elements = cloneDeep(rawElements)
			rewriteLayerElementsPathsForMagicProjectSave(elements, basePath)
		}
	}
	const config = {
		version: designData.version || "1.0.0",
		type: designData.type || "design",
		name: designData.name || "",
		canvas: {
			elements,
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

	return updatedPath
}

function replaceReferenceImageOptionsPaths(
	value: unknown,
	oldDirName: string,
	newDirName: string,
): boolean {
	if (!Array.isArray(value) || !value.length) {
		return false
	}

	let hasChanged = false
	for (const item of value) {
		if (!item || typeof item !== "object") continue
		const rec = item as Record<string, unknown>
		const path = rec.path
		if (typeof path !== "string") continue
		const nextPath = replaceDirectoryNameInPath(path, oldDirName, newDirName)
		if (nextPath !== path) {
			rec.path = nextPath
			hasChanged = true
		}
	}
	return hasChanged
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
					reference_image_options?: Array<{ path?: string }>
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
			if (
				replaceReferenceImageOptionsPaths(
					generateImageRequest.reference_image_options,
					oldDirName,
					newDirName,
				)
			) {
				hasReplaced = true
			}
		}

		const imageGenerationTaskMeta = element.imageGenerationTaskMeta as
			| ImageGenerationTaskMeta
			| undefined
		if (
			imageGenerationTaskMeta &&
			typeof imageGenerationTaskMeta === "object" &&
			typeof imageGenerationTaskMeta.file_path === "string"
		) {
			const newFilePath = replaceDirectoryNameInPath(
				imageGenerationTaskMeta.file_path,
				oldDirName,
				newDirName,
			)
			if (newFilePath !== imageGenerationTaskMeta.file_path) {
				imageGenerationTaskMeta.file_path = newFilePath
				hasReplaced = true
			}
		}
		if (
			imageGenerationTaskMeta &&
			typeof imageGenerationTaskMeta === "object" &&
			replaceReferenceImageOptionsPaths(
				imageGenerationTaskMeta.reference_image_options,
				oldDirName,
				newDirName,
			)
		) {
			hasReplaced = true
		}
		if (
			imageGenerationTaskMeta &&
			typeof imageGenerationTaskMeta === "object" &&
			imageGenerationTaskMeta.type === ImageGenerationTaskTypeMap.Expand &&
			imageGenerationTaskMeta.canvas_path &&
			typeof imageGenerationTaskMeta.canvas_path === "string"
		) {
			const newCanvasPath = replaceDirectoryNameInPath(
				imageGenerationTaskMeta.canvas_path,
				oldDirName,
				newDirName,
			)
			if (newCanvasPath !== imageGenerationTaskMeta.canvas_path) {
				imageGenerationTaskMeta.canvas_path = newCanvasPath
				hasReplaced = true
			}
		}
		if (
			imageGenerationTaskMeta &&
			typeof imageGenerationTaskMeta === "object" &&
			imageGenerationTaskMeta.mask_path &&
			typeof imageGenerationTaskMeta.mask_path === "string"
		) {
			const newMaskPath = replaceDirectoryNameInPath(
				imageGenerationTaskMeta.mask_path,
				oldDirName,
				newDirName,
			)
			if (newMaskPath !== imageGenerationTaskMeta.mask_path) {
				imageGenerationTaskMeta.mask_path = newMaskPath
				hasReplaced = true
			}
		}
		if (
			imageGenerationTaskMeta &&
			typeof imageGenerationTaskMeta === "object" &&
			imageGenerationTaskMeta.mark_path &&
			typeof imageGenerationTaskMeta.mark_path === "string"
		) {
			const newMarkPath = replaceDirectoryNameInPath(
				imageGenerationTaskMeta.mark_path,
				oldDirName,
				newDirName,
			)
			if (newMarkPath !== imageGenerationTaskMeta.mark_path) {
				imageGenerationTaskMeta.mark_path = newMarkPath
				hasReplaced = true
			}
		}

		const generateHightImageRequest = element.generateHightImageRequest as
			| {
					file_path?: string
					reference_image_options?: Array<{ path?: string }>
			  }
			| undefined
		if (
			generateHightImageRequest &&
			typeof generateHightImageRequest === "object" &&
			generateHightImageRequest.file_path &&
			typeof generateHightImageRequest.file_path === "string"
		) {
			const newFilePath = replaceDirectoryNameInPath(
				generateHightImageRequest.file_path,
				oldDirName,
				newDirName,
			)
			if (newFilePath !== generateHightImageRequest.file_path) {
				generateHightImageRequest.file_path = newFilePath
				hasReplaced = true
			}
		}
		if (
			generateHightImageRequest &&
			typeof generateHightImageRequest === "object" &&
			replaceReferenceImageOptionsPaths(
				generateHightImageRequest.reference_image_options,
				oldDirName,
				newDirName,
			)
		) {
			hasReplaced = true
		}
	}

	if (element.type === "video") {
		if (element.src && typeof element.src === "string") {
			const originalSrc = element.src as string
			const newSrc = replaceDirectoryNameInPath(originalSrc, oldDirName, newDirName)
			if (newSrc !== originalSrc) {
				element.src = newSrc
				hasReplaced = true
			}
		}

		const generateVideoRequest = element.generateVideoRequest as
			| {
					file_dir?: string
					inputs?: {
						frames?: Array<{ uri?: string }>
						reference_images?: Array<{ uri?: string }>
						reference_videos?: Array<{ uri?: string }>
						reference_audios?: Array<{ uri?: string }>
						video?: { uri?: string }
						mask?: { uri?: string }
						audio?: Array<{ uri?: string }>
					}
			  }
			| undefined

		if (generateVideoRequest && typeof generateVideoRequest === "object") {
			if (
				generateVideoRequest.file_dir &&
				typeof generateVideoRequest.file_dir === "string"
			) {
				const newFileDir = replaceDirectoryNameInPath(
					generateVideoRequest.file_dir,
					oldDirName,
					newDirName,
				)
				if (newFileDir !== generateVideoRequest.file_dir) {
					generateVideoRequest.file_dir = newFileDir
					hasReplaced = true
				}
			}

			if (Array.isArray(generateVideoRequest.inputs?.frames)) {
				generateVideoRequest.inputs.frames.forEach((frame) => {
					if (!frame.uri) return
					const replacedUri = replaceDirectoryNameInPath(
						frame.uri,
						oldDirName,
						newDirName,
					)
					if (replacedUri === frame.uri) return
					frame.uri = replacedUri
					hasReplaced = true
				})
			}

			if (Array.isArray(generateVideoRequest.inputs?.reference_images)) {
				generateVideoRequest.inputs.reference_images.forEach((item) => {
					if (!item.uri) return
					const replacedUri = replaceDirectoryNameInPath(item.uri, oldDirName, newDirName)
					if (replacedUri === item.uri) return
					item.uri = replacedUri
					hasReplaced = true
				})
			}

			if (Array.isArray(generateVideoRequest.inputs?.reference_videos)) {
				generateVideoRequest.inputs.reference_videos.forEach((item) => {
					if (!item.uri) return
					const replacedUri = replaceDirectoryNameInPath(item.uri, oldDirName, newDirName)
					if (replacedUri === item.uri) return
					item.uri = replacedUri
					hasReplaced = true
				})
			}

			if (Array.isArray(generateVideoRequest.inputs?.reference_audios)) {
				generateVideoRequest.inputs.reference_audios.forEach((item) => {
					if (!item.uri) return
					const replacedUri = replaceDirectoryNameInPath(item.uri, oldDirName, newDirName)
					if (replacedUri === item.uri) return
					item.uri = replacedUri
					hasReplaced = true
				})
			}

			if (generateVideoRequest.inputs?.video?.uri) {
				const replacedUri = replaceDirectoryNameInPath(
					generateVideoRequest.inputs.video.uri,
					oldDirName,
					newDirName,
				)
				if (replacedUri !== generateVideoRequest.inputs.video.uri) {
					generateVideoRequest.inputs.video.uri = replacedUri
					hasReplaced = true
				}
			}

			if (generateVideoRequest.inputs?.mask?.uri) {
				const replacedUri = replaceDirectoryNameInPath(
					generateVideoRequest.inputs.mask.uri,
					oldDirName,
					newDirName,
				)
				if (replacedUri !== generateVideoRequest.inputs.mask.uri) {
					generateVideoRequest.inputs.mask.uri = replacedUri
					hasReplaced = true
				}
			}

			if (Array.isArray(generateVideoRequest.inputs?.audio)) {
				generateVideoRequest.inputs.audio.forEach((item) => {
					if (!item.uri) return
					const replacedUri = replaceDirectoryNameInPath(item.uri, oldDirName, newDirName)
					if (replacedUri === item.uri) return
					item.uri = replacedUri
					hasReplaced = true
				})
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
export function extractDesignDataFromDisplayConfig(
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
		if (currentFile.is_directory && currentFile.display_config) {
			const metadata = currentFile.display_config as {
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

			if (parentFolder?.display_config) {
				const metadata = parentFolder.display_config as {
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
 * 根据当前文件信息解析设计目录对应的实际文件信息。
 * - 优先使用 `currentFile.id`
 * - 若缺少 id，则尝试按目录名在附件列表中匹配目录
 */
export function resolveActualDesignCurrentFile(options: {
	currentFile?: { id?: string; name?: string }
	flatAttachments?: FileItem[]
	attachments?: FileItem[]
	projectPath?: string
}): { id: string; name: string } | null {
	const { currentFile, flatAttachments, attachments, projectPath } = options
	const currentFileId = currentFile?.id
	const currentFileName = currentFile?.name

	const list =
		flatAttachments && flatAttachments.length > 0
			? flatAttachments
			: flattenAttachmentsList(attachments ?? [])

	if (projectPath) {
		const matchedByProjectPath = getDesignProjectCurrentFileByProjectPath({
			projectPath,
			attachments,
			flatAttachments: list,
		})
		if (matchedByProjectPath) return matchedByProjectPath
	}

	if (currentFileId && !currentFileName) {
		const matchedById = list.find((item) => item.file_id === currentFileId)
		if (matchedById) {
			const resolvedName = matchedById.file_name || matchedById.display_filename
			if (resolvedName) {
				return { id: currentFileId, name: resolvedName }
			}
		}
	}

	if (currentFileId && currentFileName) {
		return { id: currentFileId, name: currentFileName }
	}

	if (!currentFileName) return null
	if (!list.length) return null

	const matchedDirectories = list.filter(
		(item) =>
			item.is_directory &&
			(item.file_name === currentFileName || item.display_filename === currentFileName),
	)
	if (matchedDirectories.length === 0) return null
	if (matchedDirectories.length === 1) {
		const matchedDirectory = matchedDirectories[0]
		if (!matchedDirectory?.file_id) return null
		return {
			id: matchedDirectory.file_id,
			name:
				matchedDirectory.file_name || matchedDirectory.display_filename || currentFileName,
		}
	}

	const directoriesWithCanvasMetadata = matchedDirectories.filter((item) => {
		const metadata = item.display_config as { canvas?: { elements?: unknown[] } } | undefined
		return Array.isArray(metadata?.canvas?.elements)
	})
	if (directoriesWithCanvasMetadata.length === 1) {
		const matchedDirectory = directoriesWithCanvasMetadata[0]
		return {
			id: matchedDirectory.file_id,
			name:
				matchedDirectory.file_name || matchedDirectory.display_filename || currentFileName,
		}
	}

	const directoriesWithMagicProject = matchedDirectories.filter((directory) => {
		const directoryPath = directory.relative_file_path || ""
		const normalizedDirectoryPath = directoryPath.endsWith("/")
			? directoryPath
			: `${directoryPath}/`
		return list.some(
			(item) =>
				!item.is_directory &&
				item.file_name === "magic.project.js" &&
				(((item as FileItem & { parent_id?: string }).parent_id &&
					(item as FileItem & { parent_id?: string }).parent_id === directory.file_id) ||
					item.relative_file_path === `${normalizedDirectoryPath}magic.project.js`),
		)
	})
	if (directoriesWithMagicProject.length === 1) {
		const matchedDirectory = directoriesWithMagicProject[0]
		return {
			id: matchedDirectory.file_id,
			name:
				matchedDirectory.file_name || matchedDirectory.display_filename || currentFileName,
		}
	}

	return null
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
	if (!currentFile?.id || !attachments?.length) {
		return { path: null, name: null, id: null }
	}

	// 附件常为树形（children）；仅在顶层 find 会漏掉子文件夹下的 magic.project.js / 画布目录
	const list = flattenAttachmentsList(attachments)
	const currentFileItem = list.find((item) => item.file_id === currentFile.id)
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
				const directoryItem = list.find(
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
			const directoryItem = list.find(
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
					const parentFolder = list.find(
						(item) =>
							item.file_id === currentFileWithParent.parent_id && item.is_directory,
					)
					if (parentFolder) {
						directoryId = parentFolder.file_id
					}
				}
				// 如果通过 parent_id 没找到，尝试通过路径查找
				if (!directoryId && directoryName) {
					const directoryItem = list.find(
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
		const parentFolder = list.find((item) => item.file_id === parentId && item.is_directory)
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
 * 将目录路径规范为 @ 附件树目录节点 id（与 `ProjectAttachmentMentionNode` 约定一致：无尾斜杠）。
 * `getDesignDirectoryInfo` 常返回以 `/` 结尾的路径，与 `findFolderNode` 按 `id === path` 匹配时需对齐。
 */
export function normalizeMentionFolderId(folderId?: string | null): string | undefined {
	const normalized = folderId?.trim().replace(/\/+$/, "")
	return normalized || undefined
}

/**
 * 从当前文件与附件解析画布目录路径段（与 magic.project.js 同级），供 DSL 路径读写与加载后规范化
 */
export function resolveDesignProjectBasePathFromAttachments(options: {
	currentFile?: { id?: string; name?: string }
	flatAttachments?: FileItem[]
	attachments?: FileItem[]
}): string | undefined {
	const { currentFile, flatAttachments, attachments } = options
	const actualCurrentFile = resolveActualDesignCurrentFile({
		currentFile,
		flatAttachments,
		attachments,
	})
	if (!actualCurrentFile) return undefined
	const list =
		flatAttachments && flatAttachments.length > 0
			? flatAttachments
			: flattenAttachmentsList(attachments ?? [])
	if (!list.length) return undefined
	const info = getDesignDirectoryInfo(actualCurrentFile, list)
	return normalizeMagicProjectDirToBase(info.path)
}

/**
 * 解析当前画布目录名称，供加载后的内存态名称对齐与保存前名称同步复用。
 */
export function resolveDesignDirectoryNameFromAttachments(options: {
	currentFile?: { id?: string; name?: string }
	flatAttachments?: FileItem[]
	attachments?: FileItem[]
	projectPath?: string
}): string | undefined {
	const { currentFile, flatAttachments, attachments, projectPath } = options
	const actualCurrentFile = resolveActualDesignCurrentFile({
		currentFile,
		flatAttachments,
		attachments,
		projectPath,
	})
	if (!actualCurrentFile) return undefined
	const list =
		flatAttachments && flatAttachments.length > 0 ? flatAttachments : (attachments ?? [])
	if (!list.length) return undefined
	const info = getDesignDirectoryInfo(actualCurrentFile, list)
	return info.name || undefined
}

/**
 * 画布加载后把图层里的旧绝对路径（如 `/画布名/images/x`）统一为 `./images/x`（与落盘规则一致，就地改写内存数据）
 */
export function normalizeDesignDataPathsAfterLoad(
	designData: DesignData,
	projectBasePath: string | undefined,
): void {
	if (!projectBasePath?.trim()) return
	const elements = designData.canvas?.elements
	if (!elements?.length) return
	rewriteLayerElementsPathsForMagicProjectSave(elements, projectBasePath.trim())
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
	xMagicImageProcessByFileId?: Record<string, ImageProcessOptions>,
): Promise<{
	successCount: number
	results: Array<{ success: boolean; fileName: string; error?: unknown }>
}> {
	const { loadJSZip } = await import("@/lib/jszip")
	const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")

	// 加载 JSZip
	const JSZip = await loadJSZip()
	const zip = new JSZip()

	const urlMap = new Map<string, string>()
	const filesWithImageProcess = imageFiles.filter(
		(file) => !!xMagicImageProcessByFileId?.[file.file_id],
	)
	const filesWithoutImageProcess = imageFiles.filter(
		(file) => !xMagicImageProcessByFileId?.[file.file_id],
	)

	if (filesWithoutImageProcess.length > 0) {
		const fileIds = filesWithoutImageProcess.map((file) => file.file_id)
		const downloadUrls = await getTemporaryDownloadUrl({
			file_ids: fileIds,
			download_mode: downloadMode,
		})

		if (!downloadUrls || downloadUrls.length === 0) {
			throw new Error(t("design.errors.cannotGetDownloadUrl"))
		}

		downloadUrls.forEach((item: { url?: string }, index: number) => {
			if (item?.url && fileIds[index]) {
				urlMap.set(fileIds[index], item.url)
			}
		})
	}

	if (filesWithImageProcess.length > 0) {
		const imageProcessResults = await Promise.all(
			filesWithImageProcess.map(async (file) => {
				const xMagicImageProcess = xMagicImageProcessByFileId?.[file.file_id]
				if (!xMagicImageProcess) return null

				const downloadUrls = await getTemporaryDownloadUrl({
					file_ids: [file.file_id],
					download_mode: downloadMode,
					options: { xMagicImageProcess },
				})
				const downloadUrl = downloadUrls?.[0]?.url

				if (!downloadUrl) {
					throw new Error(t("design.errors.cannotGetDownloadUrl"))
				}

				return {
					fileId: file.file_id,
					url: downloadUrl,
				}
			}),
		)

		for (const item of imageProcessResults) {
			if (item?.url) {
				urlMap.set(item.fileId, item.url)
			}
		}
	}

	// 处理文件名冲突
	const usedFileNames = new Set<string>()
	const processedFiles = imageFiles.map((file: FileItem, index: number) => {
		const fileName = file.file_name || file.display_filename || `image-${index + 1}`
		const processedFormat = normalizeImageProcessFormat(
			xMagicImageProcessByFileId?.[file.file_id]?.format,
		)
		const fileExtension = processedFormat || file.file_extension || "png"
		const lastDotIndex = fileName.lastIndexOf(".")
		const baseFileName = lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex)

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

function normalizeImageProcessFormat(format?: ImageFormat): string | undefined {
	if (!format) return undefined
	if (format === "jpg") return "jpg"
	if (format === "tiff") return "tiff"
	return format
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
export function findFileBySrc(
	src: string,
	flatAttachments: FileItem[],
	designProjectBasePath?: string,
	attachmentIndex?: DesignAttachmentIndex | null,
): FileItem | null {
	if (!src || !flatAttachments || flatAttachments.length === 0) {
		return null
	}
	const resolvedCandidates =
		designProjectBasePath && src
			? resolveDesignDslPathCandidatesToWorkspaceRelative(src, designProjectBasePath)
			: [src]
	const normalizedCandidates = resolvedCandidates.map((candidate) => normalizePath(candidate))
	const normalizedSrc = normalizedCandidates[0] || normalizePath(src)

	let fileItem: FileItem | undefined

	if (attachmentIndex) {
		for (const candidate of normalizedCandidates) {
			const direct = attachmentIndex.byNormalizedPath.get(candidate)
			if (direct && !direct.is_directory) {
				fileItem = direct
				break
			}
			const tail = candidate.startsWith("/") ? candidate.slice(1) : candidate
			const relaxed = attachmentIndex.byPathWithoutLeadingSlash.get(tail)
			if (relaxed && !relaxed.is_directory) {
				fileItem = relaxed
				break
			}
		}
	}

	// 方法1: 尝试通过 relative_file_path 匹配
	if (!fileItem) {
		fileItem = flatAttachments.find((item) => {
			if (!item.relative_file_path || item.is_directory) return false
			const itemPath = normalizePath(item.relative_file_path)
			return normalizedCandidates.includes(itemPath)
		})
	}

	// 方法1.5: 如果目录名变化，尝试按多段后缀匹配（至少目录 + 文件名）
	if (!fileItem && normalizedSrc.includes("/")) {
		const pathParts = normalizedSrc.split("/").filter(Boolean)
		for (let i = pathParts.length; i > 1; i--) {
			const pathSuffix = pathParts.slice(-i).join("/")
			fileItem = flatAttachments.find((item) => {
				if (!item.relative_file_path || item.is_directory) return false
				const itemPath = normalizePath(item.relative_file_path)
				return itemPath.endsWith("/" + pathSuffix) || itemPath === pathSuffix
			})
			if (fileItem) break
		}
	}

	// 方法2: 如果 src 是 URL，尝试从 URL 中提取路径或文件名
	if (!fileItem && src.includes("/")) {
		// 尝试从 URL 中提取文件名
		const urlParts = src.split("/")
		const fileName = urlParts[urlParts.length - 1]?.split("?")[0] // 移除查询参数

		if (fileName) {
			const lower = fileName.trim().toLowerCase()
			const bucket = attachmentIndex?.byFileName.get(lower)
			if (bucket?.length) {
				fileItem = bucket.find((item) => !item.is_directory)
			}
			if (!fileItem) {
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
	}

	// 方法3: 如果 src 是 file_id，直接匹配
	if (!fileItem && src && !src.includes("/") && !src.includes("\\")) {
		const byId = attachmentIndex?.byFileId.get(src)
		if (byId && !byId.is_directory) fileItem = byId
		if (!fileItem) {
			fileItem = flatAttachments.find((item) => {
				return !item.is_directory && item.file_id === src
			})
		}
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
		display_config: fileItem.display_config,
		source: fileItem.source || AttachmentSource.PROJECT_DIRECTORY,
	}
}

function mapFileItemToProjectAttachmentMentionNode(
	item: FileItem,
	projectBasePath?: string,
): ProjectAttachmentMentionNode | null {
	const isDir = Boolean(item.is_directory)
	const rawPath = item.relative_file_path || ""
	const path = isDir ? rawPath : normalizeDesignAttachmentPathForCanvas(rawPath, projectBasePath)
	const name = (item.file_name || item.display_filename || "").trim()
	if (!isDir && !name) return null
	if (isDir && !name && !path && !item.file_id) return null

	let children: ProjectAttachmentMentionNode[] | undefined
	if (isDir && item.children?.length) {
		children = item.children
			.map((c) => mapFileItemToProjectAttachmentMentionNode(c, projectBasePath))
			.filter((n): n is ProjectAttachmentMentionNode => n !== null)
	}

	return {
		id: isDir ? path || item.file_id : item.file_id,
		fileId: item.file_id,
		name: name || path || item.file_id,
		path,
		extension: item.file_extension,
		isDirectory: isDir,
		display_config: item.display_config,
		children: children && children.length > 0 ? children : undefined,
	}
}

/** 将话题附件树转为画布 @ / 参考资源面板的目录树数据源 */
export function fileItemsToProjectAttachmentMentionTree(
	items: FileItem[] | undefined,
	projectBasePath?: string,
): ProjectAttachmentMentionNode[] {
	if (!items?.length) return []
	return items
		.map((item) => mapFileItemToProjectAttachmentMentionNode(item, projectBasePath))
		.filter((n): n is ProjectAttachmentMentionNode => n !== null)
}
