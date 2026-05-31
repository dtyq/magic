/**
 * MagicFSApi
 *
 * 向 iframe 内的 window.Magic.fs 注入文件系统 API（低层 I/O）。
 * 提供 readFile / writeFile / listFiles / watchFile，均通过 postMessage
 * 委托给主站（parent window）的 IframeFSService 处理。
 *
 * 同时注入 window.Magic.getAppBasePath() 返回应用在 workspace 中的根目录路径。
 *
 * 工作区级文件操作（上传到 OSS、触发下载、附加到消息输入框）由
 * MagicWorkspaceApi 负责，安装到 window.Magic.uploadFiles 等方法上。
 */

import { MagicBaseApi } from "./MagicBaseApi"

export class MagicFSApi extends MagicBaseApi {
	install(): void {
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
					const blob =
						content instanceof ArrayBuffer
							? new Blob([content])
							: content
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
					"*",
				)

				return () => {
					window.removeEventListener("message", handler)
					window.parent.postMessage(
						{ type: "MAGIC_FS_WATCH_UNREGISTER", requestId: watchId, path },
						"*",
					)
				}
			},
		}
	}
}
