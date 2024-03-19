import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"
import { SuperMagicApi } from "@/opensource/apis"

/**
 * 导出单个文件为PDF或PPT格式
 * @param fileId 文件ID
 * @param projectId 项目ID
 * @param convertType 转换类型，默认为"pdf"
 * @param t 国际化函数
 * @param onStart 开始导出时的回调
 * @param onEnd 结束导出时的回调
 * @returns Promise<void>
 */
export async function exportSingleFile({
	fileId,
	projectId,
	convertType = "pdf",
	t,
	onStart,
	onEnd,
	onProgress,
	onError,
}: {
	fileId: string | string[]
	projectId?: string
	convertType?: "pdf" | "ppt"
	t: (key: string) => string
	onStart?: () => void
	onEnd?: () => void
	onProgress?: (progress: number) => void
	onError?: (error: any) => void
}) {
	if (!fileId) {
		console.warn(t("topicFiles.contextMenu.fileExport.emptyFileId"))
		return
	}

	onStart?.() // 开始导出，设置loading状态

	try {
		// 调用后端创建单文件导出任务
		const data = await SuperMagicApi.exportPdfOrPpt({
			project_id: projectId,
			file_ids: Array.isArray(fileId) ? fileId : [fileId],
			convert_type: convertType,
		})
		const target = convertType === "pdf" ? "_blank" : "_self"

		if (data.status === "completed" && data.download_url) {
			// 任务已完成，直接下载
			downloadFileWithAnchor(data.download_url, undefined, target)
			onEnd?.() // 结束导出，清除loading状态
			return
		}

		if (data.status === "processing") {
			// 任务处理中，轮询状态
			const timer = setInterval(async () => {
				try {
					const checkData = await SuperMagicApi.checkExportPdfOrPptStatus(data.task_key)
					if (checkData.status === "processing") {
						onProgress?.(checkData.conversion_rate)
					}
					if (checkData.status === "completed" && checkData.download_url) {
						// 任务完成，下载文件
						downloadFileWithAnchor(checkData.download_url, undefined, target)
						clearInterval(timer)
						onEnd?.() // 结束导出，清除loading状态
					} else if (checkData?.status === "failed") {
						// 任务失败
						clearInterval(timer)
						onError?.(checkData.message) // 结束导出，清除loading状态
						const errorKey =
							convertType === "pdf" ? "pdfExportFailed" : "pptExportFailed"
						magicToast.error(
							checkData.message || t(`topicFiles.contextMenu.fileExport.${errorKey}`),
						)
					}
				} catch (error) {
					clearInterval(timer)
					onEnd?.() // 结束导出，清除loading状态
					console.error(t("topicFiles.contextMenu.fileExport.checkStatusFailed"), error)
					magicToast.error(t("topicFiles.contextMenu.fileExport.checkStatusFailed"))
				}
			}, 2000)

			// 设置最大轮询时间（10分钟）
			// setTimeout(() => {
			// 	clearInterval(timer)
			// 	onError?.(t("topicFiles.contextMenu.fileExport.exportTimeout")) // 结束导出，清除loading状态
			// 	const timeoutKey =
			// 		convertType === "pdf" ? "pdfExportTimeoutMessage" : "pptExportTimeoutMessage"
			// 	magicToast.error(t(`topicFiles.contextMenu.fileExport.${timeoutKey}`))
			// }, 10 * 60 * 1000)
		} else {
			onEnd?.() // 结束导出，清除loading状态
		}
	} catch (error) {
		onEnd?.() // 结束导出，清除loading状态
		console.error("单文件导出失败:", error)
		const errorKey = convertType === "pdf" ? "pdfExportFailed" : "pptExportFailed"
		magicToast.error(t(`topicFiles.contextMenu.fileExport.${errorKey}`))
	}
}

/**
 * 导出单个文件为PDF格式
 */
export function exportSingleFileToPdf({
	fileId,
	projectId,
	t,
	onStart,
	onEnd,
	onProgress,
	onError,
}: {
	fileId: string | string[]
	projectId?: string
	t?: (key: string) => string
	onStart?: () => void
	onEnd?: () => void
	onProgress?: (progress: number) => void
	onError?: (error: any) => void
}) {
	if (!t) {
		throw new Error("Translation function is required")
	}
	return exportSingleFile({
		fileId,
		projectId,
		convertType: "pdf",
		t,
		onStart,
		onEnd,
		onProgress,
		onError,
	})
}

/**
 * 导出单个文件为PPT格式
 */
export function exportSingleFileToPpt({
	fileId,
	projectId,
	t,
	onStart,
	onEnd,
	onProgress,
	onError,
}: {
	fileId: string | string[]
	projectId?: string
	t?: (key: string) => string
	onStart?: () => void
	onEnd?: () => void
	onProgress?: (progress: number) => void
	onError?: (error: any) => void
}) {
	if (!t) {
		throw new Error("Translation function is required")
	}
	return exportSingleFile({
		fileId,
		projectId,
		convertType: "ppt",
		t,
		onStart,
		onEnd,
		onProgress,
		onError,
	})
}

export async function batchExportFile({
	projectId,
	fileIds,
	onEnd,
	onProgress,
	onError,
	onStart,
	t,
}: {
	projectId?: string
	fileIds: string[]
	onEnd?: () => void
	onProgress?: (progress: number) => void
	onError?: (error: any) => void
	onStart?: () => void
	t?: (key: string) => string
}) {
	try {
		// 调用后端创建批量下载任务
		const data = await SuperMagicApi.createBatchDownload({
			project_id: projectId,
			file_ids: fileIds,
		})
		onStart?.()
		if (data.status === "ready" && data.download_url) {
			downloadFileWithAnchor(data.download_url)
			onEnd?.()
			return
		}

		if (data.status === "processing") {
			// 每2秒轮询批量状态
			const timer = setInterval(async () => {
				const checkData = await SuperMagicApi.checkBatchDownloadStatus(data.batch_key)
				if (checkData.status === "ready" && checkData.download_url) {
					downloadFileWithAnchor(checkData.download_url)
					onEnd?.()
					clearInterval(timer)
				}
				if (checkData.status === "processing") {
					onProgress?.(checkData.progress)
				}
				if (checkData?.status === "failed") {
					onError?.(checkData?.message)
					clearInterval(timer)
					return
				}
			}, 2000)
		}
	} catch (error) {
		console.error("批量导出失败:", error)
		onError?.(error)
	}
}
