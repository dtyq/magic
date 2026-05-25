import type {
	GetFileInfoResponse,
	UploadFileResponse,
	UploadFile,
	UploadSubDirType,
} from "@/components/CanvasDesign/types.magic"
import type { BatchSaveInfo } from "@/stores/folderUpload/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { normalizeDesignAttachmentPathForCanvas } from "./designDslPathUtils"

/**
 * 包含 file_id 的上传图片响应类型
 * 用于通过 file_id 获取文件信息时的响应类型
 */
export type UploadFileResponseWithFileId = UploadFileResponse & { file_id: string }

export type GetFileInfoResponseWithFileId = GetFileInfoResponse & { file_id: string }

function normalizeUploadResponsePath(params: {
	rawPath: string
	uploadSubDir: UploadSubDirType
	fileName: string
	designProjectBasePath?: string
}): string {
	const { rawPath, uploadSubDir, fileName, designProjectBasePath } = params
	const normalized = normalizeDesignAttachmentPathForCanvas(rawPath, designProjectBasePath)
	const uploadSubDirPath = `${uploadSubDir}/${fileName}`.replace(/\/+/g, "/")
	if (normalized === uploadSubDirPath || normalized.startsWith(`${uploadSubDir}/`)) {
		return normalized.startsWith("./") ? normalized : `./${normalized}`
	}
	return normalized
}

/**
 * 检查是否是用户取消操作
 */
function isCancelledError(error: Error | unknown): boolean {
	const errorMessage = error instanceof Error ? error.message : String(error)
	return errorMessage.includes("Task cancelled") || errorMessage.includes("Upload cancelled")
}

interface CreateUploadCallbacksParams {
	suffixDir: string
	/** 上传子目录，用于区分成功/失败提示文案（图片 vs 视频） */
	uploadSubDir: UploadSubDirType
	showSuccessToast: boolean
	designProjectBasePath?: string
	fileNameToUploadFileMap: Map<string, UploadFile>
	filesToUpload: File[]
	processedFileNames: Set<string>
	pendingGetFileInfoRef: React.MutableRefObject<Map<string, Promise<GetFileInfoResponse>>>
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	setIsUploading: (isUploading: boolean) => void
	setUploadProgress: (progress: number) => void
	t: (key: string) => string
	onComplete: (responses: UploadFileResponse[]) => void
	onError: (error: Error) => void
	onCompleteAlways: () => void
}

/**
 * 调用上传成功回调
 */
function callUploadSuccessCallback(
	uploadFile: UploadFile | undefined,
	response: UploadFileResponse,
): void {
	if (!uploadFile?.onUploadComplete) return

	try {
		uploadFile.onUploadComplete(response)
	} catch (callbackError) {
		//
	}
}

/**
 * 调用上传失败回调
 */
function callUploadFailedCallback(uploadFile: UploadFile | undefined, error: Error): void {
	if (!uploadFile?.onUploadFailed) return

	try {
		uploadFile.onUploadFailed(error)
	} catch (callbackError) {
		//
	}
}

/**
 * 为所有未处理的文件调用失败回调
 */
export function callFailedCallbacksForUnprocessedFiles(
	fileNameToUploadFileMap: Map<string, UploadFile>,
	processedFileNames: Set<string>,
	error: Error,
): void {
	fileNameToUploadFileMap.forEach((uploadFile, fileName) => {
		if (processedFileNames.has(fileName)) return
		callUploadFailedCallback(uploadFile, error)
	})
}

/**
 * 处理批次保存完成的文件
 */
export async function processBatchSavedFiles(params: {
	batchSaveInfo: BatchSaveInfo
	suffixDir: string
	uploadSubDir: UploadSubDirType
	designProjectBasePath?: string
	fileNameToUploadFileMap: Map<string, UploadFile>
	processedFileNames: Set<string>
	pendingGetFileInfoRef: React.MutableRefObject<Map<string, Promise<GetFileInfoResponse>>>
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	t: (key: string) => string
}): Promise<{
	responses: UploadFileResponse[]
	errors: Error[]
}> {
	const {
		batchSaveInfo,
		suffixDir,
		uploadSubDir,
		designProjectBasePath,
		fileNameToUploadFileMap,
		processedFileNames,
		getFileInfoById,
		t,
	} = params

	const batchUploadResponses: UploadFileResponse[] = []
	const batchErrors: Error[] = []

	// 等待一段时间，确保文件已完全保存
	await new Promise((resolve) => setTimeout(resolve, 1000))

	// 为每个保存的文件获取文件信息
	for (const savedFile of batchSaveInfo.savedFiles) {
		// 查找对应的 UploadFile（用于回调）
		const uploadFile = fileNameToUploadFileMap.get(savedFile.file_name)

		const relativeFilePath = suffixDir
			? `${suffixDir}/${savedFile.file_name}`
			: savedFile.file_name

		// parent_id 模式下后端可能返回 file_key 或雪花 ID，不能直接写入画布 path。
		// 只有当 relative_file_path 看起来确实是目录/文件名路径时才信任它，否则回退到前端已知目录。
		const apiPath = savedFile.relative_file_path?.trim()
		const rawPath =
			apiPath && apiPath.endsWith(savedFile.file_name) && apiPath.includes("/")
				? apiPath
				: relativeFilePath
		const filePath = normalizeUploadResponsePath({
			rawPath,
			uploadSubDir,
			fileName: savedFile.file_name,
			designProjectBasePath,
		})

		try {
			// 如果 API 返回了 file_id，直接使用，无需再次调用 getFileInfo
			if (savedFile.file_id) {
				// 直接通过 file_id 获取文件信息（包含下载 URL）
				// 优势：不依赖 path 和 attachments，因为 attachments 此时可能还未更新
				// file_id 会通过 getFileInfoById 自动包含在返回结果中
				// 传入 file_size 用于判断是否使用图片处理选项
				const fileInfo = await getFileInfoById(
					savedFile.file_id,
					savedFile.file_name,
					savedFile.file_size,
				)

				// 如果 fileInfo 中没有 fileName，使用 savedFile.file_name
				if (!fileInfo.fileName && savedFile.file_name) {
					fileInfo.fileName = savedFile.file_name
				}

				// 构造上传响应，file_id 已通过展开 fileInfo 自动包含
				const uploadResponse: UploadFileResponseWithFileId = {
					...fileInfo,
					path: filePath,
				}

				batchUploadResponses.push(uploadResponse)
				processedFileNames.add(savedFile.file_name)

				// 调用成功回调
				callUploadSuccessCallback(uploadFile, uploadResponse)
			} else {
				throw new Error("savedFile.file_id is required")
			}
		} catch (error) {
			// 获取文件信息失败
			const uploadError =
				error instanceof Error ? error : new Error(t("design.errors.getFileInfoFailed"))

			batchErrors.push(uploadError)
			processedFileNames.add(savedFile.file_name)

			// 调用失败回调
			callUploadFailedCallback(uploadFile, uploadError)
		}
	}

	return {
		responses: batchUploadResponses,
		errors: batchErrors,
	}
}

/**
 * 创建上传任务的回调函数
 */
export function createUploadCallbacks(params: CreateUploadCallbacksParams): {
	onProgress: (taskId: string, state: { progress?: number }) => void
	onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => Promise<void>
	onComplete: () => void
	onError: (taskId: string, error: Error) => void
} {
	const {
		suffixDir,
		uploadSubDir,
		showSuccessToast,
		designProjectBasePath,
		fileNameToUploadFileMap,
		filesToUpload,
		processedFileNames,
		pendingGetFileInfoRef,
		getFileInfoById,
		setIsUploading,
		setUploadProgress,
		t,
		onComplete,
		onError,
		onCompleteAlways,
	} = params

	const uploadSuccessMessage = t(`design.errors.uploadSuccessBySubDir.${uploadSubDir}`)
	const uploadFailedMessage = t(`design.errors.uploadFailedBySubDir.${uploadSubDir}`)

	// 收集所有批次的结果
	const allUploadResponses: UploadFileResponse[] = []
	const allErrors: Error[] = []
	let pendingBatches = 0
	let onCompleteCalled = false
	let resolved = false

	// 统一处理最终结果的函数
	const handleFinalResolve = () => {
		if (resolved) return

		// 如果所有文件都失败，则拒绝 Promise
		if (allUploadResponses.length === 0 && allErrors.length > 0) {
			setIsUploading(false)
			setUploadProgress(0)
			resolved = true
			magicToast.error(uploadFailedMessage)
			const error =
				allErrors[0] instanceof Error
					? new Error(uploadFailedMessage)
					: new Error(uploadFailedMessage)
			onError(error)
			return
		}

		// 显示成功消息（按 uploadSubDir 区分图片/视频）
		if (showSuccessToast && allUploadResponses.length > 0) {
			magicToast.success(uploadSuccessMessage)
		}

		// 上传完成，隐藏进度条
		setIsUploading(false)
		setUploadProgress(0)
		resolved = true
		onComplete(allUploadResponses)
	}

	return {
		onProgress: (_taskId: string, state) => {
			if (state.progress !== undefined) {
				setUploadProgress(state.progress)
			}
		},

		onBatchSaveComplete: async (batchSaveInfo: BatchSaveInfo) => {
			if (resolved) return

			pendingBatches++
			try {
				const result = await processBatchSavedFiles({
					batchSaveInfo,
					suffixDir,
					uploadSubDir,
					designProjectBasePath,
					fileNameToUploadFileMap,
					processedFileNames,
					pendingGetFileInfoRef,
					getFileInfoById,
					t,
				})

				// 收集当前批次的结果
				allUploadResponses.push(...result.responses)
				allErrors.push(...result.errors)
				pendingBatches--

				// 检查是否所有文件都已处理完成（成功 + 失败 = 总数）
				const totalProcessed = allUploadResponses.length + allErrors.length
				const allFilesProcessed = totalProcessed >= filesToUpload.length

				// 如果所有文件都已处理完成，且 onComplete 已被调用且所有批次都处理完成，则 resolve
				if (allFilesProcessed && onCompleteCalled && pendingBatches === 0 && !resolved) {
					handleFinalResolve()
				}
			} catch (error) {
				pendingBatches--
				if (!resolved) {
					setIsUploading(false)
					setUploadProgress(0)
					resolved = true
					magicToast.error(uploadFailedMessage)
					onError(error instanceof Error ? error : new Error(uploadFailedMessage))
				}
			}
		},

		onComplete: async () => {
			onCompleteCalled = true
			onCompleteAlways()

			if (resolved) {
				return
			}

			// 检查是否所有文件都已处理完成（成功 + 失败 = 总数）
			const totalProcessed = allUploadResponses.length + allErrors.length
			const allFilesProcessed = totalProcessed >= filesToUpload.length

			// 如果所有批次都已处理完成，立即 resolve
			if (pendingBatches === 0 && allFilesProcessed) {
				handleFinalResolve()
			}
			// 否则等待所有批次完成（在 onBatchSaveComplete 中处理）
		},

		onError: (_taskId: string, error: Error) => {
			const isCancelled = isCancelledError(error)

			if (!resolved) {
				// 如果是取消操作，只重置状态，不显示错误提示，不调用失败回调
				// 但仍然需要调用 onError 来 reject Promise，否则画布调用 uploadFiles 没有响应
				// 使用多语言的取消错误消息
				if (isCancelled) {
					setIsUploading(false)
					setUploadProgress(0)
					resolved = true
					const cancelledErrorMessage = t("design.errors.uploadCancelled")
					const cancelledError = new Error(cancelledErrorMessage)
					onError(cancelledError)
					return
				}

				// 为所有未处理的文件调用失败回调
				const translatedError = new Error(uploadFailedMessage)
				callFailedCallbacksForUnprocessedFiles(
					fileNameToUploadFileMap,
					processedFileNames,
					translatedError,
				)

				setIsUploading(false)
				setUploadProgress(0)
				resolved = true
				magicToast.error(uploadFailedMessage)
				onError(translatedError)
			}
		},
	}
}
