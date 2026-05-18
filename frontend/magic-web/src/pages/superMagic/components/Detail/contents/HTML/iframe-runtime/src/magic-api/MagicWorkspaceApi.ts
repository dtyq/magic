/**
 * MagicWorkspaceApi
 *
 * 向 iframe 内注入工作区级文件操作 API（高层 UI 集成）：
 *   - window.Magic.uploadFiles        — 将浏览器 File 对象上传到 workspace（OSS）
 *   - window.Magic.addFilesToMessage  — 将 workspace 文件附加到新建话题的消息输入框
 *   - window.Magic.downloadFiles      — 触发 workspace 文件的浏览器下载
 *
 * 与 MagicFSApi（低层文本 I/O）的区别：
 *   - MagicFSApi      → MAGIC_FS_* 消息 → IframeFSService（路径解析、OSS 临时 URL）
 *   - MagicWorkspaceApi → MAGIC_UPLOAD/ADD/DOWNLOAD_FILES_* 消息 → useMagicFiles hook
 *                         （OSS 上传、浏览器下载、Topic 创建 + 路由跳转）
 *
 * 所有操作通过 postMessage 委托给主站（parent window）处理。
 */

import { MagicBaseApi } from "./MagicBaseApi"
import { MagicApiLogger } from "./MagicApiLogger"

interface UploadFileItem {
	file: File
	path: string
	filename: string
}

interface FileData {
	file: File
	filename: string
	path: string
	fileSize: number
	fileType: string
}

export class MagicWorkspaceApi extends MagicBaseApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		MagicApiLogger.info("MagicWorkspaceApi", "install")
		this.installUploadFiles()
		this.installAddFilesToMessage()
		this.installDownloadFiles()
	}

	private installUploadFiles(): void {
		if (window.Magic.uploadFiles) return

		window.Magic.uploadFiles = (files: unknown[]): Promise<unknown> => {
			if (!Array.isArray(files)) {
				MagicApiLogger.error("MagicWorkspaceApi", "uploadFiles:invalid-files", {
					filesType: typeof files,
				})
				return Promise.reject(new Error("window.Magic.uploadFiles: files must be an array"))
			}
			if (files.length === 0) {
				MagicApiLogger.warn("MagicWorkspaceApi", "uploadFiles:empty-files")
				return Promise.reject(
					new Error("window.Magic.uploadFiles: files array cannot be empty"),
				)
			}
			MagicApiLogger.info("MagicWorkspaceApi", "uploadFiles:start", {
				fileCount: files.length,
			})
			for (let i = 0; i < files.length; i++) {
				const item = files[i] as Record<string, unknown>
				if (!item || typeof item !== "object") {
					return Promise.reject(
						new Error(`window.Magic.uploadFiles: files[${i}] must be an object`),
					)
				}
				if (!(item["file"] instanceof File)) {
					return Promise.reject(
						new Error(
							`window.Magic.uploadFiles: files[${i}].file must be a File object`,
						),
					)
				}
				if (typeof item["path"] !== "string") {
					return Promise.reject(
						new Error(`window.Magic.uploadFiles: files[${i}].path must be a string`),
					)
				}
				if (typeof item["filename"] !== "string") {
					return Promise.reject(
						new Error(
							`window.Magic.uploadFiles: files[${i}].filename must be a string`,
						),
					)
				}
			}

			const fileData: FileData[] = (files as UploadFileItem[]).map((item) => ({
				file: item.file,
				filename: item.filename,
				path: item.path,
				fileSize: item.file.size,
				fileType: item.file.type,
			}))

			return this.request<unknown>(
				"MAGIC_UPLOAD_FILES_REQUEST",
				{ files: fileData },
				60000, // 60s timeout for large files
				(data) => data["results"],
			)
		}
	}

	private installAddFilesToMessage(): void {
		if (window.Magic.addFilesToMessage) return

		window.Magic.addFilesToMessage = (
			filePaths: unknown[],
			agentMode?: string,
		): Promise<unknown> => {
			if (!Array.isArray(filePaths)) {
				MagicApiLogger.error("MagicWorkspaceApi", "addFilesToMessage:invalid-filePaths", {
					filePathsType: typeof filePaths,
				})
				return Promise.reject(
					new Error("window.Magic.addFilesToMessage: filePaths must be an array"),
				)
			}
			if (filePaths.length === 0) {
				return Promise.reject(
					new Error("window.Magic.addFilesToMessage: filePaths array cannot be empty"),
				)
			}
			for (let i = 0; i < filePaths.length; i++) {
				if (typeof filePaths[i] !== "string") {
					return Promise.reject(
						new Error(
							`window.Magic.addFilesToMessage: filePaths[${i}] must be a string`,
						),
					)
				}
			}
			if (agentMode !== undefined && typeof agentMode !== "string") {
				return Promise.reject(
					new Error("window.Magic.addFilesToMessage: agentMode must be a string"),
				)
			}

			MagicApiLogger.info("MagicWorkspaceApi", "addFilesToMessage:start", {
				filePaths: MagicApiLogger.summarizePaths(filePaths as string[]),
				hasAgentMode: agentMode !== undefined,
			})

			return this.request<unknown>(
				"MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
				{ filePaths, agentMode },
				15000,
				(data) => data["result"],
			)
		}
	}

	private installDownloadFiles(): void {
		if (window.Magic.downloadFiles) return

		window.Magic.downloadFiles = (filePaths: string[]): Promise<unknown> => {
			if (!Array.isArray(filePaths)) {
				MagicApiLogger.error("MagicWorkspaceApi", "downloadFiles:invalid-filePaths", {
					filePathsType: typeof filePaths,
				})
				return Promise.reject(
					new Error("window.Magic.downloadFiles: filePaths must be an array"),
				)
			}
			if (filePaths.length === 0) {
				return Promise.reject(
					new Error("window.Magic.downloadFiles: filePaths array cannot be empty"),
				)
			}
			for (let i = 0; i < filePaths.length; i++) {
				if (typeof filePaths[i] !== "string") {
					return Promise.reject(
						new Error(`window.Magic.downloadFiles: filePaths[${i}] must be a string`),
					)
				}
			}

			MagicApiLogger.info("MagicWorkspaceApi", "downloadFiles:start", {
				filePaths: MagicApiLogger.summarizePaths(filePaths),
			})

			return this.request<unknown>(
				"MAGIC_DOWNLOAD_FILES_REQUEST",
				{ filePaths },
				30000,
				(data) => data["result"],
			)
		}
	}
}
