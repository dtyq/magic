import { version } from "../package.json"
import { DownloadException, DownloadExceptionCode } from "./Exception/DownloadException"
import { InitException, InitExceptionCode } from "./Exception/InitException"
import PlatformModules from "./modules"
import type { DownloadConfig, UploadCallBack, UploadConfig } from "./types"
import { PlatformType } from "./types"
import type { LogModule } from "./types/log"
import { isJson, isObject } from "./utils/checkDataFormat"
import logPubSub from "./utils/logPubSub"
import { request } from "./utils/request"
import { UploadManger } from "./utils/UploadManger"
import { checkSpecialCharacters, getFileExtension } from "./utils"
import { nanoid } from "./utils/nanoid"

export class Upload {
	/** 包版本 */
	static version: string = version

	uploadManger: UploadManger

	public constructor() {
		this.uploadManger = new UploadManger()
	}

	/**
	 * @description: 生成文件下载/预览临时 Url
	 * @param {DownloadConfig} downloadConfig
	 * @return Promise<any>
	 */
	public static download(downloadConfig: DownloadConfig): Promise<any> {
		const { url, method, headers, body, option } = downloadConfig
		let tempBody = body

		try {
			// 若body为FormData格式
			if (tempBody && tempBody instanceof FormData && option) {
				tempBody.append("options", JSON.stringify(option))
				// eslint-disable-next-line no-console
				console.warn("由于body为FormData类型，option字段(图片处理参数)可能会失效")
			} else if (tempBody && isJson(tempBody)) {
				// 若body为JSON格式
				tempBody = JSON.stringify({
					...JSON.parse(tempBody),
					options: option,
				})
			} else if (tempBody && isObject(tempBody)) {
				// 若body为Object格式
				tempBody = JSON.stringify({
					...tempBody,
					options: option,
				})
			}
		} catch (e) {
			tempBody = body
		}

		return request({
			url,
			method: method || "post",
			headers,
			data: tempBody,
			success: (response) => {
				logPubSub.report({
					type: "SUCCESS",
					eventName: "download",
					eventParams: {
						url,
						method: method || "post",
						headers,
						body: tempBody,
					},
					eventResponse: response,
				})
			},
			fail: (status, reject) => {
				const error = new DownloadException(
					DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR,
					status,
				)
				reject(error)
				logPubSub.report({
					type: "ERROR",
					eventName: "download",
					eventParams: {
						url,
						method: method || "post",
						headers,
						body: tempBody,
					},
					error,
				})
			},
		})
	}

	/**
	 * @description: 文件上传接口，包括 简单上传/分片上传/断点续传，会根据上传凭证信息选择相应的平台、以及上传方式进行上传
	 * @param {UploadConfig} uploadConfig 上传配置
	 * @return {UploadCallBack} uploadCallBack 上传回调
	 */
	public upload(uploadConfig: UploadConfig): UploadCallBack {
		const { url, method, file, option, customCredentials } = uploadConfig

		// 验证参数：如果没有提供自定义凭证，则必须提供url和method
		if (!customCredentials && (!url || !method)) {
			throw new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "url", "method")
		}

		// 如果提供了自定义凭证，验证凭证参数
		if (customCredentials) {
			const { platform, temporary_credential } = customCredentials
			if (!platform || !temporary_credential) {
				throw new InitException(
					InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD,
					"platform",
					"credentials",
				)
			}
		}

		// 处理文件名
		const { rewriteFileName } = option || {}
		if (rewriteFileName) {
			const suffix = getFileExtension(uploadConfig.fileName)
			uploadConfig.fileName = `${nanoid()}.${suffix}`
		}

		// 检测文件名是否存在特殊字符
		const hasError = checkSpecialCharacters(uploadConfig.fileName)
		if (hasError) {
			throw new InitException(
				InitExceptionCode.UPLOAD_FILENAME_EXIST_SPECIAL_CHAR,
				uploadConfig.fileName,
			)
		}
		return this.uploadManger.createTask(file, uploadConfig.fileName, uploadConfig, option || {})
	}

	/**
	 * @description: 暂停所有文件上传（分片上传）
	 */
	public pause() {
		this.uploadManger.pauseAllTask()
	}

	/**
	 * @description: 恢复所有文件上传（分片上传）
	 */
	public resume() {
		this.uploadManger.resumeAllTask()
	}

	/**
	 * @description: 取消所有文件上传（分片上传）
	 */
	public cancel() {
		this.uploadManger.cancelAllTask()
	}

	/**
	 * @description: 传入回调函数, 订阅日志内容
	 */
	static subscribeLogs(callback: LogModule.CallBack) {
		logPubSub.subscribe(callback)
	}
}

// 导出类型和函数
export type { DownloadConfig, UploadCallBack, UploadConfig }
export { PlatformType, PlatformModules }

export { default as TOS } from "./modules/TOS"
export { default as OSS } from "./modules/OSS"
export { default as OBS } from "./modules/OBS"
export { default as Kodo } from "./modules/Kodo"
export { default as Local } from "./modules/Local"
export { default as MinIO } from "./modules/MinIO"
