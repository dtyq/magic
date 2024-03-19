import { env } from "@/opensource/utils/env"
import { UploadConfig } from "@dtyq/upload-sdk"
import magicClient from "@/opensource/apis/clients/magic"
import { UploadFileMentionData } from "@/opensource/components/business/MentionPanel/types"
import { cloneDeep } from "lodash-es"
import { UploadSource } from "../hooks/useFileUpload"
import { SuperMagicApi } from "@/opensource/apis"
import { logger as Logger } from "@/opensource/utils/log"

class UploadTokenService {
	private readonly baseUrl = env("MAGIC_SERVICE_BASE_URL")
	private readonly logger = Logger.createLogger("SuperMagicUploadTokenService")

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

	/**
	 * 获取上传凭证
	 * @param projectId
	 * @param expires
	 * @returns
	 */
	async fetchUploadToken(projectId: string, expires: number = 3600) {
		const queryParams = new URLSearchParams({
			project_id: projectId,
			expires: expires.toString(),
		})

		const url = `${this.getUploadTokenUrl}?${queryParams.toString()}`

		try {
			const res = await magicClient.get<UploadConfig["customCredentials"]>(url)

			this.uploadTokenMap.set(projectId, {
				customCredentials: res,
				expireTime: Date.now() + expires * 1000,
			})

			return res
		} catch (error) {
			this.logger.error("fetchUploadToken failed", { projectId, url, error })
			throw error
		}
	}

	/**
	 * 判断上传凭证是否过期
	 * @param projectId 项目ID
	 * @param bufferTime 提前过期的缓冲时间（毫秒），默认5分钟，不能为负数
	 * @returns true表示已过期，false表示未过期
	 */
	isExpired(projectId: string, bufferTime: number = 5 * 60 * 1000): boolean {
		const token = this.uploadTokenMap.get(projectId)
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
	 * @returns
	 */
	async getUploadToken(projectId: string, suffixDir: string = "uploads", force: boolean = false) {
		const token = this.uploadTokenMap.get(projectId)
		if (token && !this.isExpired(projectId) && !force) {
			return this.changeDir(token.customCredentials, suffixDir)
		}

		try {
			const newToken = await this.fetchUploadToken(projectId)
			return this.changeDir(newToken, suffixDir)
		} catch (error) {
			this.logger.error("getUploadToken failed", { projectId, error })
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
	): Promise<UploadConfig["customCredentials"]> {
		try {
			// 直接返回原始凭证，不修改任何字段
			const originalCredentials = await this.fetchUploadToken(projectId)

			this.logger.log("getUploadTokenForCustomKey success", {
				projectId,
				dir: originalCredentials?.temporary_credential?.dir,
			})

			return originalCredentials
		} catch (error) {
			this.logger.error("getUploadTokenForCustomKey failed", { projectId, error })
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
	saveTempFilesToProject(items: UploadFileMentionData[], projectId: string, topicId?: string) {
		return Promise.all(
			items.map((item) => {
				if (!item.file_path || item.file_size === undefined) {
					throw new Error("Invalid file data: missing file_path or file_size")
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
		file_key: string
		file_name: string
		file_size: number
		file_type?: string
		storage_type: "workspace" | "topic"
		source: UploadSource
	}) {
		return SuperMagicApi.saveUploadFileToProject(data)
	}
}

export const superMagicUploadTokenService = new UploadTokenService()
