import type { GetFileInfoResponse } from "@/components/CanvasDesign/types.magic"
import { parseExpiresAt, isOssExpired } from "@/components/CanvasDesign/canvas/utils/ossExpiryUtils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import projectFilesStore from "@/stores/projectFiles"
import { normalizePath } from "./utils"
import { GetFileInfoResponseWithFileId } from "./uploadCallbacks"
import type { ImageProcessOptions } from "@/utils/image-processing"

const IMAGE_PROCESS_OPTIONS: { xMagicImageProcess?: ImageProcessOptions } = {
	xMagicImageProcess: {
		format: "webp",
		// 	quality: 80,
	},
}

/**
 * 图片处理文件大小限制
 * 超过此大小的文件使用图片处理选项会导致服务端错误
 */
// const IMAGE_PROCESS_SIZE_LIMIT = 20 * 1024 * 1024 // 20MB in bytes
// const IMAGE_PROCESS_SIZE_LIMIT = 20971520
// const IMAGE_PROCESS_SIZE_LIMIT = 20971420 // 20MB - 10KB

// const IMAGE_PROCESS_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB in bytes
// const IMAGE_PROCESS_SIZE_LIMIT = 50971520 // 50MB in bytes
const IMAGE_PROCESS_SIZE_LIMIT = 50971420 // 50MB - 10KB

/**
 * 根据文件大小判断是否应该使用图片处理选项
 * @param fileSize 文件大小（字节），如果未提供则返回 false（保守策略）
 * @returns true 表示应该使用图片处理选项，false 表示不使用
 */
function shouldUseImageProcess(fileSize?: number): boolean {
	if (fileSize === undefined || fileSize === null || fileSize <= 0) {
		return false
	}
	return fileSize < IMAGE_PROCESS_SIZE_LIMIT
}

/**
 * 批量请求合并的等待窗口期(毫秒)
 * 在此时间窗口内的多个请求会被合并为一次批量请求
 */
const BATCH_REQUEST_WINDOW_MS = 100

/**
 * 文件查找重试配置
 */
const FILE_FIND_RETRY_CONFIG = {
	/** 重试次数（不包括首次尝试） */
	retryCount: 2,
	/** 每次重试的间隔时间（毫秒） */
	retryInterval: 3000,
} as const

/**
 * 缓存开关
 * 控制是否启动结果缓存
 */
let cacheEnabled = true

/**
 * 文件信息结果缓存（统一存储）
 * key: file_id
 * value: GetFileInfoResponse
 */
const fileInfoCache = new Map<string, GetFileInfoResponse>()

/**
 * path -> file_id 映射索引（用于通过 path 快速查找 file_id）
 * key: normalized file_path
 * value: file_id
 */
const pathToIdIndex = new Map<string, string>()

/**
 * 正在进行的文件信息请求缓存（用于请求去重）
 * key: file_id
 * value: Promise<GetFileInfoResponse>
 */
const fileInfoRequestCache = new Map<string, Promise<GetFileInfoResponse>>()

/**
 * 批量请求队列项
 */
interface BatchRequestItem {
	path: string
	normalizedPath: string
	fileId: string
	fileName: string
	fileSize?: number
	resolve: (value: GetFileInfoResponse) => void
	reject: (error: Error) => void
}

/**
 * 批量请求队列
 */
const batchQueue: BatchRequestItem[] = []

/**
 * 批量请求定时器
 */
let batchTimer: NodeJS.Timeout | null = null

/**
 * 无 expires_at 时的默认 TTL（毫秒），15 分钟
 * OSS 临时 URL 通常有时效，API 未返回 expires_at 时采用保守策略
 */
const DEFAULT_TTL_MS = 15 * 60 * 1000

/**
 * 无 expires_at 的缓存写入时间戳
 * key: file_id
 * value: 写入时的时间戳（毫秒）
 */
const cacheTimestampMap = new Map<string, number>()

/**
 * 检查缓存的 fileInfo 是否已过期
 * - 有 expires_at：按 API 返回的过期时间判断
 * - 无 expires_at：按默认 TTL 判断
 * @param cached 缓存的 GetFileInfoResponse
 * @param fileId 文件 ID（用于查询无 expires_at 时的写入时间）
 * @returns true 表示已过期或应视为无效
 */
function isCachedFileInfoExpired(cached: GetFileInfoResponse, fileId: string): boolean {
	const expiresAtTs = parseExpiresAt(cached.expires_at)
	if (expiresAtTs !== null) {
		return isOssExpired(expiresAtTs)
	}
	// 无 expires_at：按默认 TTL 判断
	const cachedAt = cacheTimestampMap.get(fileId)
	if (cachedAt === undefined) return false
	return Date.now() - cachedAt >= DEFAULT_TTL_MS
}

/**
 * 查找文件项（优先从传入的文件列表中查找，如果没有传入则从 projectFilesStore 中查找）
 */
function findFileItem(
	normalizedPath: string,
	path: string,
	filesList?: FileItem[],
): {
	file_id: string
	file_name: string
	display_filename?: string
	file_size?: number
} | null {
	// 优先使用传入的文件列表，如果没有传入则从 projectFilesStore 获取
	const storeFiles = filesList || projectFilesStore.workspaceFilesList || []
	if (storeFiles.length === 0) {
		return null
	}

	// 方法1: 精确匹配路径
	let fileItem = storeFiles.find((item) => {
		if (!item.relative_file_path) return false
		const itemPath = normalizePath(item.relative_file_path)
		return itemPath === normalizedPath && !item.is_directory
	})

	// 方法2: 如果精确匹配失败，尝试路径匹配的变体（处理路径格式不一致的情况）
	if (!fileItem) {
		// 尝试去掉开头斜杠的匹配
		const pathWithoutLeadingSlash = normalizedPath.startsWith("/")
			? normalizedPath.slice(1)
			: normalizedPath

		fileItem = storeFiles.find((item) => {
			if (!item.relative_file_path || item.is_directory) return false
			const itemPath = normalizePath(item.relative_file_path)
			const itemPathWithoutLeadingSlash = itemPath.startsWith("/")
				? itemPath.slice(1)
				: itemPath
			return itemPathWithoutLeadingSlash === pathWithoutLeadingSlash
		})

		// 如果还是找不到，尝试路径末尾部分匹配（如果目标路径是文件列表项路径的末尾部分）
		// 注意：只有当 pathSuffix 包含至少一个目录层级时才进行匹配，避免仅文件名匹配到不同目录下的同名文件
		if (!fileItem && normalizedPath.includes("/")) {
			const pathParts = normalizedPath.split("/").filter(Boolean)
			// 从路径末尾开始，逐步增加路径段进行匹配
			// 至少需要2个路径段（目录+文件名）才进行后缀匹配，避免仅文件名匹配
			for (let i = pathParts.length; i > 1; i--) {
				const pathSuffix = pathParts.slice(-i).join("/")
				fileItem = storeFiles.find((item) => {
					if (!item.relative_file_path || item.is_directory) return false
					const itemPath = normalizePath(item.relative_file_path)
					// 确保匹配的路径确实是目标路径的后缀（包含目录层级）
					return itemPath.endsWith("/" + pathSuffix) || itemPath === pathSuffix
				})
				if (fileItem) break
			}
		}
	}

	// 方法3: 如果还是找不到，尝试通过 file_id 匹配（如果 path 本身就是 file_id）
	if (!fileItem && path && !path.includes("/") && !path.includes("\\")) {
		fileItem = storeFiles.find((item) => {
			return !item.is_directory && item.file_id === path
		})
	}

	if (!fileItem?.file_id) {
		return null
	}
	return {
		file_id: fileItem.file_id,
		file_name: fileItem.file_name || fileItem.display_filename || fileItem.filename || "",
		display_filename: fileItem.display_filename,
		file_size: fileItem.file_size,
	}
}

/**
 * 执行批量请求
 */
async function executeBatchRequest(): Promise<void> {
	if (batchQueue.length === 0) return

	// 复制队列并清空
	const queue = [...batchQueue]
	batchQueue.length = 0
	batchTimer = null

	// 按是否需要图片处理分组
	const withImageProcess: BatchRequestItem[] = []
	const withoutImageProcess: BatchRequestItem[] = []

	for (const item of queue) {
		if (shouldUseImageProcess(item.fileSize)) {
			withImageProcess.push(item)
		} else {
			withoutImageProcess.push(item)
		}
	}

	// 处理需要图片处理的请求
	if (withImageProcess.length > 0) {
		try {
			const fileIds = withImageProcess.map((item) => item.fileId)
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: fileIds,
				options: IMAGE_PROCESS_OPTIONS,
			})

			processBatchRequestResults(withImageProcess, downloadUrls)
		} catch (error) {
			// 请求失败，拒绝所有 Promise
			for (const item of withImageProcess) {
				item.reject(error as Error)
				fileInfoRequestCache.delete(item.fileId)
			}
		}
	}

	// 处理不需要图片处理的请求
	if (withoutImageProcess.length > 0) {
		try {
			const fileIds = withoutImageProcess.map((item) => item.fileId)
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: fileIds,
				// 不传递 options，避免服务端错误
			})

			processBatchRequestResults(withoutImageProcess, downloadUrls)
		} catch (error) {
			// 请求失败，拒绝所有 Promise
			for (const item of withoutImageProcess) {
				item.reject(error as Error)
				fileInfoRequestCache.delete(item.fileId)
			}
		}
	}
}

/**
 * 处理批量请求结果
 */
function processBatchRequestResults(
	queue: BatchRequestItem[],
	downloadUrls: Array<{ file_id?: string; url?: string; expires_at?: string }> | null | undefined,
): void {
	if (!downloadUrls || downloadUrls.length === 0) {
		// 所有请求都失败
		for (const item of queue) {
			item.reject(new Error(`无法获取文件下载地址: ${item.path}`))
			fileInfoRequestCache.delete(item.fileId)
		}
		return
	}

	// 创建 fileId -> urlItem 的映射（含 expires_at）
	const urlItemMap = new Map<string, { url: string; expires_at?: string }>()
	for (const urlItem of downloadUrls) {
		if (urlItem.file_id && urlItem.url) {
			urlItemMap.set(urlItem.file_id, {
				url: urlItem.url,
				expires_at: urlItem.expires_at,
			})
		}
	}

	// 处理每个请求
	for (const item of queue) {
		const urlItem = urlItemMap.get(item.fileId)

		if (!urlItem?.url) {
			item.reject(new Error(`无法获取文件下载地址: ${item.path}`))
			fileInfoRequestCache.delete(item.fileId)
			continue
		}

		const result: GetFileInfoResponse = {
			src: urlItem.url,
			fileName: item.fileName,
			...(urlItem.expires_at && { expires_at: urlItem.expires_at }),
		}

		// 统一缓存：以 file_id 为主键存储（仅在缓存开启时）
		if (cacheEnabled) {
			fileInfoCache.set(item.fileId, result)
			if (!result.expires_at) {
				cacheTimestampMap.set(item.fileId, Date.now())
			}
			pathToIdIndex.set(item.normalizedPath, item.fileId)
		}
		// 请求完成后从请求缓存中移除
		fileInfoRequestCache.delete(item.fileId)

		// 解析 Promise
		item.resolve(result)
	}
}

/**
 * 根据文件路径获取文件信息（带缓存和批量请求合并）
 * 如果缓存中有结果，直接返回
 * 如果有正在进行的请求，复用该请求
 * 否则加入批量请求队列，等待批量处理
 * @param filePath 文件路径
 * @param filesList 可选的文件列表，如果传入则优先使用此列表查找文件，否则从 projectFilesStore 获取
 */
export async function getFileInfoByPath(
	filePath: string,
	filesList?: FileItem[],
): Promise<GetFileInfoResponse | null> {
	const normalizedPath = normalizePath(filePath)
	if (!normalizedPath) {
		return null
	}

	// 通过 path -> file_id 索引查找 file_id（仅在缓存开启时）
	if (cacheEnabled) {
		const fileId = pathToIdIndex.get(normalizedPath)
		if (fileId) {
			// 如果找到 file_id，从统一缓存中获取
			const cachedResult = fileInfoCache.get(fileId)
			if (cachedResult) {
				if (!isCachedFileInfoExpired(cachedResult, fileId)) {
					return cachedResult
				}
				// 已过期，清除缓存
				fileInfoCache.delete(fileId)
				cacheTimestampMap.delete(fileId)
				pathToIdIndex.delete(normalizedPath)
			}

			// 检查是否有正在进行的请求
			const cachedRequest = fileInfoRequestCache.get(fileId)
			if (cachedRequest) {
				return cachedRequest
			}
		}
	}

	// 查找文件项（带重试机制）
	let fileItem = findFileItem(normalizedPath, filePath, filesList)
	if (!fileItem) {
		// 如果第一次找不到，进行重试
		for (let i = 0; i < FILE_FIND_RETRY_CONFIG.retryCount; i++) {
			// 等待指定间隔时间
			await new Promise((resolve) =>
				setTimeout(resolve, FILE_FIND_RETRY_CONFIG.retryInterval),
			)
			// 重试时重新获取文件列表（因为 attachments 可能已经更新）
			fileItem = findFileItem(normalizedPath, filePath)
			if (fileItem) {
				break
			}
		}
		if (!fileItem) {
			return null
		}
	}

	// 如果已经有缓存，直接返回（仅在缓存开启时）
	if (cacheEnabled) {
		const cachedResult = fileInfoCache.get(fileItem.file_id)
		if (cachedResult) {
			if (!isCachedFileInfoExpired(cachedResult, fileItem.file_id)) {
				pathToIdIndex.set(normalizedPath, fileItem.file_id)
				return cachedResult
			}
			// 已过期，清除缓存
			fileInfoCache.delete(fileItem.file_id)
			cacheTimestampMap.delete(fileItem.file_id)
		}

		// 检查是否有正在进行的请求
		const cachedRequest = fileInfoRequestCache.get(fileItem.file_id)
		if (cachedRequest) {
			pathToIdIndex.set(normalizedPath, fileItem.file_id)
			return cachedRequest
		}
	}

	// 创建新的 Promise 并加入批量请求队列
	const requestPromise = new Promise<GetFileInfoResponse>((resolve, reject) => {
		batchQueue.push({
			path: filePath,
			normalizedPath,
			fileId: fileItem.file_id,
			fileName: fileItem.file_name,
			fileSize: fileItem.file_size,
			resolve,
			reject,
		})

		// 如果定时器不存在，启动新的批量请求定时器
		if (!batchTimer) {
			batchTimer = setTimeout(() => {
				executeBatchRequest()
			}, BATCH_REQUEST_WINDOW_MS)
		}
	})

	// 记录正在进行的请求（以 file_id 为 key）
	fileInfoRequestCache.set(fileItem.file_id, requestPromise)
	// 更新索引（仅在缓存开启时）
	if (cacheEnabled) {
		pathToIdIndex.set(normalizedPath, fileItem.file_id)
	}

	return requestPromise
}

/**
 * 设置文件信息缓存
 * 用于外部直接设置缓存，避免重复调用 API
 * @param path 文件路径（用于建立 path -> file_id 索引）
 * @param fileInfo 文件信息（如果包含 file_id，会以 file_id 为主键存储）
 * @param filesList 可选的文件列表，用于查找 file_id（如果没有提供 file_id）
 */
export function setFileInfoCache(
	path: string,
	fileInfo: GetFileInfoResponse & { file_id?: string },
	filesList?: FileItem[],
): void {
	// 如果缓存关闭，直接返回
	if (!cacheEnabled) return

	const normalizedPath = normalizePath(path)
	if (!normalizedPath) return

	// 如果 fileInfo 包含 file_id，使用 file_id 作为主键
	if (fileInfo.file_id) {
		const { file_id, ...fileInfoWithoutId } = fileInfo
		fileInfoCache.set(file_id, fileInfoWithoutId)
		if (!fileInfoWithoutId.expires_at) {
			cacheTimestampMap.set(file_id, Date.now())
		} else {
			cacheTimestampMap.delete(file_id)
		}
		pathToIdIndex.set(normalizedPath, file_id)
	} else {
		// 如果没有 file_id，尝试通过索引查找
		let fileId = pathToIdIndex.get(normalizedPath)

		// 如果索引中也没有，尝试通过 findFileItem 查找
		if (!fileId) {
			const fileItem = findFileItem(normalizedPath, path, filesList)
			if (fileItem?.file_id) {
				fileId = fileItem.file_id
				pathToIdIndex.set(normalizedPath, fileId)
			}
		}

		// 如果找到了 file_id，缓存结果
		if (fileId) {
			fileInfoCache.set(fileId, fileInfo)
			if (!fileInfo.expires_at) {
				cacheTimestampMap.set(fileId, Date.now())
			} else {
				cacheTimestampMap.delete(fileId)
			}
		}
	}
}

/**
 * 获取文件信息缓存（通过路径）
 * 若缓存已过期则清除并返回 undefined
 */
export function getFileInfoCache(path: string): GetFileInfoResponse | undefined {
	const normalizedPath = normalizePath(path)
	if (!normalizedPath) return undefined

	const fileId = pathToIdIndex.get(normalizedPath)
	if (!fileId) return undefined

	const cached = fileInfoCache.get(fileId)
	if (!cached) return undefined

	if (isCachedFileInfoExpired(cached, fileId)) {
		fileInfoCache.delete(fileId)
		cacheTimestampMap.delete(fileId)
		pathToIdIndex.delete(normalizedPath)
		return undefined
	}

	return cached
}

/**
 * 清除指定路径的缓存
 */
export function clearFileInfoCache(path: string): void {
	const normalizedPath = normalizePath(path)
	if (!normalizedPath) return

	const fileId = pathToIdIndex.get(normalizedPath)
	if (fileId) {
		fileInfoCache.delete(fileId)
		cacheTimestampMap.delete(fileId)
		fileInfoRequestCache.delete(fileId)
	}
	pathToIdIndex.delete(normalizedPath)
}

/**
 * 通过 file_id 直接获取文件信息
 * 优势：不依赖 path 和 attachments，直接使用 file_id 获取下载 URL
 * 适用场景：上传完成后，API 已返回 file_id，但 attachments 可能还未更新
 * @param fileId 文件 ID
 * @param fileName 可选的文件名
 * @param fileSize 可选的文件大小（字节），用于判断是否使用图片处理选项
 * @returns 文件信息（包含下载 URL 和 file_id）
 */
export async function getFileInfoById(
	fileId: string,
	fileName?: string,
	fileSize?: number,
): Promise<GetFileInfoResponseWithFileId> {
	if (!fileId) {
		throw new Error("file_id is required")
	}

	// 检查统一缓存（仅在缓存开启时）
	if (cacheEnabled) {
		const cached = fileInfoCache.get(fileId)
		if (cached) {
			if (!isCachedFileInfoExpired(cached, fileId)) {
				return { ...cached, file_id: fileId } as GetFileInfoResponseWithFileId
			}
			// 已过期，清除缓存
			fileInfoCache.delete(fileId)
			cacheTimestampMap.delete(fileId)
		}

		// 检查是否有正在进行的请求
		const pendingRequest = fileInfoRequestCache.get(fileId)
		if (pendingRequest) {
			const result = await pendingRequest
			return { ...result, file_id: fileId } as GetFileInfoResponseWithFileId
		}
	}

	// 创建新的请求
	const requestPromise = (async () => {
		try {
			// 根据文件大小决定是否使用图片处理选项
			const options = shouldUseImageProcess(fileSize) ? IMAGE_PROCESS_OPTIONS : undefined

			// 直接通过 file_id 获取下载 URL
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: [fileId],
				options,
			})

			if (!downloadUrls || downloadUrls.length === 0) {
				throw new Error(`Failed to get download URL for file_id: ${fileId}`)
			}

			const urlItem = downloadUrls[0]
			if (!urlItem.url) {
				throw new Error(`No URL in response for file_id: ${fileId}`)
			}

			const result: GetFileInfoResponse = {
				src: urlItem.url,
				fileName: fileName || "",
				...(urlItem.expires_at && { expires_at: urlItem.expires_at }),
			}

			// 统一缓存：以 file_id 为主键存储（仅在缓存开启时）
			if (cacheEnabled) {
				fileInfoCache.set(fileId, result)
				if (!result.expires_at) {
					cacheTimestampMap.set(fileId, Date.now())
				}
			}

			// 返回包含 file_id 的对象
			return { ...result, file_id: fileId } as GetFileInfoResponseWithFileId
		} finally {
			// 请求完成后清理
			fileInfoRequestCache.delete(fileId)
		}
	})()

	// 记录正在进行的请求
	fileInfoRequestCache.set(fileId, requestPromise)

	return requestPromise
}

/**
 * 清除所有缓存
 */
export function clearAllFileInfoCache(): void {
	fileInfoCache.clear()
	cacheTimestampMap.clear()
	pathToIdIndex.clear()
	fileInfoRequestCache.clear()
	batchQueue.length = 0
	if (batchTimer) {
		clearTimeout(batchTimer)
		batchTimer = null
	}
}

/**
 * 设置缓存开关
 * @param enabled 是否启用缓存，默认为 true
 */
export function setCacheEnabled(enabled: boolean): void {
	cacheEnabled = enabled
}

/**
 * 获取缓存开关状态
 * @returns 当前缓存是否启用
 */
export function isCacheEnabled(): boolean {
	return cacheEnabled
}

/**
 * 当文件列表变化时，清除已删除文件的缓存
 * @param filesList 可选的文件列表，如果传入则优先使用此列表，否则从 projectFilesStore 获取
 */
export function cleanupFileInfoCache(filesList?: FileItem[]): void {
	const currentFilePaths = new Set<string>()
	const currentFileIds = new Set<string>()

	// 优先使用传入的文件列表，如果没有传入则从 projectFilesStore 获取
	const storeFiles = filesList || projectFilesStore.workspaceFilesList || []
	for (const item of storeFiles) {
		if (!item.is_directory && item.relative_file_path) {
			const normalizedPath = normalizePath(item.relative_file_path)
			if (normalizedPath) {
				currentFilePaths.add(normalizedPath)
			}
			if (item.file_id) {
				currentFileIds.add(item.file_id)
			}
		}
	}

	// 清除已删除文件的 path -> file_id 索引
	for (const [cachedPath] of pathToIdIndex.entries()) {
		if (!currentFilePaths.has(cachedPath)) {
			const fileId = pathToIdIndex.get(cachedPath)
			pathToIdIndex.delete(cachedPath)
			if (fileId && !currentFileIds.has(fileId)) {
				fileInfoCache.delete(fileId)
				cacheTimestampMap.delete(fileId)
			}
		}
	}

	// 清除已删除文件的缓存（通过 file_id）
	for (const [fileId] of fileInfoCache.entries()) {
		if (!currentFileIds.has(fileId)) {
			fileInfoCache.delete(fileId)
			cacheTimestampMap.delete(fileId)
		}
	}
}
