import { useFileAccess as useFilePermissions } from "@/pages/superMagic/providers/FileAccessProvider"
import { useState, useRef } from "react"
import { TFunction } from "i18next"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import type { ImageExportFormat } from "@magic-web/html2image"
import { isFileInPPTMode } from "@/pages/superMagic/components/Detail/utils/file"
import { isMarkdownFileName } from "@/utils/pdfFileType"
import {
	iterateExportSlides,
	iterateSingleExportSlide,
	prepareFileExportSlides,
	resolvePptExportSlides,
} from "@/pages/superMagic/services/pptService"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { DownloadImageMode } from "../../../pages/Workspace/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import {
	documentExportService,
	type DocumentExport,
} from "@/pages/superMagic/services/documentExport"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import {
	assertPptxExportAvailable,
	iteratePreparedPptxPages,
	openPptxDestination,
	PptxExportUnavailableError,
	startPptxStreamingExportFromFactory,
} from "@/pages/superMagic/services/pptxStreamingExport"
import { createPptxResourceErrorCollector } from "@/pages/superMagic/utils/pptxResourceErrors"
import {
	publishPptxExportFailure,
	publishPptxExportIssues,
} from "@/pages/superMagic/utils/pptxExportIssues"
import type { ExportIssue } from "@magic/html2pptx"
import { ensureFileSavesSynced } from "../services/fileSaveQueue"
import { pptxExternalLogger, reportPptxExportError } from "@/pages/superMagic/utils/pptxLogger"
import {
	createPptxSlideConfig,
	resolvePptScaleContentDimensions,
} from "@/pages/superMagic/components/Detail/contents/HTML/utils/slide-dimensions"

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
	/** 导出为可编辑 PPTX */
	exportPptx: (fileIds: string[]) => Promise<void>
	/** 导出为图片（仅 HTML） */
	exportImage: (fileIds: string[], format?: ImageExportFormat) => Promise<void>
}

/**
 * 进度条组件
 */
function ExportProgressToast({
	progress,
	label,
	onCancel,
	cancelLabel,
}: {
	progress: number
	label: string
	onCancel?: () => void
	cancelLabel?: string
}) {
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
			{onCancel && (
				<Button type="button" variant="secondary" size="sm" onClick={onCancel}>
					{cancelLabel}
				</Button>
			)}
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
	const fileAccess = useFileAccess()
	const { permissions: access } = useFilePermissions()
	// Bind the ambient share/session identity for the direct download-url call; the
	// export services below still receive the legacy `access` override.
	const fileApi = useFileApi()
	const cancelExportRef = useRef<(() => void) | null>(null)
	const downloadProgress = useDownloadProgress()

	const startExport = () => {
		setIsExporting(true)
		setExportProgress(0)
		cancelExportRef.current = null

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
				<ExportProgressToast
					progress={roundedProgress}
					label={exportingLabel}
					onCancel={cancelExportRef.current ?? undefined}
					cancelLabel={t("topicFiles.exportCancel")}
				/>,
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
			cancelExportRef.current = null
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
		cancelExportRef.current = null
		magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
	}

	const onCanceled = () => {
		if (toastIdRef.current) {
			magicToast.destroy(toastIdRef.current)
			toastIdRef.current = null
		}
		cancelExportRef.current = null
		setIsExporting(false)
		setExportProgress(0)
		magicToast.info(t("topicFiles.exportCancel"))
	}

	const exportFile = async (fileIds: string[], fileVersion?: { [key: string]: number }) => {
		if (!access.download) return
		if (!fileIds || fileIds.length === 0) return
		if (!(await ensureFileSavesSynced(fileIds))) return

		// 检查是否为文件夹
		const fileId = fileIds[0]
		const file = attachments?.find((item) => item.file_id === fileId)
		const isFolder = file?.is_directory

		// 如果是文件夹或多个文件，使用批量下载
		if (isFolder || fileIds.length > 1) {
			await downloadProgress.startDownload({
				projectId: selectedProject?.id || projectId,
				fileIds,
				label: t("topicFiles.downloading"),
				onSuccess: () => {
					magicToast.success(t("topicFiles.downloadSuccess"))
				},
				onError: (error) => {
					console.error("Batch download failed:", error)
					magicToast.error(t("topicFiles.downloadFailed"))
				},
				onCancel: () => {
					magicToast.info(t("topicFiles.downloadAbort"))
				},
			})
		} else {
			// 单文件直接下载
			fileApi
				.getTemporaryDownloadUrl({
					file_ids: fileIds,
					file_versions: fileVersion,
					download_mode: DownloadImageMode.Download,
					is_download: true,
				})
				.then((res: Array<{ url: string }>) => {
					downloadFileWithAnchor(res[0]?.url)
				})
		}
	}

	const exportPdf = async (fileIds: string[]) => {
		if (!access.export) return
		if (!fileIds || fileIds.length === 0) return
		if (!(await ensureFileSavesSynced(fileIds))) return

		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const fileId = fileIds[0]
		const file = attachments?.find((item) => item.file_id === fileId)
		const fileName = (file as any)?.file_name || (file as any)?.display_filename || "export.pdf"

		const resourceErrors = documentExporter.createResourceErrorCollector(t)
		startExport()
		try {
			if (isMarkdownFileName(fileName)) {
				await documentExporter.exportMarkdownFile({
					fileId,
					fileName,
					selectedProject,
					relativeFilePath: (file as any)?.relative_file_path,
					attachments: (attachments ?? []) as any[],
					onResourceLoadError: resourceErrors.onResourceLoadError,
					onProgress: ({ phase, current, total }) => {
						if (phase === "capture" && total > 0) {
							onProgress(Math.round((current / total) * 100))
						}
					},
				}).promise
			} else {
				const result = await prepareFileExportSlides({
					fileId,
					fileName,
					attachmentList: (attachments ?? []) as any[],
					access: fileAccess ?? undefined,
					fileApi,
				})

				if (!result.htmlSlides.some(Boolean)) {
					throw new Error("Failed to fetch HTML file content")
				}

				const inPptMode = isFileInPPTMode(fileId, (attachments ?? []) as any[])

				await documentExporter.exportPages(result.htmlSlides, {
					fileName: (result.fileName || "export") + ".pdf",
					skipFailedPages: true,
					pptMode: inPptMode,
					vector: {
						fitContentWidth: !inPptMode,
					},
					onResourceLoadError: resourceErrors.onResourceLoadError,
					onPageProgress: (ctx) => {
						const { index, total } = ctx as DocumentExport.PageProgressContext
						if (total > 0) {
							onProgress(Math.round((index / total) * 100))
						}
					},
				}).promise
			}
			endExport()
		} catch (error) {
			console.error("[filePdfExport] export failed:", error)
			onError()
		}
	}

	const exportPptx = async (fileIds: string[]) => {
		if (!access.export) return
		if (!fileIds || fileIds.length === 0) return
		if (!(await ensureFileSavesSynced(fileIds))) return

		const fileId = fileIds[0]
		const file = attachments?.find((item) => item.file_id === fileId)
		const fileName = String(
			(file as any)?.file_name || (file as any)?.display_filename || "export",
		).replace(/\.html?$/i, "")
		const displayConfig = ((file as any)?.display_config || (file as any)?.metadata) as
			{ type?: string; slides?: string[]; name?: string } | undefined
		let slidePaths = Array.isArray(displayConfig?.slides) ? displayConfig.slides : []
		const isDeck = slidePaths.length > 0
		let pageCount = slidePaths.length || 1
		let destinationLease: Awaited<ReturnType<typeof openPptxDestination>> = null
		const resourceErrors = createPptxResourceErrorCollector(t)
		const exportIssues: ExportIssue[] = []

		try {
			assertPptxExportAvailable({ pageCount })
			destinationLease = await openPptxDestination({
				suggestedName: displayConfig?.name || fileName,
			})
			if (!destinationLease) return

			if (isDeck) {
				const resolved = await resolvePptExportSlides({
					slidePaths,
					displayConfig,
					attachmentList: (attachments ?? []) as any,
					mainFileId: fileId,
					fileApi,
					access: fileAccess ?? undefined,
				})
				slidePaths = resolved.slidePaths
				pageCount = slidePaths.length
				if (!pageCount) throw new Error("No visible slides to export")
			}
			startExport()
			const destination = destinationLease.destination
			const fontResolver = documentExportService.get()?.getPptFontResolver?.()
			const handle = startPptxStreamingExportFromFactory(
				(signal) => {
					const source = slidePaths.length
						? iterateExportSlides({
								slidePaths,
								configResolved: true,
								attachmentList: (attachments ?? []) as any,
								mainFileId: fileId,
								mainFileName: fileName,
								displayConfig,
								access: fileAccess ?? undefined,
								fileApi,
								signal,
							})
						: iterateSingleExportSlide({
								fileId,
								fileName,
								attachmentList: (attachments ?? []) as any,
								access: fileAccess ?? undefined,
								fileApi,
								signal,
							})
					return iteratePreparedPptxPages(source, {
						attachments: (attachments ?? []) as any,
						fileId,
						fileName,
						attachmentList: (attachments ?? []) as any,
						displayConfig,
						signal,
					})
				},
				(firstPage) => ({
					fileName,
					destination,
					outputPolicy: "file-stream",
					pageCount,
					autoSize: !isFileInPPTMode(fileId, (attachments ?? []) as any[]),
					config: createPptxSlideConfig(resolvePptScaleContentDimensions(firstPage.html)),
					skipFailedPages: true,
					fontResolver,
					logger: pptxExternalLogger,
					logLevel: "warn",
					onResourceLoadError: resourceErrors.onResourceLoadError,
					onExportIssue: (issue) => exportIssues.push(issue),
					onProgress: (progress) => {
						if (progress.pageIndex === undefined || progress.pageCount === undefined)
							return
						onProgress(
							Math.round(((progress.pageIndex + 1) / progress.pageCount) * 100),
						)
					},
				}),
			)
			cancelExportRef.current = handle.cancel
			onProgress(0)
			await handle.promise
			publishPptxExportIssues(exportIssues, { fileId, fileName })
			endExport()
		} catch (error: unknown) {
			await destinationLease?.abort(error).catch(() => undefined)
			const isAbort = (error as { name?: string } | null)?.name === "AbortError"
			if (isAbort) {
				onCanceled()
				return
			}
			publishPptxExportFailure(exportIssues, error, { fileId, fileName })
			const isUnavailable = error instanceof PptxExportUnavailableError
			console.error("[filePptxExport] export failed:", error)
			reportPptxExportError(error, { fileId, fileName, source: "useFileExport" })
			if (isUnavailable) {
				setIsExporting(false)
				setExportProgress(0)
				cancelExportRef.current = null
				magicToast.error(error.message)
				return
			}
			onError()
		}
	}

	const exportImage = async (fileIds: string[], format: ImageExportFormat = "png") => {
		if (!access.export) return
		if (!fileIds || fileIds.length === 0) return
		if (!(await ensureFileSavesSynced(fileIds))) return

		const fileId = fileIds[0]
		const file = attachments?.find((item) => item.file_id === fileId)
		const fileName = (file as any)?.file_name || (file as any)?.display_filename || "export"

		startExport()
		try {
			const result = await prepareFileExportSlides({
				fileId,
				fileName,
				attachmentList: (attachments ?? []) as any[],
				access: fileAccess ?? undefined,
				fileApi,
			})

			if (!result.htmlSlides.some(Boolean)) {
				throw new Error("Failed to fetch HTML file content")
			}

			// 不把图片导出引擎加入文件列表启动依赖；导入失败也必须结束现有导出状态。
			const { exportHtmlToImage } = await import("@magic-web/html2image")
			await exportHtmlToImage({
				pages: result.htmlSlides,
				format,
				fileName: result.fileName || "export",
				onProgress: ({ phase, current, total }) => {
					if (phase === "capture" && total > 0) {
						onProgress(Math.round((current / total) * 100))
					}
				},
			}).promise
			endExport()
		} catch (error) {
			console.error("[fileImageExport] export failed:", error)
			onError()
		}
	}

	return {
		isExporting: isExporting || downloadProgress.isDownloading,
		exportProgress,
		exportFile,
		exportPdf,
		exportPptx,
		exportImage,
	}
}

export default useFileExport
