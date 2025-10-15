import { isFunction } from "lodash-es"
import { InitException, InitExceptionCode } from "../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../Exception/UploadException"
import PlatformModules from "../modules"
import type {
	FailCallback,
	NormalSuccessResponse,
	PlatformMultipartUploadOption,
	PlatformParams,
	PlatformSimpleUploadOption,
	Progress,
	ProgressCallback,
	ProgressCallbackProps,
	Request,
	SuccessCallback,
	Task,
	TaskCallBack,
	TaskId,
	UploadSource,
	UploadConfig,
} from "../types"
import type { OSS } from "../types/OSS"
import type { ErrorType } from "../types/error"
import type { Kodo } from "../types/Kodo"
import type { TOS } from "../types/TOS"
import type { OBS } from "../types/OBS"
import type { Local } from "../types/Local"
import type { S3 } from "../types/S3"
import { isBlob, isFile } from "./checkDataFormat"
import EventEmitter from "./EventEmitter"
import { getUploadConfig } from "./global"
import logPubSub from "./logPubSub"
import { nanoid } from "./nanoid"
import { cancelRequest, completeRequest, pauseRequest } from "./request"

// 上传任务的事件订阅管理
const TaskEvent = new EventEmitter<SuccessCallback | FailCallback | ProgressCallback>()

export class UploadManger {
	private tasks: Record<TaskId, Task> = {}

	private detach(taskId: TaskId): void {
		delete this.tasks[taskId]
		completeRequest(taskId)
	}

	private notifySuccess(taskId: TaskId, data: NormalSuccessResponse): void {
		const { success } = this.tasks[taskId] || {}
		if (isFunction(success)) {
			success(data)
		}
	}

	private notifyError(taskId: TaskId, err: ErrorType.UploadError): void {
		const { fail } = this.tasks[taskId] || {}
		if (isFunction(fail)) {
			fail(err)
		}
	}

	private notifyProgress(
		taskId: string,
		percent: ProgressCallbackProps["percent"],
		loaded: ProgressCallbackProps["loaded"],
		total: ProgressCallbackProps["total"],
		checkpoint: ProgressCallbackProps["checkpoint"],
	): void {
		const { progress } = this.tasks[taskId] || {}
		if (isFunction(progress)) {
			progress(percent, loaded, total, checkpoint)
		}
	}

	public createTask(
		file: File | Blob,
		key: string,
		uploadConfig: UploadConfig,
		option: PlatformMultipartUploadOption | PlatformSimpleUploadOption,
	): TaskCallBack {
		let taskId = nanoid()
		if (this.tasks[taskId]) {
			while (this.tasks[taskId]) {
				taskId = nanoid()
			}
		}

		const output: TaskCallBack = {
			success: (callback) => {
				const taskEventCallback: SuccessCallback = (response) => {
					// 上报成功日志
					logPubSub.report({
						type: "SUCCESS",
						eventName: "upload",
						eventParams: { ...uploadConfig },
						eventResponse: response,
					})
					// 移除当前任务的所有回调
					TaskEvent.off(`${taskId}_success`)
					TaskEvent.off(`${taskId}_fail`)
					TaskEvent.off(`${taskId}_progress`)
					callback(response)
				}
				// 订阅当前上传任务的成功回调
				TaskEvent.on(`${taskId}_success`, taskEventCallback)
			},
			fail: (callback) => {
				const taskEventCallback: FailCallback = (error) => {
					// 上报失败日志
					logPubSub.report({
						type: "ERROR",
						eventName: "upload",
						eventParams: { ...uploadConfig },
						error,
					})
					// 移除当前任务的所有回调
					// TaskEvent.off(`${taskId}_success`)
					// TaskEvent.off(`${taskId}_fail`)
					// TaskEvent.off(`${taskId}_progress`)
					callback(error)
				}
				// 订阅当前上传任务的失败回调
				TaskEvent.on(`${taskId}_fail`, taskEventCallback)
			},
			progress: (callback) => {
				const taskEventCallback: ProgressCallback = (
					percent,
					loaded,
					total,
					checkpoint,
				) => {
					callback(percent, loaded, total, checkpoint)
				}
				// 订阅当前上传任务的进度回调
				TaskEvent.on(`${taskId}_progress`, taskEventCallback)
			},
		cancel: () => {
			const task = this.tasks[taskId]
			if (task) {
				cancelRequest(taskId)
				// 移除当前任务的所有回调
				TaskEvent.off(`${taskId}_success`)
				TaskEvent.off(`${taskId}_fail`)
				TaskEvent.off(`${taskId}_progress`)
				const { pauseInfo } = task
				if (pauseInfo) {
					// 清空复杂上传断点信息
					delete task.pauseInfo
				}
			}
		},
		pause: () => {
			const task = this.tasks[taskId]
			if (task) {
				const { pauseInfo } = task
				if (pauseInfo) {
					task.pauseInfo = {
						...pauseInfo,
						isPause: true,
					}
					pauseRequest(taskId)
				}
			}
		},
		resume: () => {
			const task = this.tasks[taskId]
			if (task) {
				const { pauseInfo } = task
				// 只有复杂上传方式才能恢复上传
				if (pauseInfo) {
					const { isPause, checkpoint } = pauseInfo

					if (isPause) {
						task.pauseInfo = {
							isPause: false,
							checkpoint,
						}
						this.upload(file, key, taskId, uploadConfig, {
							...option,
							checkpoint,
						})
					}
				}
			}
		},
		}
		this.tasks[taskId] = {
			success: (response) => {
				TaskEvent.emit(`${taskId}_success`, response)
			},
			fail: (error) => {
				TaskEvent.emit(`${taskId}_fail`, error)
			},
			progress: (response) => {
				TaskEvent.emit(`${taskId}_progress`, response)
			},
			cancel: output.cancel,
			pause: output.pause,
			resume: output.resume,
		}

		this.upload(file, key, taskId, uploadConfig, option)

		return {
			success: output.success,
			fail: output.fail,
			progress: output.progress,
			cancel: output.cancel,
			pause: output.pause,
			resume: output.resume,
		}
	}

	private upload<T extends PlatformParams>(
		file: File | Blob,
		key: string,
		taskId: TaskId,
		uploadConfig: UploadConfig,
		option: PlatformMultipartUploadOption | PlatformSimpleUploadOption,
	) {
	const onProgress: Progress = (
		percent: number,
		loaded: number,
		total: number,
		checkpoint: OSS.Checkpoint | null,
	) => {
		// 保存复杂上传断点信息
		const task = this.tasks[taskId]
		if (checkpoint && task) {
			task.pauseInfo = {
				isPause: false,
				checkpoint,
			}
			this.notifyProgress(taskId, percent, loaded, total, checkpoint)
		} else {
			this.notifyProgress(taskId, percent, loaded, total, null)
		}
	}
		// 处理上传凭证：支持自定义凭证和传统凭证获取
		const uploadPromise = uploadConfig.customCredentials
			? Promise.resolve({
					platform: uploadConfig.customCredentials.platform,
					temporary_credential: uploadConfig.customCredentials.temporary_credential,
					expire: uploadConfig.customCredentials.expire || 0,
			  } as UploadSource<T>)
			: (() => {
					const { url, method, headers, body } = uploadConfig
					const uploadSourceRequest: Request = {
						url: url!,
						method: method!,
						headers,
						body,
					}
					const isNeedForceReFresh = !option?.reUploadedCount
					return getUploadConfig<T>(uploadSourceRequest, isNeedForceReFresh)
			  })()

		uploadPromise
			.then(async (uploadSource: UploadSource<T>) => {
				const platformType = uploadSource.platform
				const platformConfig = uploadSource.temporary_credential

				// 使用异步加载平台模块
				try {
					const platform = PlatformModules[platformType]

					if (!platform) {
						throw new InitException(
							InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM,
							platformType,
						)
					}
					return { platform, platformConfig }
				} catch (error) {
					throw new InitException(
						InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM,
						platformType,
					)
				}
			})
		.then(({ platform, platformConfig }) => {
			if (!file && !isBlob(file) && !isFile(file))
				throw new InitException(InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT)
			if (!key)
				throw new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "fileName")
			if (!platform.upload) {
				throw new InitException(
					InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM,
					"platform.upload is undefined"
				)
			}
			return platform.upload(
				file,
				key,
				platformConfig as OSS.AuthParams &
					Kodo.AuthParams &
					OSS.STSAuthParams &
					TOS.STSAuthParams &
					TOS.AuthParams &
					OBS.STSAuthParams &
					OBS.AuthParams &
					Local.AuthParams &
					S3.AuthParams &
					S3.STSAuthParams,
				{
					...option,
					progress: onProgress,
					taskId,
				},
			)
		})
			.then((res) => {
				this.notifySuccess(taskId, res)
				this.detach(taskId)
			})
			.catch((err) => {
				let message = err
				// 当上传平台返回 token失效的错误时
				if (err?.status === 1003) {
					// 默认重传 3 次
					if (option?.reUploadedCount && option?.reUploadedCount >= 2) {
						this.notifyError(
							taskId,
							new InitException(InitExceptionCode.REUPLOAD_IS_FAILED),
						)
						return
					}
					this.upload(file, key, taskId, uploadConfig, {
						...option,
						reUploadedCount: option?.reUploadedCount ? option.reUploadedCount + 1 : 1,
					})
					return
				}
				// 上传暂停
				if (err?.status === 5002) {
					message = new UploadException(UploadExceptionCode.UPLOAD_PAUSE)
				}
				// 上传取消
				if (err?.status === 5001) {
					message = new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
				}
				this.notifyError(taskId, message)
			})
	}

	// 全部上传暂停
	public pauseAllTask() {
		Object.values(this.tasks).forEach((task) => {
			if (task.pause) {
				task.pause()
			}
		})
	}

	// 全部上传继续
	public resumeAllTask() {
		Object.values(this.tasks).forEach((task) => {
			if (task.resume) {
				task.resume()
			}
		})
	}

	// 取消全部上传
	public cancelAllTask() {
		Object.values(this.tasks).forEach((task) => {
			if (task.cancel) {
				task.cancel()
			}
		})
	}
}
