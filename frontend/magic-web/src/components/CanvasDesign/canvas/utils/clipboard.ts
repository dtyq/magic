import type { LayerElement } from "../types"
import {
	validateAndFilterImageFiles,
	getFileExtensionFromMimeType,
	isCanvasClipboardData,
	type ElementClipboardMetadata,
} from "./utils"
import { isValidElementData } from "./validateElement"

const ELEMENT_METADATA_MIME_TYPE = "application/x-canvas-element-metadata"

/**
 * 剪贴板解析结果类型
 */
export type ClipboardParseResult =
	| { type: "images"; files: File[]; metadata?: ElementClipboardMetadata[] }
	| { type: "elements"; elements: LayerElement[]; canvasId?: string }
	| { type: "empty" }
	| { type: "invalid"; reason: string }

/**
 * 解析剪贴板内容的可选配置
 * 用于注入 clipboard 读写方法（如项目中的 clipboard-helpers），实现与 navigator.clipboard 的解耦
 */
export interface ParseClipboardOptions {
	read?: () => Promise<ClipboardItem[]>
	readText?: () => Promise<string>
}

/**
 * 解析剪贴板内容
 * 按优先级依次尝试三种数据源：
 * 1. ClipboardEvent.clipboardData（最可靠，特别是在粘贴事件中，macOS 从 Finder 复制的文件数据通常在粘贴事件中才可用）
 * 2. clipboard.read() 或 navigator.clipboard.read()（支持富格式和 metadata）
 * 3. 文本内容（向后兼容）
 *
 * @param clipboardEvent 可选的 ClipboardEvent
 * @param options 可选的 clipboard 读写方法，未提供时使用 navigator.clipboard
 * @returns 解析结果
 */
export async function parseClipboardContent(
	clipboardEvent?: ClipboardEvent,
	options?: ParseClipboardOptions,
): Promise<ClipboardParseResult> {
	try {
		// 第一优先级：从 ClipboardEvent.clipboardData 读取文件（最可靠，特别是在粘贴事件中）
		// 在 macOS 上，从 Finder 复制的文件数据通常在粘贴事件中才可用
		const eventResult = parseFromClipboardEvent(clipboardEvent)
		if (eventResult) {
			// 如果从 ClipboardEvent 获取到图片，但没有 metadata，尝试从 Clipboard API 补充 metadata
			if (eventResult.type === "images" && !eventResult.metadata) {
				const clipboardApiResult = await parseFromClipboardAPI(options)
				if (clipboardApiResult?.type === "images" && clipboardApiResult.metadata) {
					// 合并 metadata
					eventResult.metadata = clipboardApiResult.metadata
					// 使用 metadata 的 filename 重命名 File
					eventResult.files = renameFilesWithMetadata(
						eventResult.files,
						clipboardApiResult.metadata,
					)
				}
			}
			return eventResult
		}

		// 第二优先级：从 clipboard.read() 读取富格式内容（包括 metadata）
		const clipboardApiResult = await parseFromClipboardAPI(options)
		if (clipboardApiResult) {
			return clipboardApiResult
		}

		// 第三优先级：从文本读取（向后兼容）
		const textResult = await parseFromText(clipboardEvent, options)
		if (textResult) {
			return textResult
		}

		return { type: "empty" }
	} catch (error) {
		return { type: "invalid", reason: error instanceof Error ? error.message : "未知错误" }
	}
}

/**
 * 使用 metadata 的 filename 重命名 File 对象
 * 提取 metadata filename 的基础名，使用 File 的实际类型作为扩展名
 */
function renameFilesWithMetadata(files: File[], metadata: ElementClipboardMetadata[]): File[] {
	return files.map((file, index) => {
		const meta = metadata[index]
		if (!meta?.filename) {
			return file
		}

		// 提取 metadata filename 的基础名（去掉扩展名）
		const baseName = meta.filename.replace(/\.[^.]*$/, "")

		// 根据 File 的实际类型获取扩展名
		const extension = getFileExtensionFromMimeType(file.type)

		// 创建新的文件名
		const newFileName = `${baseName}.${extension}`

		// 创建新的 File 对象
		return new File([file], newFileName, { type: file.type })
	})
}

/**
 * 第一优先级：从 ClipboardEvent.clipboardData 读取文件
 * 这是最可靠的方式，直接从粘贴事件中获取文件
 */
function parseFromClipboardEvent(clipboardEvent?: ClipboardEvent): ClipboardParseResult | null {
	if (!clipboardEvent?.clipboardData) {
		return null
	}

	// 方法1：尝试从 files 获取
	if (clipboardEvent.clipboardData.files && clipboardEvent.clipboardData.files.length > 0) {
		const files = Array.from(clipboardEvent.clipboardData.files)
		const validImageFiles = validateAndFilterImageFiles(files)

		if (validImageFiles.length > 0) {
			return { type: "images", files: validImageFiles }
		}
	}

	// 方法2：尝试从 items 获取图片数据（更全面的检查）
	if (clipboardEvent.clipboardData.items) {
		const imageFiles: File[] = []
		for (let i = 0; i < clipboardEvent.clipboardData.items.length; i++) {
			const item = clipboardEvent.clipboardData.items[i]

			// 检查所有可能的文件类型
			if (item.kind === "file") {
				// 尝试获取文件（不限制类型，让 validateAndFilterImageFiles 来过滤）
				try {
					const file = item.getAsFile()
					if (file) {
						const validImageFiles = validateAndFilterImageFiles([file])
						if (validImageFiles.length > 0) {
							imageFiles.push(...validImageFiles)
						}
					}
				} catch (error) {
					// 读取失败，继续
				}
			}
		}
		if (imageFiles.length > 0) {
			return { type: "images", files: imageFiles }
		}
	}

	return null
}

/**
 * 第二优先级：从 clipboard.read() 读取富格式内容
 * 支持读取图片、元数据和 JSON 元素
 */
async function parseFromClipboardAPI(
	options?: ParseClipboardOptions,
): Promise<ClipboardParseResult | null> {
	const read =
		options?.read ??
		(navigator.clipboard?.read ? navigator.clipboard.read.bind(navigator.clipboard) : undefined)
	if (!read) {
		return null
	}

	try {
		const clipboardItems = await read()
		const parsedItems: Array<{
			type: "image" | "json"
			file?: File
			element?: LayerElement
			metadata?: ElementClipboardMetadata
			canvasId?: string
		}> = []

		// 遍历所有 ClipboardItem
		// 如果只有 text/plain 且内容是图片文件名，跳过处理
		for (const item of clipboardItems) {
			const itemTypes = Array.from(item.types)

			// 如果只有 text/plain，尝试读取内容并检查是否是图片文件名
			if (itemTypes.length === 1 && itemTypes[0] === "text/plain") {
				try {
					const textBlob = await item.getType("text/plain")
					const textContent = await textBlob.text()
					const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i
					if (imageExtensions.test(textContent.trim())) {
						// 这是图片文件名，但无法获取文件数据，跳过
						continue
					}
				} catch (error) {
					// 读取失败，继续
				}
			}

			const itemResult = await parseClipboardItem(item)
			if (itemResult) {
				parsedItems.push(...itemResult)
			}
		}

		// 分类处理解析结果
		return categorizeParseResults(parsedItems)
	} catch (error) {
		// 读取剪贴板失败，返回 null 继续尝试其他方式
		return null
	}
}

/**
 * 解析单个 ClipboardItem
 */
async function parseClipboardItem(item: ClipboardItem): Promise<
	Array<{
		type: "image" | "json"
		file?: File
		element?: LayerElement
		metadata?: ElementClipboardMetadata
		canvasId?: string
	}>
> {
	const results: Array<{
		type: "image" | "json"
		file?: File
		element?: LayerElement
		metadata?: ElementClipboardMetadata
		canvasId?: string
	}> = []

	// 1. 尝试读取元数据
	const metadata = await parseMetadata(item)

	// 2. 尝试读取图片
	const imageResult = await parseImage(item, metadata)
	if (imageResult) {
		results.push(imageResult)
		return results
	}

	// 3. 如果没有图片，尝试读取 JSON 元素
	const jsonResults = await parseJSON(item)
	if (jsonResults.length > 0) {
		results.push(...jsonResults)
	}

	return results
}

/**
 * 解析元数据
 * 支持两种格式：
 * 1. 自定义 MIME 类型（application/x-canvas-element-metadata）- 向后兼容
 * 2. HTML 注释格式（text/html 中的 <!-- CANVAS_METADATA:... -->）- 推荐方式
 */
async function parseMetadata(item: ClipboardItem): Promise<ElementClipboardMetadata | undefined> {
	// 方法 1：尝试从自定义 MIME 类型读取（向后兼容）
	if (item.types.includes(ELEMENT_METADATA_MIME_TYPE)) {
		try {
			const metadataBlob = await item.getType(ELEMENT_METADATA_MIME_TYPE)
			const metadataText = await metadataBlob.text()
			const parsed = JSON.parse(metadataText) as ElementClipboardMetadata
			return parsed
		} catch (error) {
			// 解析失败，继续尝试其他方法
		}
	}

	// 方法 2：尝试从 text/html 读取（推荐方式，更好的浏览器兼容性）
	if (item.types.includes("text/html")) {
		try {
			const htmlBlob = await item.getType("text/html")
			const htmlText = await htmlBlob.text()

			// 从 HTML 注释中提取 metadata
			const match = htmlText.match(/<!--\s*CANVAS_METADATA:(.*?)\s*-->/)
			if (match && match[1]) {
				const metadataJSON = match[1]
				const parsed = JSON.parse(metadataJSON) as ElementClipboardMetadata
				return parsed
			}
		} catch (error) {
			// 解析失败
		}
	}

	return undefined
}

/**
 * 解析图片
 */
async function parseImage(
	item: ClipboardItem,
	metadata?: ElementClipboardMetadata,
): Promise<{
	type: "image"
	file: File
	metadata?: ElementClipboardMetadata
} | null> {
	// 查找图片类型（跳过 text/plain、text/html 和元数据类型）
	for (const type of item.types) {
		if (type === "text/plain" || type === "text/html" || type === ELEMENT_METADATA_MIME_TYPE) {
			continue
		}

		if (type.startsWith("image/")) {
			try {
				const blob = await item.getType(type)
				let filename: string
				if (metadata?.filename) {
					// 从 metadata.filename 提取基础名称（不含扩展名），后缀使用实际类型
					const baseName = metadata.filename.replace(/\.[^.]*$/, "")
					const extension = getFileExtensionFromMimeType(type)
					filename = `${baseName}.${extension}`
				} else {
					filename = `image.${getFileExtensionFromMimeType(type)}`
				}
				const file = new File([blob], filename, { type })
				const validImageFiles = validateAndFilterImageFiles([file])

				if (validImageFiles.length > 0) {
					return {
						type: "image",
						file: validImageFiles[0],
						metadata,
					}
				}
			} catch (error) {
				// 读取失败，继续尝试下一个类型
			}
		}
	}

	return null
}

/**
 * 解析 JSON 元素
 */
async function parseJSON(item: ClipboardItem): Promise<
	Array<{
		type: "json"
		element: LayerElement
		canvasId?: string
	}>
> {
	const results: Array<{
		type: "json"
		element: LayerElement
		canvasId?: string
	}> = []

	for (const type of item.types) {
		if (type === "application/json") {
			try {
				const blob = await item.getType(type)
				const jsonText = await blob.text()
				const jsonData = JSON.parse(jsonText)

				// 检查是否为旧的 CanvasClipboardData 格式
				if (isCanvasClipboardData(jsonData)) {
					// 兼容旧格式：展开 elements 数组
					for (const elementData of jsonData.elements) {
						if (isValidElementData(elementData)) {
							results.push({
								type: "json",
								element: elementData,
								canvasId: jsonData.id,
							})
						}
					}
				} else if (isValidElementData(jsonData)) {
					// 单个元素对象
					results.push({
						type: "json",
						element: jsonData,
					})
				}
			} catch (error) {
				// JSON 解析失败，继续
			}
			break
		}
	}

	return results
}

/**
 * 分类处理解析结果
 */
function categorizeParseResults(
	parsedItems: Array<{
		type: "image" | "json"
		file?: File
		element?: LayerElement
		metadata?: ElementClipboardMetadata
		canvasId?: string
	}>,
): ClipboardParseResult | null {
	const imageItems = parsedItems.filter((item) => item.type === "image")
	const jsonItems = parsedItems.filter((item) => item.type === "json")

	if (imageItems.length > 0) {
		// 如果有图片，返回图片
		const files = imageItems
			.map((item) => item.file)
			.filter((file): file is File => file !== undefined)
		const metadataList = imageItems
			.map((item) => item.metadata)
			.filter((meta): meta is ElementClipboardMetadata => meta !== undefined)
		return {
			type: "images",
			files,
			metadata: metadataList.length > 0 ? metadataList : undefined,
		}
	}

	if (jsonItems.length > 0) {
		// 如果有 JSON 元素，返回元素
		const elements = jsonItems
			.map((item) => item.element)
			.filter((el): el is LayerElement => el !== undefined)
		if (elements.length > 0) {
			// 获取第一个元素的 canvasId（所有元素应该来自同一个画布）
			const canvasId = jsonItems.find((item) => item.canvasId)?.canvasId
			return { type: "elements", elements, canvasId }
		}
	}

	return null
}

/**
 * 第三优先级：从文本读取（向后兼容）
 */
async function parseFromText(
	clipboardEvent?: ClipboardEvent,
	options?: ParseClipboardOptions,
): Promise<ClipboardParseResult | null> {
	// 优先从 ClipboardEvent 获取文本
	let clipboardText = ""
	if (clipboardEvent?.clipboardData) {
		clipboardText = clipboardEvent.clipboardData.getData("text/plain")
	}

	// 如果从 ClipboardEvent 获取不到文本，尝试使用 Clipboard API
	if (!clipboardText) {
		const readText =
			options?.readText ??
			(navigator.clipboard?.readText
				? navigator.clipboard.readText.bind(navigator.clipboard)
				: undefined)
		if (!readText) {
			return null
		}
		try {
			clipboardText = await readText()
		} catch (error) {
			// Clipboard API 读取失败，返回 null
			return null
		}
	}

	if (!clipboardText) {
		return null
	}

	// 检查是否是图片文件名（而不是 JSON）
	// 如果文本看起来像文件名（包含图片扩展名），且不是 JSON，则返回 null 而不是 invalid
	const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i
	const looksLikeImageFilename =
		imageExtensions.test(clipboardText.trim()) &&
		!clipboardText.trim().startsWith("{") &&
		!clipboardText.trim().startsWith("[")

	// 尝试解析 JSON
	let clipboardData: unknown
	try {
		clipboardData = JSON.parse(clipboardText)
	} catch {
		// 如果是图片文件名，返回 null 而不是 invalid（因为这不是错误，只是没有可用的数据）
		if (looksLikeImageFilename) {
			return null
		}
		return { type: "invalid", reason: "剪贴板内容不是有效的 JSON" }
	}

	// 检查是否为画布剪贴板数据格式（向后兼容）
	if (isCanvasClipboardData(clipboardData)) {
		// 验证每个元素
		const validElements: LayerElement[] = []
		for (const elementData of clipboardData.elements) {
			if (isValidElementData(elementData)) {
				validElements.push(elementData)
			}
		}

		if (validElements.length === 0) {
			return { type: "invalid", reason: "剪贴板中没有有效的元素数据" }
		}

		return { type: "elements", elements: validElements, canvasId: clipboardData.id }
	}

	// 检查是否为单个元素对象
	if (isValidElementData(clipboardData)) {
		return { type: "elements", elements: [clipboardData] }
	}

	return { type: "invalid", reason: "剪贴板内容不是有效的画布数据" }
}
