import { createStyles } from "antd-style"
import {
	type Ref,
	useEffect,
	useRef,
	useState,
	forwardRef,
	useImperativeHandle,
	useMemo,
	useLayoutEffect,
} from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { filterInjectedTags } from "./utils"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { useUpload } from "@/hooks/useUploadFiles"
import { useTranslation } from "react-i18next"
import { addContentToChat } from "@/pages/superMagic/components/Detail/components/AIOptimization/utils"
import { decodeHTMLEntities, getFullContent } from "./utils/full-content"
import { getHTMLMessengerContent } from "./utils/messenger-content"
import { useMediaScenario } from "./media/useMediaScenario"
import { handleMediaImageUrlRequest, MEDIA_MESSAGE_TYPES } from "./media/utils"
import { cn } from "@/lib/utils"
import { StylePanel } from "./components/StylePanel"
import { ZoomControls } from "./components/StylePanel/controls"
import type { HTMLEditorV2Ref, SaveResult } from "./iframe-bridge/types/props"
import type {
	ImageUploadRequestPayload,
	ImageUploadResultPayload,
} from "./iframe-bridge/types/messages"
import { useHTMLEditorV2 } from "./hooks/useHTMLEditorV2"
import { SelectionOverlay } from "./components/SelectionOverlay"
import { useZoomControls } from "./hooks/useZoomControls"
import { StylePanelStoreProvider } from "./iframe-bridge/contexts/StylePanelContext"
import { TAILWIND_Z_INDEX_CLASSES } from "./constants/z-index"
import { LogPanel } from "./components/LogPanel"

export interface IsolatedHTMLRendererRef {
	getIframeElement: () => HTMLIFrameElement | null
	getEditorRef: () => React.RefObject<HTMLEditorV2Ref> | null
	resetContent: () => void
	updateContent: (
		newContent: string,
		options?: {
			restoreSelectionMode?: boolean
		},
	) => void
	getContent: () => Promise<string | null>
	getFetchInterceptedCallback: () => OnFetchIntercepted | undefined
}
//HTML预览增强组件 iframe里面的内容尺寸，用于计算缩放比例
export interface IsolatedHTMLRendererContentMetrics {
	contentWidth: number
	contentHeight: number
	phase?: "initial" | "settled"
	hasHorizontalOverflow?: boolean
	hasVerticalOverflow?: boolean
	verticalScrollbarWidth?: number
}
import magicToast from "@/components/base/MagicToaster/utils"
import { base64ToFile } from "@/pages/superMagic/components/MessageEditor/utils/fileConverter"
import { resolveUploadPath, cleanPath } from "./utils/file-utils"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { addMultipleFilesToCurrentChat } from "@/pages/superMagic/utils/topics"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "@/pages/superMagic/services"
import { topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { runInAction } from "mobx"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { logger as Logger } from "@/utils/log"
import { useFetchInterceptionCache } from "./hooks/useFetchInterceptionCache"
import { POST_MESSAGE_TARGET_STRATEGIES, type OnFetchIntercepted } from "./utils/fetchInterceptor"

import { env } from "@/utils/env"

interface IsolatedHTMLRendererProps {
	content: string
	sandboxType?: "iframe" | "shadow-dom"
	className?: string
	isPptRender?: boolean
	isFullscreen?: boolean
	isEditMode?: boolean
	isSaving?: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	onSaveReady?: (triggerSave: () => Promise<SaveResult | undefined>) => void
	fileId?: string
	filePathMapping: Map<string, string>
	relative_file_path?: string //当前html的相对路径
	openNewTab: (fileId: string, path: string, autoEdit?: boolean) => void
	selectedProject?: any
	attachmentList?: any[]
	setSlideContents?: (slideContents: Map<number, string>) => void
	slideIndex?: number
	setProcessedContent?: (processedContent: string) => void
	isPlaybackMode?: boolean
	toolbarClassName?: string
	/** Mount target for `createPortal` (e.g. save/cancel) at style toolbar’s right */
	toolbarEndRef?: Ref<HTMLDivElement | null>
	isVisible?: boolean
	iframeClassName?: string
	containIframeOverscroll?: boolean //控制HTML预览增强组件内部是否启用
	hideVerticalScroll?: boolean
	enableScalingHeightCalculation?: boolean
	waitForSettledContentMetrics?: boolean
	autoFitScalePaddingFactor?: number
	disableDynamicResourceInterception?: boolean
	disableIframeDocumentClickBridge?: boolean // **重要** 控制HTML预览增强组件内部是否禁用 iframe 到父层的通用 DOM_CLICK 桥接
	onRenderReady?: () => void //控制HTML预览组件的skeleton结束时机
	onContentMetrics?: (metrics: IsolatedHTMLRendererContentMetrics) => void //计算HTML预览组件内部内容尺寸
	onInterrupt?: () => void //新增：中断回调
}

interface MagicUploadFileData {
	base64: string
	filename: string
	path: string
	fileSize: number
	fileType: string
}

interface MagicUploadFilesRequest {
	type: "MAGIC_UPLOAD_FILES_REQUEST"
	requestId: string
	files: MagicUploadFileData[]
}

interface MagicAddFilesToMessageRequest {
	type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST"
	requestId: string
	filePaths: string[]
	agentMode?: string
}

interface MagicDownloadFilesRequest {
	type: "MAGIC_DOWNLOAD_FILES_REQUEST"
	requestId: string
	filePaths: string[]
}

interface MagicI18nLangSubscribeRequest {
	type: "MAGIC_I18N_LANG_SUBSCRIBE"
	requestId?: string
}

interface LegacyImageUploadRequestData {
	targetSelector: string
}

const useStyles = createStyles(({ css }) => {
	return {
		rendererContainer: css`
			width: 100%;
			height: 100%;
			overflow: auto;
		`,
		hiddenScrollbar: css`
			scrollbar-width: none;
			-ms-overflow-style: none;

			&::-webkit-scrollbar {
				display: none;
				width: 0;
				height: 0;
			}
		`,
		iframe: css`
			width: 100%;
			height: 100%;
			display: block;
		`,
		shadowHost: css`
			width: 100%;
			height: 100%;
			display: block;
			position: relative;
		`,
		loadingContainer: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})

const logger = Logger.createLogger("IsolatedHTMLRenderer")

// Internal component that uses the StylePanelStore context
const IsolatedHTMLRendererInner = forwardRef<IsolatedHTMLRendererRef, IsolatedHTMLRendererProps>(
	(props, ref) => {
		const {
			content,
			sandboxType = "iframe",
			className,
			isPptRender,
			isFullscreen,
			isEditMode,
			isSaving = false,
			saveEditContent,
			onSaveReady,
			fileId,
			filePathMapping,
			openNewTab,
			relative_file_path,
			selectedProject,
			attachmentList,
			isPlaybackMode,
			toolbarClassName,
			toolbarEndRef,
			iframeClassName,
			isVisible,
			containIframeOverscroll = false,
			hideVerticalScroll = false,
			enableScalingHeightCalculation = false,
			waitForSettledContentMetrics = false,
			autoFitScalePaddingFactor = 1,
			disableDynamicResourceInterception = false,
			disableIframeDocumentClickBridge = false,
			onRenderReady,
			onContentMetrics,
		} = props
		const renderSiteUrl = useMemo(() => env("MAGIC_HTML_SANDBOX_URL"), [])
		const renderSiteOrigin = useMemo(() => {
			if (!renderSiteUrl) return ""

			try {
				return new URL(renderSiteUrl).origin
			} catch {
				return ""
			}
		}, [renderSiteUrl])
		const postMessageTargetStrategy = useMemo(
			() =>
				renderSiteUrl
					? POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT
					: POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
			[renderSiteUrl],
		)

		const { styles, cx } = useStyles()
		const containerRef = useRef<HTMLDivElement>(null)
		const contentWrapperRef = useRef<HTMLDivElement>(null)
		const scrollContainerRef = useRef<HTMLDivElement>(null)
		const iframeRef = useRef<HTMLIFrameElement>(null)
		useEffect(() => {
			const iframe = iframeRef.current
			if (!iframe) return
			// Legacy fullscreen attributes for old WebKit/Firefox engines.
			iframe.setAttribute("allowfullscreen", "true")
			iframe.setAttribute("webkitallowfullscreen", "true")
			iframe.setAttribute("mozallowfullscreen", "true")
		}, [])

		const [iframeLoaded, setIframeLoaded] = useState(false)
		const [contentInjected, setContentInjected] = useState(false) // 标记内容是否已注入到 iframe
		const hasRenderedOnceRef = useRef(false) // 跟踪 iframe 是否至少已渲染一次
		const hasNotifiedRenderReadyRef = useRef(false)
		const hasIframeI18nSubscriberRef = useRef(false)
		// Fallback timer: unblocks scaling when sandbox never sends contentMetrics
		const contentMetricsFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

		// Track selected element for zoom centering
		const [selectedElementRect, setSelectedElementRect] = useState<{
			top: number
			left: number
			width: number
			height: number
		} | null>(null)
		const [scalingContentMetrics, setScalingContentMetrics] = useState<{
			contentWidth: number
			contentHeight: number
			phase?: "initial" | "settled"
		} | null>(null)

		// 使用缩放控制 hook 处理 PPT 渲染模式
		const {
			scaleRatio,
			shouldApplyScaling,
			isScaleReady,
			isManualZoom,
			handleScaleChange,
			handleResetZoom,
			getContentWrapperStyle,
			getIframeStyle,
		} = useZoomControls({
			containerRef,
			iframeRef,
			isPptRender,
			isFullscreen,
			iframeLoaded,
			contentInjected,
			isVisible,
			isEditMode,
			selectedElementRect,
			enableHeightCalculation: enableScalingHeightCalculation,
			contentMetricsOverride: scalingContentMetrics,
			waitForSettledContentMetrics,
			autoFitScalePaddingFactor,
		})

		// 跟踪缩放准备就绪时机以避免后续渲染时闪烁
		useEffect(() => {
			if (isScaleReady && isVisible) {
				hasRenderedOnceRef.current = true
			}
		}, [isScaleReady, isVisible])
		//控制HTML预览组件的skeleton结束时机
		useEffect(() => {
			hasNotifiedRenderReadyRef.current = false
			setScalingContentMetrics(null)
			if (contentMetricsFallbackTimerRef.current) {
				clearTimeout(contentMetricsFallbackTimerRef.current)
				contentMetricsFallbackTimerRef.current = null
			}
		}, [content])

		const notifyRenderReady = useMemoizedFn(() => {
			if (hasNotifiedRenderReadyRef.current) return

			hasNotifiedRenderReadyRef.current = true
			onRenderReady?.()
		})

		// Handle zoom request from iframe (trackpad pinch-to-zoom)
		const handleIframeZoomRequest = useMemoizedFn((delta: number) => {
			const scaleFactor = 0.002 // Sensitivity adjustment
			const scaleChange = delta * scaleFactor
			const newScale = scaleRatio + scaleChange
			handleScaleChange(newScale)
		})

		// V2 编辑机制相关
		const editorRef = useRef<HTMLEditorV2Ref>(null)
		useHTMLEditorV2({
			iframeRef,
			isEditMode,
			sandboxType,
			iframeLoaded,
			contentInjected,
			renderSiteUrl,
			scaleRatio,
			saveEditContent,
			fileId,
			filePathMapping,
			editorRef,
			isPptRender,
			onZoomRequest: handleIframeZoomRequest,
		})

		// 使用 media scenario hook
		const {
			isMediaScenario,
			injectMediaScript,
			handleMediaSpeakerEdit,
			saveMediaConfiguration,
		} = useMediaScenario({
			attachmentList,
			fileId,
		})

		const { t, i18n } = useTranslation("super")
		const { upload } = useUpload<any>({
			url: superMagicUploadTokenService.getUploadTokenUrl,
			body: {
				project_id: selectedProject?.id ?? "",
				expires: 3600,
			},
			rewriteFileName: false,
			useSnowflakeId: true,
		})

		const toStoredRelativePath = useMemoizedFn((uploadedRelativePath: string) => {
			const normalizedUploadedPath = uploadedRelativePath.replace(/^\/+/, "")
			if (!relative_file_path || relative_file_path === "/") {
				return normalizedUploadedPath
			}

			const normalizedCurrentPath = relative_file_path.replace(/^\/+/, "")
			const lastSlashIndex = normalizedCurrentPath.lastIndexOf("/")
			const currentDirectory =
				lastSlashIndex >= 0 ? normalizedCurrentPath.slice(0, lastSlashIndex + 1) : ""

			if (currentDirectory && normalizedUploadedPath.startsWith(currentDirectory)) {
				return normalizedUploadedPath.slice(currentDirectory.length)
			}

			return normalizedUploadedPath
		})

		const uploadImageFileToProject = useMemoizedFn(
			async ({ file, path, fileSize }: { file: File; path: string; fileSize?: number }) => {
				if (!selectedProject?.id) {
					throw new Error("No project selected")
				}

				const resolvedPath = resolveUploadPath(path, relative_file_path)
				const cleanPathValue = cleanPath(resolvedPath)
				const token = await superMagicUploadTokenService.getUploadToken(
					selectedProject.id,
					cleanPathValue || "",
				)
				const dir = token?.temporary_credential?.dir ?? ""
				const newFiles = Array.from([file]).map(genFileData)
				const { fullfilled } = await upload(newFiles, token)
				if (fullfilled.length === 0) {
					throw new Error("Upload failed")
				}

				const saveRes = await superMagicUploadTokenService.saveFileToProject({
					project_id: selectedProject.id,
					file_key: `${dir}${file.name}`,
					file_name: file.name,
					file_size: fileSize || file.size,
					file_type: "user_upload",
					source: 2,
					storage_type: "workspace",
				})

				if (!saveRes?.relative_file_path) {
					throw new Error("Uploaded file path is empty")
				}

				return {
					uploadedRelativeFilePath: saveRes.relative_file_path,
					storedRelativeFilePath: toStoredRelativePath(saveRes.relative_file_path),
				}
			},
		)

		// 从 attachmentList 中查找文件（递归查找，支持嵌套的 children）
		const findFileInAttachments = useMemoizedFn(
			(attachments: any[], targetPath: string): any | null => {
				if (!attachments || attachments.length === 0) {
					return null
				}

				// 标准化目标路径用于比较
				const normalizePath = (path: string) => {
					return path.replace(/^\/+/, "").replace(/\/+$/, "")
				}

				const normalizedTarget = normalizePath(targetPath)

				for (const item of attachments) {
					// 递归查找子节点
					if (item.children && item.children.length > 0) {
						const found = findFileInAttachments(item.children, targetPath)
						if (found) return found
					}

					// 检查 relative_file_path
					if (item.relative_file_path) {
						const normalizedItemPath = normalizePath(item.relative_file_path)
						if (normalizedItemPath === normalizedTarget) {
							return item
						}
					}

					// 检查 file_path
					if (item.file_path) {
						const normalizedItemPath = normalizePath(item.file_path)
						if (normalizedItemPath === normalizedTarget) {
							return item
						}
					}
				}

				return null
			},
		)

		// 消息列表预览这类只依赖预处理结果的场景，不需要再启用运行时相对路径拦截，
		// 避免把不在附件树里的原始相对路径也带进通用业务拦截链。
		const isDynamicInterceptionEnabled = !disableDynamicResourceInterception
		const dynamicResourceInterceptionConfig = useMemo(() => {
			return {
				enable: isDynamicInterceptionEnabled,
				fileId: fileId || "",
				postMessageTargetStrategy,
			}
		}, [fileId, isDynamicInterceptionEnabled, postMessageTargetStrategy])

		// 处理 window.Magic.uploadFiles 请求
		const handleMagicUploadFiles = useMemoizedFn(async (data: MagicUploadFilesRequest) => {
			const { requestId, files } = data

			if (!requestId || !Array.isArray(files) || files.length === 0) {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_UPLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: false,
						error: "Invalid request data",
					},
					"*",
				)
				return
			}

			if (!selectedProject?.id) {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_UPLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: false,
						error: "No project selected",
					},
					"*",
				)
				return
			}

			try {
				magicToast.loading({
					content: t("topicFiles.fileUploading"),
					duration: 0,
				})

				const results = []

				// 逐个处理文件上传
				for (const fileData of files) {
					try {
						const { base64, filename, path, fileSize } = fileData
						const file = base64ToFile(base64, filename)
						const uploadResult = await uploadImageFileToProject({
							file,
							path,
							fileSize,
						})

						results.push({
							filename,
							path,
							success: true,
							relative_file_path: uploadResult.uploadedRelativeFilePath,
						})
					} catch (error) {
						results.push({
							filename: fileData.filename,
							path: fileData.path,
							success: false,
							error: error instanceof Error ? error.message : "Unknown error",
						})
					}
				}

				// 发送成功响应
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_UPLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: true,
						results: results,
					},
					"*",
				)

				// 触发附件列表更新
				pubsub.publish(PubSubEvents.Update_Attachments, () => {
					magicToast.destroy()
					magicToast.success(t("topicFiles.fileUploadSuccess"))
				})
			} catch (error) {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_UPLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					},
					"*",
				)
				magicToast.destroy()
				magicToast.error(t("topicFiles.fileUploadError", "文件上传失败"))
			}
		})

		// 处理 window.Magic.addFilesToMessage 请求
		const handleMagicAddFilesToMessage = useMemoizedFn(
			async (data: MagicAddFilesToMessageRequest) => {
				const { requestId, filePaths, agentMode } = data

				if (!requestId || !Array.isArray(filePaths) || filePaths.length === 0) {
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
							requestId: requestId,
							success: false,
							error: "Invalid request data",
						},
						"*",
					)
					return
				}

				if (!selectedProject?.id) {
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
							requestId: requestId,
							success: false,
							error: "No project selected",
						},
						"*",
					)
					return
				}

				try {
					// 1. 解析文件路径并查找文件
					const foundFiles: any[] = []
					const notFoundPaths: string[] = []

					for (const filePath of filePaths) {
						// 解析路径（相对路径或绝对路径）
						const resolvedPath = resolveUploadPath(filePath, relative_file_path)

						// 从 attachmentList 中查找文件
						const fileItem = attachmentList
							? findFileInAttachments(attachmentList, resolvedPath)
							: null

						if (fileItem) {
							foundFiles.push(fileItem)
						} else {
							notFoundPaths.push(filePath)
						}
					}

					if (foundFiles.length === 0) {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
								requestId: requestId,
								success: false,
								error: "No files found",
								notFoundPaths: notFoundPaths,
							},
							"*",
						)
						return
					}

					// 2. 创建新话题（如果没传 agentMode，默认使用通用模式）
					const finalAgentMode = agentMode || TopicMode.General

					try {
						// 验证 agentMode 是否为有效的 TopicMode
						const validModes = Object.values(TopicMode)
						if (!validModes.includes(finalAgentMode as TopicMode)) {
							throw new Error(`Invalid agentMode: ${finalAgentMode}`)
						}

						const workspaceId =
							selectedProject.workspace_id ||
							workspaceStore.selectedWorkspace?.id ||
							""

						if (!workspaceId) {
							throw new Error("Workspace ID not found")
						}

						// 创建新话题
						const newTopic = await SuperMagicApi.createTopic({
							// workspace_id: workspaceId,
							project_id: selectedProject.id,
							topic_name: "",
							project_mode: finalAgentMode as TopicMode,
						})

						if (newTopic?.id) {
							// 确保话题的模式设置正确
							const topicWithMode: any = {
								...newTopic,
								topic_mode: finalAgentMode as TopicMode,
							}

							// 更新 store
							runInAction(() => {
								topicStore.setSelectedTopic(topicWithMode)
							})

							// 发布模式变化事件
							pubsub.publish(PubSubEvents.Super_Magic_Topic_Mode_Changed, {
								mode: finalAgentMode as TopicMode,
								workspaceId: workspaceId,
								projectId: selectedProject.id,
							})

							// 导航到新话题
							SuperMagicService.route.navigateToState({
								topicId: newTopic.id || null,
							})

							// 等待导航完成后再添加文件
							setTimeout(() => {
								// 添加文件到消息对话框
								addMultipleFilesToCurrentChat({
									fileItems: foundFiles,
									autoFocus: true,
								})

								// 发送成功响应
								iframeRef.current?.contentWindow?.postMessage(
									{
										type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
										requestId: requestId,
										success: true,
										result: {
											foundCount: foundFiles.length,
											notFoundPaths: notFoundPaths,
										},
									},
									"*",
								)
							}, 500)
						} else {
							throw new Error("Failed to create topic")
						}
					} catch (error) {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
								requestId: requestId,
								success: false,
								error:
									error instanceof Error
										? error.message
										: "Failed to create topic",
							},
							"*",
						)
					}
				} catch (error) {
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
							requestId: requestId,
							success: false,
							error: error instanceof Error ? error.message : "Unknown error",
						},
						"*",
					)
				}
			},
		)

		// 处理 window.Magic.downloadFiles 请求
		const handleMagicDownloadFiles = useMemoizedFn(async (data: MagicDownloadFilesRequest) => {
			const { requestId, filePaths } = data

			if (!requestId || !Array.isArray(filePaths) || filePaths.length === 0) {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: false,
						error: "Invalid request data",
					},
					"*",
				)
				return
			}

			try {
				// 1. 解析文件路径并查找文件
				const foundFiles: Array<{
					fileItem: any
					originalPath: string
					resolvedPath: string
				}> = []
				const notFoundPaths: string[] = []

				for (const filePath of filePaths) {
					// 解析路径（相对路径或绝对路径）
					const resolvedPath = resolveUploadPath(filePath, relative_file_path)

					// 从 attachmentList 中查找文件
					const fileItem = attachmentList
						? findFileInAttachments(attachmentList, resolvedPath)
						: null

					if (fileItem && fileItem.file_id) {
						foundFiles.push({
							fileItem,
							originalPath: filePath,
							resolvedPath,
						})
					} else {
						notFoundPaths.push(filePath)
					}
				}

				if (foundFiles.length === 0) {
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
							requestId: requestId,
							success: false,
							error: "No files found",
							notFoundPaths: notFoundPaths,
						},
						"*",
					)
					return
				}

				// 2. 获取下载 URL 并下载文件
				const downloadResults: Array<{
					path: string
					success: boolean
					error?: string
				}> = []

				// 并行获取所有文件的下载 URL
				const downloadUrlPromises = foundFiles.map(async ({ fileItem, originalPath }) => {
					try {
						// 获取下载 URL
						const downloadUrls = await getTemporaryDownloadUrl({
							file_ids: [fileItem.file_id],
						})

						if (!downloadUrls || !downloadUrls[0]?.url) {
							downloadResults.push({
								path: originalPath,
								success: false,
								error: "Failed to get download URL",
							})
							return
						}

						// 获取文件名
						const fileName =
							fileItem.file_name ||
							fileItem.display_filename ||
							fileItem.filename ||
							undefined

						// 下载文件
						await downloadFileWithAnchor(downloadUrls[0].url, fileName)

						downloadResults.push({
							path: originalPath,
							success: true,
						})
					} catch (error) {
						downloadResults.push({
							path: originalPath,
							success: false,
							error: error instanceof Error ? error.message : "Unknown error",
						})
					}
				})

				// 等待所有下载完成
				await Promise.allSettled(downloadUrlPromises)

				// 3. 返回结果
				const successCount = downloadResults.filter((r) => r.success).length
				const failedResults = downloadResults.filter((r) => !r.success)

				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: successCount > 0,
						result: {
							successCount,
							failedCount: failedResults.length,
							notFoundPaths: notFoundPaths,
							failedResults: failedResults,
						},
					},
					"*",
				)
			} catch (error) {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
						requestId: requestId,
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					},
					"*",
				)
			}
		})

		// 初始化 iframe 内容
		const initializeIframe = () => {
			try {
				if (renderSiteUrl) {
					if (iframeRef.current && iframeRef.current.src !== renderSiteUrl) {
						iframeRef.current.src = renderSiteUrl
					}
					// 跨域渲染站由自身发送 iframeReady
					setContentInjected(false)
					return
				}

				if (!iframeRef.current?.contentDocument) return

				const htmlContent = getHTMLMessengerContent()
				console.log("[IsolatedHTMLRenderer] 同域 messenger 内容", htmlContent)
				const doc = iframeRef.current.contentDocument
				// 直接写入HTML内容
				console.log("[IsolatedHTMLRenderer] 同域 messenger 注入中")
				doc.open()
				doc.write(htmlContent)
				doc.close()

				setIframeLoaded(true)
				// 重置内容注入状态，等待新内容注入
				setContentInjected(false)
			} catch (error) {
				console.error("初始化iframe内容时出错:", error)
			}
		}

		// 监听 iframe 准备就绪并初始化内容
		useEffect(() => {
			if (!iframeRef.current) return
			initializeIframe()
		}, [renderSiteUrl])

		const getMarkerId = useMemoizedFn(() => {
			if (!attachmentList || !fileId) return fileId

			// 查找当前文件信息
			const currentFile = attachmentList.find((item: any) => item.file_id === fileId)
			if (currentFile?.parent_id) {
				// 查找父目录信息
				const parentDirectory = attachmentList.find(
					(item: any) => item.file_id === currentFile.parent_id,
				)
				// 如果父目录存在display_config，返回父目录ID
				if (parentDirectory?.display_config) {
					return currentFile.parent_id
				}
			}
			// 默认返回文件ID
			return fileId
		})

		const reloadIframeContent = () => {
			pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
		}

		const notifyIframeI18nLang = useMemoizedFn(
			(source: "subscribe_ack" | "language_changed", requestId?: string) => {
				const currentLang = i18n.resolvedLanguage || i18n.language || "zh-CN"
				if (!iframeRef.current?.contentWindow) return

				iframeRef.current.contentWindow.postMessage(
					{
						type: "MAGIC_I18N_LANG_SUBSCRIBE",
						requestId,
						success: true,
						results: {
							lang: currentLang,
							source,
						},
					},
					"*",
				)
			},
		)

		const refreshIframeContent = useMemoizedFn(() => {
			hasIframeI18nSubscriberRef.current = false
			// 解码HTML实体
			let decodedContent = decodeHTMLEntities(content)

			// 如果是media场景，注入media脚本
			if (isMediaScenario) {
				decodedContent = injectMediaScript(decodedContent)
			}

			// 根据HTML文件上下文确定标记ID：如果父目录存在metadata则使用父目录ID，否则使用文件ID
			const markerId = getMarkerId()
			// 创建完整HTML内容
			const fullContent = getFullContent(decodedContent, markerId, {
				dynamicInterception: dynamicResourceInterceptionConfig,
				containOverscroll: containIframeOverscroll,
				hideVerticalScroll,
				disableParentClickBridge: disableIframeDocumentClickBridge,
				postMessageTargetStrategy,
			})
			// 发送内容到iframe
			try {
				if (iframeRef.current && iframeRef.current.contentWindow) {
					iframeRef.current.contentWindow.postMessage(
						{
							type: "setContent",
							content: fullContent,
						},
						"*",
					)
				} else {
					console.error("iframe或contentWindow不可用")
				}
			} catch (postError) {
				console.error("发送消息到iframe时出错:", postError)
			}
		})

		// 使用 fetch 拦截缓存 hook（必须在 refreshIframeContent 定义之后）
		const { handleFetchIntercepted } = useFetchInterceptionCache({
			attachmentList,
			sandboxType,
			isEditMode,
			iframeRef,
			content,
			refreshIframeContent,
			setContentInjected,
		})

		// Expose iframe element and editor ref via ref
		useImperativeHandle(
			ref,
			() => ({
				getIframeElement: () => iframeRef.current,
				getEditorRef: () => editorRef,
				resetContent: () => {
					// Clear edit history
					if (editorRef.current) {
						editorRef.current.clearHistory().catch((error) => {
							console.error("清除编辑历史失败:", error)
						})
					}
					// Refresh iframe content to original state
					refreshIframeContent()
				},
				updateContent: async (
					newContent: string,
					options?: {
						// 允许调用方在取消/放弃时禁用选择模式恢复
						restoreSelectionMode?: boolean
					},
				) => {
					hasIframeI18nSubscriberRef.current = false
					// Save current edit mode state before updating content
					const wasInEditMode = isEditMode
					// 默认恢复；仅显式传 false 时不恢复
					const shouldRestoreSelectionMode = options?.restoreSelectionMode !== false

					// Clear edit history and reset editor state
					if (editorRef.current) {
						await editorRef.current.clearHistory().catch((error) => {
							console.error("清除编辑历史失败:", error)
						})
						await editorRef.current.resetEditorState().catch((error) => {
							console.error("重置编辑器状态失败:", error)
						})
					}
					// Update iframe with new content
					let decodedContent = decodeHTMLEntities(newContent)

					// 如果是media场景，注入media脚本
					if (isMediaScenario) {
						decodedContent = injectMediaScript(decodedContent)
					}

					// 根据HTML文件上下文确定标记ID
					const markerId = getMarkerId()
					// 创建完整HTML内容
					const fullContent = getFullContent(decodedContent, markerId, {
						dynamicInterception: dynamicResourceInterceptionConfig,
						containOverscroll: containIframeOverscroll,
						hideVerticalScroll,
						disableParentClickBridge: disableIframeDocumentClickBridge,
						postMessageTargetStrategy,
					})
					// 发送内容到iframe
					try {
						if (iframeRef.current && iframeRef.current.contentWindow) {
							console.log("更新html内容为新版本")
							iframeRef.current.contentWindow.postMessage(
								{
									type: "setContent",
									content: fullContent,
								},
								"*",
							)

							// Re-enter selection mode after iframe content is replaced
							// Wait for iframe runtime to be ready, then restore edit mode
							if (wasInEditMode && shouldRestoreSelectionMode && editorRef.current) {
								// Wait a bit for iframe runtime to initialize
								setTimeout(async () => {
									try {
										await editorRef.current?.enableSelectionMode()
									} catch (error) {
										console.error("重新进入选择模式失败:", error)
									}
								}, 500)
							}
						} else {
							console.error("iframe或contentWindow不可用")
						}
					} catch (postError) {
						console.error("发送消息到iframe时出错:", postError)
					}
				},
				getContent: async () => {
					if (editorRef.current) {
						try {
							return await editorRef.current.getContent()
						} catch (error) {
							console.error("获取内容失败:", error)
							return null
						}
					}
					return null
				},
				getFetchInterceptedCallback: () => handleFetchIntercepted,
			}),
			[
				containIframeOverscroll,
				disableIframeDocumentClickBridge,
				dynamicResourceInterceptionConfig,
				getMarkerId,
				hideVerticalScroll,
				injectMediaScript,
				isEditMode,
				isMediaScenario,
				refreshIframeContent,
				editorRef,
				handleFetchIntercepted,
				postMessageTargetStrategy,
			],
		)

		// 处理iframe中的图片上传请求
		const handleImageUploadRequest = (
			data: ImageUploadRequestPayload | LegacyImageUploadRequestData,
		) => {
			const isStructuredRequest = (
				requestData: ImageUploadRequestPayload | LegacyImageUploadRequestData,
			): requestData is ImageUploadRequestPayload => {
				return (
					"requestId" in requestData &&
					"action" in requestData &&
					"selector" in requestData &&
					"suggestedPath" in requestData
				)
			}

			const postStructuredImageUploadResult = (payload: ImageUploadResultPayload) => {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "IMAGE_UPLOAD_RESULT",
						data: payload,
					},
					"*",
				)
			}

			const fileInput = document.createElement("input")
			fileInput.type = "file"
			fileInput.accept = "image/*"
			fileInput.style.display = "none"
			document.body.appendChild(fileInput)

			fileInput.addEventListener("change", async (e) => {
				const file = (e.target as HTMLInputElement).files?.[0]
				if (!file) {
					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: false,
							cancelled: true,
						})
					}
					document.body.removeChild(fileInput)
					return
				}

				try {
					magicToast.loading({
						content: t("topicFiles.fileUploading"),
						duration: 0,
					})

					const uploadResult = await uploadImageFileToProject({
						file,
						path: isStructuredRequest(data) ? data.suggestedPath : "./images",
						fileSize: file.size,
					})
					const previewUrl = await fileToBase64(file)

					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: true,
							previewUrl,
							relativeFilePath: uploadResult.storedRelativeFilePath,
						})
					} else {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "IMAGE_UPLOAD_RESULT",
								src: previewUrl,
								dataSrc: uploadResult.storedRelativeFilePath,
								targetSelector: data.targetSelector,
							},
							"*",
						)
					}

					pubsub.publish(PubSubEvents.Update_Attachments, () => {
						magicToast.destroy()
						magicToast.success(t("topicFiles.fileUploadSuccess"))
					})
					console.log(
						"图片已转换为base64并发送给iframe",
						iframeRef.current?.contentWindow,
					)
				} catch (error) {
					console.error("转换图片失败:", error)
					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: false,
							error: error instanceof Error ? error.message : "图片转换失败",
						})
					} else {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "IMAGE_UPLOAD_RESULT",
								error: "图片转换失败",
								targetSelector: data.targetSelector,
							},
							"*",
						)
					}
					magicToast.destroy()
					magicToast.error(t("topicFiles.fileUploadError", "文件上传失败"))
				} finally {
					document.body.removeChild(fileInput)
				}
			})

			// 触发文件选择
			try {
				fileInput.click()
			} catch (error) {
				console.error("触发文件选择失败:", error)
				if (isStructuredRequest(data)) {
					postStructuredImageUploadResult({
						requestId: data.requestId,
						action: data.action,
						selector: data.selector,
						success: false,
						error: error instanceof Error ? error.message : "触发文件选择失败",
					})
				}
				document.body.removeChild(fileInput)
			}
		}

		// 将文件转换为base64的工具函数
		const fileToBase64 = (file: File): Promise<string> => {
			return new Promise((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(reader.result as string)
				reader.onerror = () => reject(new Error("文件读取失败"))
				reader.readAsDataURL(file)
			})
		}

		// 创建消息监听器
		const iframeMessageTypes = useMemo(
			() =>
				new Set<string>([
					"iframeReady",
					"pageLoaded",
					"contentLoaded",
					"domReady",
					"renderComplete",
					"pageFullyLoaded",
					"contentMetrics",
					"iframeError",
					"linkClicked",
					"DOWNLOAD_IMAGE",
					"REQUEST_IMAGE_UPLOAD",
					"AI_OPTIMIZATION_ACTION",
					"DOM_CLICK",
					"saveContent",
					"MAGIC_RELOAD_REQUEST",
					"MAGIC_SET_INPUT_MESSAGE",
					"MAGIC_UPLOAD_FILES_REQUEST",
					"MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					"MAGIC_DOWNLOAD_FILES_REQUEST",
					"MAGIC_I18N_LANG_SUBSCRIBE",
					MEDIA_MESSAGE_TYPES.SPEAKER_EDITED,
					MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST,
				]),
			[],
		)

		const buildMessageLogContext = useMemoizedFn(
			(
				event: MessageEvent,
				messageType: string,
				extra: Record<string, unknown> = {},
			): Record<string, unknown> => {
				const href = typeof event.data?.href === "string" ? event.data.href : ""
				const autoEdit = event.data?.autoEdit === true

				return {
					messageType,
					href,
					autoEdit,
					origin: event.origin,
					fileId: fileId || "",
					relativeFilePath: relative_file_path || "",
					isPlaybackMode: Boolean(isPlaybackMode),
					userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
					...extra,
				}
			},
		)

		const handleMessage = useMemoizedFn(async (event: MessageEvent) => {
			const messageType = typeof event.data?.type === "string" ? event.data.type : ""
			const isExpectedSource = event.source === iframeRef.current?.contentWindow
			const isAllowedType = messageType ? iframeMessageTypes.has(messageType) : false
			const shouldStrictlyValidatePreviewSource =
				Boolean(onContentMetrics || onRenderReady) &&
				Boolean(messageType) &&
				[
					"iframeReady",
					"contentLoaded",
					"domReady",
					"renderComplete",
					"pageFullyLoaded",
					"contentMetrics",
				].includes(messageType)

			// 只处理来自iframe的消息，兼容钉钉 WebView source 不一致
			if (!isExpectedSource && !isAllowedType) {
				if (messageType === "linkClicked" || Boolean(event.data?.href)) {
					logger.report(
						"忽略 iframe link 消息：source 不匹配且类型不在白名单",
						buildMessageLogContext(event, messageType, {
							isExpectedSource,
							isAllowedType,
						}),
					)
				}
				return
			}

			if (shouldStrictlyValidatePreviewSource && !isExpectedSource) return

			// 检查是否是 EditorBridge 协议消息（由 MessageBridge 处理）
			// MessageBridge 的监听器会先处理新协议消息（有 version 字段的）
			// 这里只处理旧协议消息（没有 version 字段的）
			if (event.data?.version === "1.0.0") {
				// 新协议消息，由 MessageBridge 处理，这里跳过
				// 注意：MessageBridge 的监听器和这个监听器都会收到消息
				// MessageBridge 会处理新协议消息，这里只处理旧协议消息
				return
			}

			try {
				// 处理旧协议消息（没有 version 字段的）

				if (event.data && event.data.type === "iframeError") {
					const payload = event.data.payload || {}
					logger.error(
						"iframe 内部错误",
						buildMessageLogContext(event, messageType, {
							isExpectedSource,
							isAllowedType,
							errorType: payload.errorType,
							errorMessage: payload.message,
							errorStack: payload.stack,
							errorSource: payload.source,
							errorLineno: payload.lineno,
							errorColno: payload.colno,
						}),
					)
					return
				}

				if (event.data && event.data.type === "iframeReady") {
					// iframe已准备好接收内容
					setIframeLoaded(true)
				} else if (
					event.data &&
					event.data.type === "pageLoaded" &&
					renderSiteOrigin &&
					event.origin === renderSiteOrigin
				) {
					// 跨域渲染站 load 后再次兜底置为 ready，避免早期 iframeReady 丢失
					setIframeLoaded(true)
				} else if (event.data && event.data.type === "contentLoaded") {
					// 内容已写入iframe，但可能还未完成渲染
					// 如果处于编辑模式，重置 contentInjected 状态以触发脚本重新注入
					// 因为 setContent 会清除 iframe 中的所有脚本，需要重新注入编辑脚本
					if (isEditMode) {
						// 重置 contentInjected 状态，这会触发 useHTMLEditorV2 中的 effect 重新运行
						// 从而重新注入编辑脚本并恢复编辑模式
						setContentInjected(false)
						// 使用 setTimeout 确保状态更新后立即重新设置为 true，触发 effect
						setTimeout(() => {
							setContentInjected(true)
						}, 0)
					}
				} else if (event.data && event.data.type === "domReady") {
					// DOM树构建完成
				} else if (event.data && event.data.type === "renderComplete") {
					// iframe渲染真正完成，现在可以安全地计算缩放比例
					notifyRenderReady()
				} else if (event.data && event.data.type === "pageFullyLoaded") {
					// 页面完全加载完成（包括图片、样式表等）
					notifyRenderReady()
					// When sandbox doesn't support contentMetrics, unblock scaling after timeout
					if (waitForSettledContentMetrics) {
						if (contentMetricsFallbackTimerRef.current) {
							clearTimeout(contentMetricsFallbackTimerRef.current)
						}
						contentMetricsFallbackTimerRef.current = setTimeout(() => {
							setScalingContentMetrics((prev) => {
								if (prev?.phase === "settled") return prev
								const w = iframeRef.current?.offsetWidth ?? 0
								const h = iframeRef.current?.offsetHeight ?? 0
								if (w <= 0 || h <= 0) return prev
								return { contentWidth: w, contentHeight: h, phase: "settled" }
							})
						}, 1000)
					}
				} else if (event.data && event.data.type === "contentMetrics") {
					const contentWidth = Number(event.data?.contentWidth)
					const contentHeight = Number(event.data?.contentHeight)

					if (
						Number.isFinite(contentWidth) &&
						contentWidth > 0 &&
						Number.isFinite(contentHeight) &&
						contentHeight > 0
					) {
						const metricsPhase = event.data?.phase === "settled" ? "settled" : "initial"
						// Real settled metrics arrived — cancel fallback timer
						if (metricsPhase === "settled" && contentMetricsFallbackTimerRef.current) {
							clearTimeout(contentMetricsFallbackTimerRef.current)
							contentMetricsFallbackTimerRef.current = null
						}
						const metricsPayload = {
							contentWidth,
							contentHeight,
							phase: metricsPhase,
							hasHorizontalOverflow: event.data?.hasHorizontalOverflow === true,
							hasVerticalOverflow: event.data?.hasVerticalOverflow === true,
							verticalScrollbarWidth: Math.max(
								0,
								Number(event.data?.verticalScrollbarWidth) || 0,
							),
						}

						setScalingContentMetrics((prev) => {
							if (prev?.phase === "settled" && metricsPhase !== "settled") {
								return prev
							}

							return {
								contentWidth,
								contentHeight,
								phase: metricsPhase,
							}
						})
						onContentMetrics?.({
							contentWidth,
							contentHeight,
							phase: metricsPhase,
							hasHorizontalOverflow: metricsPayload.hasHorizontalOverflow,
							hasVerticalOverflow: metricsPayload.hasVerticalOverflow,
							verticalScrollbarWidth: metricsPayload.verticalScrollbarWidth,
						})
					}
				} else if (event.data && event.data.type === "linkClicked") {
					// 如果是回放模式，不处理链接点击
					if (isPlaybackMode) {
						logger.report(
							"回放模式忽略 iframe 链接点击",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isAllowedType,
							}),
						)
						return
					}

					const href = typeof event.data?.href === "string" ? event.data.href : ""
					const autoEdit = event.data?.autoEdit === true

					try {
						openNewTab(fileId || "", href, autoEdit)
					} catch (error) {
						logger.error(
							"处理 iframe 链接点击失败",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isAllowedType,
								href,
								autoEdit,
								errorMessage:
									error instanceof Error ? error.message : String(error),
								errorStack: error instanceof Error ? error.stack : undefined,
							}),
							error,
						)
					}
				} else if (event.data && event.data.type === "DOWNLOAD_IMAGE") {
					console.log("下载图片", event.data)
					if (!event.data?.data?.dataUrl) {
						return
					}
					const link = document.createElement("a")
					link.download = event.data?.data?.fileName || ""
					link.href = event.data?.data?.dataUrl || ""

					// 触发下载
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
					console.log("图片下载成功")
				} else if (event.data && event.data.type === "REQUEST_IMAGE_UPLOAD") {
					if (!isExpectedSource) {
						logger.report(
							"忽略跨实例图片上传消息：source 不匹配",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isAllowedType,
							}),
						)
						return
					}
					console.log("iframe请求图片上传", event.data)
					handleImageUploadRequest(event.data.data)
				} else if (event.data && event.data.type === "AI_OPTIMIZATION_ACTION") {
					console.log("AI优化操作", event.data)
					addContentToChat({
						attachmentList,
						file_id: fileId,
						t,
						payload: event.data,
					})
				} else if (event.data.type === "DOM_CLICK") {
					// console.log("DOM点击", event.data)
					// 关闭所有下拉菜单
					pubsub.publish(PubSubEvents.Close_All_Dropdowns)
					containerRef?.current?.click?.()
				} else if (event.data && event.data.type === "saveContent") {
					// Note: Legacy save mechanism (V1 editing script)
					// V2 editing mechanism uses MessageBridge and editorRef.current.save() instead
					// This is kept for backward compatibility if V1 script is still used somewhere
					console.log("收到旧版保存消息 (V1)", event.data)
					if (saveEditContent && typeof saveEditContent === "function") {
						const newContent = filterInjectedTags(event.data.content, filePathMapping)
						saveEditContent(newContent, String(fileId))
					}
				} else if (event.data && event.data.type === MEDIA_MESSAGE_TYPES.SPEAKER_EDITED) {
					// 处理媒体说话人编辑事件
					handleMediaSpeakerEdit(event.data.detail)
				} else if (
					event.data &&
					event.data.type === MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST
				) {
					// 处理marked.js图片路径解析请求
					await handleMediaImageUrlRequest(event, attachmentList || [], fileId || "")
				} else if (event.data && event.data.type === "MAGIC_RELOAD_REQUEST") {
					// 处理 window.Magic.reload() 请求
					reloadIframeContent()
				} else if (event.data && event.data.type === "MAGIC_SET_INPUT_MESSAGE") {
					// 处理 window.Magic.setInputMessage() 请求
					const message = event.data.message
					if (typeof message === "string") {
						pubsub.publish(PubSubEvents.Set_Input_Message, message)
					}
				} else if (event.data && event.data.type === "MAGIC_UPLOAD_FILES_REQUEST") {
					// 处理 window.Magic.uploadFiles() 请求
					handleMagicUploadFiles(event.data)
				} else if (event.data && event.data.type === "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST") {
					// 处理 window.Magic.addFilesToMessage() 请求
					handleMagicAddFilesToMessage(event.data)
				} else if (event.data && event.data.type === "MAGIC_DOWNLOAD_FILES_REQUEST") {
					// 处理 window.Magic.downloadFiles() 请求
					handleMagicDownloadFiles(event.data)
				} else if (event.data && event.data.type === "MAGIC_I18N_LANG_SUBSCRIBE") {
					// 处理 window.Magic.i18n.subscribe() 请求
					const payload = event.data as MagicI18nLangSubscribeRequest
					hasIframeI18nSubscriberRef.current = true
					notifyIframeI18nLang("subscribe_ack", payload.requestId)
				}

				if (event.data && event.data.originalKey === "Escape") {
					pubsub.publish(PubSubEvents.Exit_Fullscreen)
				}
			} catch (error) {
				logger.error(
					"处理 iframe message 失败",
					buildMessageLogContext(event, messageType, {
						isExpectedSource,
						isAllowedType,
						errorMessage: error instanceof Error ? error.message : String(error),
						errorStack: error instanceof Error ? error.stack : undefined,
					}),
					error,
				)
			}
		})
		// 处理 iframe 内容更新
		// 跨域模式：必须等 iframe 加载完成并收到 iframeReady 后再发 setContent，否则消息会丢失
		useDeepCompareEffect(() => {
			if (sandboxType !== "iframe" || !iframeRef.current || !content) return
			const canSendContent = !renderSiteUrl || iframeLoaded
			if (!canSendContent) return

			hasRenderedOnceRef.current = false
			try {
				refreshIframeContent()
				setContentInjected(true)
			} catch (error) {
				console.error("处理iframe内容时出错:", error)
				setContentInjected(false)
			}
		}, [content, iframeLoaded, renderSiteUrl])

		useEffect(() => {
			if (!isPptRender) return
			if (sandboxType !== "iframe") return
			if (!iframeRef.current?.contentWindow) return
			if (!contentInjected) return
			// Pause animations when slide is not visible
			iframeRef.current.contentWindow.postMessage(
				{
					type: "setAnimationState",
					paused: !isVisible,
				},
				"*",
			)
		}, [contentInjected, isPptRender, isVisible, sandboxType])

		useEffect(() => {
			if (sandboxType !== "iframe") return

			const handleLanguageChanged = () => {
				if (!hasIframeI18nSubscriberRef.current) return
				notifyIframeI18nLang("language_changed")
			}

			i18n.on("languageChanged", handleLanguageChanged)
			return () => {
				i18n.off("languageChanged", handleLanguageChanged)
			}
		}, [i18n, notifyIframeI18nLang, sandboxType])

		useLayoutEffect(() => {
			window.addEventListener("message", handleMessage)
			return () => {
				window.removeEventListener("message", handleMessage)
			}
			//eslint-disable-next-line react-hooks/exhaustive-deps
		}, [])

		// 提供手动保存方法
		const triggerSave = useMemoizedFn(async () => {
			if (isMediaScenario) {
				// Media场景直接保存说话人配置
				saveMediaConfiguration()
			} else if (isEditMode && editorRef.current) {
				// 使用新的编辑机制 V2 保存
				try {
					const saveResult = await editorRef.current.save()
					console.log("[IsolatedHTMLRenderer] 保存结果:", {
						success: saveResult.success,
						fileId: saveResult.fileId,
						contentLength: saveResult.cleanContent.length,
					})

					if (!saveResult.success) {
						console.error("[IsolatedHTMLRenderer] 保存失败")
					}

					// 返回保存结果，方便调用方获取
					return saveResult
				} catch (error) {
					console.error("保存内容时出错:", error)
					throw error
				}
			}
		})

		// 将保存方法暴露给父组件
		useEffect(() => {
			if (onSaveReady && iframeLoaded) {
				onSaveReady(triggerSave)
			}
		}, [iframeLoaded, onSaveReady, isMediaScenario, triggerSave])

		return (
			<div
				ref={scrollContainerRef}
				className={cx(
					styles.rendererContainer,
					hideVerticalScroll && styles.hiddenScrollbar,
					"relative flex min-h-0 w-full flex-1",
					className,
				)}
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					overflow: hideVerticalScroll ? "hidden" : undefined,
				}}
			>
				{/* 工具栏 - 固定在顶部，不滚动 */}
				{sandboxType === "iframe" && isEditMode && (
					<>
						<StylePanel
							editorRef={editorRef as React.RefObject<HTMLEditorV2Ref>}
							disabled={isSaving}
							toolbarEndRef={toolbarEndRef}
							className={cn(
								"w-full flex-shrink-0",
								isPptRender &&
									`absolute left-1/2 ${TAILWIND_Z_INDEX_CLASSES.TOOLBAR.STYLE_PANEL} top-[10px] w-[98%] -translate-x-1/2 rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60`,
								toolbarClassName,
							)}
						/>
						{/* 缩放控件 - 绝对定位在工具栏下方 */}
						{isPptRender && (
							<div className="absolute bottom-[10px] right-[10px] z-50 rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60">
								<ZoomControls
									currentScale={scaleRatio}
									onScaleChange={handleScaleChange}
									onResetZoom={handleResetZoom}
									disabled={isSaving}
								/>
							</div>
						)}
					</>
				)}

				{/* 可滚动内容容器 */}
				<div
					ref={containerRef}
					className={cx(
						hideVerticalScroll && styles.hiddenScrollbar,
						cn(
							"relative flex min-h-0 w-full flex-1 flex-col",
							shouldApplyScaling && isFullscreen && "bg-black",
							shouldApplyScaling && !isFullscreen && "bg-[#eee] dark:bg-[#1c1c1c]",
						),
					)}
					style={{
						overflow: hideVerticalScroll
							? "hidden"
							: shouldApplyScaling
								? isManualZoom
									? "auto"
									: "hidden"
								: "auto",
						minHeight: 0,
					}}
				>
					{/* 内容包装器，使用 flex 居中 iframe */}
					<div
						ref={contentWrapperRef}
						className="relative h-full min-h-0 w-full"
						style={getContentWrapperStyle()}
					>
						{sandboxType === "iframe" ? (
							<>
								<iframe
									ref={iframeRef}
									className={cn(
										styles.iframe,
										"h-full w-full flex-shrink-0 border-none",
										iframeClassName,
									)}
									title="Isolated HTML Content"
									src={renderSiteUrl || undefined}
									sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
									allow="fullscreen"
									allowFullScreen
									translate="no"
									style={getIframeStyle(hasRenderedOnceRef.current)}
								/>
								{/* 选择覆盖层 - 在父窗口中渲染元素高亮 */}
								{isEditMode && (
									<SelectionOverlay
										containerRef={contentWrapperRef}
										scrollContainerRef={scrollContainerRef}
										iframeRef={iframeRef}
										editorRef={editorRef}
										scaleRatio={scaleRatio}
										isPptRender={shouldApplyScaling}
										disabled={isSaving}
										onSelectedElementChange={setSelectedElementRect}
									/>
								)}
								{/* 日志面板 - 用于查看运行时日志的开发工具 */}
								{isEditMode && process.env.NODE_ENV === "development" && (
									<LogPanel iframeRef={iframeRef} />
								)}
							</>
						) : (
							<div className={styles.shadowHost} translate="no" />
						)}
					</div>
				</div>
			</div>
		)
	},
)

// 包装组件，提供 StylePanelStore 上下文
const IsolatedHTMLRendererComponent = forwardRef<
	IsolatedHTMLRendererRef,
	IsolatedHTMLRendererProps
>((props, ref) => {
	return (
		<StylePanelStoreProvider>
			<IsolatedHTMLRendererInner ref={ref} {...props} />
		</StylePanelStoreProvider>
	)
})

export default IsolatedHTMLRendererComponent
