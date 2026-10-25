/**
 * IframeFSService
 *
 * 处理 MAGIC_FS_* 消息，为主站（parent window）提供
 * 文件读取 / 写入 / 目录列举 / 文件监听能力。
 * 纯 class，不依赖 React，由 useIframeFS hook 持有实例。
 */

import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { getIframeDownloadUrl } from "../iframeApi"
import {
	FS_MESSAGE_TYPES,
	type FSReadRequest,
	type FSWriteRequest,
	type FSWriteBlobRequest,
	type FSListRequest,
	type FSListDirRequest,
	type FSGetFileUrlRequest,
	type FSDeleteFileRequest,
	type FSDeleteDirRequest,
	type FSMoveFileRequest,
	type FSRenameFileRequest,
	type FSWatchRegister,
	type FSWatchUnregister,
	type FSWatchDirRegister,
	type FSWatchDirUnregister,
	type FSDirEntry,
	type HTMLAppConfig,
	type HtmlPermissionScope,
} from "../types"
import { IframeFSWatchService } from "./IframeFSWatchService"

/** workspace 文件项（来自 attachmentList 扁平化后） */
export interface FSFileItem {
	file_id: string
	relative_file_path: string
	file_name?: string
	is_directory?: boolean
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
}) => Promise<FSFileItem>

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

/**
 * 服务端文件信息校验函数。破坏性操作前必须按 file_id 反查真实路径。
 */
export type VerifyFileFn = (params: {
	file_id: string
	project_id: string
}) => Promise<{ file_name?: string; relative_file_path?: string }>

export type ConfirmProjectDeleteFn = (params: {
	path: string
	isDirectory: boolean
	appRootDir: string
	operation?: "write" | "move" | "rename"
}) => Promise<boolean>

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
	/** 项目上下文不可用时返回给 iframe 的语义化错误。 */
	projectContextUnavailableError?: string
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
	/**
	 * 破坏性操作前按 file_id 反查服务端真实路径。
	 * 不提供时 delete/move/rename 请求将返回错误。
	 */
	verifyFileFn?: VerifyFileFn
	/**
	 * 删除 appRoot 外的 project-scope 文件/目录前，让宿主弹出二次确认。
	 */
	confirmProjectDeleteFn?: ConfirmProjectDeleteFn
	getFileAccess?: () => FileAccessContext | null
	/** 执行高风险能力前的授权检查。未提供时保持旧行为。 */
	authorizePermission?: (scope: HtmlPermissionScope) => Promise<boolean>
}

/** 读取文件大小限制：5 MB */
const MAX_READ_BYTES = 5 * 1024 * 1024
/** 写入内容大小限制（单次 writeFile string）：5 MB */
const MAX_WRITE_BYTES = 5 * 1024 * 1024
/** Blob 写入大小限制：500 MB */
const MAX_BLOB_WRITE_BYTES = 500 * 1024 * 1024

export class IframeFSService {
	private readonly cfg: IframeFSConfig
	private readonly pendingFiles = new Map<string, FSFileItem | null>()
	/** 应用根目录（从入口路径派生，末尾含 /） */
	readonly appRootDir: string
	/** 文件别名映射（来自 appConfig.files） */
	private readonly aliasMap: Record<string, string>
	private readonly watchService: IframeFSWatchService
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

		this.watchService = new IframeFSWatchService({
			postToIframe: (message) => this.send(message),
			getFileUpdatedAt: (resolvedPath) => this.findFile(resolvedPath)?.updated_at,
			getDirEntryNames: (resolvedDir) => this.buildDirEntryNames(resolvedDir),
			getDirEntries: (resolvedDir, originalDir) =>
				this.buildDirEntries(resolvedDir, originalDir),
		})
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
			case FS_MESSAGE_TYPES.LIST_DIR_REQUEST:
				this.handleListDir(payload as FSListDirRequest)
				return true
			case FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST:
				await this.handleGetFileUrl(payload as FSGetFileUrlRequest)
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
			case FS_MESSAGE_TYPES.WATCH_DIR_REGISTER:
				this.handleWatchDirRegister(payload as FSWatchDirRegister)
				return true
			case FS_MESSAGE_TYPES.WATCH_DIR_UNREGISTER:
				this.handleWatchDirUnregister(payload as FSWatchDirUnregister)
				return true
			case FS_MESSAGE_TYPES.GET_APP_BASE_PATH_REQUEST:
				this.handleGetAppBasePath(payload as { requestId: string })
				return true
			default:
				return false
		}
	}

	destroy() {
		this.watchService.destroy()
		this.dirCache.clear()
		this.pendingFiles.clear()
	}

	/** 供 hook 在 fileList 变化时调用，保持内部引用最新 */
	updateFileList(newFileList: FSFileItem[]) {
		// Attachment notifications can lag behind successful mutations. Keep the confirmed
		// local result until an incoming snapshot acknowledges it, then release it.
		const incoming = new Map(newFileList.map((item) => [item.file_id, item]))
		for (const [id, pending] of this.pendingFiles) {
			const item = incoming.get(id)
			if (
				pending === null ? !item : item?.relative_file_path === pending.relative_file_path
			) {
				this.pendingFiles.delete(id)
			} else if (pending) {
				incoming.set(id, pending)
			} else {
				incoming.delete(id)
			}
		}
		this.cfg.fileList = [...incoming.values()]
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
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.read")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.READ_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.read",
					})
				}
			}

			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.READ_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			const urls = await getIframeDownloadUrl(
				[item.file_id],
				this.cfg.getFileAccess?.() ?? null,
			)
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
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.WRITE_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			await this.confirmProjectOperationIfNeeded(resolved, false, "write")
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

				const uploaded = await this.cfg.uploadFn({
					file,
					path: this.toUploadPath(resolved),
					fileSize: blob.size,
					parentId,
				})
				this.recordFile(uploaded)
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
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: replyType,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			await this.confirmProjectOperationIfNeeded(resolved, false, "write")
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

				const uploaded = await this.cfg.uploadFn({
					file,
					path: this.toUploadPath(resolved),
					fileSize: blob.size,
					parentId,
				})
				this.recordFile(uploaded)
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

	private handleListDir(req: FSListDirRequest) {
		const { requestId, dir } = req
		const requestDir = dir ?? "./"
		const resolvedDir = this.resolveDir(requestDir)

		if (resolvedDir === null) {
			return this.send({
				type: FS_MESSAGE_TYPES.LIST_DIR_RESPONSE,
				requestId,
				success: false,
				error: `Access denied or invalid directory: ${dir}`,
			})
		}

		this.send({
			type: FS_MESSAGE_TYPES.LIST_DIR_RESPONSE,
			requestId,
			success: true,
			entries: this.buildDirEntries(resolvedDir, requestDir),
		})
	}

	private async handleGetFileUrl(req: FSGetFileUrlRequest) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)
		const replyType = FS_MESSAGE_TYPES.GET_FILE_URL_RESPONSE

		if (!resolved) {
			return this.send({
				type: replyType,
				requestId,
				success: false,
				error: `Access denied or invalid path: ${path}`,
			})
		}

		try {
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.read")
				if (!allowed) {
					return this.send({
						type: replyType,
						requestId,
						success: false,
						error: "Permission denied: fs.project.read",
					})
				}
			}

			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: replyType,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			const urls = await getIframeDownloadUrl(
				[item.file_id],
				this.cfg.getFileAccess?.() ?? null,
			)
			const url = urls?.[0]?.url
			if (!url) throw new Error("Failed to get file URL")

			this.send({ type: replyType, requestId, success: true, url })
		} catch (err) {
			this.send({
				type: replyType,
				requestId,
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			})
		}
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
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			this.assertInFileScope(item)
			const projectId = this.requireProjectId()
			const serverPath = await this.assertServerPath(item, projectId, resolved)
			await this.confirmProjectDeleteIfNeeded(serverPath, false)
			await this.cfg.deleteFn({ file_id: item.file_id, project_id: projectId })
			this.removeFiles([item.file_id])
			this.clearDirCacheForPath(resolved)
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

		if (this.hasProjectFileScope() && resolvedDir === "") {
			return this.send({
				type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
				requestId,
				success: false,
				error: "Cannot delete the project root directory",
			})
		}

		try {
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.DELETE_DIR_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			// 收集目录本身 + 目录下所有文件的 file_id
			const dirPath = this.normalizeWorkspacePath(
				resolvedDir.endsWith("/") ? resolvedDir.slice(0, -1) : resolvedDir,
			)
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

			this.assertInFileScope(dirItem)
			const projectId = this.requireProjectId()
			const serverPath = await this.assertServerPath(dirItem, projectId, dirPath)

			// 收集目录下所有子文件/子目录
			for (const f of this.cfg.fileList) {
				const fp = this.normalizeWorkspacePath(f.relative_file_path)
				if (fp === dirPath || fp.startsWith(`${dirPath}/`)) {
					this.assertInFileScope(f)
					const canonicalPath = this.canonicalWorkspacePath(f.relative_file_path)
					if (canonicalPath !== dirPath && !canonicalPath?.startsWith(`${dirPath}/`)) {
						throw new Error("Access denied: file is outside the requested directory")
					}
					await this.assertServerPathInDir(f, projectId, dirPath)
					fileIds.add(f.file_id)
				}
			}

			// 加入目录本身
			fileIds.add(dirItem.file_id)

			await this.confirmProjectDeleteIfNeeded(serverPath, true)
			await this.cfg.deleteFilesFn({
				file_ids: Array.from(fileIds),
				project_id: projectId,
			})

			this.removeFiles(fileIds)

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
			if (this.isProjectRootRequestPath(path) || this.isProjectRootRequestPath(targetDir)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.MOVE_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			this.assertInFileScope(item)
			const projectId = this.requireProjectId()
			const serverPath = await this.assertServerPath(item, projectId, resolved)

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

			this.assertInFileScope(targetDirItem)
			const targetServerPath = await this.assertServerPath(
				targetDirItem,
				projectId,
				targetDirPath,
			)
			await this.confirmProjectOperationIfNeeded(
				serverPath,
				item.is_directory ?? false,
				"move",
				[targetServerPath],
			)
			await this.cfg.moveFileFn({
				file_id: item.file_id,
				target_parent_id: targetDirItem.file_id,
				project_id: projectId,
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

		if (!this.isSingleFileName(newName)) {
			return this.send({
				type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
				requestId,
				success: false,
				error: "renameFile: newName must be a single file name",
			})
		}

		try {
			if (this.isProjectRootRequestPath(path)) {
				const allowed = await this.ensurePermission("fs.project.write")
				if (!allowed) {
					return this.send({
						type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
						requestId,
						success: false,
						error: "Permission denied: fs.project.write",
					})
				}
			}

			const item = this.findFile(resolved)
			if (!item) {
				return this.send({
					type: FS_MESSAGE_TYPES.RENAME_FILE_RESPONSE,
					requestId,
					success: false,
					error: `File not found: ${path}`,
				})
			}

			this.assertInFileScope(item)
			const projectId = this.requireProjectId()
			const serverPath = await this.assertServerPath(item, projectId, resolved)
			await this.confirmProjectOperationIfNeeded(
				serverPath,
				item.is_directory ?? false,
				"rename",
			)
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

		this.watchService.registerFile(requestId, path, resolved)
	}

	private handleWatchUnregister(req: FSWatchUnregister) {
		const { requestId, path } = req
		const resolved = this.resolvePath(path)
		if (!resolved) return

		this.watchService.unregisterFile(requestId, resolved)
	}

	private handleWatchDirRegister(req: FSWatchDirRegister) {
		const { requestId, dir } = req
		const resolved = this.resolveDir(dir)
		if (resolved === null) return

		this.watchService.registerDir(requestId, dir, resolved)
	}

	private handleWatchDirUnregister(req: FSWatchDirUnregister) {
		const { requestId, dir } = req
		const resolved = this.resolveDir(dir)
		if (resolved === null) return

		this.watchService.unregisterDir(requestId, resolved)
	}

	// ─── 路径工具 ────────────────────────────────────────────────────────────────

	/**
	 * 将 iframe 传入的路径解析为 workspace 相对路径。
	 * - 默认相对应用根目录
	 * - 以 / 开头时访问项目根路径
	 * - 禁止 `..` 穿越
	 */
	private resolvePath(path: string): string | null {
		const aliasResolved = this.aliasMap[path] ?? path
		const resolved = this.resolveWorkspacePath(aliasResolved, false)
		return resolved || null
	}

	private resolveDir(dir: string): string | null {
		const resolved = this.resolveWorkspacePath(dir, true)
		if (resolved === null) return null
		if (!resolved) return ""
		return resolved.endsWith("/") ? resolved : `${resolved}/`
	}

	private resolveWorkspacePath(path: string, allowRoot: boolean): string | null {
		const isAbsolutePath = path.startsWith("/")
		const isProjectRootPath = this.hasProjectFileScope() && isAbsolutePath
		if (isAbsolutePath && !isProjectRootPath) return null

		const clean = path.replace(/^\/+/, "").replace(/^(\.\/)+/, "")
		if (clean.includes("..")) return null

		if (isProjectRootPath) {
			const canonical = this.canonicalWorkspacePath(clean)
			if (canonical === null || (!allowRoot && !canonical)) return null
			return canonical
		}

		if ((clean === "" || clean === ".") && allowRoot) {
			return this.normalizeWorkspacePath(this.appRootDir)
		}

		const full = this.appRootDir ? `${this.appRootDir}${clean}` : clean
		const canonical = this.canonicalWorkspacePath(full)
		if (canonical === null || (!allowRoot && !canonical)) return null
		if (!this.isPathInAppRoot(canonical)) return null
		return canonical
	}

	private findFile(resolvedPath: string): FSFileItem | undefined {
		const normalizedPath = this.normalizeWorkspacePath(resolvedPath)
		return this.cfg.fileList.find(
			(f) => this.normalizeWorkspacePath(f.relative_file_path) === normalizedPath,
		)
	}

	private listDirectDirItems(resolvedDir: string) {
		return this.cfg.fileList
			.map((item) => ({ item, path: this.normalizeWorkspacePath(item.relative_file_path) }))
			.filter(({ path }) => {
				if (resolvedDir === "") {
					return path.length > 0 && !path.includes("/")
				}
				if (!path.startsWith(resolvedDir)) return false
				const rest = path.slice(resolvedDir.length)
				return rest.length > 0 && !rest.includes("/")
			})
	}

	private buildDirEntryNames(resolvedDir: string): string[] {
		return this.listDirectDirItems(resolvedDir).map(
			({ item, path }) => item.file_name || path.split("/").pop() || path,
		)
	}

	private buildDirEntries(resolvedDir: string, originalDir: string): FSDirEntry[] {
		return this.listDirectDirItems(resolvedDir).map(({ item, path }) => {
			const name = item.file_name || path.split("/").pop() || path
			const entry: FSDirEntry = {
				name,
				path: this.toIframeVisiblePath(path, originalDir),
				isDirectory: item.is_directory ?? false,
			}
			if (item.updated_at) entry.updatedAt = item.updated_at
			return entry
		})
	}

	private toIframeVisiblePath(resolvedPath: string, originalDir: string): string {
		if (this.isProjectRootRequestPath(originalDir)) {
			return `/${resolvedPath}`
		}

		const appRoot = this.normalizeWorkspacePath(this.appRootDir)
		if (!appRoot) return resolvedPath
		if (resolvedPath === appRoot) return ""
		if (resolvedPath.startsWith(`${appRoot}/`)) {
			return resolvedPath.slice(appRoot.length + 1)
		}
		return resolvedPath
	}

	private normalizeWorkspacePath(path: string): string {
		return path.replace(/^\/+/, "").replace(/\/+$/, "")
	}

	private canonicalWorkspacePath(path: string): string | null {
		const segments: string[] = []
		for (const segment of path.replace(/^\/+/, "").split("/")) {
			if (!segment || segment === ".") continue
			if (segment === "..") {
				if (segments.length === 0) return null
				segments.pop()
				continue
			}
			segments.push(segment)
		}
		return segments.join("/")
	}

	private hasProjectFileScope(): boolean {
		return true
	}

	private isProjectRootRequestPath(path: string): boolean {
		return typeof path === "string" && path.startsWith("/")
	}

	private isPathInAppRoot(path: string): boolean {
		const itemPath = this.canonicalWorkspacePath(path)
		const appRoot = this.normalizeWorkspacePath(this.appRootDir)
		return (
			!!itemPath && (!appRoot || itemPath === appRoot || itemPath.startsWith(`${appRoot}/`))
		)
	}

	private assertInFileScope(item: FSFileItem) {
		const itemPath = this.canonicalWorkspacePath(item.relative_file_path)
		if (!itemPath) {
			throw new Error("Access denied: file path is invalid")
		}
		if (!this.hasProjectFileScope() && !this.isPathInAppRoot(itemPath)) {
			throw new Error("Access denied: file is outside the app root")
		}
	}

	private async getServerCanonicalPath(item: FSFileItem, projectId: string): Promise<string> {
		if (!this.cfg.verifyFileFn) {
			throw new Error("File verification is required for destructive file operations")
		}
		const info = await this.cfg.verifyFileFn({ file_id: item.file_id, project_id: projectId })
		const serverPath = this.canonicalWorkspacePath(info.relative_file_path || "")
		if (!serverPath) {
			throw new Error("Access denied: server file path is required")
		}
		if (!this.hasProjectFileScope() && !this.isPathInAppRoot(serverPath)) {
			throw new Error("Access denied: server file path is outside the app root")
		}
		return serverPath
	}

	private async assertServerPath(
		item: FSFileItem,
		projectId: string,
		expectedPath: string,
	): Promise<string> {
		const serverPath = await this.getServerCanonicalPath(item, projectId)
		const expected = this.canonicalWorkspacePath(expectedPath)
		if (!expected || serverPath !== expected) {
			throw new Error("Access denied: server file path does not match the requested path")
		}
		return serverPath
	}

	private async assertServerPathInDir(item: FSFileItem, projectId: string, dirPath: string) {
		const serverPath = await this.getServerCanonicalPath(item, projectId)
		if (serverPath !== dirPath && !serverPath.startsWith(`${dirPath}/`)) {
			throw new Error("Access denied: server file path is outside the requested directory")
		}
	}

	private async confirmProjectDeleteIfNeeded(path: string, isDirectory: boolean) {
		await this.confirmProjectOperationIfNeeded(path, isDirectory)
	}

	private async confirmProjectOperationIfNeeded(
		path: string,
		isDirectory: boolean,
		operation?: "write" | "move" | "rename",
		extraPaths: string[] = [],
	) {
		if (!this.hasProjectFileScope()) return
		const affectedPaths = [path, ...extraPaths]
		if (affectedPaths.every((affectedPath) => this.isPathInAppRoot(affectedPath))) return
		if (!this.cfg.confirmProjectDeleteFn) {
			throw new Error("Project file operation confirmation is required")
		}
		const request: Parameters<NonNullable<IframeFSConfig["confirmProjectDeleteFn"]>>[0] = {
			path,
			isDirectory,
			appRootDir: this.appRootDir,
		}
		if (operation) request.operation = operation
		const confirmed = await this.cfg.confirmProjectDeleteFn(request)
		if (!confirmed) throw new Error("File operation cancelled")
	}

	private toUploadPath(resolvedPath: string): string {
		return this.isPathInAppRoot(resolvedPath) ? resolvedPath : `/${resolvedPath}`
	}

	private requireProjectId(): string {
		const projectId = this.cfg.projectId?.trim()
		if (!projectId) {
			throw new Error("Project id is required for destructive file operations")
		}
		return projectId
	}

	private isSingleFileName(name: string): boolean {
		return (
			name.trim().length > 0 &&
			!name.includes("/") &&
			!name.includes("\\") &&
			!name.includes("..") &&
			!Array.from(name).some((char) => {
				const code = char.charCodeAt(0)
				return code <= 31 || code === 127
			})
		)
	}

	private updateLocalPaths(oldPath: string, newPath: string) {
		const oldBase = this.normalizeWorkspacePath(oldPath)
		const newBase = this.normalizeWorkspacePath(newPath)
		const oldPrefix = `${oldBase}/`
		const newName = newBase.split("/").pop()
		const changed: FSFileItem[] = []

		for (const item of this.cfg.fileList) {
			const currentPath = this.normalizeWorkspacePath(item.relative_file_path)
			if (currentPath === oldBase) {
				changed.push({ ...item, relative_file_path: newBase, file_name: newName })
			} else if (currentPath.startsWith(oldPrefix)) {
				changed.push({
					...item,
					relative_file_path: `${newBase}/${currentPath.slice(oldPrefix.length)}`,
				})
			}
		}
		this.recordFiles(changed)

		this.clearDirCacheForPath(oldBase)
		this.clearDirCacheForPath(newBase)
	}

	private recordFile(item: FSFileItem) {
		this.recordFiles([item])
	}

	private recordFiles(items: FSFileItem[]) {
		const changed = new Map<string, FSFileItem>()
		for (const item of items) {
			if (!item?.file_id || !item.relative_file_path) {
				throw new Error("Uploaded file metadata is missing")
			}
			this.assertInFileScope(item)
			changed.set(item.file_id, item)
		}
		for (const [id, item] of changed) this.pendingFiles.set(id, item)
		// Renaming a large directory must scan the host list only once.
		this.cfg.fileList = [
			...this.cfg.fileList.filter((item) => !changed.has(item.file_id)),
			...changed.values(),
		]
	}

	private removeFiles(ids: Iterable<string>) {
		const removed = new Set(ids)
		for (const id of removed) this.pendingFiles.set(id, null)
		this.cfg.fileList = this.cfg.fileList.filter((item) => !removed.has(item.file_id))
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
			this.recordFile({
				file_id: result.file_id,
				relative_file_path: pathUpToHere,
				file_name: dirName,
				is_directory: true,
			})
			this.dirCache.set(pathUpToHere, result.file_id)
			parentId = result.file_id
		}

		return parentId
	}

	private send(message: object) {
		this.cfg.postToIframe(message)
	}

	private async ensurePermission(scope: HtmlPermissionScope): Promise<boolean> {
		if ((scope === "fs.project.read" || scope === "fs.project.write") && !this.cfg.projectId) {
			throw new Error(this.cfg.projectContextUnavailableError || "No project selected")
		}
		if (!this.cfg.authorizePermission) return true
		return this.cfg.authorizePermission(scope)
	}
}
