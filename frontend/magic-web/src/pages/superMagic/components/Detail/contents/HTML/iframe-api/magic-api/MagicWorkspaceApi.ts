/**
 * MagicWorkspaceApi
 *
 * 向 iframe 内注入工作区级文件操作 API（高层 UI 集成）：
 *   - window.Magic.project.uploadFiles        — 将浏览器 File 对象上传到 workspace（OSS）
 *   - window.Magic.project.addFilesToMessage  — 将 workspace 文件附加到消息输入框
 *   - window.Magic.project.downloadFiles      — 触发 workspace 文件的浏览器下载
 *
 * 单话题宿主（龙虾 / 对话）上 addFilesToMessage 会附加到当前话题，
 * 并忽略 agentMode，沿用 claw/chat 自己的 agent。
 *
 * 向后兼容（deprecated）：
 *   - window.Magic.uploadFiles
 *   - window.Magic.addFilesToMessage
 *   - window.Magic.downloadFiles
 *
 * 与 MagicFSApi（低层文本 I/O）的区别：
 *   - MagicFSApi      → MAGIC_FS_* 消息 → IframeFSService（路径解析、OSS 临时 URL）
 *   - MagicWorkspaceApi → MAGIC_UPLOAD/ADD/DOWNLOAD_FILES_* 消息 → useMagicFiles hook
 *                         （OSS 上传、浏览器下载、Topic 创建 + 路由跳转）
 *
 * 所有操作通过 postMessage 委托给主站（parent window）处理。
 */

import { BaseRuntimeBridgeApiPlugin } from "@dtyq/html-sandbox"
import { MagicApiLogger } from "./MagicApiLogger"

interface UploadFileItem {
	file: File | Blob | ArrayBuffer
	path: string
	filename: string
}

interface FileData {
	file: File | Blob | ArrayBuffer
	filename: string
	path: string
	fileSize: number
	fileType: string
}

export class MagicWorkspaceApi extends BaseRuntimeBridgeApiPlugin {
	constructor() {
		super("MagicWorkspaceApi")
	}

	install(): void {
		if (!window.Magic) window.Magic = {}
		if (!window.Magic.project) window.Magic.project = {}
		this.logger.info("install")
		this.installUploadFiles()
		this.installAddFilesToMessage()
		this.installDownloadFiles()
	}

	private installUploadFiles(): void {
		const uploadFilesFn = (files: unknown[]): Promise<unknown> => {
			if (!Array.isArray(files)) {
				this.logger.error("uploadFiles:invalid-files", {
					filesType: typeof files,
				})
				return Promise.reject(new Error("uploadFiles: files must be an array"))
			}
			if (files.length === 0) {
				this.logger.warn("uploadFiles:empty-files")
				return Promise.reject(
					new Error("window.Magic.uploadFiles: files array cannot be empty"),
				)
			}
			this.logger.info("uploadFiles:start", {
				fileCount: files.length,
			})
			for (let i = 0; i < files.length; i++) {
				const item = files[i] as Record<string, unknown>
				if (!item || typeof item !== "object") {
					return Promise.reject(
						new Error(`window.Magic.uploadFiles: files[${i}] must be an object`),
					)
				}
				if (
					!(item["file"] instanceof File) &&
					!(item["file"] instanceof Blob) &&
					!(item["file"] instanceof ArrayBuffer)
				) {
					return Promise.reject(
						new Error(
							`window.Magic.uploadFiles: files[${i}].file must be a File, Blob, or ArrayBuffer`,
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
				fileSize: item.file instanceof ArrayBuffer ? item.file.byteLength : item.file.size,
				fileType: item.file instanceof ArrayBuffer ? "" : item.file.type,
			}))
			const transfer = fileData
				.map((item) => item.file)
				.filter((file): file is ArrayBuffer => file instanceof ArrayBuffer)

			return this.request<unknown>(
				"MAGIC_UPLOAD_FILES_REQUEST",
				{ files: fileData },
				60000, // 60s timeout for large files
				(data) => data["results"],
				transfer,
			)
		}

		// New namespace
		if (!window.Magic.project!.uploadFiles) {
			window.Magic.project!.uploadFiles = uploadFilesFn
		}
		// Backward compat (deprecated)
		if (!window.Magic.uploadFiles) {
			window.Magic.uploadFiles = uploadFilesFn
		}
	}

	private installAddFilesToMessage(): void {
		const addFilesToMessageFn = (
			filePaths: unknown[],
			agentMode?: string,
		): Promise<unknown> => {
			if (!Array.isArray(filePaths)) {
				this.logger.error("addFilesToMessage:invalid-filePaths", {
					filePathsType: typeof filePaths,
				})
				return Promise.reject(new Error("addFilesToMessage: filePaths must be an array"))
			}
			if (filePaths.length === 0) {
				return Promise.reject(
					new Error("addFilesToMessage: filePaths array cannot be empty"),
				)
			}
			for (let i = 0; i < filePaths.length; i++) {
				if (typeof filePaths[i] !== "string") {
					return Promise.reject(
						new Error(`addFilesToMessage: filePaths[${i}] must be a string`),
					)
				}
			}
			if (agentMode !== undefined && typeof agentMode !== "string") {
				return Promise.reject(new Error("addFilesToMessage: agentMode must be a string"))
			}

			this.logger.info("addFilesToMessage:start", {
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

		// New namespace
		if (!window.Magic.project!.addFilesToMessage) {
			window.Magic.project!.addFilesToMessage = addFilesToMessageFn
		}
		// Backward compat (deprecated)
		if (!window.Magic.addFilesToMessage) {
			window.Magic.addFilesToMessage = addFilesToMessageFn
		}
	}

	private installDownloadFiles(): void {
		const downloadFilesFn = (filePaths: string[]): Promise<unknown> => {
			if (!Array.isArray(filePaths)) {
				this.logger.error("downloadFiles:invalid-filePaths", {
					filePathsType: typeof filePaths,
				})
				return Promise.reject(new Error("downloadFiles: filePaths must be an array"))
			}
			if (filePaths.length === 0) {
				return Promise.reject(new Error("downloadFiles: filePaths array cannot be empty"))
			}
			for (let i = 0; i < filePaths.length; i++) {
				if (typeof filePaths[i] !== "string") {
					return Promise.reject(
						new Error(`downloadFiles: filePaths[${i}] must be a string`),
					)
				}
			}

			this.logger.info("downloadFiles:start", {
				filePaths: MagicApiLogger.summarizePaths(filePaths),
			})

			return this.request<unknown>(
				"MAGIC_DOWNLOAD_FILES_REQUEST",
				{ filePaths },
				30000,
				(data) => data["result"],
			)
		}

		// New namespace
		if (!window.Magic.project!.downloadFiles) {
			window.Magic.project!.downloadFiles = downloadFilesFn
		}
		// Backward compat (deprecated)
		if (!window.Magic.downloadFiles) {
			window.Magic.downloadFiles = downloadFilesFn
		}
	}
}
