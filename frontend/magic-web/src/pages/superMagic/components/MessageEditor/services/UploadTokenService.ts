import { env } from "@/utils/env"
import { UploadConfig } from "@dtyq/upload-sdk"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import { UploadFileMentionData } from "@/components/business/MentionPanel/types"
import { cloneDeep } from "lodash-es"
import { UploadSource } from "../hooks/useFileUpload"
import { SuperMagicApi } from "@/apis"
import { logger as Logger } from "@/infrastructure/logger"
import type { FileScope } from "@/apis/modules/fileScope"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"

const TEMP_UPLOAD_DIR_NAME = ".tmp"

export class UploadTokenService {
	private readonly baseUrl = env("MAGIC_SERVICE_BASE_URL")
	private readonly logger = Logger.createLogger("SuperMagicUploadTokenService")
	private readonly tempUploadDirectoryIds = new Map<string, string>()
	private readonly tempUploadDirectoryPromises = new Map<string, Promise<string>>()

	/**
	 * 上传凭证缓存
	 */
	uploadTokenMap = new Map<
		string,
		{
			customCredentials: UploadConfig["customCredentials"]
			expireTime: number
		}
	>()

	/**
	 * 获取临时上传目录
	 */
	getLastWorkDir() {
		const dir = this.uploadTokenMap.get("")?.customCredentials?.temporary_credential?.dir
		if (!dir) {
			return undefined
		}
		this.uploadTokenMap.delete("")
		return dir
	}

	get getUploadTokenUrl() {
		return this.baseUrl + "/api/v1/super-agent/file/project-upload-token"
	}

	/** 生成包含文件空间的上传凭证缓存键。 */
	private getUploadTokenCacheKey(projectId: string, fileScope?: FileScope): string {
		return fileScope ? `${fileScope}:${getFileReferenceIdentityKey()}:${projectId}` : projectId
	}

	/**
	 * 获取上传凭证
	 * @param projectId
	 * @param expires
	 * @returns
	 */
	async fetchUploadToken(projectId: string, expires: number = 3600, fileScope?: FileScope) {
		const cacheKey = this.getUploadTokenCacheKey(projectId, fileScope)
		const queryParams = new URLSearchParams({
			project_id: projectId,
			expires: expires.toString(),
		})
		if (fileScope) queryParams.set("scope", fileScope)

		const url = `${this.getUploadTokenUrl}?${queryParams.toString()}`

		try {
			const res = await magicClient.get<UploadConfig["customCredentials"]>(url)

			// 用户文件空间在不同身份下共用 project_id=0，凭证只能返回给发起请求的身份。
			if (cacheKey !== this.getUploadTokenCacheKey(projectId, fileScope))
				throw new DOMException("Upload identity changed", "AbortError")
			this.uploadTokenMap.set(cacheKey, {
				customCredentials: res,
				expireTime: Date.now() + expires * 1000,
			})

			return res
		} catch (error) {
			this.logger.error({
				eventKey: "fetch_upload_token_failed",
				errorKind: "permission",
				error: error,
				message: "fetchUploadToken failed",
				context: { projectId, url, fileScope },
			})
			throw error
		}
	}

	/**
	 * 判断上传凭证是否过期
	 * @param projectId 项目ID
	 * @param bufferTime 提前过期的缓冲时间（毫秒），默认5分钟，不能为负数
	 * @returns true表示已过期，false表示未过期
	 */
	isExpired(
		projectId: string,
		bufferTime: number = 5 * 60 * 1000,
		fileScope?: FileScope,
	): boolean {
		const token = this.uploadTokenMap.get(this.getUploadTokenCacheKey(projectId, fileScope))
		if (!token) {
			this.logger.warn("token not found, treated as expired", { projectId })
			return true
		}

		// 确保缓冲时间不为负数
		const safeBufferTime = Math.max(0, bufferTime)

		// 提前缓冲时间过期，避免在使用过程中过期
		const currentTime = Date.now()
		const expireTimeWithBuffer = token.expireTime - safeBufferTime

		const expired = currentTime >= expireTimeWithBuffer
		if (expired)
			this.logger.warn("token expired (with buffer)", {
				projectId,
				expireTime: token.expireTime,
				bufferTime: safeBufferTime,
			})
		return expired
	}

	changeDir(customCredentials: UploadConfig["customCredentials"], suffixDir: string) {
		const crd = cloneDeep(customCredentials)
		if (!crd?.temporary_credential?.dir || !suffixDir) {
			return customCredentials
		}

		// normalizedSuffixDir 前后都带/
		let normalizedSuffixDir = suffixDir.endsWith("/") ? suffixDir : suffixDir + "/"
		if (!normalizedSuffixDir.startsWith("/")) {
			normalizedSuffixDir = "/" + normalizedSuffixDir
		}

		// 尾部不带/
		const normalizedDir = crd.temporary_credential.dir.endsWith("/")
			? crd.temporary_credential.dir.slice(0, -1)
			: crd.temporary_credential.dir

		crd.temporary_credential.dir = normalizedDir + normalizedSuffixDir
		return crd
	}

	/**
	 * 获取上传凭证
	 * @param projectId
	 * @param _parentId 父目录ID（保留用于向后兼容，未使用）
	 * @returns
	 */
	async getUploadToken(
		projectId: string,
		_parentId?: string,
		force: boolean = false,
		fileScope?: FileScope,
	) {
		const token = this.uploadTokenMap.get(this.getUploadTokenCacheKey(projectId, fileScope))
		if (token && !this.isExpired(projectId, undefined, fileScope) && !force) {
			return token.customCredentials
		}

		try {
			const newToken = await this.fetchUploadToken(projectId, 3600, fileScope)
			return newToken
		} catch (error) {
			this.logger.error({
				eventKey: "get_upload_token_failed",
				errorKind: "permission",
				error: error,
				message: "getUploadToken failed",
				context: { projectId, fileScope },
			})
			throw error
		}
	}

	/**
	 * 获取用于自定义fileKey的上传凭证
	 * 直接返回原始凭证，不修改dir字段，避免SDK凭证验证失败
	 * 自定义路径通过fileName参数处理
	 * @param projectId 项目ID
	 * @returns 原始上传凭证
	 */
	async getUploadTokenForCustomKey(
		projectId: string,
		fileScope?: FileScope,
	): Promise<UploadConfig["customCredentials"]> {
		try {
			// 直接返回原始凭证，不修改任何字段
			const originalCredentials = await this.fetchUploadToken(projectId, 3600, fileScope)

			this.logger.log("getUploadTokenForCustomKey success", {
				projectId,
				dir: originalCredentials?.temporary_credential?.dir,
			})

			return originalCredentials
		} catch (error) {
			this.logger.error({
				eventKey: "custom_key_upload_token_failed",
				errorKind: "permission",
				error: error,
				message: "getUploadTokenForCustomKey failed",
				context: { projectId, fileScope },
			})
			throw error
		}
	}

	/**
	 * 保存临时文件到项目
	 * @param items
	 * @param projectId
	 * @param topicId
	 * @returns
	 */
	private async ensureTempUploadDirectory(projectId: string) {
		const cachedDirectoryId = this.tempUploadDirectoryIds.get(projectId)
		if (cachedDirectoryId) return cachedDirectoryId
		const pendingDirectory = this.tempUploadDirectoryPromises.get(projectId)
		if (pendingDirectory) return pendingDirectory

		const createDirectory = (async () => {
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				file_name: TEMP_UPLOAD_DIR_NAME,
				is_directory: true,
				ignore_duplicate: true,
			})
			if (!response?.file_id) {
				throw new Error("Failed to create temp upload directory")
			}

			this.tempUploadDirectoryIds.set(projectId, response.file_id)
			return response.file_id
		})()
		this.tempUploadDirectoryPromises.set(projectId, createDirectory)

		try {
			return await createDirectory
		} finally {
			this.tempUploadDirectoryPromises.delete(projectId)
		}
	}

	saveTempFilesToProject(items: UploadFileMentionData[], projectId: string, topicId?: string) {
		return Promise.all(
			items.map(async (item) => {
				if (!item.file_path || item.file_size === undefined) {
					throw new Error("Invalid file data: missing file_path or file_size")
				}

				// Workspace-home images are uploaded before a project exists. Once message
				// sending creates the project, materialize their hidden .tmp destination here.
				if (item.is_hidden) {
					const parentId = await this.ensureTempUploadDirectory(projectId)
					const [saveResult] = await SuperMagicApi.batchSaveFiles({
						project_id: projectId,
						parent_id: parentId,
						files: [
							{
								project_id: projectId,
								topic_id: topicId,
								task_id: "",
								file_key: item.file_path,
								file_name: item.file_name,
								file_size: item.file_size,
								file_type: "user_upload",
								storage_type: "workspace",
								source: UploadSource.Home,
								relative_file_path:
									item.relative_file_path ||
									`${TEMP_UPLOAD_DIR_NAME}/${item.file_name}`,
								is_hidden: true,
							},
						],
					})
					return saveResult
				}

				return this.saveFileToProject({
					project_id: projectId,
					topic_id: topicId,
					file_key: item.file_path,
					file_name: item.file_name,
					file_size: item.file_size,
					file_type: "user_upload",
					storage_type: "workspace",
					source: UploadSource.Home,
				})
			}),
		)
	}

	/**
	 * 保存文件到项目
	 * @param data
	 * @returns
	 */
	saveFileToProject(data: {
		project_id: string
		topic_id?: string
		task_id?: string
		parent_id?: string
		file_key: string
		file_name: string
		file_size: number
		file_type?: string
		storage_type: "workspace" | "topic"
		source: UploadSource
		relative_file_path?: string
		is_hidden?: boolean
	}) {
		return SuperMagicApi.saveUploadFileToProject(data)
	}
}

export const superMagicUploadTokenService = new UploadTokenService()
