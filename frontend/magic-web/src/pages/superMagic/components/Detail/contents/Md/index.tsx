import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { TextFileSession } from "../../types"
import DetailEmpty from "../../components/DetailEmpty"
import type {
	MarkdownSourceSnapshot,
	SourceReplacement,
} from "./components/EditorBody/source-location"
import { useMarkdownSelection } from "./hooks/useMarkdownSelection"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { TextSaveStatus } from "../../components/TextSaveStatus"
import { cn } from "@/utils/cn"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { getLanguage } from "@/pages/superMagic/utils/handleFIle"
import EditorBody from "./components/EditorBody"
import MagicSpin from "@/components/base/MagicSpin"
import { useAIEditMenuItems } from "@/pages/superMagic/components/Detail/components/EditToolbar/useAIEditMenuItems"
import ConditionalTooltip from "../../components/EditToolbar/ConditionalTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Crosshair } from "lucide-react"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import CommonFooter from "../../components/CommonFooter"
import { useIsMobile } from "@/hooks/useIsMobile"
import useExportMenuItems from "../HTML/useExportMenuItems"
import { useImageUrlResolver } from "./hooks/useImageUrlResolver"
import {
	type AttachmentFile,
	findFileByPath,
	normalizeImagePath,
	buildImageUrlMapEntries,
	extractImagePaths,
	isExternalUrl,
	resolveRelativePath,
	escapeDangerousInvisibleHtmlTags,
} from "./utils"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import useShareButtonVisibility from "../../hooks/useShareButtonVisibility"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { exportMarkdownToImage } from "@/utils/markdownImageExport"
import type { ImageExportFormat } from "@magic-web/html2image"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import { requestProjectAttachmentsFullRefresh } from "@/pages/superMagic/services/attachmentsTopicSync"
import { documentExportService } from "@/pages/superMagic/services/documentExport"
import { isLargeMarkdownContent } from "./components/EditorBody/largeMarkdown"
import { useDevicePreview } from "../../components/DevicePreview/useDevicePreview"
import { DevicePreviewToolbar } from "../../components/DevicePreview/DevicePreviewToolbar"
import { DevicePreviewViewport } from "../../components/DevicePreview/DevicePreviewViewport"

interface TextEditorProps {
	textFileSession?: TextFileSession
	resolveRelativeFile?: (href: string) => Promise<AttachmentItem | undefined>
	resolveImageUrl?: (href: string) => Promise<string>
	data?: any
	attachments?: AttachmentFile[]
	attachmentList?: AttachmentFile[]
	setUserSelectDetail?: (detail: any) => void
	type?: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: (fileId?: string, fileVersion?: number) => void
	totalFiles?: number
	hasUserSelectDetail?: boolean
	isFromNode?: boolean
	onClose?: () => void
	userSelectDetail?: any
	isFullscreen?: boolean
	/** Enables page-level document flow for pure-share previews. */
	documentFlowFullscreen?: boolean
	handleShareFile?: () => void
	allowEdit?: boolean
	setIsEditMode?: (isEdit: boolean) => void
	isEditMode?: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
		shouldExitEditMode?: boolean,
		options?: { silent?: boolean; awaitPersist?: boolean },
	) => Promise<void>
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	updatedAt?: string
	detailMode?: "single" | "files"
	showFileHeader?: boolean
	selectedProject?: any
	onRefreshFile?: () => void
	activeFileId?: string | null
	showFooter?: boolean
	exportFile?: (fileId: string, fileVersion?: number) => void
	exportPdf?: (fileId: string) => void
	isExporting?: boolean
	openFileTab?: (fileItem: { file_id: string } & Record<string, any>) => void
	isPlaybackMode?: boolean
	/** Cached file tabs use this to gate global preview shortcuts and background work. */
	isTabActive?: boolean
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	/** playback 模式下，由 PlaybackTabContent 提供的 portal 挂载点 */
	mdToolbarContainer?: HTMLDivElement | null
}

interface MdExportActionProps {
	handleExportSource: () => void
	handleExportPDF: () => void
	handleExportImage?: (format: ImageExportFormat) => void
	handleExportRasterPdf?: (pageMode: "fit" | "paginate") => void
	isExporting?: boolean
	showButtonText: boolean
}

const MdExportAction = memo(function MdExportAction({
	handleExportSource,
	handleExportPDF,
	handleExportImage,
	handleExportRasterPdf,
	isExporting = false,
	showButtonText,
}: MdExportActionProps) {
	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF,
		handleExportImage,
		handleExportRasterPdf,
		isExporting,
		showButtonText,
		showExportImage: !!handleExportImage,
		showExportPdf: true,
		showExportRasterPdf: !!handleExportRasterPdf,
	})

	return ExportDropdownButton
})

export default memo(function TextEditor(props: TextEditorProps) {
	const {
		textFileSession,
		resolveRelativeFile,
		resolveImageUrl,
		data: displayData,
		attachments,
		attachmentList,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		documentFlowFullscreen = false,
		allowEdit,
		viewMode = "desktop",
		onViewModeChange,
		onCopy,
		fileContent,
		// File sharing props
		currentFile,
		setIsEditMode,
		isEditMode,
		saveEditContent,
		onRegisterSaveHandler,
		className,
		updatedAt,
		detailMode,
		showFileHeader = true,
		selectedProject,
		activeFileId,
		showFooter,
		exportFile,
		isExporting,
		openFileTab,
		isPlaybackMode,
		isTabActive = true,
		allowDownload,
		mdToolbarContainer,
		topicId,
	} = props
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()

	/** 使用分享按钮可见性控制 Hook，用于控制导出按钮和下载按钮 */
	const { shouldHideByPermission } = useShareButtonVisibility({
		allowDownload,
		isMobile,
		allowEdit,
		isEditMode,
	})

	const {
		fileData,
		loading: fileLoading,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		fetchFileVersions,
		isNewestVersion,
		isDeleted,
		loadError: fileLoadError,
		refreshFile,
	} = useFileData({
		enabled: true,
		loadContent: !textFileSession,
		isTabActive,
		file_id: displayData?.file_id || "",
		updatedAt,
		isEditing: isEditMode,
		activeFileId,
		isFromNode,
		content: displayData?.content,
		disabledUrlCache: isPlaybackMode,
	})

	const [localEditContent, setLocalEditContent] = useState<string>("")
	const editContent = textFileSession?.draft ?? localEditContent
	const setEditContent = textFileSession?.setDraft ?? setLocalEditContent
	const loading = textFileSession?.loading ?? fileLoading
	const [originalContent, setOriginalContent] = useState<string>("")
	const [savedContent, setSavedContent] = useState<string>("")
	const [isExportingPdf, setIsExportingPdf] = useState(false)

	// 维护一个内部的 viewMode 状态，在数据加载期间保持稳定
	const [internalViewMode, setInternalViewMode] = useState<"code" | "desktop" | "phone">(viewMode)
	// The phone frame has fixed dimensions and its own clipping; pure shares need page scrolling.
	const shouldUsePhoneFrame = !documentFlowFullscreen && internalViewMode === "phone"
	const devicePreview = useDevicePreview(
		String(selectedProject?.id || ""),
		String(displayData?.file_id || ""),
	)
	const devicePreviewEnabled =
		shouldUsePhoneFrame && !isMobile && showFileHeader && !isPlaybackMode

	// 计算当前的内容源 - savedContent 优先于 fileData 和 displayData?.content
	const currentContent =
		fileVersion !== undefined
			? (fileData ?? textFileSession?.content ?? "")
			: (textFileSession?.content ?? (savedContent || displayData?.content || fileData || ""))
	const isLargeMarkdown = useMemo(() => isLargeMarkdownContent(currentContent), [currentContent])
	const wasEditingLargeMarkdownRef = useRef(false)

	// Large documents use the virtual preview while reading and Monaco while editing.
	// Keep the public view-mode state aligned so the header never advertises rich preview during edits.
	useEffect(() => {
		if (isLargeMarkdown && isEditMode) {
			wasEditingLargeMarkdownRef.current = true
			if (internalViewMode !== "code") {
				setInternalViewMode("code")
				onViewModeChange?.("code")
			}
			return
		}

		if (wasEditingLargeMarkdownRef.current && !isEditMode) {
			wasEditingLargeMarkdownRef.current = false
			setInternalViewMode("desktop")
			onViewModeChange?.("desktop")
		}
	}, [internalViewMode, isEditMode, isLargeMarkdown, onViewModeChange])

	// 初始化编辑内容和原始内容
	useEffect(() => {
		if (textFileSession) return
		if (isEditMode) {
			// 如果 currentContent 有值，需要确保 editContent 和 originalContent 都被正确初始化
			if (currentContent) {
				// 先更新 originalContent（如果为空）
				setOriginalContent((prevOriginal) => {
					if (!prevOriginal) {
						return currentContent
					}
					return prevOriginal
				})
				// 然后更新 editContent
				setLocalEditContent((prevEditContent) => {
					// 如果 editContent 为空，使用 currentContent 初始化
					if (!prevEditContent) {
						return currentContent
					}
					// 编辑模式下，如果内容未修改（等于 originalContent），可以同步更新为 currentContent
					// 注意：这里使用闭包中的 originalContent，可能不是最新的值
					// 但如果 prevEditContent === originalContent，说明用户没有修改，应该更新
					if (prevEditContent === originalContent) {
						return currentContent
					}
					return prevEditContent
				})
			} else {
				// currentContent 为空时，确保 editContent 至少是空字符串
				setLocalEditContent((prevEditContent) => {
					if (!prevEditContent) {
						return ""
					}
					return prevEditContent
				})
			}
		} else {
			// 非编辑模式下，同步更新内容
			if (currentContent) {
				setLocalEditContent(currentContent)
				setOriginalContent(currentContent)
			}
		}
	}, [currentContent, isEditMode, originalContent])

	// 当文件切换时重置savedContent状态
	useEffect(() => {
		setSavedContent("")
	}, [displayData?.file_id, fileData])

	const data = useMemo(() => {
		return {
			...displayData,
			content: currentContent,
		}
	}, [displayData, currentContent])

	const [sourceSnapshot, setSourceSnapshot] = useState<MarkdownSourceSnapshot | null>(null)
	const processedContent = sourceSnapshot?.content ?? ""
	const [isLoading, setIsLoading] = useState<boolean>(true)
	// Get language for syntax highlighting
	const language = useMemo(() => {
		return getLanguage(data?.file_name || data?.title || "file.md")
	}, [data?.file_name, data?.title])

	const relativeFilePath = useMemo(() => {
		// Primary: look up in the visible attachment list
		const fromList = attachmentList?.find(
			(item) => item.file_id === displayData?.file_id,
		)?.relative_file_path
		if (fromList) return fromList
		// Fallback: use relative_file_path directly from the file data (handles hidden files)
		return displayData?.relative_file_path as string | undefined
	}, [displayData?.file_id, displayData?.relative_file_path, attachmentList])

	// Use the image URL resolver hook
	const { imageUrlMap, setImageUrlMap, urlResolver } = useImageUrlResolver({
		resolveUrl: resolveImageUrl,
		attachments,
		relativeFilePath,
	})

	/**
	 * Strip leading/trailing slashes from a path for comparison.
	 */
	const normalizeMdPath = (path: string) => path.replace(/^\/+|\/+$/g, "")

	/**
	 * Resolve or create the images folder before an image upload.
	 * - Searches attachmentList for an existing directory matching folderPath.
	 * - If found, returns its file_id directly.
	 * - If not found, resolves the parent dir file_id, calls createFile, and returns the new id.
	 * - On DuplicateFile error, re-searches attachmentList for the existing folder.
	 * - Returns undefined on any unrecoverable failure (graceful degradation → root).
	 */
	const resolveImagesFolderParentId = useMemoizedFn(async (folderPath: string) => {
		if (!selectedProject?.id) return undefined

		const flatList = (attachmentList as AttachmentItem[] | undefined) ?? []
		const normalizedFolderPath = normalizeMdPath(folderPath)

		// Step 1: Check if the images folder already exists
		const existingFolder = flatList.find(
			(item) =>
				item.is_directory &&
				normalizeMdPath(item.relative_file_path || "") === normalizedFolderPath,
		)
		if (existingFolder?.file_id) {
			return existingFolder.file_id
		}

		// Step 2: Find the parent directory's file_id
		const lastSlash = normalizedFolderPath.lastIndexOf("/")
		const parentPath = lastSlash > 0 ? normalizedFolderPath.substring(0, lastSlash) : ""
		const folderName =
			lastSlash > 0 ? normalizedFolderPath.substring(lastSlash + 1) : normalizedFolderPath

		let parentDirId: string | undefined
		if (parentPath) {
			const parentDir = flatList.find(
				(item) =>
					item.is_directory &&
					normalizeMdPath(item.relative_file_path || "") === parentPath,
			)
			parentDirId = parentDir?.file_id
		}

		// Step 3: Create the images folder
		try {
			const result = await SuperMagicApi.createFile({
				project_id: selectedProject.id,
				parent_id: parentDirId || "",
				file_name: folderName,
				is_directory: true,
			})
			const folderId = (result as any)?.file_id as string | undefined
			return folderId
		} catch (error: unknown) {
			const errorObj = error as { code?: number }
			if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
				// Folder already exists — refresh and search again
				requestProjectAttachmentsFullRefresh({
					projectId: selectedProject.id,
					reason: "markdown-images-folder-duplicate",
				})
				const existing = flatList.find(
					(item) =>
						item.is_directory &&
						normalizeMdPath(item.relative_file_path || "") === normalizedFolderPath,
				)
				return existing?.file_id
			}
			// Other errors: graceful degradation (save to root)
			console.error("[MdEditor] Failed to create images folder:", error)
			return undefined
		}
	})
	// 当数据加载完成（loading 为 false）且内容处理完成（isLoading 为 false）后，才同步 viewMode
	useEffect(() => {
		if (!loading && !isLoading) {
			setInternalViewMode(viewMode)
		}
	}, [loading, isLoading, viewMode])

	// Process markdown images to resolve URLs
	useEffect(() => {
		let disposed = false
		const processContent = () => {
			let replacements: SourceReplacement[] = []
			const content = escapeDangerousInvisibleHtmlTags(currentContent, (ranges) => {
				replacements = ranges
			})
			setSourceSnapshot({ source: currentContent, content, replacements })
		}
		const processImages = async () => {
			if (shouldWaitForShareAccess(fileAccess)) return
			setIsLoading(true)
			setImageUrlMap(new Map())

			// Extract all image paths from markdown content
			const imagePaths = extractImagePaths(currentContent)

			if (imagePaths.length === 0) {
				processContent()
				setIsLoading(false)
				return
			}

			if (resolveImageUrl) {
				await Promise.all(
					imagePaths.filter((path) => !isExternalUrl(path)).map(urlResolver),
				)
				if (disposed) return
				processContent()
				setIsLoading(false)
				return
			}

			// Get document directory path for resolving relative image paths
			const documentDir = relativeFilePath
				? relativeFilePath.substring(0, relativeFilePath.lastIndexOf("/"))
				: ""

			// Collect images to process and build file ID to paths mapping
			const imagesToProcess = new Set<string>()
			const fileIdToPaths = new Map<string, Set<string>>()

			for (const imgUrl of imagePaths) {
				// Skip external URLs
				if (isExternalUrl(imgUrl)) {
					continue
				}

				// Normalize path to remove size syntax for file lookup
				const pathForLookup = normalizeImagePath(imgUrl)

				// Convert relative path (relative to document) to path relative to project root
				const resolvedPath = documentDir
					? resolveRelativePath(documentDir, pathForLookup)
					: pathForLookup

				// Find the matched file in attachments tree by relative path
				const matchedFile = findFileByPath(attachments || [], resolvedPath)

				if (matchedFile) {
					imagesToProcess.add(matchedFile.file_id)
					const existingPaths =
						fileIdToPaths.get(matchedFile.file_id) || new Set<string>()
					existingPaths.add(imgUrl)
					fileIdToPaths.set(matchedFile.file_id, existingPaths)
				}
			}

			if (imagesToProcess.size > 0) {
				try {
					// Batch fetch temporary download URLs
					const downloadUrls =
						(await fileApi.getTemporaryDownloadUrl({
							file_ids: Array.from(imagesToProcess),
							options: {
								xMagicImageProcess: {
									quality: 85,
									format: "webp",
								},
							},
						})) || []

					if (disposed) return

					// Build image URL map using utility function
					const resolvedMap = buildImageUrlMapEntries(downloadUrls, fileIdToPaths)

					setImageUrlMap(resolvedMap)
					processContent()
					setIsLoading(false)
				} catch (error) {
					if (disposed) return
					console.error("Error fetching download URLs:", error)
					processContent()
					setImageUrlMap(new Map())
					setIsLoading(false)
				}
			} else {
				processContent()
				setImageUrlMap(new Map())
				setIsLoading(false)
			}
		}
		processImages()
		return () => {
			disposed = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentContent, relativeFilePath, fileAccess, fileApi])

	const handleEdit = useMemoizedFn(() => {
		markdownSelection.stop()
		setIsEditMode?.(true)
		// 进入编辑模式时，使用当前的内容作为编辑内容
		if (!textFileSession) setEditContent(currentContent)
	})

	const handleSave = useMemoizedFn(async () => {
		if (textFileSession) return textFileSession.save()
		try {
			if (originalContent === editContent) {
				return
			}
			// 调用保存方法
			if (saveEditContent) {
				// Feedback is the top-right save chip, so skip the centered toast.
				await saveEditContent(
					editContent,
					displayData?.file_id,
					false,
					fetchFileVersions,
					undefined,
					false,
					{ silent: true },
				)
				// 保存成功后更新原始内容
				setOriginalContent(editContent)
				setSavedContent(editContent)
			}
			// 不再退出编辑模式
		} catch (error) {
			console.error("保存失败:", error)
			// 这里可以添加错误提示
		}
	})

	// Register save handler when in edit mode
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	const handleSaveAndExit = useMemoizedFn(async () => {
		if (textFileSession) {
			await textFileSession.save()
			setIsEditMode?.(false)
			return
		}
		try {
			if (originalContent === editContent) {
				setIsEditMode?.(false)
				return
			}
			// 调用保存方法，传递 shouldExitEditMode = true
			if (saveEditContent) {
				await saveEditContent(
					editContent,
					displayData?.file_id,
					false,
					fetchFileVersions,
					undefined,
					true,
					{ silent: true },
				)
				// 保存成功后更新原始内容
				setOriginalContent(editContent)
				setSavedContent(editContent)
			}
		} catch (error) {
			console.error("保存失败:", error)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		// 取消编辑，恢复原始内容
		setEditContent(originalContent)
		setIsEditMode?.(false)
	})

	const quitEditMode = useMemoizedFn(() => {
		setEditContent(originalContent)
		setIsEditMode?.(false)
	})

	const handleExportSource = useMemoizedFn(() => {
		exportFile?.(displayData?.file_id, fileVersion)
	})

	const handleExportPDF = useMemoizedFn(async () => {
		const fileId = displayData?.file_id
		if (!currentContent) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}
		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const toastKey = `md2pdf-${fileId || Date.now()}`
		setIsExportingPdf(true)
		magicToast.loading({
			key: toastKey,
			content: t("topicFiles.exporting"),
			duration: 0,
		})

		try {
			const { promise } = documentExporter.exportMarkdown({
				markdown: currentContent,
				processedContent,
				fileName: (displayData?.file_name || "export").replace(/\.[^.]+$/, ".pdf"),
				selectedProject,
				relativeFilePath: relativeFilePath,
				attachments,
				initialImageUrlMap: imageUrlMap,
				onProgress: ({ phase, current, total }) => {
					if (phase !== "capture" || total <= 1) return
					magicToast.loading({
						key: toastKey,
						content: `${t("topicFiles.exporting")} (${current}/${total})`,
						duration: 0,
					})
				},
			})
			await promise
			magicToast.success({
				key: toastKey,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[markdownPdfExport] Export failed:", error)
			magicToast.destroy(toastKey)
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
		} finally {
			setIsExportingPdf(false)
		}
	})

	const handleExportRasterPdf = useMemoizedFn(async (pageMode: "fit" | "paginate") => {
		const fileId = displayData?.file_id
		if (!currentContent) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}
		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const toastKey = `md2pdf-raster-${fileId || Date.now()}`
		setIsExportingPdf(true)
		magicToast.loading({
			key: toastKey,
			content: t("topicFiles.exporting"),
			duration: 0,
		})

		try {
			const { promise } = documentExporter.exportMarkdownRaster({
				markdown: currentContent,
				processedContent,
				fileName: (displayData?.file_name || "export").replace(/\.[^.]+$/, ".pdf"),
				selectedProject,
				relativeFilePath: relativeFilePath,
				attachments,
				initialImageUrlMap: imageUrlMap,
				pageMode,
				onProgress: ({ phase, current, total }) => {
					if (phase !== "capture" || total <= 1) return
					magicToast.loading({
						key: toastKey,
						content: `${t("topicFiles.exporting")} (${current}/${total})`,
						duration: 0,
					})
				},
			})
			await promise
			magicToast.success({
				key: toastKey,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[markdownRasterPdfExport] Export failed:", error)
			magicToast.destroy(toastKey)
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
		} finally {
			setIsExportingPdf(false)
		}
	})

	const handleExportImage = useMemoizedFn(async (format: ImageExportFormat = "png") => {
		if (!currentContent) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const toastKey = `md-image-export-${displayData?.file_id || Date.now()}`
		setIsExportingPdf(true)
		magicToast.loading({
			key: toastKey,
			content: t("topicFiles.exporting"),
			duration: 0,
		})

		try {
			const { promise } = exportMarkdownToImage({
				markdown: currentContent,
				processedContent,
				format,
				fileName: (displayData?.file_name || "export").replace(/\.[^.]+$/, ""),
				selectedProject,
				relativeFilePath,
				attachments,
				initialImageUrlMap: imageUrlMap,
				onProgress: ({ phase, current, total }) => {
					if (phase !== "capture" || total <= 1) return
					magicToast.loading({
						key: toastKey,
						content: `${t("topicFiles.exporting")} (${current}/${total})`,
						duration: 0,
					})
				},
			})
			await promise
			magicToast.success({
				key: toastKey,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[image-export] Markdown export failed:", error)
			magicToast.destroy(toastKey)
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
		} finally {
			setIsExportingPdf(false)
		}
	})

	const handleCopyMarkdown = useMemoizedFn(() => {
		navigator.clipboard
			.writeText(currentContent)
			.then(() => magicToast.success(t("playbackControl.copyMarkdownSuccess")))
			.catch(() => magicToast.error(t("playbackControl.copyMarkdownFailed")))
	})

	const markdownSelection = useMarkdownSelection({
		file: displayData,
		enabled:
			!!allowEdit &&
			!isMobile &&
			!isEditMode &&
			isNewestVersion &&
			isTabActive &&
			!loading &&
			!isLoading &&
			internalViewMode !== "code" &&
			!shouldHideByPermission,
		snapshot: sourceSnapshot?.source === currentContent ? sourceSnapshot : null,
		fileId: displayData?.file_id,
		fileName: displayData?.file_name || displayData?.title,
		filePath: relativeFilePath,
		topicId,
		projectId: selectedProject?.id,
	})

	const aiEditMenuItems = useAIEditMenuItems({
		file: textFileSession ? displayData : undefined,
		attachmentList: attachmentList as AttachmentItem[],
		fileId: displayData?.file_id,
		enabled: !!allowEdit && !isMobile && !isEditMode && isNewestVersion && isTabActive,
	})

	const headerActionConfig = useMemo(() => {
		const customActions: NonNullable<HeaderActionConfig["customActions"]> = []

		if (!isMobile && allowEdit && !isEditMode && !shouldHideByPermission) {
			customActions.push({
				key: "md-export-dropdown",
				zone: "secondary" as const,
				after: "download" as const,
				render: (context) => (
					<MdExportAction
						handleExportSource={handleExportSource}
						handleExportPDF={handleExportPDF}
						handleExportImage={handleExportImage}
						handleExportRasterPdf={handleExportRasterPdf}
						isExporting={isExporting || isExportingPdf}
						showButtonText={context.showButtonText}
					/>
				),
			})
		}

		if (
			allowEdit &&
			!isMobile &&
			!isEditMode &&
			isNewestVersion &&
			internalViewMode !== "code"
		) {
			const label = t(
				markdownSelection.active
					? "topicFiles.exitSelectElement"
					: "topicFiles.selectElement",
			)
			customActions.push({
				key: "md-select",
				zone: "secondary",
				before: "refresh",
				render: (context) => (
					<ConditionalTooltip showText={context.showButtonText} title={label}>
						<Button
							variant="outline"
							size="sm"
							onClick={markdownSelection.toggle}
							disabled={!markdownSelection.canSelect}
							aria-pressed={markdownSelection.active}
							aria-label={label}
							className={cn(
								"h-6 gap-1.5 rounded-[8px] px-3 py-0 text-xs font-normal shadow-xs",
								markdownSelection.active && "text-primary",
							)}
						>
							<Crosshair size={16} />
							{context.showButtonText && <span>{label}</span>}
						</Button>
					</ConditionalTooltip>
				),
			})
		}
		if (setIsEditMode && allowEdit && !isMobile && displayData?.file_id && isNewestVersion) {
			customActions.push({
				key: "md-edit-buttons",
				zone: "secondary" as const,
				before: "refresh" as const,
				render: (context) => (
					<FileEditButtons
						isEditMode={isEditMode}
						isSaving={textFileSession?.saving ?? false}
						interactionDisabled={Boolean(
							textFileSession &&
							(loading || textFileSession.loadError || !isTabActive),
						)}
						showButtonText={context.showButtonText}
						onEdit={handleEdit}
						onSave={
							textFileSession ? () => handleSave().catch(() => undefined) : handleSave
						}
						onSaveAndExit={
							textFileSession
								? () => handleSaveAndExit().catch(() => undefined)
								: handleSaveAndExit
						}
						onCancel={handleCancel}
					/>
				),
			})
		}

		if (customActions.length === 0 && !textFileSession) {
			return undefined
		}

		return {
			customActions,
			overrides: textFileSession
				? {
						refresh: {
							onClick: textFileSession.refresh,
							disabled: loading || textFileSession.saving || isEditMode,
						},
					}
				: undefined,
		}
	}, [
		textFileSession,
		loading,
		isTabActive,
		allowEdit,
		markdownSelection.active,
		markdownSelection.canSelect,
		markdownSelection.toggle,
		internalViewMode,
		t,
		attachmentList,
		displayData?.file_id,
		handleExportImage,
		handleExportPDF,
		handleExportSource,
		handleCancel,
		handleEdit,
		handleSave,
		handleSaveAndExit,
		isExporting,
		isEditMode,
		isMobile,
		isNewestVersion,
		setIsEditMode,
		shouldHideByPermission,
	])

	return (
		<>
			<div
				className={cn(
					documentFlowFullscreen
						? "flex min-h-dvh flex-col overflow-visible [&_pre]:pl-0 [&_pre_>_pre]:!bg-muted"
						: "flex h-full flex-col overflow-hidden [&_pre]:pl-0 [&_pre_>_pre]:!bg-muted",
					className,
				)}
			>
				{showFileHeader && (
					<CommonHeaderV2
						type={type}
						onFullscreen={onFullscreen}
						onDownload={() => onDownload?.(displayData?.file_id, fileVersion)}
						isFromNode={isFromNode}
						isFullscreen={isFullscreen}
						viewMode={internalViewMode}
						onViewModeChange={onViewModeChange}
						onCopy={onCopy}
						fileContent={fileContent || processedContent}
						currentFile={currentFile}
						detailMode={detailMode}
						isEditMode={isEditMode}
						fileVersion={fileVersion}
						isNewestFileVersion={isNewestVersion}
						showDownload={
							(isMobile || !allowEdit) &&
							!shouldHideByPermission &&
							allowDownload !== false
						}
						changeFileVersion={changeFileVersion}
						fileVersionsList={fileVersionsList}
						handleVersionRollback={handleVersionRollback}
						quitEditMode={quitEditMode}
						allowEdit={allowEdit}
						attachments={attachments as AttachmentItem[] | undefined}
						actionConfig={headerActionConfig}
						extraMoreMenuItems={aiEditMenuItems}
					/>
				)}
				<TextSaveStatus fileId={displayData?.file_id} textFileSession={textFileSession} />
				{devicePreviewEnabled && (
					<DevicePreviewToolbar
						{...devicePreview}
						active={isTabActive && !loading && !isDeleted}
					/>
				)}
				{textFileSession?.loadError || fileLoadError ? (
					<DetailEmpty
						title={t("common.fileNotFoundOrLoadFailed")}
						onRetry={textFileSession?.refresh ?? refreshFile}
					/>
				) : loading ? (
					documentFlowFullscreen ? (
						<div className="min-h-0 flex-1" />
					) : (
						<div className="flex min-h-0 flex-1 items-center justify-center bg-background">
							<MagicSpin spinning />
						</div>
					)
				) : isDeleted ? (
					<Deleted data={displayData} showHeader={false} />
				) : (
					<div
						className={cn(
							documentFlowFullscreen
								? "min-h-dvh flex-1 overflow-visible transition-[background-color_0.4s_cubic-bezier(0.4,0,0.2,1)]"
								: "min-h-0 flex-1 transition-[background-color_0.4s_cubic-bezier(0.4,0,0.2,1)]",
							!documentFlowFullscreen &&
								(internalViewMode === "code" || devicePreviewEnabled
									? "overflow-hidden"
									: "overflow-auto"),
							shouldUsePhoneFrame &&
								!devicePreviewEnabled &&
								"flex w-full items-center justify-center bg-muted",
						)}
					>
						<DevicePreviewViewport
							{...devicePreview}
							active={isTabActive}
							enabled={devicePreviewEnabled}
						>
							<div
								className={cn(
									documentFlowFullscreen
										? "m-auto min-h-dvh w-full flex-none overflow-visible transition-[width_0.4s_cubic-bezier(0.4,0,0.2,1),border-radius_0.4s_cubic-bezier(0.4,0,0.2,1),background-color_0.4s_cubic-bezier(0.4,0,0.2,1),box-shadow_0.4s_cubic-bezier(0.4,0,0.2,1)]"
										: "m-auto h-full min-h-0 w-full flex-none transition-[width_0.4s_cubic-bezier(0.4,0,0.2,1),border-radius_0.4s_cubic-bezier(0.4,0,0.2,1),background-color_0.4s_cubic-bezier(0.4,0,0.2,1),box-shadow_0.4s_cubic-bezier(0.4,0,0.2,1)]",
									!documentFlowFullscreen &&
										internalViewMode === "code" &&
										"overflow-hidden",
									shouldUsePhoneFrame &&
										!devicePreviewEnabled &&
										"!my-5 h-[calc(100%-40px)] w-[416px] flex-none overflow-hidden rounded-lg border border-border bg-background shadow-[0_4px_14px_0_rgba(0,0,0,0.1),0_0_1px_0_rgba(0,0,0,0.3)]",
								)}
							>
								<EditorBody
									allowDownload={allowDownload}
									selectionRootRef={markdownSelection.selectionRootRef}
									enableSourceLocation={
										!!allowEdit &&
										!isMobile &&
										!isEditMode &&
										internalViewMode !== "code"
									}
									isLoading={isLoading}
									viewMode={internalViewMode as "code" | "markdown"}
									language={language}
									content={currentContent}
									processedContent={processedContent}
									className={cn(
										documentFlowFullscreen
											? "min-h-dvh flex-1 overflow-visible bg-background text-base"
											: "h-full min-h-0 flex-1 bg-background text-base [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5",
										!documentFlowFullscreen &&
											(internalViewMode === "code"
												? "overflow-hidden"
												: "overflow-visible whitespace-pre-wrap"),
										internalViewMode === "code" && "[&_>_pre]:!bg-background",
									)}
									isEditMode={isEditMode}
									editContent={editContent}
									setEditContent={setEditContent}
									selectedProject={selectedProject}
									currentDocumentPath={relativeFilePath}
									urlResolver={urlResolver}
									attachments={attachments}
									onOpenFile={openFileTab}
									resolveRelativeFile={resolveRelativeFile}
									placeholder={t("fileViewer.placeholder.content")}
									resolveImagesFolderParentId={resolveImagesFolderParentId}
									suppressLoadingIndicator={documentFlowFullscreen}
									documentFlowFullscreen={documentFlowFullscreen}
									isTabActive={isTabActive}
								/>
							</div>
						</DevicePreviewViewport>
					</div>
				)}
				{/* 底部 */}
				{showFooter && (
					<CommonFooter
						fileVersion={fileVersion}
						changeFileVersion={changeFileVersion}
						fileVersionsList={fileVersionsList}
						handleVersionRollback={handleVersionRollback}
						quitEditMode={quitEditMode}
						allowEdit={allowEdit}
						isEditMode={isEditMode}
					/>
				)}
			</div>
			{/* Playback 模式下通过 portal 将工具栏按钮渲染到 PlaybackTabContent 的 header 右侧 */}
			{isPlaybackMode &&
				mdToolbarContainer &&
				createPortal(
					<div className="flex shrink-0 flex-nowrap items-center gap-2">
						<div className="flex h-6 shrink-0 items-center overflow-hidden rounded-full border border-border bg-muted text-xs">
							<button
								type="button"
								className={cn(
									"flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-muted-foreground transition-colors",
									internalViewMode !== "code" &&
										"bg-background font-medium text-foreground shadow-sm",
								)}
								onClick={() => {
									setInternalViewMode("desktop")
									onViewModeChange?.("desktop")
								}}
								data-testid="set-internal-view-mode"
							>
								{t("playbackControl.mdViewModeRender")}
							</button>
							<button
								type="button"
								className={cn(
									"flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-muted-foreground transition-colors",
									internalViewMode === "code" &&
										"bg-background font-medium text-foreground shadow-sm",
								)}
								onClick={() => {
									setInternalViewMode("code")
									onViewModeChange?.("code")
								}}
								data-testid="set-internal-view-mode-2"
							>
								{t("playbackControl.mdViewModeSource")}
							</button>
						</div>
						<button
							type="button"
							className="flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							onClick={handleCopyMarkdown}
							data-testid="handle-copy-markdown"
						>
							{t("playbackControl.copyMarkdown")}
						</button>
					</div>,
					mdToolbarContainer as HTMLDivElement,
				)}
		</>
	)
})
