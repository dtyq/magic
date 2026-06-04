/**
 * IframeFSService
 *
 * 处理 MAGIC_FS_* 消息，为主站（parent window）提供
 * 文件读取 / 写入 / 目录列举 / 文件监听能力。
 * 纯 class，不依赖 React，由 useIframeFS hook 持有实例。
 */

import { getIframeDownloadUrl } from "../iframeApi"
import {
	FS_MESSAGE_TYPES,
	type FSReadRequest,
	type FSWriteRequest,
	type FSWriteBlobRequest,
	type FSListRequest,
	type FSDeleteFileRequest,
	type FSDeleteDirRequest,
	type FSMoveFileRequest,
	type FSRenameFileRequest,
	type FSWatchRegister,
	type FSWatchUnregister,
	type HTMLAppConfig,
} from "../types"

/** workspace 文件项（来自 attachmentList 扁平化后） */
export interface FSFileItem {
	file_id: string
	relative_file_path: string
	file_name?: string
	updated_at?: string
}

/**
 * 上传函数签名——由 hook 注入，内部复用 IsolatedHTMLRenderer
 * 已有的 uploadImageFileToProject 链路。
 *
 * @param workspacePath 完整的 workspace 相对路径（例如 "todo-list/todo.json"）。
 *   当由 IframeFSService 调用时必须传入，用于确保 saveFileToProject 的 file_name
 *   携带完整目录信息，而非仅文件名（否则文件会落在 workspace 根目录）。
 */
export type UploadFn = (params: {
	file: File
	path: string
	fileSize?: number
	parentId?: string
}) => Promise<unknown>

/**
 * 更新已存在文件内容的函数签名。
 * 文件已在 workspace 中存在时，直接通过 file_id + content 更新，无需重新上传 OSS。
 */
export type SaveContentFn = (params: { file_id: string; content: string }) => Promise<unknown>

/**
 * 创建目录函数签名——由 hook 注入，内部使用 SuperMagicApi.createFile。
 * 返回新建目录的 file_id，用于后续以此为 parentId 创建子目录或上传文件。
 */
export type MkdirFn = (params: { name: string; parentId?: string }) => Promise<{ file_id: string }>

/**
 * 删除文件函数签名——由 hook 注入，调用 SuperMagicApi.deleteFile。
 */
export type DeleteFileFn = (params: { file_id: string; project_id: string }) => Promise<unknown>

/**
 * 批量删除文件函数签名——用于删除目录时一次性删除目录下所有文件及目录本身。
 */
export type DeleteFilesFn = (params: { file_ids: string[]; project_id: string }) => Promise<unknown>

/**
 * 移动文件/目录函数签名——将文件移动到目标父目录。
 */
export type MoveFileFn = (params: {
	file_id: string
	target_parent_id: string
	project_id: string
}) => Promise<unknown>

/**
 * 重命名文件/目录函数签名。
 */
export type RenameFileFn = (params: { file_id: string; target_name: string }) => Promise<unknown>

export interface IframeFSConfig {
	/** 向 iframe 发送消息的函数 */
	postToIframe: (message: object) => void
	/** 当前 HTML 入口文件的 workspace 相对路径（例如 my-app/index.html） */
	entryPath: string
	/** workspace 中所有文件列表 */
	fileList: FSFileItem[]
	/** Optional app.json (alias map, etc.); null if not loaded. */
	appConfig: HTMLAppConfig | null
	/** 项目 ID，用于删除等需要 project_id 的操作 */
	projectId?: string
	/** 创建新文件时使用的上传函数（文件不存在时走此路径） */
	uploadFn: UploadFn
	/** 更新已存在文件内容的函数（文件已存在时走此路径，不重新上传 OSS） */
	saveContentFn: SaveContentFn
	/**
	 * （可选）创建目录函数。
	 * 写入路径的父目录不存在时，会逐级调用此函数补全目录树。
	 * 不提供时回退到旧行为：只查 fileList 中已有的目录。
	 */
	mkdirFn?: MkdirFn
	/**
	 * （可选）删除文件函数。
	 * 不提供时 deleteFile 请求将返回错误。
	 */
	deleteFn?: DeleteFileFn
	/**
	 * （可选）批量删除文件函数。
	 * 用于删除目录及其所有内容。不提供时 deleteDir 请求将返回错误。
	 */
	deleteFilesFn?: DeleteFilesFn
	/**
	 * （可选）移动文件/目录函数。
	 * 不提供时 moveFile 请求将返回错误。
	 */
	moveFileFn?: MoveFileFn
	/**
	 * （可选）重命名文件/目录函数。
	 * 不提供时 renameFile 请求将返回错误。
	 */
	renameFileFn?: RenameFileFn
}

/** 读取文件大小限制：5 MB */
const MAX_READ_BYTES = 5 * 1024 * 1024
/** 写入内容大小限制（单次 writeFile string）：5 MB */
const MAX_WRITE_BYTES = 5 * 1024 * 1024
/** Blob 写入大小限制：500 MB */
const MAX_BLOB_WRITE_BYTES = 500 * 1024 * 1024

export class IframeFSService {
	private readonly cfg: IframeFSConfig
	/** 应用根目录（从入口路径派生，末尾含 /） */
	readonly appRootDir: string
	/** 文件别名映射（来自 appConfig.files） */
	private readonly aliasMap: Record<string, string>
	/** watch 注册表：resolvedPath → { watchers, originalPath } */
	private watchRegistry = new Map<string, { watchers: Set<string>; originalPath: string }>()
	/** 文件 updated_at 快照（用于轮询变更检测） */
	private watchSnapshot = new Map<string, string | undefined>()
	/** 轮询定时器 */
	private pollTimerId: ReturnType<typeof setInterval> | null = null
	/**
	 * 本次会话中通过 mkdirFn 新建的目录缓存：resolvedPath → file_id
	 * 避免重复创建同一目录（fileList 刷新前的中间态）
	 */
	private dirCache = new Map<string, string>()

	constructor(cfg: IframeFSConfig) {
		this.cfg = cfg

		// 派生应用根目录
		const cleaned = cfg.entryPath.replace(/^\/+/, "")
		const lastSlash = cleaned.lastIndexOf("/")
		this.appRootDir = lastSlash >= 0 ? cleaned.slice(0, lastSlash + 1) : ""

		// 别名映射
		this.aliasMap = cfg.appConfig?.files ?? {}
	}

	/**
	 * 主路由入口，由 useIframeFS → IsolatedHTMLRenderer 的 handleMessage 调用。
	 * 返回 true 表示消息已被处理。
	 */
	async handleMessage(type: string, payload: unknown): Promise<boolean> {
		switch (type) {
			case FS_MESSAGE_TYPES.READ_REQUEST:
				await this.handleRead(payload as FSReadRequest)
				return true
			case FS_MESSAGE_TYPES.WRITE_REQUEST:
				await this.handleWrite(payload as FSWriteRequest)
				return true
			case FS_MESSAGE_TYPES.WRITE_BLOB_REQUEST:
				await this.handleWriteBlob(payload as FSWriteBlobRequest)
				return true
			case FS_MESSAGE_TYPES.LIST_REQUEST:
				this.handleList(payload as FSListRequest)
				return true
			case FS_MESSAGE_TYPES.DELETE_FILE_REQUEST:
				await this.handleDeleteFile(payload as FSDeleteFileRequest)
				return true
			case FS_MESSAGE_TYPES.DELETE_DIR_REQUEST:
				await this.handleDeleteDir(payload as FSDeleteDirRequest)
				return true
			case FS_MESSAGE_TYPES.MOVE_FILE_REQUEST:
				await this.handleMoveFile(payload as FSMoveFileRequest)
				return true
			case FS_MESSAGE_TYPES.RENAME_FILE_REQUEST:
				await this.handleRenameFile(payload as FSRenameFileRequest)
				return true
			case FS_MESSAGE_TYPES.WATCH_REGISTER:
				this.handleWatchRegister(payload as FSWatchRegister)
				return true
			case FS_MESSAGE_TYPES.WATCH_UNREGISTER:
				this.handleWatchUnregister(payload as FSWatchUnregister)
				return true
			case FS_MESSAGE_TYPES.GET_APP_BASE_PATH_REQUEST:
				this.handleGetAppBasePath(payload as { requestId: string })
				return true
			default:
				return false
		}
	}

	destroy() {
		this.stopPolling()
		this.watchRegistry.clear()
		this.watchSnapshot.clear()
		this.dirCache.clear()
	}

	/** 供 hook 在 fileList 变化时调用，保持内部引用最新 */
	updateFileList(newFileList: FSFileItem[]) {
		this.cfg.fileList = newFileList
	}

	// ─── 内部处理 ────────────────────────────────────────────────────────────────

	private async handleRead(req: FSReadRequest) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: FS_MESSAGE_TYPES.READ_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		try {
			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.READ_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			const urls = await getIframeDownloadUrl([item.file_id])
			const url = urls?.[0]?.url
			if (!url) throw new Error("Failed to get download URL")

			const res = await fetch(url)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)

			const contentLength = res.headers.get("content-length")
			if (contentLength && Number(contentLength) > MAX_READ_BYTES) {
				throw new Error(`File too large (max ${MAX_READ_BYTES / 1024 / 1024} MB)`)
			}

			const content = await res.text()
			this.send({ type: FS_MESSAGE_TYPES.READ_RESPONSE, requestId, success: true, content })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.READ_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private async handleWrite(req: FSWriteRequest) {
		const { requestId, path, content } = req
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: FS_MESSAGE_TYPES.WRITE_RESPONSE,
				requestId,
				success: false,
				error: `Write access denied or invalid path: ${path}`,
			})
		}

		// Content size validation
		const contentSize = new Blob([content]).size
		if (contentSize > MAX_WRITE_BYTES) {
			return this.send({
				type: FS_MESSAGE_TYPES.WRITE_RESPONSE,
				requestId,
				success: false,
				error: `Content too large (${(contentSize / 1024 / 1024).toFixed(1)} MB). Max allowed: ${MAX_WRITE_BYTES / 1024 / 1024} MB`,
			})
		}

		try {
			const existingFile = this.findFile(resolved)

			if (existingFile) {
				// 文件已存在：直接更新内容，不重新上传 OSS
				await this.cfg.saveContentFn({ file_id: existingFile.file_id, content })
			} else {
				// 文件不存在：先确保父目录链路完整，再走上传创建流程
				const fileName = resolved.split("/").pop() || "file"
				const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
				const file = new File([blob], fileName, { type: blob.type })
				const parentId = await this.ensureParentDirs(resolved)

				await this.cfg.uploadFn({
					file,
					path: resolved,
					fileSize: blob.size,
					parentId,
				})
			}

			this.send({ type: FS_MESSAGE_TYPES.WRITE_RESPONSE, requestId, success: true })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.WRITE_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private async handleWriteBlob(req: FSWriteBlobRequest) {
		const { requestId, path, blob, fileName: explicitName } = req
		const replyType = FS_MESSAGE_TYPES.WRITE_BLOB_RESPONSE
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: replyType,
				requestId,
				success: false,
				error: `Write access denied or invalid path: ${path}`,
			})
		}

		if (!(blob instanceof Blob)) {
			return this.send({
				type: replyType,
				requestId,
				success: false,
				error: "Invalid request: blob field must be a Blob instance",
			})
		}

		if (blob.size > MAX_BLOB_WRITE_BYTES) {
			return this.send({
				type: replyType,
				requestId,
				success: false,
				error: `File too large (${(blob.size / 1024 / 1024).toFixed(1)} MB). Max allowed: ${MAX_BLOB_WRITE_BYTES / 1024 / 1024} MB`,
			})
		}

		try {
			const existingFile = this.findFile(resolved)

			if (existingFile) {
				// 文件已存在：读取 blob 内容更新
				const content = await blob.text()
				await this.cfg.saveContentFn({ file_id: existingFile.file_id, content })
			} else {
				// 文件不存在：直接用 Blob 构建 File 并上传
				const name = explicitName || resolved.split("/").pop() || "file"
				const file = new File([blob], name, {
					type: blob.type || "application/octet-stream",
				})
				const parentId = await this.ensureParentDirs(resolved)

				await this.cfg.uploadFn({
					file,
					path: resolved,
					fileSize: blob.size,
					parentId,
				})
			}

			this.send({ type: replyType, requestId, success: true })
		} catch (err) {
			this.send({
				type: replyType,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private handleList(req: FSListRequest) {
		const { requestId, dir } = req
		const resolvedDir = this.resolveDir(dir ?? "./")

		if (resolvedDir === null) {
			return this.send({
				type: FS_MESSAGE_TYPES.LIST_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid directory: ${dir}`,
			})
		}

		const files = this.cfg.fileList
			.map((f) => f.relative_file_path.replace(/^\/+/, ""))
			.filter((p) => {
				if (!p.startsWith(resolvedDir)) return false
				const rest = p.slice(resolvedDir.length)
				return rest.length > 0 && !rest.includes("/")
			})
			.map((p) => p.split("/").pop() || p)

		this.send({ type: FS_MESSAGE_TYPES.LIST_RESPONSE, requestId, success: true, files })
	}

	private async handleDeleteFile(req: FSDeleteFileRequest) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		if (!this.cfg.deleteFn) {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
				requestId,
				success: false,
				error: "Delete operation is not supported",
			})
		}

		try {
			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			await this.cfg.deleteFn({ file_id: item.file_id, project_id: this.cfg.projectId || "" })
			this.send({ type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE, requestId, success: true })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private async handleDeleteDir(req: FSDeleteDirRequest) {
		const { requestId, path } = req
		const resolvedDir = this.resolveDir(path)

		if (resolvedDir === null) {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		if (!this.cfg.deleteFilesFn) {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
				requestId,
				success: false,
				error: "Delete operation is not supported",
			})
		}

		// 禁止删除应用根目录本身
		if (resolvedDir === this.appRootDir) {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
				requestId,
				success: false,
				error: "Cannot delete the app root directory",
			})
		}

		try {
			// 收集目录本身 + 目录下所有文件的 file_id
			const dirPath = resolvedDir.endsWith("/") ? resolvedDir.slice(0, -1) : resolvedDir
			const fileIds = new Set<string>()

			// 先找目录本身的 file_id
			const dirItem = this.findFile(dirPath)
			if (!dirItem) {
				return this.send({
					type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
					requestId,
					success: false,
					error: `Directory not found: ${path}`,
				})
			}

			// 收集目录下所有子文件/子目录
			for (const f of this.cfg.fileList) {
				const fp = this.normalizeWorkspacePath(f.relative_file_path)
				if (fp === dirPath || fp.startsWith(`${dirPath}/`)) {
					fileIds.add(f.file_id)
				}
			}

			// 加入目录本身
			fileIds.add(dirItem.file_id)

			await this.cfg.deleteFilesFn({
				file_ids: Array.from(fileIds),
				project_id: this.cfg.projectId || "",
			})

			// 清理 dirCache 中相关条目
			for (const key of Array.from(this.dirCache.keys())) {
				if (key === dirPath || key.startsWith(resolvedDir)) {
					this.dirCache.delete(key)
				}
			}

			this.send({ type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE, requestId, success: true })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private async handleMoveFile(req: FSMoveFileRequest) {
		const { requestId, path, targetDir } = req
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		if (!this.cfg.moveFileFn) {
			return this.send({
				type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
				requestId,
				success: false,
				error: "Move operation is not supported",
			})
		}

		try {
			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			// 解析目标父目录
			const resolvedTargetDir = this.resolveDir(targetDir)
			if (resolvedTargetDir === null) {
				return this.send({
					type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `Invalid target directory: ${targetDir}`,
				})
			}

			const targetDirPath = resolvedTargetDir.endsWith("/")
				? resolvedTargetDir.slice(0, -1)
				: resolvedTargetDir
			const targetDirItem = this.findFile(targetDirPath)
			if (!targetDirItem) {
				return this.send({
					type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `Target directory not found: ${targetDir}`,
				})
			}

			await this.cfg.moveFileFn({
				file_id: item.file_id,
				target_parent_id: targetDirItem.file_id,
				project_id: this.cfg.projectId || "",
			})
			const fileName = resolved.split("/").pop() || resolved
			this.updateLocalPaths(resolved, `${resolvedTargetDir}${fileName}`)
			this.send({ type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE, requestId, success: true })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private async handleRenameFile(req: FSRenameFileRequest) {
		const { requestId, path, newName } = req
		const resolved = this.resolvePath(path)

		if (!resolved) {
			return this.send({
				type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		if (!this.cfg.renameFileFn) {
			return this.send({
				type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
				requestId,
				success: false,
				error: "Rename operation is not supported",
			})
		}

		try {
			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			await this.cfg.renameFileFn({ file_id: item.file_id, target_name: newName })
			const lastSlash = resolved.lastIndexOf("/")
			const parentDir = lastSlash >= 0 ? resolved.slice(0, lastSlash + 1) : ""
			this.updateLocalPaths(resolved, `${parentDir}${newName}`)
			this.send({ type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE, requestId, success: true })
		} catch (err) {
			this.send({
				type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
	}

	private handleGetAppBasePath(req: { requestId: string }) {
		this.send({
			type: FS_MESSAGE_TYPES.GET_APP_BASE_PATH_RESPONSE,
			requestId: req.requestId,
			success: true,
			content: this.appRootDir,
		})
	}

	private handleWatchRegister(req: FSWatchRegister) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)
		if (!resolved) return

		// 最多同时监听 10 个文件
		if (this.watchRegistry.size >= 10 && !this.watchRegistry.has(resolved)) return

		if (!this.watchRegistry.has(resolved)) {
			this.watchRegistry.set(resolved, { watchers: new Set(), originalPath: path })
			this.watchSnapshot.set(resolved, this.findFile(resolved)?.updated_at)
		}
		const entry = this.watchRegistry.get(resolved)
		if (!entry) return
		entry.watchers.add(requestId)

		if (this.pollTimerId === null) this.startPolling()
	}

	private handleWatchUnregister(req: FSWatchUnregister) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)
		if (!resolved) return

		const entry = this.watchRegistry.get(resolved)
		if (entry) {
			entry.watchers.delete(requestId)
			if (entry.watchers.size === 0) {
				this.watchRegistry.delete(resolved)
				this.watchSnapshot.delete(resolved)
			}
		}

		if (this.watchRegistry.size === 0) this.stopPolling()
	}

	private startPolling() {
		this.pollTimerId = setInterval(() => {
			this.watchRegistry.forEach(({ originalPath }, resolved) => {
				const item = this.findFile(resolved)
				const prev = this.watchSnapshot.get(resolved)
				const curr = item?.updated_at
				if (curr && curr !== prev) {
					this.watchSnapshot.set(resolved, curr)
					// 发回 iframe 注册时使用的原始路径，确保 iframe 侧过滤条件匹配
					this.send({
						type: FS_MESSAGE_TYPES.FILE_CHANGED,
						path: originalPath,
						timestamp: Date.now(),
					})
				}
			})
		}, 3000)
	}

	private stopPolling() {
		if (this.pollTimerId !== null) {
			clearInterval(this.pollTimerId)
			this.pollTimerId = null
		}
	}

	// ─── 路径工具 ────────────────────────────────────────────────────────────────

	/**
	 * 将 iframe 传入的路径解析为 workspace 相对路径。
	 * - 应用别名替换（appConfig.files）
	 * - 禁止 `..` 穿越
	 * - 必须在应用根目录（appRootDir）边界内
	 */
	private resolvePath(path: string): string | null {
		const aliasResolved = this.aliasMap[path] ?? path
		const clean = aliasResolved.replace(/^\/+/, "").replace(/^(\.\/)+/, "")
		if (clean.includes("..")) return null
		const full = this.appRootDir ? `${this.appRootDir}${clean}` : clean
		if (this.appRootDir && !full.startsWith(this.appRootDir)) return null
		return full
	}

	private resolveDir(dir: string): string | null {
		const clean = dir.replace(/^\/+/, "").replace(/^\.\//, "")
		if (clean.includes("..")) return null
		if (clean === "" || clean === ".") return this.appRootDir
		const full = this.appRootDir ? `${this.appRootDir}${clean}` : clean
		if (this.appRootDir && !full.startsWith(this.appRootDir)) return null
		return full.endsWith("/") ? full : `${full}/`
	}

	private findFile(resolvedPath: string): FSFileItem | undefined {
		const normalizedPath = this.normalizeWorkspacePath(resolvedPath)
		return this.cfg.fileList.find(
			(f) => this.normalizeWorkspacePath(f.relative_file_path) === normalizedPath,
		)
	}

	private normalizeWorkspacePath(path: string): string {
		return path.replace(/^\/+/, "").replace(/\/+$/, "")
	}

	private updateLocalPaths(oldPath: string, newPath: string) {
		const oldBase = this.normalizeWorkspacePath(oldPath)
		const newBase = this.normalizeWorkspacePath(newPath)
		const oldPrefix = `${oldBase}/`
		const newName = newBase.split("/").pop()

		for (const item of this.cfg.fileList) {
			const currentPath = this.normalizeWorkspacePath(item.relative_file_path)
			if (currentPath === oldBase) {
				item.relative_file_path = newBase
				if (newName) item.file_name = newName
			} else if (currentPath.startsWith(oldPrefix)) {
				item.relative_file_path = `${newBase}/${currentPath.slice(oldPrefix.length)}`
			}
		}

		this.clearDirCacheForPath(oldBase)
		this.clearDirCacheForPath(newBase)
	}

	private clearDirCacheForPath(path: string) {
		const normalizedPath = this.normalizeWorkspacePath(path)
		for (const key of Array.from(this.dirCache.keys())) {
			if (key === normalizedPath || key.startsWith(`${normalizedPath}/`)) {
				this.dirCache.delete(key)
			}
		}
	}

	/**
	 * 确保 resolvedPath 的所有父目录都存在，逐级检查 fileList → dirCache → mkdirFn 创建。
	 * 返回直接父目录的 file_id（用作上传 parentId），若无父目录则返回 undefined。
	 *
	 * 多级示例：写入 "my-app/data/sub/out.json"
	 *   → 依次检查/创建 "my-app"、"my-app/data"、"my-app/data/sub"
	 */
	private async ensureParentDirs(resolvedPath: string): Promise<string | undefined> {
		const allSegments = resolvedPath.split("/")
		// 取父目录链路（去掉最后一段文件名）
		const parentSegments = allSegments.slice(0, -1)
		if (parentSegments.length === 0) return undefined

		// 没有注入 mkdirFn 时，回退到原来只查 fileList 的行为
		if (!this.cfg.mkdirFn) {
			const parentPath = parentSegments.join("/")
			return this.findFile(parentPath)?.file_id
		}

		let parentId: string | undefined = undefined

		for (let i = 0; i < parentSegments.length; i++) {
			const pathUpToHere = parentSegments.slice(0, i + 1).join("/")

			// 1. 已在 workspace fileList 中
			const existingInList = this.findFile(pathUpToHere)
			if (existingInList) {
				parentId = existingInList.file_id
				continue
			}

			// 2. 本次会话中已创建过（fileList 尚未刷新）
			const cached = this.dirCache.get(pathUpToHere)
			if (cached !== undefined) {
				parentId = cached
				continue
			}

			// 3. 目录不存在，调用 mkdirFn 创建
			const dirName = parentSegments[i]
			const result = await this.cfg.mkdirFn({ name: dirName, parentId })
			this.dirCache.set(pathUpToHere, result.file_id)
			parentId = result.file_id
		}

		return parentId
	}

	private send(message: object) {
		this.cfg.postToIframe(message)
	}
}
