import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isConvertibleFile } from "../../utils/file"
import IsolatedHTMLRenderer, { type IsolatedHTMLRendererRef } from "./IsolatedHTMLRenderer"
import {
	createParentMessageHandler,
	injectFetchInterceptorScript,
	injectKeyboardInterceptorScript,
	createKeyboardMessageHandler,
	POST_MESSAGE_TARGET_STRATEGIES,
	type FileItem,
} from "./utils/fetchInterceptor"
import { createNestedIframeContentHandler } from "./utils/nested-iframe-content"
import type { SaveResult } from "./iframe-bridge/types"
import { useStyles } from "./styles"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { processHtmlContent, type HtmlPreviewBundledTemplateKind } from "./htmlProcessor"
import {
	attemptHtmlSaveFlow,
	confirmHtmlConflictSave,
	resolveRelativePath,
	resolveServerUpdateState,
} from "./utils"
import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { Flex, Tour } from "antd"
import { shadow } from "@/utils/shadow"
import CodeEditor from "@/components/base/CodeEditor"
import { parseAnchorLink, scrollToAnchor } from "@/utils/slug"
import { HTMLGuideTourElementId, useHTMLGuideTour } from "@/pages/superMagic/hooks/useHTMLGuideTour"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MagicSpin from "@/components/base/MagicSpin"
import DashboardIsolatedHTMLRenderer from "./dashboard/DashboardIsolatedHTMLRenderer"
import { inlineDashboardDataJs } from "./dashboard/resourceVersioning"
import { useDashboardVersioning } from "./dashboard/useDashboardVersioning"
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
import useServerUpdate from "../../hooks/useServerUpdate"
import CodeVersionCompareDialog from "../../components/versioning/CodeVersionCompareDialog"
import VersionCompareDialog from "../../components/versioning/VersionCompareDialog"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { env } from "@/utils/env"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"

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
	displayConfig?: any
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	exportFile?: (fileId: string, fileVersion?: number) => void
	exportPdf?: (fileId: string) => void
	exportPpt?: (fileId: string) => void
	exportPptx?: (fileId: string) => void
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
	handleExportPptx: () => void
	isExporting?: boolean
	supportPPT: boolean
	showButtonText: boolean
	showExportPptx?: boolean
}

const HtmlExportAction = memo(function HtmlExportAction({
	handleExportSource,
	handleExportPDF,
	handleExportPPT,
	handleExportPptx,
	isExporting,
	supportPPT,
	showButtonText,
	showExportPptx,
}: HtmlExportActionProps) {
	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF,
		handleExportPPT,
		handleExportPptx,
		isExporting,
		showButtonText,
		supportPPT,
		showExportPptx,
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
		displayConfig: externalDisplayConfig,
		openFileTab,
		exportFile,
		exportPdf,
		exportPpt,
		exportPptx,
		isExporting,
		selectedProject,
		showFileHeader = true,
		activeFileId,
		showFooter,
		onRefreshFile,
		isPlaybackMode = false,
		onRegisterSaveHandler,
		isInPPTMode = false,
		allowDownload,
	} = props

	const displayConfig = displayData?.display_config || externalDisplayConfig
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const isImmersiveLayout = !showFileHeader && !showFooter
	// 通过 previewPolicy 声明能力，详情页消费配置
	const previewPolicy = displayData?.display_config?.previewPolicy
	const isReadonlyPreview = previewPolicy?.readonly === true
	const remoteHtmlFileId =
		previewPolicy?.keepLocalContent === true ? "" : displayData?.file_id || ""

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
	const [serverUpdatedContent, setServerUpdatedContent] = useState<string>()
	const editSessionUpdatedAtRef = useRef<string | undefined>(undefined)
	const serverUpdateRequestIdRef = useRef(0)
	const editSessionBaselineContentRef = useRef<string | null>(null)
	// Tracks the last successful local save so the follow-up refresh is not treated as an external update.
	const lastLocalSavedContentRef = useRef<string | null>(null)
	const pendingSaveIntentRef = useRef<"save" | "save-and-exit" | null>(null)

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
		file_id: remoteHtmlFileId,
		isEditing: isEditMode,
		updatedAt,
		activeFileId,
		isFromNode,
		content: displayData?.content || "",
		disabledUrlCache: isPlaybackMode,
	})

	const {
		allAttachmentItems,
		flattenedAttachmentList,
		isDataAnalysis,
		dashboardDataJsFile,
		dashboardDataJsContent,
		activeHistory,
		resourceFileVersions,
		fetchDashboardDataJsFileVersions,
	} = useDashboardVersioning({
		attachmentList,
		displayData,
		displayConfig,
		isFromNode,
		isPlaybackMode,
		htmlVersioning: {
			fileVersion: htmlFileVersion,
			changeFileVersion: changeHtmlFileVersion,
			fileVersionsList: htmlFileVersionsList,
			handleVersionRollback: handleHtmlVersionRollback,
			isNewestVersion: htmlIsNewestVersion,
			loading,
		},
	})

	/** 头部刷新：拉取 HTML / data.js 版本列表；若最新版本号变新则切到最新并加载 */
	const handleDetailHeaderRefresh = useMemoizedFn(async () => {
		if (!displayData?.file_id || activeFileId !== displayData.file_id) return

		const htmlFileId = displayData.file_id
		const prevHtmlNewest = htmlFileVersionsList[0]?.version
		const newHtmlVersions = await fetchHtmlFileVersions(htmlFileId, false)
		const nextHtmlNewest = newHtmlVersions[0]?.version
		if (
			typeof prevHtmlNewest === "number" &&
			typeof nextHtmlNewest === "number" &&
			nextHtmlNewest > prevHtmlNewest
		) {
			changeHtmlFileVersion(undefined, newHtmlVersions)
		}

		if (!isDataAnalysis || !dashboardDataJsFile?.file_id) return

		const dataJsId = dashboardDataJsFile.file_id
		const prevDataNewest = activeHistory.fileVersionsList[0]?.version
		const newDataVersions = await fetchDashboardDataJsFileVersions(dataJsId, false)
		const nextDataNewest = newDataVersions[0]?.version
		if (
			typeof prevDataNewest === "number" &&
			typeof nextDataNewest === "number" &&
			nextDataNewest > prevDataNewest
		) {
			activeHistory.changeFileVersion(undefined)
		}
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleDetailHeaderRefresh)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleDetailHeaderRefresh)
		}
	}, [handleDetailHeaderRefresh])

	/** 与 useMediaScenario 一致：父目录 metadata 标识 audio / video */
	const mediaParentScenarioType = useMemo((): "audio" | "video" | null => {
		const file = allAttachmentItems.find((item: any) => item.file_id === displayData?.file_id)
		if (!file?.parent_id) return null
		const parent = allAttachmentItems.find((item: any) => item.file_id === file.parent_id)
		const t = parent?.display_config?.type
		if (t === "audio" || t === "video") return t
		return null
	}, [allAttachmentItems, displayData?.file_id])

	/**
	 * 仅可视化预览：dashboard / audio / video 入口 HTML 走构建内 templates；dashboard 另换壳 CSS/JS。
	 * 代码模式、编辑、回放、PPT 仍用用户仓库 HTML + OSS。
	 */
	const htmlPreviewBundledTemplate = useMemo((): HtmlPreviewBundledTemplateKind | undefined => {
		if (isEditMode || viewMode === "code" || isPlaybackMode || isInPPTMode) return undefined
		if (isDataAnalysis || displayConfig?.type === "dashboard") return "dashboard"
		if (displayConfig?.type === "audio" || mediaParentScenarioType === "audio") return "audio"
		if (displayConfig?.type === "video" || mediaParentScenarioType === "video") return "video"
		return undefined
	}, [
		isDataAnalysis,
		displayConfig?.type,
		mediaParentScenarioType,
		isEditMode,
		viewMode,
		isPlaybackMode,
		isInPPTMode,
	])

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
	useUpdateEffect(() => {
		if (viewMode === "code") {
			const newData = {
				...displayData,
				content: htmlFileData || displayData?.content,
			}
			setData(newData)
		} else {
			updateDataContent(htmlFileData)
		}
	}, [viewMode])

	// IsolatedHTMLRenderer 的 ref，用于获取拦截回调函数
	const htmlRendererRef = useRef<IsolatedHTMLRendererRef>(null)

	const getCurrentEditingContent = useMemoizedFn(async () => {
		if (viewMode === "code") return editingCodeContent || data?.content || ""
		return (await htmlRendererRef.current?.getContent()) || data?.content || ""
	})

	const applyEditingContent = useMemoizedFn((nextContent: string) => {
		if (viewMode !== "code") return

		setEditingCodeContent(nextContent)
		setData((prev: any) => ({
			...prev,
			content: nextContent,
		}))
	})

	const getEditSessionBaselineContent = useMemoizedFn(() => {
		return data?.content || htmlFileData || displayData?.content || ""
	})

	const {
		hasServerUpdate,
		actualServerContent,
		showVersionCompareDialog,
		showSaveWithUpdateConfirmDialog,
		currentEditingContent,
		handleViewServerUpdate,
		handleUseMyVersion,
		handleUseServerVersion,
		clearServerUpdate,
		checkServerUpdateBeforeSave,
		setShowVersionCompareDialog,
		setShowSaveWithUpdateConfirmDialog,
		applyServerUpdate,
	} = useServerUpdate({
		externalServerUpdatedContent: serverUpdatedContent,
		onClearServerUpdate: () => {
			setServerUpdatedContent(undefined)
		},
		isEditMode: Boolean(isEditMode),
		rendererRef: htmlRendererRef,
		content: data?.content || displayData?.content || "",
		getCurrentEditingContent,
		applyContent: applyEditingContent,
	})

	useEffect(() => {
		setServerUpdatedContent(undefined)
		editSessionUpdatedAtRef.current = updatedAt
		editSessionBaselineContentRef.current = null
		// Reset local-save memory when the user switches to another file.
		lastLocalSavedContentRef.current = null
		// Do not depend on updatedAt here, otherwise external updates will be
		// consumed before the edit-session detection effect can compare them.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [displayData?.file_id])

	useEffect(() => {
		if (isEditMode) {
			if (editSessionUpdatedAtRef.current === undefined) {
				editSessionUpdatedAtRef.current = updatedAt
			}
			if (editSessionBaselineContentRef.current === null) {
				editSessionBaselineContentRef.current = getEditSessionBaselineContent()
			}
			return
		}

		setServerUpdatedContent(undefined)
		editSessionUpdatedAtRef.current = updatedAt
		editSessionBaselineContentRef.current = null
		// Leaving edit mode ends the current conflict-detection session.
		lastLocalSavedContentRef.current = null
	}, [getEditSessionBaselineContent, isEditMode, updatedAt])

	useEffect(() => {
		if (!isEditMode || !displayData?.file_id || !updatedAt) return
		if (editSessionUpdatedAtRef.current === undefined) {
			editSessionUpdatedAtRef.current = updatedAt
			return
		}
		if (editSessionUpdatedAtRef.current === updatedAt) return

		editSessionUpdatedAtRef.current = updatedAt
		const currentRequestId = serverUpdateRequestIdRef.current + 1
		serverUpdateRequestIdRef.current = currentRequestId

		getFileContentById(displayData.file_id, {
			responseType: "text",
		})
			.then(async (latestContent) => {
				if (serverUpdateRequestIdRef.current !== currentRequestId) return
				if (typeof latestContent !== "string") return

				const { shouldPrompt, nextLastLocalSavedContent } = resolveServerUpdateState({
					latestContent,
					sessionBaselineContent: editSessionBaselineContentRef.current,
					lastLocalSavedContent: lastLocalSavedContentRef.current,
				})

				lastLocalSavedContentRef.current = nextLastLocalSavedContent

				if (!shouldPrompt) {
					setServerUpdatedContent(undefined)
					return
				}

				setServerUpdatedContent(latestContent)
			})
			.catch((error) => {
				console.error("[HTML] 获取服务端最新内容失败", error)
			})
	}, [displayData?.file_id, getCurrentEditingContent, isEditMode, updatedAt])

	const refreshServerUpdateState = useMemoizedFn(async () => {
		if (!displayData?.file_id) return false

		const latestContent = await getFileContentById(displayData.file_id, {
			responseType: "text",
		})
		if (typeof latestContent !== "string") return false

		const { shouldPrompt, nextLastLocalSavedContent } = resolveServerUpdateState({
			latestContent,
			sessionBaselineContent: editSessionBaselineContentRef.current,
			lastLocalSavedContent: lastLocalSavedContentRef.current,
		})

		lastLocalSavedContentRef.current = nextLastLocalSavedContent

		if (!shouldPrompt) {
			setServerUpdatedContent(undefined)
			return false
		}

		setServerUpdatedContent(latestContent)
		return true
	})

	const postMessageTargetStrategy = useMemo(
		() =>
			env("MAGIC_HTML_SANDBOX_URL")
				? POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT
				: POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
		[],
	)

	// 创建消息处理器并注册/移除监听器（即使没有 attachments 也要注册）
	useEffect(() => {
		// 获取当前HTML文件的相对文件夹路径
		let htmlRelativeFolderPath = "/"
		const currentFileId = displayData?.file_id
		if (currentFileId && flattenedAttachmentList.length > 0) {
			const currentFile = flattenedAttachmentList.find(
				(item) => item.file_id === currentFileId,
			)
			if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
				// 从relative_file_path中去掉file_name，得到文件夹路径
				htmlRelativeFolderPath = currentFile.relative_file_path.replace(
					currentFile.file_name,
					"",
				)
			}
		}
		// 即使没有 attachments 也创建空数组，确保拦截器能正常工作
		const allFiles = flattenedAttachmentList as FileItem[]

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
			{
				postMessageTargetStrategy,
			},
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attachmentList, displayData?.file_id])

	const processContent = useMemoizedFn(async () => {
		if (isDataAnalysis && !activeHistory.isPreviewReady) return

		try {
			const result = await processHtmlContent({
				content: data?.content,
				attachments,
				fileId: displayData?.file_id,
				fileName: data?.file_name,
				attachmentList,
				displayConfig,
				resourceFileVersions,
				htmlPreviewBundledTemplate,
			})

			let finalProcessedContent = result.processedContent
			finalProcessedContent = inlineDashboardDataJs({
				html: finalProcessedContent,
				dataJsContent: dashboardDataJsContent,
			})

			// 注入fetch拦截器脚本（默认启用）
			// 注意：media拦截器现在在htmlProcessor中根据display_config.type自动注入
			finalProcessedContent = injectFetchInterceptorScript(finalProcessedContent, {
				fileId: displayData?.file_id || "",
				postMessageTargetStrategy,
			})

			// 在编辑模式下注入键盘快捷键拦截器
			if (isEditMode) {
				finalProcessedContent = injectKeyboardInterceptorScript(finalProcessedContent)
			}

			setProcessedContent(finalProcessedContent)
			setFilePathMapping(result.filePathMapping)
		} catch (error) {
			console.error("Error processing HTML content:", error)
			setProcessedContent(data?.content || "")
		}
	})

	useDeepCompareEffect(() => {
		if (!data?.content) return
		if (isDataAnalysis && !activeHistory.isPreviewReady) return
		processContent()
	}, [
		data,
		displayConfig,
		isEditMode,
		htmlPreviewBundledTemplate,
		resourceFileVersions,
		dashboardDataJsContent,
		isDataAnalysis,
		activeHistory.isPreviewReady,
	])

	// 编辑态下，附件 updated_at 变化会导致 processedContent 重算并触发 iframe setContent，
	// 进而打断未保存编辑；因此仅在非编辑态响应 attachmentList 变化。
	useDeepCompareEffect(() => {
		if (isEditMode) return
		if (!data?.content) return
		if (isDataAnalysis && !activeHistory.isPreviewReady) return
		processContent()
	}, [
		attachmentList,
		htmlPreviewBundledTemplate,
		resourceFileVersions,
		dashboardDataJsContent,
		isDataAnalysis,
		activeHistory.isPreviewReady,
	])

	// AI modification detection is now handled by PPTStore internally
	// This logic has been removed to simplify the component

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			editSessionBaselineContentRef.current = getEditSessionBaselineContent()
			setIsEditMode(true)
			// 初始化编辑内容
			setEditingCodeContent(data?.content || "")
		}
	})

	const performSave = useMemoizedFn(async () => {
		setIsEditingAfter(true)
		if (viewMode === "code" && editingCodeContent) {
			// 保存代码编辑内容
			await saveEditContent?.(
				shadow(editingCodeContent),
				displayData?.file_id,
				true,
				fetchHtmlFileVersions,
			)
			// Code mode saves exactly the editor text, so we can cache it directly.
			lastLocalSavedContentRef.current = editingCodeContent
			editSessionBaselineContentRef.current = editingCodeContent
			setData((prev: any) => ({
				...prev,
				content: editingCodeContent,
			}))
		} else if (saveFunction) {
			const result = await saveFunction()
			if (result && !result.success) {
				console.error("[HTML Editor] 保存失败", result)
			}
			if (result?.success) {
				// Visual mode returns the cleaned HTML that will be stored on the server.
				lastLocalSavedContentRef.current = result.cleanContent
				editSessionBaselineContentRef.current = result.cleanContent
			}
		}
		setShowSaveWithUpdateConfirmDialog(false)
		clearServerUpdate()
		// 不再退出编辑模式
	})

	const exitEditModeAfterSave = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		onRefreshFile?.()
	})

	const runSaveAttempt = useMemoizedFn(async (intent: "save" | "save-and-exit") => {
		pendingSaveIntentRef.current = intent

		const result = await attemptHtmlSaveFlow({
			shouldExitAfterSave: intent === "save-and-exit",
			refreshServerUpdateState,
			showConflictDialog: () => setShowSaveWithUpdateConfirmDialog(true),
			checkServerUpdateBeforeSave,
			performSave,
			exitEditMode: exitEditModeAfterSave,
			onRefreshServerUpdateError: (error: unknown) => {
				console.error("[HTML] 保存前检查服务端冲突失败", error)
			},
		})

		if (!result.isAwaitingConflictConfirmation) {
			pendingSaveIntentRef.current = null
		}

		return result.didSave
	})

	const handleSave = useMemoizedFn(async () => {
		await runSaveAttempt("save")
	})

	// Register save handler when in edit mode
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	const handleSaveAndExit = useMemoizedFn(async () => {
		await runSaveAttempt("save-and-exit")
	})

	const handleSaveConflictDialogChange = useMemoizedFn((open: boolean) => {
		setShowSaveWithUpdateConfirmDialog(open)
	})

	const handleDismissSaveWithUpdate = useMemoizedFn(() => {
		pendingSaveIntentRef.current = null
	})

	const handleConfirmSaveWithUpdate = useMemoizedFn(async () => {
		const shouldExitAfterSave = pendingSaveIntentRef.current === "save-and-exit"

		await confirmHtmlConflictSave({
			shouldExitAfterSave,
			performSave,
			exitEditMode: exitEditModeAfterSave,
		})

		pendingSaveIntentRef.current = null
	})

	const handleCancel = useMemoizedFn(async () => {
		pendingSaveIntentRef.current = null
		setShowSaveWithUpdateConfirmDialog(false)
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		applyServerUpdate()
		clearServerUpdate()
		setRenderKey((prev) => prev + 1)
		onRefreshFile?.()
	})

	const handleAcceptMyVersion = useMemoizedFn((editedContent?: string) => {
		if (actualServerContent) {
			editSessionBaselineContentRef.current = actualServerContent
		}
		handleUseMyVersion(editedContent)
	})

	const handleAcceptServerVersion = useMemoizedFn((editedContent?: string) => {
		// Visual compare may return normalized HTML that differs from the raw server payload.
		// Keep the conflict baseline anchored to the last accepted server version so the next
		// save is not treated as a brand-new external conflict.
		const nextBaselineContent = actualServerContent || editedContent
		if (nextBaselineContent) {
			editSessionBaselineContentRef.current = nextBaselineContent
		}
		lastLocalSavedContentRef.current = null
		handleUseServerVersion(editedContent)
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

	const handleExportPptx = useMemoizedFn(() => {
		exportPptx?.(displayData?.file_id)
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
	const isMediaScenario = displayConfig?.type === "audio" || displayConfig?.type === "video"
	const isCodeViewMode = viewMode === "code"
	const versionCompareFileName = data?.file_name || data?.title || "file.html"

	/** 是否显示 AI编辑 按钮 */
	const showAIOptimizationButton = useMemo(() => {
		if (isReadonlyPreview) {
			return false
		}
		// 当 display_config.type 为 audio/video 时，隐藏 AI 编辑按钮
		if (isMediaScenario) {
			return false
		}
		return !isMobile && allowEdit && !isEditMode && activeHistory.isNewestVersion
	}, [
		isReadonlyPreview,
		isMediaScenario,
		isMobile,
		allowEdit,
		isEditMode,
		activeHistory.isNewestVersion,
	])

	/** 是否显示 在线编辑 按钮 */
	const showFileEditButton = useMemo(() => {
		if (isReadonlyPreview) {
			return false
		}
		// 当 display_config.type 为 audio/video 时，隐藏编辑按钮
		if (isMediaScenario) {
			return false
		}
		return (
			setIsEditMode &&
			allowEdit &&
			!isMobile &&
			(saveFunction !== null || viewMode === "code") &&
			displayData?.file_id &&
			activeHistory.isNewestVersion
		)
	}, [
		isReadonlyPreview,
		isMediaScenario,
		setIsEditMode,
		allowEdit,
		isMobile,
		saveFunction,
		viewMode,
		displayData?.file_id,
		activeHistory.isNewestVersion,
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
			hideDefaults: isReadonlyPreview
				? ["refresh", "download", "share", "versionMenu", "more"]
				: [],
			customActions: [
				{
					key: "html-server-update",
					zone: "primary",
					visible: () => Boolean(isEditMode && hasServerUpdate),
					render: () => (
						<Button
							variant="secondary"
							size="sm"
							onClick={handleViewServerUpdate}
							className="h-6 gap-1.5 rounded-md px-3 text-xs font-normal shadow-xs"
							data-testid="html-server-update-button"
						>
							<AlertTriangle size={16} className="text-amber-600" />
							<span>{t("ppt.serverUpdateAvailable")}</span>
						</Button>
					),
				},
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
					visible: () => Boolean(!isReadonlyPreview && showExportButton),
					render: (context) => (
						<HtmlExportAction
							handleExportSource={handleExportSource}
							handleExportPDF={handleExportPDF}
							handleExportPPT={handleExportPPT}
							handleExportPptx={handleExportPptx}
							isExporting={isExporting}
							supportPPT={isInPPTMode}
							showButtonText={context.showButtonText}
							showExportPptx={isConvertibleFile(displayData, ["html"])}
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
			handleExportPptx,
			handleExportSource,
			handleSave,
			handleSaveAndExit,
			handleViewServerUpdate,
			hasServerUpdate,
			isExporting,
			isEditMode,
			isInPPTMode,
			isReadonlyPreview,
			showAIOptimizationButton,
			showExportButton,
			showFileEditButton,
			t,
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
			onCopy?.(
				targetFileVersion || activeHistory.fileVersionsList[0]?.version,
				displayData?.file_id,
			),
		fileContent: fileContent || processedContent,
		currentFile,
		detailMode,
		showDownload: showDownloadButton && !showExportButton,
		isEditMode,
		fileVersion: activeHistory.fileVersion,
		isNewestFileVersion: activeHistory.isNewestVersion,
		showRefreshButton: true,
		changeFileVersion: activeHistory.changeFileVersion,
		fileVersionsList: activeHistory.fileVersionsList,
		handleVersionRollback: activeHistory.handleVersionRollback,
		quitEditMode,
		allowEdit,
		attachments,
		actionConfig: headerActionConfig,
	}

	return (
		<div
			className={cx(styles.htmlContainer, className, {
				[styles.immersiveHtmlContainer]: isImmersiveLayout,
			})}
		>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{activeHistory.loading ? (
				<Flex
					justify="center"
					align="center"
					style={{ height: "100%", width: "100%", backgroundColor: "white" }}
				>
					<MagicSpin spinning />
				</Flex>
			) : isCodeViewMode ? (
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
						[styles.immersivePreviewContainer]: isImmersiveLayout,
					})}
				>
					<div
						className={cx(styles.previewInnerBase, styles.htmlBody, {
							[styles.phoneModeInner]: viewMode === "phone",
							[styles.immersivePreviewInner]: isImmersiveLayout,
						})}
					>
						{isDataAnalysis ? (
							<DashboardIsolatedHTMLRenderer
								key={`dashboard-html-${dashboardDataJsFile?.file_id || "none"}-${activeHistory.previewRevision}`}
								content={processedContent}
								className={className}
								isEditMode={isEditMode || false}
								dashboardRenderMode={
									viewMode === "phone"
										? "mobile"
										: viewMode === "desktop"
											? "desktop"
											: "auto"
								}
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
			{showFooter && !isReadonlyPreview && (
				<CommonFooter
					fileVersion={activeHistory.fileVersion}
					changeFileVersion={activeHistory.changeFileVersion}
					fileVersionsList={activeHistory.fileVersionsList}
					handleVersionRollback={activeHistory.handleVersionRollback}
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
			<AlertDialog
				open={showSaveWithUpdateConfirmDialog}
				onOpenChange={handleSaveConflictDialogChange}
			>
				<AlertDialogContent data-testid="html-save-with-update-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.saveWithServerUpdateTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.saveWithServerUpdate")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDismissSaveWithUpdate}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmSaveWithUpdate}>
							{t("common.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{isCodeViewMode ? (
				<CodeVersionCompareDialog
					open={showVersionCompareDialog}
					onOpenChange={setShowVersionCompareDialog}
					currentContent={currentEditingContent}
					serverContent={actualServerContent}
					fileName={versionCompareFileName}
					onUseMyVersion={() => handleAcceptMyVersion()}
					onUseServerVersion={() => handleAcceptServerVersion()}
				/>
			) : (
				<VersionCompareDialog
					open={showVersionCompareDialog}
					onOpenChange={setShowVersionCompareDialog}
					currentContent={currentEditingContent}
					serverContent={actualServerContent}
					onUseMyVersion={handleAcceptMyVersion}
					onUseServerVersion={handleAcceptServerVersion}
					filePathMapping={filePathMapping}
					fileId={displayData?.file_id}
					openNewTab={openNewTab}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
				/>
			)}
		</div>
	)
})
