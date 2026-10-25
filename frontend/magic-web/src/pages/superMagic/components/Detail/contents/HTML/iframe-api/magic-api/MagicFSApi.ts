/**
 * MagicFSApi
 *
 * 向 iframe 内的 window.Magic.fs 注入文件系统 API（低层 I/O）。
 * 提供 readFile / writeFile / listFiles / getFileUrl / watchFile，均通过 postMessage
 * 委托给主站（parent window）的 IframeFSService 处理。
 *
 * 同时注入 window.Magic.getAppBasePath() 返回应用在 workspace 中的根目录路径。
 *
 * 工作区级文件操作（上传到 OSS、触发下载、附加到消息输入框）由
 * MagicWorkspaceApi 负责，安装到 window.Magic.uploadFiles 等方法上。
 */

import { BaseRuntimeBridgeApiPlugin, getParentOrigin } from "@dtyq/html-sandbox"
import { getPreludeVersion, isStaleDocument } from "./prelude-runtime-context"

function isSingleFileName(name: string): boolean {
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

interface FSDirEntry {
	name: string
	path: string
	isDirectory: boolean
	updatedAt?: string
}

interface FSDirChangedEvent {
	dir: string
	timestamp: number
	added: string[]
	removed: string[]
	entries: FSDirEntry[]
	success?: boolean
	reason?: "too_many_entries"
	entryCount?: number
	maxEntryCount?: number
}

export class MagicFSApi extends BaseRuntimeBridgeApiPlugin {
	constructor() {
		super("MagicFSApi")
	}

	install(): void {
		const installedVersion = getPreludeVersion()
		if (!window.Magic) window.Magic = {}

		// Install getAppBasePath at top-level
		if (!window.Magic.getAppBasePath) {
			window.Magic.getAppBasePath = (): Promise<string> => {
				return this.request<string>("MAGIC_FS_GET_APP_BASE_PATH_REQUEST", {})
			}
		}

		if (window.Magic.fs) return

		window.Magic.fs = {
			readFile: (path: string): Promise<string> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("readFile: path must be a string"))
				}
				return this.request<string>("MAGIC_FS_READ_REQUEST", { path })
			},

			writeFile: (path: string, content: string | Blob | ArrayBuffer): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("writeFile: path must be a string"))
				}
				if (
					typeof content !== "string" &&
					!(content instanceof Blob) &&
					!(content instanceof ArrayBuffer)
				) {
					return Promise.reject(
						new Error("writeFile: content must be a string, Blob, or ArrayBuffer"),
					)
				}

				// For Blob / ArrayBuffer, use the blob write protocol (supports up to 100MB)
				if (content instanceof Blob || content instanceof ArrayBuffer) {
					const blob = content instanceof ArrayBuffer ? new Blob([content]) : content
					return this.request<void>(
						"MAGIC_FS_WRITE_BLOB_REQUEST",
						{ path, blob },
						60000, // 60s timeout for large files
					)
				}

				// For string content, use the standard write protocol (up to 5MB)
				return this.request<void>("MAGIC_FS_WRITE_REQUEST", { path, content })
			},

			listFiles: (dir?: string): Promise<string[]> => {
				return this.request<{ files?: string[] }>("MAGIC_FS_LIST_REQUEST", {
					dir: dir ?? "./",
				}).then((data) => {
					if (
						data &&
						typeof data === "object" &&
						Array.isArray((data as { files?: string[] }).files)
					) {
						return (data as { files: string[] }).files
					}
					return []
				})
			},

			listDir: (dir?: string): Promise<FSDirEntry[]> => {
				if (dir !== undefined && typeof dir !== "string") {
					return Promise.reject(new Error("listDir: dir must be a string"))
				}
				return this.request<{ entries?: FSDirEntry[] }>("MAGIC_FS_LIST_DIR_REQUEST", {
					dir: dir ?? "./",
				}).then((data) => {
					if (
						data &&
						typeof data === "object" &&
						Array.isArray((data as { entries?: FSDirEntry[] }).entries)
					) {
						return (data as { entries: FSDirEntry[] }).entries
					}
					return []
				})
			},

			getFileUrl: (path: string): Promise<string> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("getFileUrl: path must be a string"))
				}
				return this.request<string>(
					"MAGIC_FS_GET_FILE_URL_REQUEST",
					{ path },
					15000,
					(data) => data["url"] as string,
				)
			},

			deleteFile: (path: string): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("deleteFile: path must be a string"))
				}
				return this.request<void>("MAGIC_FS_DELETE_FILE_REQUEST", { path })
			},

			deleteDir: (path: string): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("deleteDir: path must be a string"))
				}
				return this.request<void>("MAGIC_FS_DELETE_DIR_REQUEST", { path })
			},

			moveFile: (path: string, targetDir: string): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("moveFile: path must be a string"))
				}
				if (typeof targetDir !== "string") {
					return Promise.reject(new Error("moveFile: targetDir must be a string"))
				}
				return this.request<void>("MAGIC_FS_MOVE_FILE_REQUEST", { path, targetDir })
			},

			renameFile: (path: string, newName: string): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("renameFile: path must be a string"))
				}
				if (typeof newName !== "string") {
					return Promise.reject(new Error("renameFile: newName must be a string"))
				}
				if (!isSingleFileName(newName)) {
					return Promise.reject(
						new Error("renameFile: newName must be a single file name"),
					)
				}
				return this.request<void>("MAGIC_FS_RENAME_FILE_REQUEST", { path, newName })
			},

			watchFile: (
				path: string,
				callback: (e: { path: string; timestamp: number }) => void,
			): (() => void) => {
				if (typeof path !== "string") throw new Error("watchFile: path must be a string")
				if (typeof callback !== "function")
					throw new Error("watchFile: callback must be a function")

				const watchId = `watch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

				const handler = (
					event: MessageEvent<{ type?: string; path?: string; timestamp?: number }>,
				) => {
					if (!this.isHostMessage(event) || isStaleDocument(installedVersion)) return
					if (!event.data || event.data.type !== "MAGIC_FS_FILE_CHANGED") return
					if (event.data.path !== path) return
					try {
						callback({
							path: event.data.path!,
							timestamp: event.data.timestamp ?? Date.now(),
						})
					} catch {
						// ignore callback errors
					}
				}
				window.addEventListener("message", handler)
				window.parent.postMessage(
					{ type: "MAGIC_FS_WATCH_REGISTER", requestId: watchId, path },
					getParentOrigin(),
				)

				return () => {
					window.removeEventListener("message", handler)
					window.parent.postMessage(
						{ type: "MAGIC_FS_WATCH_UNREGISTER", requestId: watchId, path },
						getParentOrigin(),
					)
				}
			},

			watchDir: (dir: string, callback: (event: FSDirChangedEvent) => void): (() => void) => {
				if (typeof dir !== "string") throw new Error("watchDir: dir must be a string")
				if (typeof callback !== "function")
					throw new Error("watchDir: callback must be a function")

				const watchId = `watch_dir_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

				const handler = (
					event: MessageEvent<{
						type?: string
						dir?: string
						timestamp?: number
						added?: string[]
						removed?: string[]
						entries?: FSDirEntry[]
						success?: boolean
						reason?: "too_many_entries"
						entryCount?: number
						maxEntryCount?: number
					}>,
				) => {
					if (!this.isHostMessage(event) || isStaleDocument(installedVersion)) return
					if (
						!event.data ||
						(event.data.type !== "MAGIC_FS_DIR_CHANGED" &&
							event.data.type !== "MAGIC_FS_DIR_WATCH_STATUS")
					)
						return
					if (event.data.dir !== dir) return
					try {
						callback({
							dir: event.data.dir!,
							timestamp: event.data.timestamp ?? Date.now(),
							added: Array.isArray(event.data.added) ? event.data.added : [],
							removed: Array.isArray(event.data.removed) ? event.data.removed : [],
							entries: Array.isArray(event.data.entries) ? event.data.entries : [],
							...(event.data.type === "MAGIC_FS_DIR_WATCH_STATUS"
								? {
										success: event.data.success ?? false,
										reason: event.data.reason,
										entryCount: event.data.entryCount,
										maxEntryCount: event.data.maxEntryCount,
									}
								: {}),
						})
					} catch {
						// ignore callback errors
					}
				}
				window.addEventListener("message", handler)
				window.parent.postMessage(
					{ type: "MAGIC_FS_WATCH_DIR_REGISTER", requestId: watchId, dir },
					getParentOrigin(),
				)

				return () => {
					window.removeEventListener("message", handler)
					window.parent.postMessage(
						{ type: "MAGIC_FS_WATCH_DIR_UNREGISTER", requestId: watchId, dir },
						getParentOrigin(),
					)
				}
			},
		}
	}
}
