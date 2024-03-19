import Konva from "konva"
import type { LayerElement, RichTextParagraph, ElementType, ImageElement } from "../types"
import type { UploadImageResponse, ImageModelItem } from "../../types.magic"
import { ElementTypeEnum } from "../types"
import type { Canvas } from "../Canvas"
import { ImageElement as ImageElementClass } from "../element/elements/ImageElement"

/**
 * 矩形边界
 */
export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

/**
 * 雪花ID生成器
 * 生成20位数字ID
 * 格式：时间戳(13位) + 机器ID(2位) + 序列号(5位) = 20位
 */
class SnowflakeIdGenerator {
	private sequence: number = 0
	private lastTimestamp: number = 0
	private readonly workerId: number = 1 // 机器ID，范围 0-99

	/**
	 * 生成20位雪花ID
	 * 格式：时间戳(13位) + 机器ID(2位) + 序列号(5位) = 20位
	 */
	generate(): string {
		let now = Date.now()

		// 如果时间戳回退，等待下一毫秒
		if (now < this.lastTimestamp) {
			now = this.lastTimestamp
		}

		// 同一毫秒内，序列号递增
		if (now === this.lastTimestamp) {
			this.sequence = (this.sequence + 1) % 100000 // 5位序列号，最大99999
			if (this.sequence === 0) {
				// 序列号溢出，等待下一毫秒
				now = this.waitNextMillis(this.lastTimestamp)
			}
		} else {
			this.sequence = 0
		}

		this.lastTimestamp = now

		// 时间戳取后13位（确保20位总长度）
		const timestamp = now % 10000000000000 // 13位
		const workerId = this.workerId % 100 // 2位
		const sequence = this.sequence % 100000 // 5位

		// 组合成20位数字字符串
		const id = `${timestamp.toString().padStart(13, "0")}${workerId
			.toString()
			.padStart(2, "0")}${sequence.toString().padStart(5, "0")}`

		return id
	}

	/**
	 * 等待下一毫秒
	 */
	private waitNextMillis(lastTimestamp: number): number {
		let timestamp = Date.now()
		while (timestamp <= lastTimestamp) {
			timestamp = Date.now()
		}
		return timestamp
	}
}

// 全局雪花ID生成器实例
const snowflakeGenerator = new SnowflakeIdGenerator()

/**
 * 生成元素唯一标识
 * 格式：element-{20位雪花ID}
 * @returns 元素唯一标识
 */
export function generateElementId(): string {
	const snowflakeId = snowflakeGenerator.generate()
	return `element-${snowflakeId}`
}

/**
 * 生成标记唯一标识
 * 格式：marker-{20位雪花ID}
 * @returns 标记唯一标识
 */
export function generateMarkerId(): string {
	const snowflakeId = snowflakeGenerator.generate()
	return `marker-${snowflakeId}`
}

/**
 * 生成 UUID v4
 * 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * @returns UUID 字符串
 */
export function generateUUID(): string {
	// 优先使用浏览器原生 API（如果可用）
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID()
	}

	// 降级方案：手动生成 UUID v4
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * 递归获取元素及其所有子元素的扁平列表
 * @param element 元素
 * @returns 包含该元素及其所有子孙元素的数组
 */
function flattenElement(element: LayerElement): LayerElement[] {
	const result: LayerElement[] = [element]

	if ("children" in element && element.children) {
		for (const child of element.children) {
			result.push(...flattenElement(child))
		}
	}

	return result
}

/**
 * 获取单个元素的边界矩形
 * @param element 元素
 * @returns 元素的边界矩形，如果元素没有位置信息则返回 null
 */
function getElementRect(element: LayerElement): Rect | null {
	const { x, y, width, height } = element

	if (x === undefined || y === undefined || width === undefined || height === undefined) {
		return null
	}

	return { x, y, width, height }
}

/**
 * 合并多个矩形，计算包含所有矩形的最小边界矩形
 * @param rects 矩形数组
 * @returns 合并后的边界矩形，如果数组为空则返回 null
 */
function mergeRects(rects: Rect[]): Rect | null {
	if (rects.length === 0) {
		return null
	}

	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity

	for (const rect of rects) {
		minX = Math.min(minX, rect.x)
		minY = Math.min(minY, rect.y)
		maxX = Math.max(maxX, rect.x + rect.width)
		maxY = Math.max(maxY, rect.y + rect.height)
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	}
}

/**
 * 计算指定多个元素的总体边界矩形
 *
 * 该函数会：
 * 1. 深度递归处理有子元素的容器元素，获取所有子孙元素
 * 2. 收集所有元素（包括子元素）的边界矩形
 * 3. 计算包含所有元素的最小边界矩形
 *
 * @param elements 元素数组
 * @returns 总体边界矩形，如果没有有效元素则返回 null
 *
 * @example
 * ```typescript
 * const elements = [element1, element2, containerElement]
 * const rect = calculateElementsRect(elements)
 * if (rect) {
 *   console.log(`总体边界: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`)
 * }
 * ```
 */
export function calculateElementsRect(elements: LayerElement[]): Rect | null {
	if (elements.length === 0) {
		return null
	}

	// 扁平化所有元素（包括递归展开有子元素的容器元素的子元素）
	const allElements: LayerElement[] = []
	for (const element of elements) {
		allElements.push(...flattenElement(element))
	}

	// 收集所有有效的边界矩形
	const rects: Rect[] = []
	for (const element of allElements) {
		const rect = getElementRect(element)
		if (rect) {
			rects.push(rect)
		}
	}

	// 合并所有矩形
	return mergeRects(rects)
}

/**
 * 计算多个 Konva 节点的总体边界矩形（返回 layer 坐标系中的位置）
 *
 * 该函数会：
 * 1. 优先使用 Element 实例的 getBoundingRect() 方法（如果可用）
 * 2. 递归处理 Group 节点，获取所有叶子节点（实际渲染的 Shape）
 * 3. 使用 Konva 的 getClientRect() 方法获取每个节点的边界矩形
 * 4. 计算包含所有节点的最小边界矩形
 *
 * 注意：返回的坐标是相对于 layer 的坐标（不包含 stage 的变换）
 *
 * @param nodes Konva 节点数组
 * @param stage Konva Stage 实例（用于保持接口一致性，当前未直接使用）
 * @param elementManager 可选的 ElementManager 实例，用于获取 Element 的自定义边界计算
 * @returns 总体边界矩形（layer 坐标系），如果没有有效节点则返回 null
 */
export function calculateNodesRect(
	nodes: Konva.Node[],
	stage: Konva.Stage,
	elementManager?: {
		getElementInstance: (id: string) => { getBoundingRect?: () => Rect | null } | undefined
	},
): Rect | null {
	// stage 参数保留用于未来扩展
	void stage
	if (nodes.length === 0) {
		return null
	}

	const rects: Rect[] = []

	for (const node of nodes) {
		// 尝试从 ElementManager 获取 Element 实例并使用自定义边界计算
		const elementId = node.id()
		let rect: Rect | null = null

		if (elementManager && elementId) {
			const element = elementManager.getElementInstance(elementId)
			if (element && typeof element.getBoundingRect === "function") {
				// 优先使用 Element 的自定义边界计算
				rect = element.getBoundingRect()
			}
		}

		// 如果没有自定义方法，使用默认逻辑
		if (!rect) {
			if (node instanceof Konva.Group) {
				// 对于 Group，递归收集子节点的边界矩形
				const groupRects: Rect[] = []
				collectGroupChildrenRects(node, groupRects)
				const mergedRect = mergeRects(groupRects)
				if (mergedRect) {
					rects.push(mergedRect)
				}
				continue
			} else {
				// 对于普通节点，使用 getClientRect
				const clientRect = node.getClientRect({ relativeTo: node.getLayer() || undefined })
				if (clientRect.width > 0 && clientRect.height > 0) {
					rect = {
						x: clientRect.x,
						y: clientRect.y,
						width: clientRect.width,
						height: clientRect.height,
					}
				}
			}
		}

		if (rect) {
			rects.push(rect)
		}
	}

	// 合并所有矩形
	return mergeRects(rects)
}

/**
 * 递归收集 Group 子节点的边界矩形
 * 排除装饰性 UI 元素（名称以 decorator- 开头的元素）
 */
function collectGroupChildrenRects(group: Konva.Group, rects: Rect[]): void {
	const children = group.children

	for (const child of children) {
		// 跳过所有装饰性 UI 元素（名称以 decorator- 开头）
		if (child.name().startsWith("decorator-")) {
			continue
		}

		if (child instanceof Konva.Group) {
			// 递归处理子 Group
			collectGroupChildrenRects(child, rects)
		} else {
			// 叶子节点（Shape）直接获取边界矩形
			const clientRect = child.getClientRect({ relativeTo: child.getLayer() || undefined })
			if (clientRect.width > 0 && clientRect.height > 0) {
				rects.push({
					x: clientRect.x,
					y: clientRect.y,
					width: clientRect.width,
					height: clientRect.height,
				})
			}
		}
	}
}

/**
 * 从富文本段落数组中提取所有文本内容
 * @param paragraphs 富文本段落数组
 * @returns 提取的文本字符串
 */
export function extractTextFromRichTextParagraphs(
	paragraphs: RichTextParagraph[] | undefined,
): string {
	if (!paragraphs || paragraphs.length === 0) {
		return ""
	}

	return paragraphs
		.map((paragraph) => {
			if (!paragraph.children || paragraph.children.length === 0) {
				return ""
			}
			return paragraph.children
				.map((node) => {
					if (node.type === "text") {
						return node.text || ""
					}
					return ""
				})
				.join("")
		})
		.join("\n")
}

/**
 * 递归收集指定类型的所有元素（包括子元素）
 * @param elements 元素数组
 * @param elementType 要收集的元素类型
 * @returns 收集到的元素数组
 */
export function collectElementsByType(
	elements: LayerElement[],
	elementType: ElementType,
): LayerElement[] {
	const result: LayerElement[] = []

	for (const element of elements) {
		if (element.type === elementType) {
			result.push(element)
		}

		// 递归处理子元素
		if ("children" in element && element.children && element.children.length > 0) {
			result.push(...collectElementsByType(element.children, elementType))
		}
	}

	return result
}

/**
 * 将 useImmer 创建的 Proxy 对象转换为普通对象
 * 通过 JSON 序列化/反序列化实现深拷贝，确保返回的是普通对象而非 Proxy
 *
 * @param value 可能是 Proxy 对象的值
 * @returns 转换后的普通对象
 *
 * @example
 * ```typescript
 * const immerData = useImmer({ elements: [] })
 * const plainData = toPlainObject(immerData)
 * canvas.loadDocument(plainData)
 * ```
 */
export function toPlainObject<T>(value: T): T {
	if (value === null || value === undefined) {
		return value
	}
	return JSON.parse(JSON.stringify(value)) as T
}

// utils.ts 中添加
export function isMobile(): boolean {
	return (
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		) || window.innerWidth < 768
	)
}

export function isTouchDevice(): boolean {
	return "ontouchstart" in window || navigator.maxTouchPoints > 0
}

/**
 * 文件类型配置
 */
export interface FileTypeConfig {
	/** MIME 类型前缀或完整类型，如 "image/" 或 "image/png" */
	mimeType: string
	/** 最大文件大小（字节） */
	maxSize: number
}

/**
 * 允许的文件类型配置（基于 MIME type）
 * 用于验证 File 对象（从文件系统拖拽）
 * 目前暂时只允许图片，且不限制大小
 * 注意：与 SUPPORTED_IMAGE_EXTENSIONS 保持一致
 */
export const ALLOWED_FILE_TYPES: FileTypeConfig[] = [
	{ mimeType: "image/", maxSize: Infinity }, // Infinity 表示不限制大小
]

/**
 * 检查文件是否为允许的类型
 * @param file 文件对象
 * @returns 是否为允许的类型
 */
export function isAllowedFileType(file: File): boolean {
	return ALLOWED_FILE_TYPES.some((config) => {
		if (config.mimeType.endsWith("/")) {
			// 前缀匹配，如 "image/"
			return file.type.startsWith(config.mimeType)
		} else {
			// 精确匹配，如 "image/png"
			return file.type === config.mimeType
		}
	})
}

/**
 * 检查文件大小是否符合限制
 * @param file 文件对象
 * @returns 是否符合大小限制
 */
export function isFileSizeValid(file: File): boolean {
	const config = ALLOWED_FILE_TYPES.find((c) => {
		if (c.mimeType.endsWith("/")) {
			return file.type.startsWith(c.mimeType)
		} else {
			return file.type === c.mimeType
		}
	})

	if (!config) {
		return false
	}

	// maxSize 为 Infinity 表示不限制大小
	if (config.maxSize === Infinity) {
		return true
	}

	return file.size <= config.maxSize
}

/**
 * 验证文件是否符合所有限制（类型和大小）
 * @param file 文件对象
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
	if (!isAllowedFileType(file)) {
		return { valid: false, error: `不支持的文件类型: ${file.type}` }
	}

	if (!isFileSizeValid(file)) {
		const config = ALLOWED_FILE_TYPES.find((c) => {
			if (c.mimeType.endsWith("/")) {
				return file.type.startsWith(c.mimeType)
			} else {
				return file.type === c.mimeType
			}
		})
		if (config && config.maxSize !== Infinity) {
			const maxSizeMB = (config.maxSize / 1024 / 1024).toFixed(2)
			return { valid: false, error: `文件大小超过限制: ${maxSizeMB}MB` }
		}
		return { valid: false, error: `文件大小超过限制` }
	}

	return { valid: true }
}

/**
 * 检查文件列表是否全部为图片类型
 * @param files 文件列表
 * @returns 是否全部为图片类型
 */
export function areAllFilesImages(files: FileList | File[]): boolean {
	const fileArray = Array.from(files)
	if (fileArray.length === 0) {
		return false
	}
	return fileArray.every((file) => file.type.startsWith("image/"))
}

/**
 * 检查文件是否为图片类型
 * @param file 文件对象
 * @returns 是否为图片类型
 */
export function isImageFile(file: File): boolean {
	const imageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
	return imageTypes.includes(file.type)
}

/**
 * 画布支持的图片文件扩展名（基于文件扩展名）
 * 用于验证文件路径（从项目文件列表拖拽）
 * 与 isImageFile 和 ALLOWED_FILE_TYPES 保持一致
 */
export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"] as const

/**
 * 文件验证结果
 */
export interface FileValidationResult {
	/** 是否有效 */
	valid: boolean
	/** 无效原因 */
	reason?: string
}

/**
 * 验证文件路径是否为支持的图片格式
 * @param filePath 文件路径
 * @returns 验证结果
 */
export function validateImageFilePath(filePath: string): FileValidationResult {
	if (!filePath) {
		return { valid: false, reason: "文件路径为空" }
	}

	// 提取文件扩展名
	const lastDotIndex = filePath.lastIndexOf(".")
	if (lastDotIndex === -1) {
		return { valid: false, reason: "无法识别文件扩展名" }
	}

	const ext = filePath.slice(lastDotIndex).toLowerCase()

	// 检查是否为支持的图片格式
	if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number])) {
		return {
			valid: false,
			reason: `不支持的文件类型: ${ext}`,
		}
	}

	return { valid: true }
}

/**
 * 批量验证文件路径列表
 * @param filePaths 文件路径列表
 * @returns 验证结果，包含有效文件和无效文件
 */
export function validateImageFilePaths(filePaths: string[]): {
	validFiles: string[]
	invalidFiles: Array<{ filePath: string; reason: string }>
} {
	const validFiles: string[] = []
	const invalidFiles: Array<{ filePath: string; reason: string }> = []

	for (const filePath of filePaths) {
		const validation = validateImageFilePath(filePath)
		if (validation.valid) {
			validFiles.push(filePath)
		} else {
			invalidFiles.push({
				filePath,
				reason: validation.reason || "未知错误",
			})
		}
	}

	return { validFiles, invalidFiles }
}

/**
 * 获取图片文件的原始尺寸
 * @param file 图片文件对象
 * @returns Promise<{width: number, height: number}> 图片的宽度和高度
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		const url = URL.createObjectURL(file)

		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve({
				width: img.naturalWidth,
				height: img.naturalHeight,
			})
		}

		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error("Failed to load image"))
		}

		img.src = url
	})
}

/**
 * 根据第一个模型列表、第一个分辨率、第一个选项获取默认图片尺寸
 * @param imageModelList 模型列表
 * @returns 默认尺寸对象，包含 width、height 和 size 字符串，如果无法获取则返回 null
 */
export function getDefaultImageSize(
	imageModelList: ImageModelItem[],
): { width: number; height: number; size: string } | null {
	// 获取第一个模型
	if (imageModelList.length === 0) {
		return null
	}

	const firstModel = imageModelList[0]
	if (!firstModel?.image_size_config?.sizes || firstModel.image_size_config.sizes.length === 0) {
		return null
	}

	// 获取第一个分辨率（第一个 size 项）
	const firstSize = firstModel.image_size_config.sizes[0]
	if (!firstSize?.value) {
		return null
	}

	// 解析尺寸值（格式为 "宽度x高度"，如 "1024x1024"）
	const [width, height] = firstSize.value.split("x").map(Number)
	if (isNaN(width) || isNaN(height)) {
		return null
	}

	return {
		width,
		height,
		size: firstSize.value,
	}
}

/**
 * 计算多个图片的水平排列布局位置
 * 图片按宽度并排，顶部对齐
 * @param imageDimensions 图片尺寸数组，每个元素包含 width 和 height
 * @param anchorPosition 锚点位置，第一个图片的中心将位于此位置
 * @param spacing 图片之间的间距，默认为 0（无间隙）
 * @returns 每个图片的中心位置数组
 */
export function calculateHorizontalImageLayout(
	imageDimensions: Array<{ width: number; height: number }>,
	anchorPosition: { x: number; y: number },
	spacing: number = 0,
): Array<{ x: number; y: number }> {
	if (imageDimensions.length === 0) {
		return []
	}

	const firstImageDimensions = imageDimensions[0]
	const firstImageWidth = firstImageDimensions.width
	const firstImageHeight = firstImageDimensions.height

	// 第一个图片的顶部位置（顶部对齐）
	const topY = anchorPosition.y - firstImageHeight / 2

	// 第一个图片的左边缘从锚点位置开始
	let currentLeftEdge = anchorPosition.x - firstImageWidth / 2

	// 计算每个图片的中心位置
	return imageDimensions.map((dimensions) => {
		// 计算当前图片的中心位置
		const centerX = currentLeftEdge + dimensions.width / 2
		// 计算当前图片的中心 Y（顶部对齐：顶部 + 当前图片高度的一半）
		const centerY = topY + dimensions.height / 2

		// 更新下一个图片的左边缘位置（当前图片右边缘 + 间距）
		currentLeftEdge += dimensions.width + spacing

		return { x: centerX, y: centerY }
	})
}

/**
 * 画布剪贴板数据格式（统一格式，单个或多个元素都使用数组，向后兼容）
 */
export interface CanvasClipboardData {
	elements: LayerElement[]
	/** 画布唯一标识，用于跨画布粘贴校验 */
	id?: string
}

/**
 * 元素剪贴板元数据（用于关联图片文件和元素数据）
 */
export interface ElementClipboardMetadata {
	data: ImageElement
	filename: string
	mimeType: string
	fileSize: number
}

/**
 * 类型守卫：检查是否为画布剪贴板数据格式
 */
export function isCanvasClipboardData(data: unknown): data is CanvasClipboardData {
	return (
		typeof data === "object" &&
		data !== null &&
		"elements" in data &&
		Array.isArray(data.elements)
	)
}

/**
 * 类型守卫：检查元素是否为 ImageElement 实例（具有 preloadImage 方法）
 */
export function isImageElementInstance(element: unknown): element is ImageElement & {
	preloadImage: () => void
	setOssSrc: (ossSrc: string) => void
	getUploadResult?: () => UploadImageResponse[] | undefined
} {
	return (
		typeof element === "object" &&
		element !== null &&
		"preloadImage" in element &&
		typeof (element as { preloadImage: unknown }).preloadImage === "function"
	)
}

/**
 * 验证并过滤有效的图片文件
 * @param files 文件数组
 * @returns 有效的图片文件数组
 */
export function validateAndFilterImageFiles(files: File[]): File[] {
	const validImageFiles: File[] = []
	for (const file of files) {
		if (isAllowedFileType(file)) {
			const validation = validateFile(file)
			if (validation.valid && isImageFile(file)) {
				validImageFiles.push(file)
			}
		}
	}
	return validImageFiles
}

/**
 * 生成唯一的元素名称
 * 如果名称已存在，则在名称后添加(n)，n 从 1 开始递增
 * @param baseName 基础名称
 * @param existingNames 现有元素名称集合（包括所有元素，包括子元素）
 * @returns 唯一的名称
 * @example
 * generateUniqueElementName("我是元素", ["我是元素"]) // "我是元素(1)"
 * generateUniqueElementName("我是元素", ["我是元素", "我是元素(1)"]) // "我是元素(2)"
 * generateUniqueElementName("image(1)", ["image(1)"]) // "image(2)"
 */
export function generateUniqueElementName(baseName: string, existingNames: Set<string>): string {
	// 如果基础名称为空，返回空字符串
	if (!baseName || baseName.trim() === "") {
		return baseName
	}

	// 提取基础名称和计数器（如果存在）
	// 匹配模式：名称末尾的 (数字) 格式
	const match = baseName.match(/^(.+)\((\d+)\)$/)
	let actualBaseName: string
	let startCounter: number

	if (match) {
		// 如果名称已经包含 (n) 后缀，提取基础名称和起始计数器
		actualBaseName = match[1]
		startCounter = parseInt(match[2], 10)
	} else {
		// 如果名称不包含 (n) 后缀，直接使用原名称
		actualBaseName = baseName
		startCounter = 0
	}

	// 如果原始名称不存在，直接返回
	if (!existingNames.has(baseName)) {
		return baseName
	}

	// 名称已存在，尝试添加或递增 (n) 后缀
	let counter = startCounter + 1
	let newName = `${actualBaseName}(${counter})`

	// 递增计数器，直到找到一个不重复的名称
	while (existingNames.has(newName)) {
		counter++
		newName = `${actualBaseName}(${counter})`
	}

	return newName
}

/**
 * 计算新元素的位置（放在原元素右边，顶部对齐）
 * @param originalElement 原元素数据
 * @param originalElementInstance 原元素实例（需要 getBoundingRect 方法）
 * @param elementManager 元素管理器（用于查找父元素）
 * @param spacing 新元素与原元素之间的间距，默认为 0
 * @returns 新元素的位置坐标，如果无法计算则返回 null
 */
export function calculateNewElementPosition(
	originalElement: LayerElement,
	originalElementInstance: { getBoundingRect: () => Rect | null },
	elementManager: { findParentIdForElement: (id: string) => string | undefined },
	spacing: number = 0,
): { x: number; y: number } | null {
	// 获取原图片的位置和尺寸
	const originalWidth = originalElement.width ?? 1024

	// 检查原图片是否在 Frame 里面
	const parentId = elementManager.findParentIdForElement(originalElement.id)
	let newX: number
	let newY: number

	if (parentId) {
		// 原图片在 Frame 里，需要使用画布绝对坐标
		const boundingRect = originalElementInstance.getBoundingRect()
		if (!boundingRect) {
			return null
		}
		// 新元素放在原图片右边，顶部对齐（使用画布绝对坐标）
		newX = boundingRect.x + boundingRect.width + spacing
		newY = boundingRect.y // 顶部对齐
	} else {
		// 原图片不在 Frame 里，直接使用相对坐标
		const originalX = originalElement.x ?? 0
		const originalY = originalElement.y ?? 0
		newX = originalX + originalWidth + spacing
		newY = originalY // 顶部对齐
	}

	return { x: newX, y: newY }
}

/**
 * 从 MIME 类型获取文件后缀
 * @param mimeType MIME 类型，如 "image/png"
 * @returns 文件后缀，如 "png"
 */
export function getFileExtensionFromMimeType(mimeType: string): string {
	// MIME 类型到文件后缀的映射
	const mimeTypeToExtension: Record<string, string> = {
		"image/png": "png",
		"image/jpeg": "jpeg",
		"image/jpg": "jpg",
		"image/gif": "gif",
		"image/webp": "webp",
		"image/svg+xml": "svg",
		"image/bmp": "bmp",
		"image/x-icon": "ico",
	}

	// 如果映射中存在，直接返回
	if (mimeTypeToExtension[mimeType]) {
		return mimeTypeToExtension[mimeType]
	}

	// 否则尝试从 MIME 类型中提取后缀部分
	const parts = mimeType.split("/")
	if (parts.length === 2) {
		const subtype = parts[1]
		// 处理类似 "svg+xml" 的情况，取第一部分
		const extension = subtype.split("+")[0]
		// 处理类似 "x-icon" 的情况，去掉 "x-" 前缀
		return extension.replace(/^x-/, "")
	}

	// 默认返回 "png"
	return "png"
}

/**
 * 获取已加载的图片元素列表
 */
export function getLoadedImageElements(canvas: Canvas): ImageElement[] {
	const selectedIds = canvas.selectionManager.getSelectedIds()
	const imageElements: ImageElement[] = []

	for (const id of selectedIds) {
		const elementData = canvas.elementManager.getElementData(id)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) continue

		const imageElement = elementData as ImageElement

		// 从 ImageElement 实例判断图片是否已加载
		if (imageElement.src) {
			const elementInstance = canvas.elementManager.getElementInstance(id)
			if (
				elementInstance &&
				elementInstance instanceof ImageElementClass &&
				elementInstance.isImageLoaded()
			) {
				imageElements.push(imageElement)
			}
		}
	}

	return imageElements
}

/**
 * 规范化路径，统一去除前导 "/"
 * @param path 路径（path）
 * @returns 规范化后的路径
 */
export function normalizePath(path: string): string {
	return path.startsWith("/") ? path.slice(1) : path
}
