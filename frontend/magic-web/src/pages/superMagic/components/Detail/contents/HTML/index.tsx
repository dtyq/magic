import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import IsolatedHTMLRenderer, { type IsolatedHTMLRendererRef } from "./IsolatedHTMLRenderer"
import {
	createParentMessageHandler,
	injectFetchInterceptorScript,
	injectKeyboardInterceptorScript,
	createKeyboardMessageHandler,
	type FileItem,
} from "./utils/fetchInterceptor"
import { createNestedIframeContentHandler } from "./utils/nested-iframe-content"
import type { SaveResult } from "./iframe-bridge/types"
import { useStyles } from "./styles"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { processHtmlContent } from "./htmlProcessor"
import { flattenAttachments, resolveRelativePath } from "./utils"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { Flex, Tour } from "antd"
import { shadow } from "@/utils/shadow"
import CodeEditor from "@/components/base/CodeEditor"
import { parseAnchorLink, scrollToAnchor } from "@/utils/slug"
import {
	HTMLGuideTourElementId,
	useHTMLGuideTour,
} from "@/pages/superMagic/hooks/useHTMLGuideTour"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MagicSpin from "@/components/base/MagicSpin"
import DashboardIsolatedHTMLRenderer from "./dashboard/DashboardIsolatedHTMLRenderer"
import AIEditButton from "@/pages/superMagic/components/Detail/components/EditToolbar/AIEditButton"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import CommonFooter from "../../components/CommonFooter"
import { useIsMobile } from "@/hooks/useIsMobile"
import useExportMenuItems from "./useExportMenuItems"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import useShareButtonVisibility from "../../hooks/useShareButtonVisibility"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"

interface HTMLProps {
	data: string | any
	attachments?: any[]
	type?: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: (fileId?: string, fileVersion?: number) => void
	totalFiles?: number
	userSelectDetail?: any
	hasUserSelectDetail?: boolean
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	isFullscreen?: boolean
	attachmentList?: any[]
	isEditMode?: boolean
	setIsEditMode?: (isEditMode: boolean) => void
	saveEditContent?: (
		data: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
	) => Promise<void>
	allowEdit?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: (fileVersion?: number, fileId?: string) => void
	fileContent?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	updatedAt?: string
	detailMode?: "single" | "files"
	metadata?: any
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	exportFile?: (fileId: string, fileVersion?: number) => void
	exportPdf?: (fileId: string) => void
	exportPpt?: (fileId: string) => void
	isExporting?: boolean
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	showFileHeader?: boolean
	activeFileId?: string | null
	showFooter?: boolean
	onRefreshFile?: () => void
	isPlaybackMode?: boolean
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
	isInPPTMode?: boolean
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	projectId?: string
}

interface HtmlExportActionProps {
	handleExportSource: () => void
	handleExportPDF: () => void
	handleExportPPT: () => void
	isExporting?: boolean
	supportPPT: boolean
	showButtonText: boolean
}

const HtmlExportAction = memo(function HtmlExportAction({
	handleExportSource,
	handleExportPDF,
	handleExportPPT,
	isExporting,
	supportPPT,
	showButtonText,
}: HtmlExportActionProps) {
	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF,
		handleExportPPT,
		isExporting,
		showButtonText,
		supportPPT,
	})

	return ExportDropdownButton
})

export default memo(function HTML(props: HTMLProps) {
	const {
		data: displayData,
		attachments,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		attachmentList,
		isEditMode,
		setIsEditMode,
		saveEditContent,
		allowEdit,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		className,
		updatedAt,
		detailMode,
		metadata,
		openFileTab,
		exportFile,
		exportPdf,
		exportPpt,
		isExporting,
		selectedProject,
		selectedTopic,
		showFileHeader = true,
		activeFileId,
		showFooter,
		onRefreshFile,
		isPlaybackMode = false,
		onRegisterSaveHandler,
		isInPPTMode = false,
		allowDownload,
	} = props

	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()

	const [processedContent, setProcessedContent] = useState<string>("")
	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map()) // 记录文件的相对路径和替换后的url映射关系
	const [saveFunction, setSaveFunction] = useState<
		(() => Promise<SaveResult | undefined>) | (() => void) | null
	>(null) // 保存函数
	const [renderKey, setRenderKey] = useState(0)
	/** 当前展示的 HTML 文件的数据 */
	const [data, setData] = useState<any>({})
	const [editingCodeContent, setEditingCodeContent] = useState<string>("")
	/** 是否正处于编辑后的状态 */
	const [isEditingAfter, setIsEditingAfter] = useState(false)

	const {
		fileData: htmlFileData,
		fileVersion: htmlFileVersion,
		changeFileVersion: changeHtmlFileVersion,
		loading,
		fetchFileVersions: fetchHtmlFileVersions,
		fileVersionsList: htmlFileVersionsList,
		handleVersionRollback: handleHtmlVersionRollback,
		isNewestVersion: htmlIsNewestVersion,
		isDeleted: htmlIsDeleted,
	} = useFileData({
		file_id: displayData?.file_id || "",
		isEditing: isEditMode,
		updatedAt,
		activeFileId,
		isFromNode,
		content: displayData?.content || "",
		disabledUrlCache: isPlaybackMode,
	})

	// 判断是否为数据分析模式
	const isDataAnalysis = useMemo(() => {
		const file = attachmentList?.find((item: any) => item.file_id === displayData?.file_id)
		let parent
		if (file?.parent_id) {
			parent = attachmentList?.find((item: any) => item.file_id === file.parent_id)
		}
		return parent?.metadata?.type === "dashboard"
	}, [attachmentList, displayData?.file_id])

	/** 更新HTML文件的数据内容 */
	const updateDataContent = useMemoizedFn((fileData: any) => {
		const newData = {
			...displayData,
			content: fileData || displayData?.content,
		}
		if (data.content !== newData.content) {
			setData(newData)
		}
	})

	useDeepCompareEffect(() => {
		// 如果正处于编辑后的状态，则不进行content更新，避免页面内容发生闪动
		if (isEditingAfter) {
			setIsEditingAfter(false)
			return
		}
		updateDataContent(htmlFileData)
	}, [htmlFileData])

	/** 处理代码预览模式 */
	useEffect(() => {
		if (viewMode === "code") {
			const newData = {
				...displayData,
				content: htmlFileData || displayData?.content,
			}
			setData(newData)
		} else {
			updateDataContent(htmlFileData)
		}
	}, [viewMode, htmlFileData, displayData, updateDataContent])

	// IsolatedHTMLRenderer 的 ref，用于获取拦截回调函数
	const htmlRendererRef = useRef<IsolatedHTMLRendererRef>(null)

	// 创建消息处理器并注册/移除监听器（即使没有 attachments 也要注册）
	useEffect(() => {
		// 获取当前HTML文件的相对文件夹路径
		let htmlRelativeFolderPath = "/"
		const currentFileId = displayData?.file_id
		if (currentFileId && attachmentList && attachmentList.length > 0) {
			const currentFile = attachmentList.find((item) => item.file_id === currentFileId)
			if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
				// 从relative_file_path中去掉file_name，得到文件夹路径
				htmlRelativeFolderPath = currentFile.relative_file_path.replace(
					currentFile.file_name,
					"",
				)
			}
		}
		// 即使没有 attachments 也创建空数组，确保拦截器能正常工作
		const allFiles = attachmentList ? (flattenAttachments(attachmentList) as FileItem[]) : []

		// 获取拦截回调函数
		const onFetchIntercepted = htmlRendererRef.current?.getFetchInterceptedCallback()

		// 创建新的消息处理器，传入 fileId 和回调函数
		const messageHandler = createParentMessageHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
			onFetchIntercepted,
		)

		// 处理嵌套 HTML iframe 内容请求
		const nestedIframeHandler = createNestedIframeContentHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
			attachmentList || [],
		)

		// 处理来自 iframe 的键盘快捷键消息
		const keyboardMessageHandler = createKeyboardMessageHandler({
			onSave: handleSave,
			onSaveAndExit: handleSaveAndExit,
			onCancel: handleCancel,
		})

		window.addEventListener("message", messageHandler)
		window.addEventListener("message", nestedIframeHandler)
		window.addEventListener("message", keyboardMessageHandler)

		return () => {
			window.removeEventListener("message", messageHandler)
			window.removeEventListener("message", nestedIframeHandler)
			window.removeEventListener("message", keyboardMessageHandler)
		}
	}, [attachmentList, displayData?.file_id])

	const processContent = useMemoizedFn(async () => {
		try {
			const result = await processHtmlContent({
				content: data?.content,
				attachments,
				fileId: displayData?.file_id,
				fileName: data?.file_name,
				attachmentList,
				metadata: metadata,
			})

			let finalProcessedContent = result.processedContent

			// 注入fetch拦截器脚本（默认启用）
			// 注意：media拦截器现在在htmlProcessor中根据metadata.type自动注入
			finalProcessedContent = injectFetchInterceptorScript(finalProcessedContent, {
				fileId: displayData?.file_id || "",
			})

			// 在编辑模式下注入键盘快捷键拦截器
			if (isEditMode) {
				finalProcessedContent = injectKeyboardInterceptorScript(finalProcessedContent)
			}

			console.log("processContent result", result)
			console.log("processContent metadata", metadata)

			setProcessedContent(finalProcessedContent)
			setFilePathMapping(result.filePathMapping)
		} catch (error) {
			console.error("Error processing HTML content:", error)
			setProcessedContent(data?.content || "")
		}
	})

	useDeepCompareEffect(() => {
		if (!data?.content) return
		processContent()
	}, [data, metadata, attachmentList, isEditMode])

	// AI modification detection is now handled by PPTStore internally
	// This logic has been removed to simplify the component

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(true)
			// 初始化编辑内容
			setEditingCodeContent(data?.content || "")
		}
	})

	const handleSave = useMemoizedFn(async () => {
		setIsEditingAfter(true)
		if (viewMode === "code" && editingCodeContent) {
			// 保存代码编辑内容
			await saveEditContent?.(
				shadow(editingCodeContent),
				displayData?.file_id,
				true,
				fetchHtmlFileVersions,
			)
			setData((prev: any) => ({
				...prev,
				content: editingCodeContent,
			}))
		} else if (saveFunction) {
			const result = await saveFunction()
			if (result && !result.success) {
				console.error("[HTML Editor] 保存失败", result)
			}
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

	const handleCancel = useMemoizedFn(async () => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		if (viewMode === "code") {
			setData((prev: any) => ({
				...prev,
				content: data?.content,
			}))
			return
		}
		setRenderKey((prev) => prev + 1)
		onRefreshFile?.()
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingCodeContent("")
	})

	// 用于接收保存函数的回调
	const onSaveReady = useCallback(
		(triggerSave: () => Promise<SaveResult | undefined> | (() => void)) => {
			setSaveFunction(() => triggerSave)
		},
		[],
	)

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const openNewTab = (fileId: string, path: string, autoEdit?: boolean) => {
		// 防护检查：fileId 不能为空
		if (!fileId) {
			console.warn("openNewTab: fileId is empty, cannot open new tab")
			return
		}

		// Parse anchor from path
		const { filePath, anchor } = parseAnchorLink(path)

		// Handle pure anchor link (navigation within current document)
		if (!filePath && anchor) {
			scrollToAnchor(anchor, 80) // 80px offset for fixed headers
			return
		}

		const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)

		// 防护检查：必须找到对应的文件项
		if (!fileItem || !fileItem.relative_file_path || !fileItem.file_name) {
			console.warn("openNewTab: fileItem not found or missing required fields", {
				fileId,
				fileItem,
			})
			return
		}

		const relativePath = fileItem.relative_file_path.replace(fileItem.file_name, "")
		const newPath = resolveRelativePath(relativePath, filePath)
		const item = attachmentList?.find((item: any) => item.relative_file_path === newPath)
		if (item) {
			openFileTab?.(item, autoEdit)

			// If there's an anchor, scroll to it after document loads
			if (anchor) {
				// Wait for document to render before scrolling
				setTimeout(() => {
					scrollToAnchor(anchor, 80)
				}, 300) // Adjust delay as needed
			}
		}
	}

	const handleExportSource = useMemoizedFn(() => {
		exportFile?.(displayData?.file_id, htmlFileVersion)
	})

	const handleExportPDF = useMemoizedFn(() => {
		exportPdf?.(displayData?.file_id)
	})

	const handleExportPPT = useMemoizedFn(() => {
		exportPpt?.(displayData?.file_id)
	})

	const relative_file_path = useMemo(() => {
		const path = attachmentList?.find(
			(item: any) => item.file_id === displayData?.file_id,
		)?.relative_file_path

		return path?.replace(displayData?.file_name, "")
	}, [attachmentList, displayData])

	const handleDownload = useMemoizedFn(() => {
		onDownload?.(displayData?.file_id, htmlFileVersion)
	})

	/** 是否为媒体场景（audio/video） */
	const isMediaScenario = metadata?.type === "audio" || metadata?.type === "video"

	/** 是否显示 AI编辑 按钮 */
	const showAIOptimizationButton = useMemo(() => {
		// 当 metadata.type 为 audio/video 时，隐藏 AI 编辑按钮
		if (isMediaScenario) {
			return false
		}
		return !isMobile && allowEdit && !isEditMode && htmlIsNewestVersion
	}, [isMediaScenario, isMobile, allowEdit, isEditMode, htmlIsNewestVersion])

	/** 是否显示 在线编辑 按钮 */
	const showFileEditButton = useMemo(() => {
		// 当 metadata.type 为 audio/video 时，隐藏编辑按钮
		if (isMediaScenario) {
			return false
		}
		return (
			setIsEditMode &&
			allowEdit &&
			!isMobile &&
			(saveFunction !== null || viewMode === "code") &&
			displayData?.file_id &&
			htmlIsNewestVersion
		)
	}, [
		isMediaScenario,
		setIsEditMode,
		allowEdit,
		isMobile,
		saveFunction,
		viewMode,
		displayData?.file_id,
		htmlIsNewestVersion,
	])

	/** 使用分享按钮可见性控制 Hook */
	const { showDownloadButton, showExportButton } = useShareButtonVisibility({
		allowDownload,
		isMediaScenario,
		isMobile,
		allowEdit,
		isEditMode,
	})

	const { guideTourOpen, setGuideTourOpen, guideTourSteps } = useHTMLGuideTour({
		isMobile,
	})

	// 通知在线编辑按钮已准备好
	useEffect(() => {
		if (showFileEditButton) {
			pubsub.publish(
				PubSubEvents.GuideTourHTMLElementReady,
				HTMLGuideTourElementId.HTMLFileEditButton,
			)
		}
		if (showAIOptimizationButton) {
			pubsub.publish(
				PubSubEvents.GuideTourHTMLElementReady,
				HTMLGuideTourElementId.AIOptimizationButton,
			)
		}
	}, [showFileEditButton, showAIOptimizationButton])

	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			customActions: [
				{
					key: "html-toolbar-actions",
					zone: "primary",
					visible: () => Boolean(showAIOptimizationButton || showFileEditButton),
					render: () => (
						<div className="flex items-center gap-1">
							{showAIOptimizationButton && !isEditMode && (
								<AIEditButton
									showButtonText
									attachmentList={attachmentList}
									fileId={displayData?.file_id}
								/>
							)}
							{showFileEditButton && (
								<FileEditButtons
									isEditMode={isEditMode}
									isSaving={false}
									showButtonText
									onEdit={handleEdit}
									onSave={handleSave}
									onSaveAndExit={handleSaveAndExit}
									onCancel={handleCancel}
								/>
							)}
						</div>
					),
				},
				{
					key: "html-export-dropdown",
					zone: "secondary",
					after: "download",
					visible: () => Boolean(showExportButton),
					render: (context) => (
						<HtmlExportAction
							handleExportSource={handleExportSource}
							handleExportPDF={handleExportPDF}
							handleExportPPT={handleExportPPT}
							isExporting={isExporting}
							supportPPT={isInPPTMode}
							showButtonText={context.showButtonText}
						/>
					),
				},
			],
		}),
		[
			attachmentList,
			displayData?.file_id,
			handleCancel,
			handleEdit,
			handleExportPDF,
			handleExportPPT,
			handleExportSource,
			handleSave,
			isExporting,
			isEditMode,
			isInPPTMode,
			showAIOptimizationButton,
			showExportButton,
			showFileEditButton,
		],
	)

	const headerContext = {
		type,
		onFullscreen,
		onDownload: handleDownload,
		isFromNode,
		isFullscreen,
		viewMode,
		onViewModeChange,
		onCopy: (targetFileVersion?: number) =>
			onCopy?.(targetFileVersion || htmlFileVersionsList[0]?.version, displayData?.file_id),
		fileContent: fileContent || processedContent,
		currentFile,
		detailMode,
		showDownload: showDownloadButton && !showExportButton,
		isEditMode,
		fileVersion: htmlFileVersion,
		isNewestFileVersion: htmlIsNewestVersion,
		showRefreshButton: true,
		changeFileVersion: changeHtmlFileVersion,
		fileVersionsList: htmlFileVersionsList,
		handleVersionRollback: handleHtmlVersionRollback,
		quitEditMode,
		allowEdit,
		attachments,
		actionConfig: headerActionConfig,
	}

	return (
		<div className={cx(styles.htmlContainer, className)}>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{loading ? (
				<Flex
					justify="center"
					align="center"
					style={{ height: "100%", width: "100%", backgroundColor: "white" }}
				>
					<MagicSpin spinning />
				</Flex>
			) : viewMode === "code" ? (
				<div className={styles.htmlBody}>
					<CodeEditor
						content={data?.content || ""}
						fileName={data?.file_name || data?.title || "file.html"}
						isEditMode={isEditMode}
						onChange={(value) => setEditingCodeContent(value)}
						height="100%"
						showLineNumbers={true}
						theme="light"
					/>
				</div>
			) : (
				<div
					className={cx(styles.previewContainerBase, {
						[styles.phoneModeContainer]: viewMode === "phone",
					})}
				>
					<div
						className={cx(styles.previewInnerBase, styles.htmlBody, {
							[styles.phoneModeInner]: viewMode === "phone",
						})}
					>
						{isDataAnalysis ? (
							<DashboardIsolatedHTMLRenderer
								key={`dashboard-html-${renderKey}`}
								content={processedContent}
								className={className}
								isEditMode={isEditMode || false}
								onSaveReady={onSaveReady as (triggerSave: () => void) => void}
								attachments={attachments}
								attachmentList={attachmentList}
								currentFileId={displayData?.file_id}
								currentFileName={data?.file_name}
							/>
						) : htmlIsDeleted ? (
							<Deleted data={displayData} showHeader={false} />
						) : (
							<IsolatedHTMLRenderer
								ref={htmlRendererRef}
								key={`html-${renderKey}`}
								content={processedContent}
								sandboxType="iframe"
								isPptRender={isInPPTMode}
								isFullscreen={isFullscreen}
								isEditMode={isEditMode}
								saveEditContent={saveEditContent}
								onSaveReady={onSaveReady}
								fileId={displayData?.file_id}
								filePathMapping={filePathMapping}
								openNewTab={openNewTab}
								relative_file_path={relative_file_path}
								selectedProject={selectedProject}
								attachmentList={attachmentList}
								isPlaybackMode={isPlaybackMode}
							/>
						)}
					</div>
				</div>
			)}
			{/* 底部 */}
			{showFooter && (
				<CommonFooter
					fileVersion={htmlFileVersion}
					changeFileVersion={changeHtmlFileVersion}
					fileVersionsList={htmlFileVersionsList}
					handleVersionRollback={handleHtmlVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={isEditMode}
				/>
			)}

			<Tour
				steps={guideTourSteps}
				open={guideTourOpen}
				onClose={() => setGuideTourOpen(false)}
				gap={{
					radius: 8,
				}}
			/>
		</div>
	)
})
