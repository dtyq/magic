import type { TextFileSession } from "../../types"
import DetailEmpty from "../../components/DetailEmpty"
import CommonHeaderV2 from "@/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { useStyles } from "./style"
import { Flex } from "antd"
import { useMemo, useState, useEffect, useRef, type RefObject, type ReactNode } from "react"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import CodeEditor from "@/components/base/CodeEditor"
import { shadow } from "@/utils/shadow"
import { useMemoizedFn } from "ahooks"
import { useAIEditMenuItems } from "@/pages/superMagic/components/Detail/components/EditToolbar/useAIEditMenuItems"
import CommonFooter from "../../components/CommonFooter"
import { TextSaveStatus } from "../../components/TextSaveStatus"
import { useIsMobile } from "@/hooks/useIsMobile"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import type { HeaderActionConfig } from "@/pages/superMagic/components/Detail/components/CommonHeaderV2/types"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import useExportMenuItems from "../HTML/useExportMenuItems"
import { exportHtmlToImage, type ImageExportFormat } from "@magic-web/html2image"
import { textToHtml } from "../../../../utils/textToHtml"
import MagicSpin from "@/components/base/MagicSpin"

export interface CodeViewerExtensionContext {
	fileName: string
	content: string
	displayContent: string
	scopeRef: RefObject<HTMLElement>
}

export type CodeViewerExtensionRenderer = (context: CodeViewerExtensionContext) => ReactNode

export default function CodeViewer(props: any) {
	const textFileSession: TextFileSession | undefined = props.textFileSession
	const isTabActive: boolean = props.isTabActive ?? true
	const {
		data,
		attachments,
		attachmentList,
		file_name,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		documentFlowFullscreen = false,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		className,
		updatedAt,
		detailMode,
		isEditMode,
		saveEditContent,
		setIsEditMode,
		allowEdit,
		onRegisterSaveHandler,
		showFileHeader = true,
		activeFileId,
		showFooter,
		isPlaybackMode,
		allowDownload,
		exportFile,
		isExporting,
		renderExtensions,
	} = props

	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const extensionScopeRef = useRef<HTMLDivElement>(null)

	const { content: displayContent, file_id } = data

	const {
		fileData,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		fetchFileVersions,
		isNewestVersion,
		isDeleted,
		loadError: fileLoadError,
		refreshFile,
		loading: fileLoading,
	} = useFileData({
		enabled: true,
		loadContent: !textFileSession,
		isTabActive,
		file_id,
		updatedAt,
		isEditing: isEditMode,
		activeFileId,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})

	const [localContent, setContent] = useState<string>("")
	const content =
		fileVersion !== undefined
			? (fileData ?? textFileSession?.content ?? "")
			: (textFileSession?.content ?? localContent)
	const loading = textFileSession?.loading ?? fileLoading
	const [localDraft, setLocalDraft] = useState<string>("")
	const editingCodeContent = textFileSession?.draft ?? localDraft
	const setEditingCodeContent = textFileSession?.setDraft ?? setLocalDraft
	const isPureShareCodePreview = documentFlowFullscreen && !isEditMode
	// Use the fetched value immediately so pure-share rendering does not wait for state mirroring.
	const pureShareCodeContent = displayContent || fileData || content

	// 初始化 content
	useEffect(() => {
		if (textFileSession) return
		const initialContent = displayContent ? displayContent : fileData
		setContent(initialContent || "")
	}, [displayContent, fileData])

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(true)
			// 初始化编辑内容
			if (!textFileSession) setEditingCodeContent(content || "")
		}
	})

	const handleSave = useMemoizedFn(async () => {
		if (textFileSession) return textFileSession.save()
		if (editingCodeContent && editingCodeContent !== content) {
			// 保存代码编辑内容，使用 shadow 函数加密
			const enable_shadow = true
			// Feedback is the top-right save chip, so skip the centered toast.
			await saveEditContent?.(
				shadow(editingCodeContent),
				file_id,
				enable_shadow,
				fetchFileVersions,
				undefined,
				false,
				{ silent: true },
			)
			// 更新 content 状态
			setContent(editingCodeContent)
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
		setEditingCodeContent("")
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingCodeContent("")
	})

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (textFileSession) return
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const [isExportingImage, setIsExportingImage] = useState(false)

	const handleExportSource = useMemoizedFn(() => {
		exportFile?.(file_id, fileVersion)
	})

	const handleExportImage = useMemoizedFn(async (format: ImageExportFormat = "png") => {
		const currentContent = content || displayContent
		if (!currentContent) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const toastKey = `code-image-export-${file_id || Date.now()}`
		setIsExportingImage(true)
		magicToast.loading({
			key: toastKey,
			content: t("topicFiles.exporting"),
			duration: 0,
		})

		try {
			// Derive language from file extension
			const ext = (file_name || "").split(".").pop() || "plaintext"
			const html = textToHtml(currentContent, { language: ext })
			await exportHtmlToImage({
				pages: [html],
				format,
				fileName: (file_name || "export").replace(/\.[^.]+$/, ""),
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
			console.error("[image-export] Code export failed:", error)
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
		showExportImage: true,
		showExportPdf: false,
	})

	const aiEditMenuItems = useAIEditMenuItems({
		file: textFileSession ? data : undefined,
		attachmentList,
		fileId: data?.file_id,
		enabled: !!allowEdit && !isMobile && !isEditMode && isNewestVersion && isTabActive,
	})

	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			overrides: textFileSession
				? {
						refresh: {
							onClick: textFileSession.refresh,
							disabled: loading || textFileSession.saving || isEditMode,
						},
					}
				: undefined,
			customActions: [
				{
					key: "code-export-dropdown",
					zone: "secondary",
					after: "download",
					visible: () => !isMobile && allowDownload !== false,
					render: () => ExportDropdownButton,
				},
				{
					key: "code-edit-actions",
					zone: "secondary",
					before: "refresh",
					visible: () =>
						Boolean(
							setIsEditMode && allowEdit && !isMobile && file_id && isNewestVersion,
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
			allowDownload,
			allowEdit,
			attachmentList,
			data?.file_id,
			file_id,
			ExportDropdownButton,
			handleCancel,
			handleEdit,
			handleSave,
			isEditMode,
			isMobile,
			isNewestVersion,
			setIsEditMode,
		],
	)

	const headerContext = useMemo(
		() => ({
			type,
			onFullscreen,
			onDownload: () => onDownload(file_id, fileVersion),
			isFromNode,
			isFullscreen,
			viewMode,
			onViewModeChange,
			onCopy,
			fileContent: fileContent || content,
			currentFile,
			detailMode,
			showDownload: false,
			isEditMode,
			fileVersion,
			isNewestFileVersion: isNewestVersion,
			changeFileVersion,
			fileVersionsList,
			handleVersionRollback,
			quitEditMode,
			allowEdit,
			attachments,
			actionConfig: headerActionConfig,
			extraMoreMenuItems: aiEditMenuItems,
		}),
		[
			aiEditMenuItems,
			allowDownload,
			allowEdit,
			attachments,
			changeFileVersion,
			content,
			currentFile,
			detailMode,
			fileContent,
			file_id,
			fileVersion,
			fileVersionsList,
			handleVersionRollback,
			isEditMode,
			isFromNode,
			isFullscreen,
			isNewestVersion,
			onCopy,
			onDownload,
			onFullscreen,
			onViewModeChange,
			quitEditMode,
			type,
			viewMode,
			headerActionConfig,
		],
	)

	return (
		<Flex
			ref={extensionScopeRef}
			vertical
			className={cx(styles.container, className)}
			style={
				documentFlowFullscreen
					? { height: "auto", minHeight: "100dvh", overflow: "visible" }
					: undefined
			}
			tabIndex={-1}
		>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			<TextSaveStatus fileId={file_id} textFileSession={textFileSession} />
			{textFileSession?.loadError || fileLoadError ? (
				<DetailEmpty
					title={t("common.fileNotFoundOrLoadFailed")}
					onRetry={textFileSession?.refresh ?? refreshFile}
				/>
			) : textFileSession && loading ? (
				<Flex
					flex={1}
					align="center"
					justify="center"
					className="min-h-0 bg-background"
					data-testid="text-file-session-loading"
				>
					<MagicSpin spinning />
				</Flex>
			) : isPureShareCodePreview ? (
				loading ? (
					<Flex
						align="center"
						justify="center"
						className="min-h-dvh w-full bg-background"
					>
						<MagicSpin spinning />
					</Flex>
				) : isDeleted ? (
					<Deleted data={data} showHeader={false} />
				) : (
					<pre className="m-0 min-h-dvh w-full overflow-visible whitespace-pre-wrap break-words bg-background p-4 font-mono text-sm leading-6 text-foreground">
						<code>{pureShareCodeContent}</code>
					</pre>
				)
			) : isEditMode ? (
				<CodeEditor
					content={textFileSession?.draft ?? content ?? ""}
					fileName={file_name || "file"}
					isEditMode={isEditMode}
					onChange={(value) => {
						setEditingCodeContent(value)
					}}
					height="100%"
					showLineNumbers={true}
					editorOptions={textFileSession?.saving ? { readOnly: true } : undefined}
					theme="light"
				/>
			) : isDeleted ? (
				<Deleted data={data} showHeader={false} />
			) : (
				<CodeEditor
					fileName={file_name || "file"}
					isEditMode={false}
					content={content || ""}
					theme="light"
				/>
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
			{renderExtensions?.({
				fileName: file_name || data?.file_name || "file",
				content,
				displayContent: displayContent || "",
				scopeRef: extensionScopeRef,
			})}
		</Flex>
	)
}
