import { useState, useRef } from "react"
import { TFunction } from "i18next"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	exportSingleFileToPdf,
	exportSingleFileToPpt,
} from "@/pages/superMagic/components/TopicFilesButton/utils/exportSingleFile"
import { getExportAllFileIds } from "../contents/HTML/utils"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { DownloadImageMode } from "../../../pages/Workspace/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { toast } from "sonner"
import { SuperMagicApi } from "@/apis"

interface Attachment {
	file_id?: string
	is_directory?: boolean
	[key: string]: unknown
}

interface UseFileExportParams {
	/** 附件列表 */
	attachments?: Attachment[]
	/** 选中的项目 */
	selectedProject?: { id: string }
	/** 项目 ID */
	projectId?: string
	/** 翻译函数 */
	t: TFunction
}

interface UseFileExportReturn {
	/** 是否正在导出 */
	isExporting: boolean
	/** 导出进度 (0-100) */
	exportProgress: number
	/** 导出原文件 */
	exportFile: (
		fileIds: string[],
		fileVersion?: { [key: string]: number } | undefined,
	) => Promise<void>
	/** 导出为 PDF */
	exportPdf: (fileIds: string[]) => Promise<void>
	/** 导出为 PPT */
	exportPpt: (fileIds: string[]) => Promise<void>
}

/**
 * 进度条组件
 */
function ExportProgressToast({ progress, label }: { progress: number; label: string }) {
	return (
		<div className="flex min-w-[280px] items-center gap-3">
			<div className="flex-1">
				<div className="mb-1.5 text-sm font-medium">{label}</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
					<div
						className="h-full bg-blue-500 transition-all duration-300 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
			</div>
			<div className="min-w-[42px] text-right text-sm font-medium text-gray-600">
				{progress}%
			</div>
		</div>
	)
}

/**
 * 文件导出 Hook
 * 提供文件导出功能，包括原文件导出、PDF 导出和 PPT 导出
 */
function useFileExport({
	attachments,
	selectedProject,
	projectId,
	t,
}: UseFileExportParams): UseFileExportReturn {
	const [isExporting, setIsExporting] = useState(false)
	const [exportProgress, setExportProgress] = useState(0)
	const toastIdRef = useRef<string | number | null>(null)

	const startExport = () => {
		setIsExporting(true)
		setExportProgress(0)

		// 显示进度条 Toast
		const exportingLabel = t("topicFiles.exporting")
		toastIdRef.current = magicToast.loading({
			content: <ExportProgressToast progress={0} label={exportingLabel} />,
			duration: 0, // 不自动关闭
		})
	}

	const onProgress = (progress: number) => {
		const roundedProgress = Math.round(progress)
		setExportProgress(roundedProgress)

		// 更新进度条
		if (toastIdRef.current) {
			const exportingLabel = t("topicFiles.exporting")
			toast.loading(
				<ExportProgressToast progress={roundedProgress} label={exportingLabel} />,
				{
					id: toastIdRef.current,
				},
			)
		}
	}

	const endExport = () => {
		setExportProgress(100)

		// 更新到 100%
		if (toastIdRef.current) {
			const exportingLabel = t("topicFiles.exporting")
			toast.loading(<ExportProgressToast progress={100} label={exportingLabel} />, {
				id: toastIdRef.current,
			})
		}

		// 延迟后关闭进度条并显示成功提示
		setTimeout(() => {
			if (toastIdRef.current) {
				magicToast.destroy(toastIdRef.current)
				toastIdRef.current = null
			}
			setIsExporting(false)
			setExportProgress(0)
			magicToast.success(t("topicFiles.exportSuccess"))
		}, 500)
	}

	const onError = () => {
		// 关闭进度条
		if (toastIdRef.current) {
			magicToast.destroy(toastIdRef.current)
			toastIdRef.current = null
		}

		setIsExporting(false)
		setExportProgress(0)
		magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
	}

	const exportFile = async (fileIds: string[], fileVersion?: { [key: string]: number }) => {
		if (!fileIds || fileIds.length === 0) return

		// 检查是否为文件夹
		const fileId = fileIds[0]
		const file = attachments?.find((item) => item.file_id === fileId)
		const isFolder = file?.is_directory

		// 如果是文件夹或多个文件，使用批量下载
		if (isFolder || fileIds.length > 1) {
			startExport()

			try {
				const data = await SuperMagicApi.createBatchDownload({
					project_id: selectedProject?.id || projectId,
					file_ids: fileIds,
				})

				if (data.status === "ready" && data.download_url) {
					downloadFileWithAnchor(data.download_url)
					endExport()
					return
				}

				if (data.status === "processing") {
					// 轮询批量下载状态
					const timer = setInterval(async () => {
						try {
							const checkData = await SuperMagicApi.checkBatchDownloadStatus(
								data.batch_key,
							)

							if (checkData.status === "processing") {
								onProgress(checkData.progress || 0)
							}

							if (checkData?.status === "ready") {
								clearInterval(timer)
								if (checkData.download_url) {
									downloadFileWithAnchor(checkData.download_url)
									endExport()
								}
							}

							if (checkData?.status === "failed") {
								clearInterval(timer)
								onError()
							}
						} catch (error) {
							clearInterval(timer)
							console.error("Batch download check failed:", error)
							onError()
						}
					}, 2000)
				}
			} catch (error) {
				console.error("Batch download failed:", error)
				onError()
			}
		} else {
			// 单文件直接下载
			getTemporaryDownloadUrl({
				file_ids: fileIds,
				file_versions: fileVersion,
				download_mode: DownloadImageMode.Download,
				is_download: true,
			}).then((res: Array<{ url: string }>) => {
				downloadFileWithAnchor(res[0]?.url)
			})
		}
	}

	const exportPdf = async (fileIds: string[]) => {
		if (!fileIds || fileIds.length === 0) return

		if (fileIds?.length > 0) {
			exportSingleFileToPdf({
				fileId: fileIds,
				projectId: selectedProject?.id || projectId,
				t,
				onStart: startExport,
				onEnd: endExport,
				onProgress,
				onError,
			})
		}
	}

	const exportPpt = async (fileIds: string[]) => {
		if (!fileIds || fileIds.length === 0) return

		if (fileIds?.length > 0) {
			exportSingleFileToPpt({
				fileId: fileIds,
				projectId: selectedProject?.id || projectId,
				t,
				onStart: startExport,
				onEnd: endExport,
				onProgress,
				onError,
			})
		}
	}

	return {
		isExporting,
		exportProgress,
		exportFile,
		exportPdf,
		exportPpt,
	}
}

export default useFileExport
