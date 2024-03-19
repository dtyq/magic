import { getTemporaryDownloadUrl } from "@/opensource/pages/superMagic/utils/api"
import { memo, useEffect, useMemo, useState } from "react"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { cn } from "@/opensource/lib/utils"
import { useFileData } from "@/opensource/pages/superMagic/hooks/useFileData"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { getLanguage } from "@/opensource/pages/superMagic/utils/handleFIle"
import EditorBody from "./components/EditorBody"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import AIOptimization from "@/opensource/pages/superMagic/components/Detail/components/AIOptimization"
import FileEditButtons from "@/opensource/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import CommonFooter from "../../components/CommonFooter"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
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
} from "./utils"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import useShareButtonVisibility from "../../hooks/useShareButtonVisibility"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"

interface TextEditorProps {
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
	exportPpt?: (fileId: string) => void
	isExporting?: boolean
	openFileTab?: (fileItem: { file_id: string } & Record<string, any>) => void
	isPlaybackMode?: boolean
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
}

interface MdExportActionProps {
	handleExportSource: () => void
	handleExportPDF: () => void
	isExporting?: boolean
	showButtonText: boolean
}

const MdExportAction = memo(function MdExportAction({
	handleExportSource,
	handleExportPDF,
	isExporting = false,
	showButtonText,
}: MdExportActionProps) {
	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF,
		handleExportPPT: undefined,
		isExporting,
		supportPPT: false,
		showButtonText,
	})

	return ExportDropdownButton
})

export default memo(function TextEditor(props: TextEditorProps) {
	const {
		data: displayData,
		attachments,
		attachmentList,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
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
		exportPdf,
		isExporting,
		openFileTab,
		isPlaybackMode,
		allowDownload,
	} = props
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	/** 使用分享按钮可见性控制 Hook，用于控制导出按钮和下载按钮 */
	const { shouldHideByPermission } = useShareButtonVisibility({
		allowDownload,
		isMobile,
		allowEdit,
		isEditMode,
	})

	const {
		fileData,
		loading,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		fetchFileVersions,
		isNewestVersion,
		isDeleted,
	} = useFileData({
		file_id: displayData?.file_id || "",
		updatedAt,
		isEditing: isEditMode,
		activeFileId,
		isFromNode,
		content: displayData?.content,
		disabledUrlCache: isPlaybackMode,
	})

	const [editContent, setEditContent] = useState<string>("")
	const [originalContent, setOriginalContent] = useState<string>("")
	const [savedContent, setSavedContent] = useState<string>("")

	// 维护一个内部的 viewMode 状态，在数据加载期间保持稳定
	const [internalViewMode, setInternalViewMode] = useState<"code" | "desktop" | "phone">(viewMode)

	// 计算当前的内容源 - savedContent 优先于 fileData 和 displayData?.content
	const currentContent = savedContent || displayData?.content || fileData || ""

	// 初始化编辑内容和原始内容
	useEffect(() => {
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
				setEditContent((prevEditContent) => {
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
				setEditContent((prevEditContent) => {
					if (!prevEditContent) {
						return ""
					}
					return prevEditContent
				})
			}
		} else {
			// 非编辑模式下，同步更新内容
			if (currentContent) {
				setEditContent(currentContent)
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
			content: displayData?.content || fileData,
		}
	}, [displayData, fileData])

	const [processedContent, setProcessedContent] = useState<string>(data?.content || "")
	const [isLoading, setIsLoading] = useState<boolean>(true)
	// Get language for syntax highlighting
	const language = useMemo(() => {
		return getLanguage(data?.file_name || data?.title || "file.md")
	}, [data?.file_name, data?.title])

	const relativeFilePath = useMemo(() => {
		return attachmentList?.find((item) => item.file_id === displayData?.file_id)
			?.relative_file_path
	}, [displayData?.file_id, attachmentList])

	// Use the image URL resolver hook
	const { setImageUrlMap, urlResolver } = useImageUrlResolver({
		attachments,
		relativeFilePath,
	})
	// 当数据加载完成（loading 为 false）且内容处理完成（isLoading 为 false）后，才同步 viewMode
	useEffect(() => {
		if (!loading && !isLoading) {
			setInternalViewMode(viewMode)
		}
	}, [loading, isLoading, viewMode])

	// Process markdown images to resolve URLs
	useEffect(() => {
		const processImages = async () => {
			setIsLoading(true)
			setImageUrlMap(new Map())

			// Extract all image paths from markdown content
			const imagePaths = extractImagePaths(currentContent)

			if (imagePaths.length === 0) {
				setProcessedContent(currentContent)
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
						(await getTemporaryDownloadUrl({
							file_ids: Array.from(imagesToProcess),
							options: {
								xMagicImageProcess: {
									quality: 85,
									format: "webp",
								},
							},
						})) || []

					// Build image URL map using utility function
					const resolvedMap = buildImageUrlMapEntries(downloadUrls, fileIdToPaths)

					setImageUrlMap(resolvedMap)
					setProcessedContent(currentContent)
					setIsLoading(false)
				} catch (error) {
					console.error("Error fetching download URLs:", error)
					setProcessedContent(currentContent)
					setImageUrlMap(new Map())
					setIsLoading(false)
				}
			} else {
				setProcessedContent(currentContent)
				setImageUrlMap(new Map())
				setIsLoading(false)
			}
		}
		processImages()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentContent, relativeFilePath])

	const handleEdit = useMemoizedFn(() => {
		setIsEditMode?.(true)
		// 进入编辑模式时，使用当前的内容作为编辑内容
		setEditContent(currentContent)
	})

	const handleSave = useMemoizedFn(async () => {
		try {
			if (originalContent === editContent) {
				return
			}
			// 调用保存方法
			if (saveEditContent) {
				await saveEditContent(editContent, displayData?.file_id, false, fetchFileVersions)
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

	const handleExportPDF = useMemoizedFn(() => {
		exportPdf?.(displayData?.file_id)
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
						isExporting={isExporting}
						showButtonText={context.showButtonText}
					/>
				),
			})
		}

		if (allowEdit && !isMobile && displayData?.file_id && !isEditMode && isNewestVersion) {
			customActions.push({
				key: "md-ai-optimize",
				zone: "primary" as const,
				render: () => (
					<AIOptimization
						attachmentList={attachmentList as AttachmentItem[]}
						file_id={displayData?.file_id}
						showButtonText
					/>
				),
			})
		}

		if (setIsEditMode && allowEdit && !isMobile && displayData?.file_id && isNewestVersion) {
			customActions.push({
				key: "md-edit-buttons",
				zone: "primary" as const,
				render: () => (
					<FileEditButtons
						isEditMode={isEditMode}
						isSaving={false}
						showButtonText
						onEdit={handleEdit}
						onSave={handleSave}
						onSaveAndExit={handleSaveAndExit}
						onCancel={handleCancel}
					/>
				),
			})
		}

		if (customActions.length === 0) {
			return undefined
		}

		return { customActions }
	}, [
		allowEdit,
		attachmentList,
		displayData?.file_id,
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
		<div
			className={cn(
				"flex h-full flex-col overflow-hidden [&_pre]:pl-0 [&_pre_>_pre]:!bg-muted",
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
				/>
			)}
			{loading ? (
				<div className="flex h-full w-full items-center justify-center bg-background">
					<MagicSpin spinning />
				</div>
			) : isDeleted ? (
				<Deleted data={displayData} showHeader={false} />
			) : (
				<div
					className={cn(
						"h-full overflow-auto transition-[background-color_0.4s_cubic-bezier(0.4,0,0.2,1)]",
						internalViewMode === "phone" &&
							"flex w-full items-center justify-center bg-muted",
					)}
				>
					<div
						className={cn(
							"m-auto h-full w-full flex-none transition-[width_0.4s_cubic-bezier(0.4,0,0.2,1),border-radius_0.4s_cubic-bezier(0.4,0,0.2,1),background-color_0.4s_cubic-bezier(0.4,0,0.2,1),box-shadow_0.4s_cubic-bezier(0.4,0,0.2,1)]",
							internalViewMode === "phone" &&
								"!my-5 h-[calc(100%-40px)] w-[416px] flex-none overflow-hidden rounded-lg border border-border bg-background shadow-[0_4px_14px_0_rgba(0,0,0,0.1),0_0_1px_0_rgba(0,0,0,0.3)]",
						)}
					>
						<EditorBody
							isLoading={isLoading}
							viewMode={internalViewMode as "code" | "markdown"}
							language={language}
							content={currentContent}
							processedContent={processedContent}
							className={cn(
								"h-full flex-1 overflow-auto whitespace-pre-wrap bg-background text-base [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5",
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
							placeholder={t("fileViewer.placeholder.content")}
						/>
					</div>
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
	)
})
