import type { PPTStoreConfig } from "../stores/PPTStore"
import type { PPTLoggerService } from "./PPTLoggerService"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"

/**
 * PPTPathMappingService
 * Handles path to URL and path to file ID mappings
 */
export class PPTPathMappingService {
	/** Maps original path to temporary download URL */
	private pathToUrlMapping: Map<string, string> = new Map()

	/** Maps original path to file ID */
	private pathToFileIdMapping: Map<string, string> = new Map()

	constructor(
		private config: PPTStoreConfig,
		private logger: PPTLoggerService,
	) { }

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<PPTStoreConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Extract file ID from path using attachmentList
	 * Converts path (relative to PPT folder) to absolute path (relative to workspace root)
	 */
	extractFileIdFromPath(path: string): string | undefined {
		const mainFile = this.config.attachmentList?.find(
			(item: any) => item.file_id === this.config.mainFileId,
		)

		if (!mainFile || !mainFile.relative_file_path || !mainFile.file_name) {
			this.logger.warn("主文件未找到或缺少必需字段", {
				operation: "extractFileIdFromPath",
				metadata: {
					mainFileId: this.config.mainFileId,
					path,
				},
			})
			return undefined
		}

		// Extract base folder path from main file's relative_file_path
		const baseFolderPath = mainFile.relative_file_path.replace(mainFile.file_name, "")

		// Resolve relative path to absolute path
		const absolutePath = this.resolveRelativePath(baseFolderPath, path)

		// Find file by absolute path
		const file = this.config.attachmentList?.find(
			(item: any) => item.relative_file_path === absolutePath,
		)

		if (!file) {
			this.logger.debug("未找到对应的文件 ID", {
				operation: "extractFileIdFromPath",
				metadata: { path, absolutePath },
			})
		}

		return file?.file_id
	}

	/**
	 * Resolve relative path to absolute path
	 */
	private resolveRelativePath(basePath: string, relativePath: string): string {
		if (!basePath || !relativePath) {
			this.logger.warn("basePath 或 relativePath 为空", {
				operation: "resolveRelativePath",
				metadata: { basePath, relativePath },
			})
			return relativePath || ""
		}

		const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath

		if (relativePath.startsWith("/")) {
			return normalizedBase + "/" + relativePath.slice(1)
		}

		if (relativePath.startsWith("./")) {
			return normalizedBase + "/" + relativePath.slice(2)
		}

		if (relativePath.startsWith("../")) {
			const baseParts = normalizedBase.split("/")
			let relativeParts = relativePath.split("/")

			let backLevels = 0
			while (relativeParts[0] === "..") {
				backLevels++
				relativeParts = relativeParts.slice(1)
			}

			if (backLevels >= baseParts.length) {
				return "/" + relativeParts.join("/")
			}

			const newBaseParts = baseParts.slice(0, -backLevels)
			return newBaseParts.join("/") + "/" + relativeParts.join("/")
		}

		return normalizedBase + "/" + relativePath
	}

	/**
	 * Batch extract file IDs from paths and build mappings
	 */
	async buildPathMappings(paths: string[]): Promise<void> {
		const fileIds: string[] = []

		paths.forEach((path) => {
			const fileId = this.extractFileIdFromPath(path)
			if (fileId) {
				fileIds.push(fileId)
				this.pathToFileIdMapping.set(path, fileId)
			}
		})

		if (fileIds.length === 0) return

		try {
			const response = await getTemporaryDownloadUrl({ file_ids: fileIds })

			response?.forEach((item: any) => {
				if (item.file_id && item.url) {
					const path = Array.from(this.pathToFileIdMapping.entries()).find(
						([, id]) => id === item.file_id,
					)?.[0]
					if (path) {
						this.pathToUrlMapping.set(path, item.url)
					}
				}
			})

			this.logger.debug("路径映射构建成功", {
				operation: "buildPathMappings",
				metadata: {
					pathCount: paths.length,
					fileIdCount: fileIds.length,
					urlCount: this.pathToUrlMapping.size,
				},
			})
		} catch (error) {
			this.logger.error("构建路径映射失败", error, {
				operation: "buildPathMappings",
			})
		}
	}

	/**
	 * Fetch temporary URLs for specific file IDs
	 */
	async fetchUrlsForFileIds(fileIds: string[]): Promise<Map<string, string>> {
		const urlMap = new Map<string, string>()

		if (fileIds.length === 0) return urlMap

		try {
			const response = await getTemporaryDownloadUrl({ file_ids: fileIds })

			response?.forEach((item: any) => {
				if (item.file_id && item.url) {
					urlMap.set(item.file_id, item.url)

					// Update internal mappings
					const path = Array.from(this.pathToFileIdMapping.entries()).find(
						([, id]) => id === item.file_id,
					)?.[0]
					if (path) {
						this.pathToUrlMapping.set(path, item.url)
					}
				}
			})

			this.logger.debug("URL 获取成功", {
				operation: "fetchUrlsForFileIds",
				metadata: { requestCount: fileIds.length, responseCount: urlMap.size },
			})
		} catch (error) {
			this.logger.error("获取 URL 失败", error, {
				operation: "fetchUrlsForFileIds",
			})
		}

		return urlMap
	}

	/**
	 * Get URL by path
	 */
	getUrlByPath(path: string): string | undefined {
		return this.pathToUrlMapping.get(path)
	}

	/**
	 * Get file ID by path
	 */
	getFileIdByPath(path: string): string | undefined {
		return this.pathToFileIdMapping.get(path)
	}

	/**
	 * Set path to file ID mapping
	 */
	setPathFileIdMapping(path: string, fileId: string): void {
		this.pathToFileIdMapping.set(path, fileId)
	}

	/**
	 * Set path to URL mapping
	 */
	setPathUrlMapping(path: string, url: string): void {
		this.pathToUrlMapping.set(path, url)
	}

	/**
	 * Clear all mappings
	 */
	clear(): void {
		this.pathToUrlMapping.clear()
		this.pathToFileIdMapping.clear()
	}

	/**
	 * Get all path to URL mappings
	 */
	getAllUrlMappings(): Map<string, string> {
		return new Map(this.pathToUrlMapping)
	}

	/**
	 * Get all path to file ID mappings
	 */
	getAllFileIdMappings(): Map<string, string> {
		return new Map(this.pathToFileIdMapping)
	}
}
