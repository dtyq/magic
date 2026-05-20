/**
 * MagicFSApi
 *
 * 向 iframe 内的 window.Magic.fs 注入文件系统 API（低层 I/O）。
 * 提供 readFile / writeFile / listFiles / watchFile，均通过 postMessage
 * 委托给主站（parent window）的 IframeFSService 处理。
 *
 * 工作区级文件操作（上传到 OSS、触发下载、附加到消息输入框）由
 * MagicWorkspaceApi 负责，安装到 window.Magic.uploadFiles 等方法上。
 */

import { MagicBaseApi } from "./MagicBaseApi"

export class MagicFSApi extends MagicBaseApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.fs) return

		window.Magic.fs = {
			readFile: (path: string): Promise<string> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("readFile: path must be a string"))
				}
				return this.request<string>("MAGIC_FS_READ_REQUEST", { path })
			},

			writeFile: (path: string, content: string): Promise<void> => {
				if (typeof path !== "string") {
					return Promise.reject(new Error("writeFile: path must be a string"))
				}
				if (typeof content !== "string") {
					return Promise.reject(new Error("writeFile: content must be a string"))
				}
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
