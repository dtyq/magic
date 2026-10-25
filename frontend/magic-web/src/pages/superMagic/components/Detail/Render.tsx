import {
	useFileAccess as useFilePermissions,
	FileAccessProvider,
} from "@/pages/superMagic/providers/FileAccessProvider"
import ContentRenderer from "./components/ContentRenderer"
import { DetailType } from "./types"
import { SuperMagicApi } from "@/apis"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import useEditMode from "./hooks/useEditMode"
import useCheckBeforeCloseWithSave from "./hooks/useCheckBeforeCloseWithSave"
import { useSyncCustomProjectFolderNameBeforeSave } from "./hooks/useSyncCustomProjectFolderNameBeforeSave"
import MagicModal from "@/components/base/MagicModal"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { DownloadImageMode } from "../../pages/Workspace/types"
import { MagicSpin } from "@/components/base"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	iterateSingleExportSlide,
	prepareSingleSlideExport,
} from "@/pages/superMagic/services/pptService"
import { pptxExternalLogger, reportPptxExportError } from "@/pages/superMagic/utils/pptxLogger"
import { createPptxResourceErrorCollector } from "@/pages/superMagic/utils/pptxResourceErrors"
import {
	publishPptxExportFailure,
	publishPptxExportIssues,
} from "@/pages/superMagic/utils/pptxExportIssues"
import type { ExportIssue } from "@magic/html2pptx"
import { isFileInPPTMode, isFileInSlideCanvasMode } from "./utils/file"
import { prepareHtmlPagesForExport } from "@/utils/htmlExportPrepare"
import type { ImageExportFormat } from "@magic-web/html2image"
import {
	createPptxSlideConfig,
	resolvePptScaleContentDimensions,
} from "./contents/HTML/utils/slide-dimensions"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import {
	documentExportService,
	type DocumentExport,
} from "@/pages/superMagic/services/documentExport"
import {
	formatPptxStreamingProgress,
	iteratePreparedPptxPages,
	assertPptxExportAvailable,
	openPptxDestination,
	PptxExportUnavailableError,
	startPptxStreamingExportFromFactory,
} from "@/pages/superMagic/services/pptxStreamingExport"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import { getShareAccessToken } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	mergeStaticDependencyFileIds,
	resolveSingleDocumentStaticDependencies,
} from "@/pages/superMagic/utils/staticDependencies"
import {
	isEditingPresenceEnabled,
	isFileShareAllowed,
	isFileVersionHistoryAllowed,
} from "./components/FilesViewer/hooks/previewPolicy"
import { FileSaveFailureListener } from "./components/FileSaveFailureListener"
import {
	ensureFileSavesSynced,
	enqueueOptimisticSave,
	getFileSaveQueue,
	type FileSavePersistRequest,
} from "./services/fileSaveQueue"
import { persistFileSave } from "./services/fileSaveQueue/persistFileSave"

function FileContentRender(props: any) {
	const { permissions: access, options: inheritedOptions } = useFilePermissions()
	const {
		type,
		data,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		terminalToolInfo,
		isFullscreen,
		attachmentList,
		allowEdit: requestedAllowEdit,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		onShare,
		onFavorite,
		fileContent,
		isFavorited,
		// File sharing props
		topicId,
		baseShareUrl,
		currentFile,
		className,
		updatedAt,
		detailMode,
		displayConfig,
		openFileTab,
		selectedProject,
		selectedTopic,
		showFileHeader = true,
		headerRenderMode = "full",
		onRefreshFile,
		activeFileId,
		onActiveFileChange,
		showFooter = true,
		isPlaybackMode = false,
		documentFlowFullscreen = false,
		// Register/unregister checkBeforeClose callback
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
		projectId,
		browserAttachments,
		allowDownload: requestedAllowDownload,
		audioPlayerMode,
		mdToolbarContainer,
	} = props
	const { t } = useTranslation("super")
	const isHtmlSlideCanvasMode = useMemo(
		() =>
			type === DetailType.Html &&
			(data?.display_config?.type === "slide" ||
				isFileInSlideCanvasMode(data?.file_id, attachmentList ?? [])),
		[attachmentList, data?.display_config?.type, data?.file_id, type],
	)
	const downloadProgress = useDownloadProgress()
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	const shareToken = getShareAccessToken(fileAccess)
	const effectiveDisplayConfig = displayConfig || data?.display_config
	const allowDownload = fileAccess?.kind === "recycle-bin" ? false : requestedAllowDownload
	const allowEdit =
		effectiveDisplayConfig?.previewPolicy?.readonly === true ? false : requestedAllowEdit
	const editingPresenceEnabled = isEditingPresenceEnabled(effectiveDisplayConfig)
	const fileShareAllowed = isFileShareAllowed(effectiveDisplayConfig)
	const fileVersionHistoryAllowed = isFileVersionHistoryAllowed(effectiveDisplayConfig)
	const isPptRenderer =
		type === DetailType.PowerPoint ||
		type === DetailType.SlidesTemplate ||
		isHtmlSlideCanvasMode
	const supportsDocumentFlow =
		documentFlowFullscreen &&
		!isPptRenderer &&
		[DetailType.Html, DetailType.Md, DetailType.Text, DetailType.Pdf, DetailType.Code].includes(
			type,
		)
	const { isEditMode, setIsEditMode, checkBeforeClose } = useEditMode({
		fileId: data?.file_id,
		fileName: data?.file_name || data?.display_filename || data?.filename,
		editingPresenceEnabled,
		silentClose: type === DetailType.Design,
	})

	// Use hook to manage save handler registration and wrapped checkBeforeClose
	const { registerSaveHandler } = useCheckBeforeCloseWithSave({
		checkBeforeClose,
		fileId: data?.file_id,
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
	})

	const { syncCustomProjectFolderNameBeforeSave } = useSyncCustomProjectFolderNameBeforeSave({
		attachments,
		currentFileData: data,
	})

	const shouldRefreshAfterSave = useRef(false)

	// 订阅进入编辑状态事件
	useEffect(() => {
		const handleEnterEditMode = (fileId: string) => {
			// 只有当事件中的 fileId 与当前文件的 fileId 匹配时才触发
			if (allowEdit && fileId === data?.file_id) {
				setIsEditMode(true)
			}
		}
		pubsub.subscribe(PubSubEvents.Enter_Edit_Mode, handleEnterEditMode)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Enter_Edit_Mode, handleEnterEditMode)
		}
	}, [data?.file_id, setIsEditMode])

	// 当数据变化时，如果并且用户处于编辑状态，则需要记录保存之后刷新文件
	useDeepCompareEffect(() => {
		if (isEditMode) {
			shouldRefreshAfterSave.current = true
		}
	}, [data])

	// 当用户退出编辑状态时，如果需要刷新文件，则刷新文件
	useEffect(() => {
		if (!isEditMode && shouldRefreshAfterSave.current) {
			// onRefreshFile?.()
			shouldRefreshAfterSave.current = false
		}
	}, [isEditMode])

	//支持批量，但是现在只需要保存单个文件即可,html内容需要混淆后才能保存
	const saveEditContent = async (
		newContent: any,
		fileId?: string,
		enable_shadow: boolean = false,
		fetchFileVersions?: (fileId: string) => void,
		// 在 PPT 编辑子页场景，会传递对应的 isEditMode 参数
		isPPTEditMode?: boolean,
		// 是否在保存后退出编辑模式，默认为 false（保持编辑状态）
		shouldExitEditMode: boolean = false,
		options?: { silent?: boolean; awaitPersist?: boolean },
	): Promise<boolean> => {
		const targetFileId = fileId || data.file_id
		if (!editingPresenceEnabled) {
			return await doSave(
				targetFileId,
				newContent,
				enable_shadow,
				fetchFileVersions,
				shouldExitEditMode,
				options,
			)
		}
		const { editing_user_count } = await SuperMagicApi.getFileEditCount(targetFileId)
		const threshold = isPPTEditMode || isEditMode ? 1 : 0
		if (editing_user_count > threshold) {
			return await new Promise<boolean>((resolve) => {
				const modal = MagicModal.confirm({
					title: t("detail.editingConflictPrompt"),
					variant: "default",
					showIcon: true,
					okText: t("common.continue"),
					cancelText: t("common.cancel"),
					closable: false,
					maskClosable: false,
					centered: true,
					onOk: async () => {
						const didSave = await doSave(
							targetFileId,
							newContent,
							enable_shadow,
							undefined,
							shouldExitEditMode,
							options,
						)
						if (didSave) modal.destroy()
						resolve(didSave)
					},
					onCancel: () => {
						modal.destroy()
						resolve(false)
					},
				})
			})
		}
		return await doSave(
			targetFileId,
			newContent,
			enable_shadow,
			fetchFileVersions,
			shouldExitEditMode,
			options,
		)
	}

	const getPersistFileMeta = useMemoizedFn((fileId: string) => {
		const item = [...(attachmentList || []), ...(attachments || [])].find(
			(entry: { file_id?: string; file_key?: string; file_name?: string }) =>
				entry?.file_id === fileId,
		)
		const projectIdValue =
			data?.project_id !== undefined && data?.project_id !== null
				? String(data.project_id)
				: selectedProject?.id || projectId
		return {
			fileKey: item?.file_key || (fileId === data?.file_id ? data?.file_key : undefined),
			fileName: item?.file_name || data?.file_name || "content.html",
			projectId: projectIdValue || undefined,
			fileScope:
				data?.display_config?.previewPolicy?.fileScope ||
				effectiveDisplayConfig?.previewPolicy?.fileScope,
		}
	})

	const persistQueuedSave = useMemoizedFn(async (request: FileSavePersistRequest) => {
		return persistFileSave(request, {
			getFileMeta: getPersistFileMeta,
			syncFolderName: syncCustomProjectFolderNameBeforeSave,
		})
	})

	const resolveBaselineVersion = useMemoizedFn((fileId: string) => {
		const item = [...(attachmentList || []), ...(attachments || [])].find(
			(entry: { file_id?: string; file_version?: number | string }) =>
				entry?.file_id === fileId,
		)
		const version =
			item?.file_version ?? (fileId === data?.file_id ? data?.file_version : undefined)
		return version == null ? undefined : String(version)
	})

	useEffect(() => {
		if (!data?.file_id || !onRefreshFile) return
		return getFileSaveQueue().registerRestoreHandler(String(data.file_id), () => {
			onRefreshFile()
		})
	}, [data?.file_id, onRefreshFile])

	async function doSave(
		targetFileId: string,
		newContent: any,
		enable_shadow: boolean,
		fetchFileVersions?: (
			fileId: string,
			page_size?: number,
			isLoadMore?: boolean,
			isSelectNewest?: boolean,
		) => void,
		shouldExitEditMode: boolean = false,
		options?: { silent?: boolean; awaitPersist?: boolean },
	): Promise<boolean> {
		if (!allowEdit) return false
		const silent = options?.silent === true
		const didEnqueue = await enqueueOptimisticSave(
			{
				fileId: targetFileId,
				content: newContent,
				enableShadow: enable_shadow,
				baselineVersion: resolveBaselineVersion(targetFileId),
				silent,
				persist: persistQueuedSave,
				onSuccess: async () => {
					await fetchFileVersions?.(targetFileId, 10, undefined, true)
					if (!silent) {
						magicToast.success({
							content: t("common.saveSuccess"),
							key: `save-${targetFileId}`,
						})
					}
				},
			},
			{ awaitPersist: options?.awaitPersist },
		)
		if (shouldExitEditMode && didEnqueue) {
			setIsEditMode(false)
		}
		return didEnqueue
	}

	const exportFile = async (fileId: string, fileVersion?: number) => {
		if (!access.download || allowDownload === false) return
		if (!(await ensureFileSavesSynced([fileId]))) return
		try {
			const dependencyResult = await resolveSingleDocumentStaticDependencies({
				fileIds: [fileId],
				attachments: attachmentList || attachments || [],
				fileApi,
			})
			const effectiveFileIds = mergeStaticDependencyFileIds(
				[fileId],
				dependencyResult.dependencyFileIds,
				true,
			)

			if (effectiveFileIds.length > 1) {
				await downloadProgress.startDownload({
					projectId: selectedProject?.id || projectId,
					fileIds: effectiveFileIds,
					token: shareToken || undefined,
					label: t("topicFiles.downloading"),
					onSuccess: () => magicToast.success(t("topicFiles.downloadSuccess")),
					onError: () => magicToast.error(t("topicFiles.downloadFailed")),
					onCancel: () => magicToast.info(t("topicFiles.downloadAbort")),
				})
				return
			}
		} catch (error) {
			console.error("Failed to resolve document dependencies before export:", error)
			magicToast.warning(t("share.documentDependenciesAnalysisFailed"))
		}

		fileApi
			.getTemporaryDownloadUrl({
				file_ids: [fileId],
				file_versions: fileVersion ? { [fileId]: fileVersion } : undefined,
				download_mode: DownloadImageMode.Download,
				is_download: true,
			})
			.then((res: any) => {
				downloadFileWithAnchor(res[0]?.url)
			})
	}

	const exportPdf = async (fileId: string, previewElement?: HTMLElement) => {
		if (!access.export || allowDownload === false) return
		if (!fileId) return
		if (!(await ensureFileSavesSynced([fileId]))) return

		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const toastId = createRandomUuidV4()
		const resourceErrors = documentExporter.createResourceErrorCollector(t)
		let pdfHandle: DocumentExport.Handle | null = null
		const inPptMode =
			displayConfig?.type === "slide" || isFileInPPTMode(fileId, attachmentList ?? [])
		const page = inPptMode
			? undefined
			: await documentExporter.requestPdfExportSettings({ previewElement })
		if (page === null) return

		const getPdfExportToastContent = (progressText: string) => (
			<div className="flex items-center gap-2">
				<span>{progressText}</span>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
					onClick={() => pdfHandle?.cancel?.()}
				>
					{t("topicFiles.exportCancel")}
				</Button>
			</div>
		)

		try {
			magicToast.loading({
				key: toastId,
				content: getPdfExportToastContent(t("topicFiles.exporting")),
				duration: 0,
			})

			const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)
			const result = await prepareSingleSlideExport({
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				access: fileAccess ?? undefined,
				fileApi,
			})

			if (!result.htmlSlides.some(Boolean)) {
				throw new Error("Failed to fetch HTML file content")
			}

			const preparedHtmlSlides = await prepareHtmlPagesForExport({
				pages: result.htmlSlides,
				attachments: attachments ?? [],
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				displayConfig,
				access: fileAccess ?? undefined,
				fileApi,
			})

			pdfHandle = documentExporter.exportPages(preparedHtmlSlides, {
				fileName: (result.fileName || "export") + ".pdf",
				skipFailedPages: true,
				pptMode: inPptMode,
				page,
				vector: {
					fitContentWidth: !inPptMode,
				},
				onResourceLoadError: resourceErrors.onResourceLoadError,
				onPageProgress: (ctx) => {
					const { index, total } = ctx as DocumentExport.PageProgressContext
					if (total <= 1) return
					magicToast.loading({
						key: toastId,
						content: getPdfExportToastContent(
							`${t("topicFiles.exporting")} (${index + 1}/${total})`,
						),
						duration: 0,
					})
				},
			})
			await pdfHandle.promise
			magicToast.success({
				key: toastId,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[filePdfExport] export failed:", error)
			const isAbort = (error as { name?: string } | null)?.name === "AbortError"
			magicToast[isAbort ? "info" : "error"]({
				key: toastId,
				content: isAbort
					? t("topicFiles.exportCancel")
					: t("topicFiles.contextMenu.fileExport.exportFailed"),
				duration: 1000,
			})
		}
	}

	const exportRasterPdf = async (fileId: string, pageMode: "fit" | "paginate") => {
		if (!access.export || allowDownload === false) return
		if (!fileId) return
		if (!(await ensureFileSavesSynced([fileId]))) return

		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const toastId = createRandomUuidV4()
		const resourceErrors = documentExporter.createResourceErrorCollector(t)
		let pdfHandle: DocumentExport.Handle | null = null

		const getPdfExportToastContent = (progressText: string) => (
			<div className="flex items-center gap-2">
				<span>{progressText}</span>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
					onClick={() => pdfHandle?.cancel?.()}
				>
					{t("topicFiles.exportCancel")}
				</Button>
			</div>
		)

		try {
			magicToast.loading({
				key: toastId,
				content: getPdfExportToastContent(t("topicFiles.exporting")),
				duration: 0,
			})

			const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)
			const result = await prepareSingleSlideExport({
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				access: fileAccess ?? undefined,
				fileApi,
			})

			if (!result.htmlSlides.some(Boolean)) {
				throw new Error("Failed to fetch HTML file content")
			}

			const inPptMode =
				displayConfig?.type === "slide" || isFileInPPTMode(fileId, attachmentList ?? [])

			const preparedHtmlSlides = await prepareHtmlPagesForExport({
				pages: result.htmlSlides,
				attachments: attachments ?? [],
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				displayConfig,
				access: fileAccess ?? undefined,
				fileApi,
			})

			pdfHandle = documentExporter.exportRasterPages(preparedHtmlSlides, {
				fileName: (result.fileName || "export") + ".pdf",
				skipFailedPages: true,
				pptMode: inPptMode,
				pageMode,
				onResourceLoadError: resourceErrors.onResourceLoadError,
			})
			await pdfHandle.promise
			magicToast.success({
				key: toastId,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[fileRasterPdfExport] export failed:", error)
			const isAbort = (error as { name?: string } | null)?.name === "AbortError"
			magicToast[isAbort ? "info" : "error"]({
				key: toastId,
				content: isAbort
					? t("topicFiles.exportCancel")
					: t("topicFiles.contextMenu.fileExport.exportFailed"),
				duration: 1000,
			})
		}
	}

	const exportPptx = async (fileId: string) => {
		if (!access.export || allowDownload === false) return
		if (!fileId) return
		if (!(await ensureFileSavesSynced([fileId]))) return

		const toastId = createRandomUuidV4()
		let cancelExport: (() => void) | null = null
		let destinationLease: Awaited<ReturnType<typeof openPptxDestination>> = null
		const resourceErrors = createPptxResourceErrorCollector(t)
		const exportIssues: ExportIssue[] = []
		// Keep these values outside try so early failures can still publish a
		// diagnostic without triggering a second ReferenceError in catch.
		const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)
		const sourceFileName = fileItem?.file_name || data?.file_name
		const exportFileName = String(sourceFileName || "export").replace(/\.html?$/i, "")

		function getExportToastContent(progressText: string) {
			return (
				<div className="flex items-center gap-2">
					<span>{progressText}</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
						onClick={() => cancelExport?.()}
					>
						{t("topicFiles.exportCancel")}
					</Button>
				</div>
			)
		}

		try {
			magicToast.loading({
				key: toastId,
				content: getExportToastContent(t("topicFiles.exporting")),
				duration: 0,
			})

			assertPptxExportAvailable({ pageCount: 1 })
			destinationLease = await openPptxDestination({ suggestedName: exportFileName })
			if (!destinationLease) {
				magicToast.destroy(toastId)
				return
			}
			const autoSize = !isFileInPPTMode(fileId, attachmentList ?? [])
			const pptFontResolver = documentExportService.get()?.getPptFontResolver?.()

			{
				const destination = destinationLease.destination
				const streamingHandle = startPptxStreamingExportFromFactory(
					(signal) =>
						iteratePreparedPptxPages(
							iterateSingleExportSlide({
								fileId,
								fileName: sourceFileName,
								attachmentList: attachments ?? [],
								access: fileAccess ?? undefined,
								fileApi,
								signal,
							}),
							{
								attachments: attachments ?? [],
								fileId,
								fileName: sourceFileName,
								attachmentList: attachments ?? [],
								displayConfig,
								signal,
							},
						),
					(firstPage) => ({
						fileName: exportFileName,
						destination,
						outputPolicy: "file-stream",
						pageCount: 1,
						autoSize,
						config: createPptxSlideConfig(
							resolvePptScaleContentDimensions(firstPage.html),
						),
						skipFailedPages: true,
						fontResolver: pptFontResolver,
						logger: pptxExternalLogger,
						logLevel: "warn",
						onResourceLoadError: resourceErrors.onResourceLoadError,
						onExportIssue: (issue) => exportIssues.push(issue),
						onProgress: (progress) => {
							magicToast.loading({
								key: toastId,
								content: getExportToastContent(
									formatPptxStreamingProgress(
										t("topicFiles.exporting"),
										progress,
									),
								),
								duration: 0,
							})
						},
					}),
				)
				cancelExport = streamingHandle.cancel
				await streamingHandle.promise
				publishPptxExportIssues(exportIssues, { fileId, fileName: exportFileName })
				magicToast.success({
					key: toastId,
					content: t("topicFiles.exportSuccess"),
					duration: 1000,
				})
				return
			}
		} catch (error: unknown) {
			await destinationLease?.abort(error).catch(() => undefined)
			const isAbort = (error as { name?: string } | null)?.name === "AbortError"
			const isUnavailable = error instanceof PptxExportUnavailableError
			if (isAbort) {
				magicToast.info({
					key: toastId,
					content: t("topicFiles.exportCancel"),
					duration: 1000,
				})
			} else {
				publishPptxExportFailure(exportIssues, error, {
					fileId,
					fileName: exportFileName,
				})
				magicToast.error({
					key: toastId,
					content: isUnavailable
						? error.message
						: t("topicFiles.contextMenu.fileExport.exportFailed"),
					duration: isUnavailable ? 3000 : 1000,
				})
				reportPptxExportError(error, { fileId, source: "Render" })
			}
		}
	}

	const exportImage = async (fileId: string, format: ImageExportFormat = "png") => {
		if (!access.export || allowDownload === false) return
		if (!fileId) return
		if (!(await ensureFileSavesSynced([fileId]))) return

		const toastId = createRandomUuidV4()
		try {
			magicToast.loading({
				key: toastId,
				content: t("topicFiles.exporting"),
				duration: 0,
			})

			const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)
			const result = await prepareSingleSlideExport({
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				access: fileAccess ?? undefined,
				fileApi,
			})

			if (!result.htmlSlides.some(Boolean)) {
				throw new Error("Failed to fetch HTML file content")
			}

			const preparedHtmlSlides = await prepareHtmlPagesForExport({
				pages: result.htmlSlides,
				attachments: attachments ?? [],
				fileId,
				fileName: fileItem?.file_name || data?.file_name,
				attachmentList: attachments ?? [],
				displayConfig,
				access: fileAccess ?? undefined,
				fileApi,
			})

			// 图片导出引擎只用于显式导出，普通文件预览不加载；失败沿用本操作的错误出口。
			const { exportHtmlToImage } = await import("@magic-web/html2image")
			await exportHtmlToImage({
				pages: preparedHtmlSlides,
				format,
				fileName: (result.fileName || "export").replace(/\.html?$/i, ""),
				onProgress: ({ phase, current, total }) => {
					if (phase !== "capture" || total <= 1) return
					magicToast.loading({
						key: toastId,
						content: `${t("topicFiles.exporting")} (${current}/${total})`,
						duration: 0,
					})
				},
			}).promise
			magicToast.success({
				key: toastId,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[fileImageExport] export failed:", error)
			magicToast.error({
				key: toastId,
				content: t("topicFiles.contextMenu.fileExport.exportFailed"),
				duration: 1000,
			})
		}
	}

	// Common props object for passing to content components
	const commonProps = {
		type,
		attachmentLoadState: props.attachmentLoadState,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload:
			access.download && allowDownload !== false ? (onDownload ?? exportFile) : undefined,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		terminalToolInfo,
		isFullscreen,
		attachmentList,
		isHtmlSlideCanvasMode,
		isEditMode,
		setIsEditMode,
		saveEditContent,
		allowEdit,
		// Register save handler from content component
		onRegisterSaveHandler: registerSaveHandler,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		onShare,
		onFavorite,
		fileContent,
		isFavorited,
		// File sharing props
		topicId,
		baseShareUrl,
		currentFile,
		className,
		updatedAt,
		detailMode,
		// display_config: display_config || data?.display_config,
		displayConfig: effectiveDisplayConfig,
		openFileTab,
		exportFile,
		exportPdf,
		exportRasterPdf,
		exportPptx,
		exportImage,
		selectedProject,
		selectedTopic,
		showFileHeader,
		headerRenderMode,
		onRefreshFile,
		activeFileId,
		onActiveFileChange,
		showFooter,
		isPlaybackMode,
		// PPT uses a viewport-sized stage for slide scaling and must keep its original layout.
		documentFlowFullscreen: supportsDocumentFlow,
		mdToolbarContainer,
		isTabActive: props.isTabActive,
		allowDownload: allowDownload !== false,
		audioPlayerMode,
		projectId,
		browserAttachments,
	}

	return (
		<>
			<FileSaveFailureListener persist={persistQueuedSave} />
			<div
				className={cn(
					supportsDocumentFlow
						? "flex min-h-dvh min-w-0 flex-col"
						: documentFlowFullscreen
							? "flex h-dvh min-w-0 flex-col overflow-hidden"
							: "flex h-full min-h-0 min-w-0 flex-col",
					className,
				)}
			>
				<Suspense
					fallback={
						supportsDocumentFlow ? (
							<div className="min-h-dvh" />
						) : (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									height: "100%",
									minHeight: "400px",
								}}
							>
								<MagicSpin />
							</div>
						)
					}
				>
					<FileAccessProvider
						permissions={{
							share: fileShareAllowed && fileAccess?.kind !== "recycle-bin",
						}}
						options={{
							copyTo: inheritedOptions.copyTo && fileAccess?.kind !== "recycle-bin",
							moveTo: inheritedOptions.moveTo && fileAccess?.kind !== "recycle-bin",
							shareTopic:
								inheritedOptions.shareTopic && fileAccess?.kind !== "recycle-bin",
							createNewTopic:
								inheritedOptions.createNewTopic &&
								fileAccess?.kind !== "recycle-bin",
							versionHistory:
								inheritedOptions.versionHistory &&
								fileVersionHistoryAllowed &&
								fileAccess?.kind !== "recycle-bin",
						}}
					>
						<ContentRenderer type={type} data={data} commonProps={commonProps} />
					</FileAccessProvider>
				</Suspense>
			</div>
		</>
	)
}

/** Avoid mounting file preview content when its containing scope disallows viewing. */
export default function Render(props: any) {
	const { permissions: access } = useFilePermissions()
	// Tool-only panels keep working; file previews can contain inline data without a file id.
	const isFile = ![
		DetailType.Terminal,
		DetailType.Browser,
		DetailType.Search,
		DetailType.KnowledgeSearch,
		DetailType.Empty,
		DetailType.Deleted,
		DetailType.FileTree,
	].includes(props.type)
	if (isFile && (!access.view || !access.preview)) return null
	return (
		<FileAccessProvider
			permissions={{ download: props.allowDownload, export: props.allowDownload }}
		>
			<FileContentRender {...props} />
		</FileAccessProvider>
	)
}
