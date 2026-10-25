import MagicSpin from "@/components/base/MagicSpin"
import type { TextFileSession, TextReadOnlyPreview } from "../../types"
import DetailEmpty from "../../components/DetailEmpty"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { cn } from "@/utils/cn"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { TextSaveStatus } from "../../components/TextSaveStatus"
import { Input } from "antd"
import { useState, useEffect, useRef, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useAIEditMenuItems } from "@/pages/superMagic/components/Detail/components/EditToolbar/useAIEditMenuItems"
import { useIsMobile } from "@/hooks/useIsMobile"
import CommonFooter from "../../components/CommonFooter"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import useExportMenuItems from "../HTML/useExportMenuItems"
import { exportHtmlToImage, type ImageExportFormat } from "@magic-web/html2image"
import { textToHtml } from "../../../../utils/textToHtml"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"

export default function Text(props: any) {
	const textFileSession: TextFileSession | undefined = props.textFileSession
	const isTabActive: boolean = props.isTabActive ?? true
	const readOnlyPreview: TextReadOnlyPreview | undefined = props.readOnlyPreview
	const {
		type,
		data,
		updatedAt,
		attachmentList,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		documentFlowFullscreen = false,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		detailMode,
		isEditMode: requestedEditMode,
		saveEditContent,
		setIsEditMode,
		allowEdit,
		onRegisterSaveHandler,
		activeFileId,
		showFooter,
		showFileHeader = true,
		isPlaybackMode,
		allowDownload,
		attachments,
		exportFile,
		isExporting,
		headerRenderMode,
	} = props
	const isEditMode = !readOnlyPreview && requestedEditMode

	const { file_id } = data
	const { t } = useTranslation("super")

	const {
		loading: fileLoading,
		fileData: initialContent,
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
		enabled: !readOnlyPreview,
		loadContent: !textFileSession,
		isTabActive,
		file_id,
		updatedAt,
		isEditing: isEditMode,
		activeFileId,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})
	const isMobile = useIsMobile()
	const textAreaRef = useRef<any>(null)

	const [localContent, setContent] = useState<string>("")
	const content =
		readOnlyPreview?.content ??
		(fileVersion !== undefined
			? (initialContent ?? textFileSession?.content ?? "")
			: (textFileSession?.content ?? localContent))
	const loading = textFileSession?.loading ?? fileLoading
	const [localDraft, setLocalDraft] = useState<string>("")
	const editingContent = textFileSession?.draft ?? localDraft
	const setEditingContent = textFileSession?.setDraft ?? setLocalDraft

	// 初始化 content
	useEffect(() => {
		if (textFileSession || readOnlyPreview) return
		const displayContent = fileContent || initialContent
		setContent(displayContent || "")
	}, [fileContent, initialContent, textFileSession, readOnlyPreview])

	// 当进入编辑模式时，自动聚焦到 TextArea
	useEffect(() => {
		if (isEditMode && textAreaRef.current) {
			// 使用 setTimeout 确保 DOM 更新完成后再聚焦
			setTimeout(() => {
				textAreaRef.current?.focus()
			}, 100)
		}
	}, [isEditMode])

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (readOnlyPreview) return
		if (setIsEditMode) {
			setIsEditMode(true)
			// 初始化编辑内容
			if (!textFileSession) setEditingContent(content || "")
		}
	})

	const handleSave = useMemoizedFn(async () => {
		if (readOnlyPreview) return
		if (textFileSession) return textFileSession.save()
		if ((editingContent || editingContent === "") && editingContent !== content) {
			// 编辑器提交的是原始正文，关闭解码避免误处理正文中的协议前缀。
			const enable_shadow = false
			// Feedback is the top-right save chip, so skip the centered toast.
			await saveEditContent?.(
				editingContent,
				file_id,
				enable_shadow,
				fetchFileVersions,
				undefined,
				false,
				{ silent: true },
			)
			// 更新 content 状态
			setContent(editingContent)
		}
		// 不再退出编辑模式
	})

	// Register save handler when in edit mode
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	const handleSaveAndExit = useMemoizedFn(async () => {
		await handleSave()
		if (setIsEditMode) {
			setIsEditMode(false)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingContent("")
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingContent("")
	})

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (textFileSession) return
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const [isExportingImage, setIsExportingImage] = useState(false)

	const handleExportSource = useMemoizedFn(() => {
		exportFile?.(file_id, fileVersion)
	})

	const handleExportImage = useMemoizedFn(async (format: ImageExportFormat = "png") => {
		if (!content) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const toastKey = `text-image-export-${file_id || Date.now()}`
		setIsExportingImage(true)
		magicToast.loading({
			key: toastKey,
			content: t("topicFiles.exporting"),
			duration: 0,
		})

		try {
			const html = textToHtml(content, { language: "plaintext" })
			await exportHtmlToImage({
				pages: [html],
				format,
				fileName: (data?.file_name || "export").replace(/\.[^.]+$/, ""),
				onProgress: ({ phase, current, total }) => {
					if (phase !== "capture" || total <= 1) return
					magicToast.loading({
						key: toastKey,
						content: `${t("topicFiles.exporting")} (${current}/${total})`,
						duration: 0,
					})
				},
			}).promise
			magicToast.success({
				key: toastKey,
				content: t("topicFiles.exportSuccess"),
				duration: 1000,
			})
		} catch (error) {
			console.error("[image-export] Text export failed:", error)
			magicToast.destroy(toastKey)
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
		} finally {
			setIsExportingImage(false)
		}
	})

	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF: () => {},
		handleExportImage,
		isExporting: isExporting || isExportingImage,
		showButtonText: true,
		supportPPT: false,
		showExportImage: !readOnlyPreview,
		showExportPdf: false,
	})

	const aiEditMenuItems = useAIEditMenuItems({
		file: textFileSession ? data : undefined,
		attachmentList,
		fileId: data?.file_id,
		enabled:
			!readOnlyPreview &&
			!!allowEdit &&
			!isMobile &&
			!isEditMode &&
			isNewestVersion &&
			isTabActive,
	})

	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			overrides: readOnlyPreview
				? { refresh: { onClick: readOnlyPreview.refresh } }
				: textFileSession
					? {
							refresh: {
								onClick: textFileSession.refresh,
								disabled: loading || textFileSession.saving || isEditMode,
							},
						}
					: undefined,
			customActions: [
				{
					key: "text-export-dropdown",
					zone: "secondary",
					after: "download",
					visible: () => !readOnlyPreview && !isMobile && allowDownload !== false,
					render: () => ExportDropdownButton,
				},
				{
					key: "text-edit-actions",
					zone: "secondary",
					before: "refresh",
					visible: () =>
						Boolean(
							!readOnlyPreview &&
							setIsEditMode &&
							allowEdit &&
							!isMobile &&
							file_id &&
							isNewestVersion,
						),
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
								textFileSession
									? () => handleSave().catch(() => undefined)
									: handleSave
							}
							onSaveAndExit={
								textFileSession
									? () => handleSaveAndExit().catch(() => undefined)
									: handleSaveAndExit
							}
							onCancel={handleCancel}
						/>
					),
				},
			],
		}),
		[
			textFileSession,
			loading,
			isTabActive,
			readOnlyPreview,
			allowDownload,
			allowEdit,
			isMobile,
			data?.file_id,
			isEditMode,
			isNewestVersion,
			attachmentList,
			setIsEditMode,
			file_id,
			ExportDropdownButton,
			handleEdit,
			handleSave,
			handleSaveAndExit,
			handleCancel,
		],
	)

	const headerContext = {
		type,
		onFullscreen,
		onDownload: () => onDownload?.(file_id, readOnlyPreview ? data.file_version : fileVersion),
		isFromNode,
		isFullscreen,
		viewMode,
		onViewModeChange,
		onCopy: readOnlyPreview ? undefined : onCopy,
		fileContent: readOnlyPreview ? content : fileContent || content,
		currentFile,
		detailMode,
		showDownload: Boolean(readOnlyPreview) && allowDownload !== false,
		isEditMode,
		fileVersion,
		isNewestFileVersion: isNewestVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		quitEditMode,
		allowEdit,
		actionConfig: headerActionConfig,
		extraMoreMenuItems: aiEditMenuItems,
		attachments,
		renderMode: headerRenderMode,
	}

	const preview = (
		<div
			className={cn(
				documentFlowFullscreen
					? "flex min-h-dvh flex-col overflow-visible"
					: "flex h-full flex-col",
			)}
		>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{!readOnlyPreview && (
				<TextSaveStatus fileId={file_id} textFileSession={textFileSession} />
			)}
			{textFileSession?.loadError || fileLoadError ? (
				<DetailEmpty
					title={t("common.fileNotFoundOrLoadFailed")}
					onRetry={textFileSession?.refresh ?? refreshFile}
				/>
			) : textFileSession && loading ? (
				<div
					data-testid="text-file-session-loading"
					className="flex min-h-0 flex-1 items-center justify-center bg-background"
				>
					<MagicSpin spinning />
				</div>
			) : isEditMode ? (
				<Input.TextArea
					ref={textAreaRef}
					disabled={textFileSession?.saving}
					value={editingContent}
					onChange={(e) => {
						setEditingContent(e.target.value)
					}}
					style={{
						height: "100%",
						minHeight: "400px",
						resize: "none",
						fontSize: "14px",
						padding: 12,
						lineHeight: "20px",
						borderRadius: "0 0 12px 12px",
						border: "none",
						outline: "none",
					}}
					placeholder={t("common.enterText") || "Enter text..."}
				/>
			) : isDeleted ? (
				<Deleted data={data} showHeader={false} />
			) : (
				<div
					key={data.id}
					className={cn(
						documentFlowFullscreen
							? "min-h-dvh overflow-visible p-3"
							: "h-[calc(100%-40px)] overflow-y-auto overflow-x-hidden p-3",
						"whitespace-pre-wrap break-words text-sm leading-5 text-foreground",
						"bg-background",
					)}
				>
					{content}
				</div>
			)}
			{/* 底部 */}
			{showFooter && !readOnlyPreview && (
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

	// 只读仅限制内容修改与历史还原；继承分享、下载等原有权限。
	return readOnlyPreview ? (
		<FileAccessProvider options={{ versionHistory: false }}>{preview}</FileAccessProvider>
	) : (
		preview
	)
}
