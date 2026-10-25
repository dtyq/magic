import { useCallback, useEffect, useRef, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { MessageBridge } from "../iframe-bridge/bridge/MessageBridge"
import { useStylePanelStore } from "../iframe-bridge/contexts/StylePanelContext"
import {
	EditorMessageType,
	ElementSelectedPayload,
	SelectionModeChangedPayload,
	HistoryState,
	IframeZoomRequestPayload,
	ImageActionPayload,
} from "../iframe-bridge/types/messages"
import type { DomTreeNode, DomTreeResponse } from "../iframe-bridge/types/messages"
import type { HTMLEditorV2Ref, PPTBuildEntry, PPTBuildUpdate } from "../iframe-bridge/types/props"
import { filterInjectedTags } from "../utils"

interface UseHTMLEditorV2Options {
	/** iframe 元素引用 */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 是否处于编辑模式 */
	isEditMode?: boolean
	/** Select elements for animation metadata without enabling visual editing. */
	isPPTBuildMode?: boolean
	/** 沙箱类型 */
	sandboxType?: "iframe" | "shadow-dom"
	/** iframe 是否已加载 */
	iframeLoaded: boolean
	/** 内容是否已注入 */
	contentInjected: boolean
	/** 回发 iframe 的严格目标源 */
	targetOrigin: string
	/** 缩放比例 */
	scaleRatio?: number
	/** 保存编辑内容的回调 */
	saveEditContent?: (
		content: string,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<boolean | void>
	/** 清理编辑器标记后、提交保存前，合并宿主维护的最新元数据 */
	prepareSaveContent?: (content: string) => string
	/** 文件 ID */
	fileId?: string
	/** 文件路径映射 */
	filePathMapping: Map<string, string>
	/** editorRef 引用（用于暴露给父组件） */
	editorRef: React.RefObject<HTMLEditorV2Ref>
	/** 是否是 PPT 渲染 */
	isPptRender?: boolean
	/** zoom request callback from iframe */
	onZoomRequest?: (delta: number) => void
	/** iframe 内容发生变化时通知宿主刷新依赖内容结构的视图 */
	onContentChanged?: () => void
}

/**
 * HTMLEditor V2 Hook
 * 管理 V2 编辑脚本的注入、MessageBridge 的初始化和编辑器 ref 的创建
 */
export function useHTMLEditorV2(options: UseHTMLEditorV2Options) {
	const { t } = useTranslation("super")
	const {
		iframeRef,
		isEditMode: fullEditMode,
		isPPTBuildMode = false,
		sandboxType = "iframe",
		iframeLoaded,
		contentInjected,
		targetOrigin,
		scaleRatio,
		saveEditContent,
		prepareSaveContent,
		fileId,
		filePathMapping,
		editorRef,
		isPptRender,
		onZoomRequest,
		onContentChanged,
	} = options
	const isEditMode = Boolean(fullEditMode || isPPTBuildMode)
	const fullEditModeRef = useRef(Boolean(fullEditMode))
	fullEditModeRef.current = Boolean(fullEditMode)

	const stylePanelStore = useStylePanelStore()
	const messageBridgeRef = useRef<MessageBridge | null>(null)
	const [isRuntimeReady, setIsRuntimeReady] = useState(false)
	const [isEditorReady, setIsEditorReady] = useState(false)
	const activationRetryTimerRef = useRef<number | null>(null)
	const prevContentInjectedRef = useRef(false)
	const contentInjectedRef = useRef(contentInjected)
	// 记录早于 contentInjected 恢复到达的 EDITOR_READY
	const hasPendingRuntimeReadyRef = useRef(false)
	const prevIsEditModeRef = useRef(Boolean(isEditMode))
	const desiredEditModeRef = useRef(Boolean(isEditMode))
	const stylePanelStoreRef = useRef(stylePanelStore)
	const onZoomRequestRef = useRef(onZoomRequest)
	const onContentChangedRef = useRef(onContentChanged)
	const prepareSaveContentRef = useRef(prepareSaveContent)
	const editTransitionIdRef = useRef(0)
	const editLifecycleRef = useRef<"idle" | "activating" | "active" | "deactivating">("idle")

	const clearActivationRetry = useCallback(() => {
		if (activationRetryTimerRef.current !== null) {
			window.clearTimeout(activationRetryTimerRef.current)
			activationRetryTimerRef.current = null
		}
	}, [])

	stylePanelStoreRef.current = stylePanelStore
	onZoomRequestRef.current = onZoomRequest
	onContentChangedRef.current = onContentChanged
	prepareSaveContentRef.current = prepareSaveContent
	desiredEditModeRef.current = Boolean(isEditMode)
	contentInjectedRef.current = contentInjected

	const getActiveBridge = useCallback(() => {
		if (!messageBridgeRef.current?.isActive()) return null
		return messageBridgeRef.current
	}, [])

	const isCurrentTransition = useCallback((transitionId: number) => {
		return transitionId === editTransitionIdRef.current
	}, [])

	const runExitEditFlow = useCallback(
		async (transitionId: number) => {
			if (!isCurrentTransition(transitionId)) return
			setIsEditorReady(false)

			try {
				const bridge = getActiveBridge()
				if (bridge) {
					if (!isCurrentTransition(transitionId)) return
					await bridge.request(EditorMessageType.SET_PPT_BUILD_MODE, { enabled: false })
					if (!isCurrentTransition(transitionId)) return
					await bridge.request(EditorMessageType.EXIT_EDIT_MODE)

					if (!isCurrentTransition(transitionId)) return
					const latestBridge = getActiveBridge()
					if (!latestBridge) return

					await latestBridge.request(EditorMessageType.EXIT_SELECTION_MODE)
				}
			} catch (error) {
				console.debug("Exit edit mode request failed:", error)
			} finally {
				if (isCurrentTransition(transitionId)) {
					editLifecycleRef.current = "idle"
					stylePanelStoreRef.current.reset()
				}
			}
		},
		[getActiveBridge, isCurrentTransition],
	)

	const runEnterEditFlow = useCallback(
		async (transitionId: number) => {
			try {
				console.log("[useHTMLEditorV2] Runtime ready, entering edit mode")
				const bridge = getActiveBridge()
				if (!bridge) return

				const fullEditing = fullEditModeRef.current
				await bridge.request(EditorMessageType.SET_PPT_BUILD_MODE, { enabled: false })
				if (!isCurrentTransition(transitionId) || !desiredEditModeRef.current) return
				await bridge.request(
					fullEditing
						? EditorMessageType.ENTER_EDIT_MODE
						: EditorMessageType.EXIT_EDIT_MODE,
				)
				if (!isCurrentTransition(transitionId) || !desiredEditModeRef.current) return
				if (!fullEditing)
					await bridge.request(EditorMessageType.SET_PPT_BUILD_MODE, { enabled: true })

				if (!isCurrentTransition(transitionId) || !desiredEditModeRef.current) return

				const latestBridge = getActiveBridge()
				if (!latestBridge || latestBridge !== bridge) return

				await latestBridge.request(EditorMessageType.ENTER_SELECTION_MODE)

				if (
					isCurrentTransition(transitionId) &&
					desiredEditModeRef.current &&
					getActiveBridge() === bridge
				) {
					editLifecycleRef.current = "active"
					setIsEditorReady(true)
				}
			} catch (error) {
				if (isCurrentTransition(transitionId)) {
					editLifecycleRef.current = "idle"
					setIsEditorReady(false)
				}
				console.error("[useHTMLEditorV2] Failed to enter edit flow:", error)
			}
		},
		[getActiveBridge, isCurrentTransition],
	)

	// 管理 MessageBridge 生命周期（与编辑模式解耦）
	useEffect(() => {
		if (!iframeLoaded || !iframeRef.current || sandboxType !== "iframe") {
			setIsRuntimeReady(false)
			setIsEditorReady(false)
			if (messageBridgeRef.current?.isActive()) {
				messageBridgeRef.current.destroy()
			}
			messageBridgeRef.current = null
			return
		}

		// 创建 MessageBridge 实例
		const bridge = new MessageBridge(iframeRef.current, targetOrigin)
		messageBridgeRef.current = bridge

		// 监听 EDITOR_READY 事件
		bridge.on("EDITOR_READY", () => {
			console.log("[useHTMLEditorV2] iframe-runtime 已准备就绪")
			clearActivationRetry()
			// 跨域刷新时，ready 可能早于宿主状态恢复
			if (!contentInjectedRef.current) {
				hasPendingRuntimeReadyRef.current = true
			}
			setIsRuntimeReady(true)
		})

		// 监听 ELEMENT_SELECTED 事件
		bridge.on(EditorMessageType.ELEMENT_SELECTED, (message) => {
			const payload = message.payload as ElementSelectedPayload
			const store = stylePanelStoreRef.current
			// 更新 StylePanelStore
			store.selectElement({
				selector: payload.selector,
				tagName: payload.tagName,
				isImageElement: payload.isImageElement,
				intrinsicWidth: payload.intrinsicWidth,
				intrinsicHeight: payload.intrinsicHeight,
				intrinsicAspectRatio: payload.intrinsicAspectRatio,
				isTextElement: payload.isTextElement,
				hasDirectTextContent: payload.hasDirectTextContent,
				textContent: payload.textContent,
				ancestors: payload.ancestors,
				inlineStyles: payload.inlineStyles,
				attributes: payload.attributes,
				computedStyles: payload.computedStyles,
			})
		})
		bridge.on(EditorMessageType.DYNAMIC_ELEMENT_CLICKED, () => {
			magicToast.info(t("htmlEditor.dynamicElementNotEditable"))
		})

		// 监听 ELEMENTS_DESELECTED 事件
		bridge.on(EditorMessageType.ELEMENTS_DESELECTED, () => {
			const store = stylePanelStoreRef.current
			// Only clear selected elements, but keep selection mode active
			// This is important during operations like zooming where selection should persist
			store.clearSelectedElements()
			// Do NOT set isSelectionMode = false here!
		})

		// 监听选择模式变化
		bridge.on(EditorMessageType.SELECTION_MODE_CHANGED, (message) => {
			const payload = message.payload as SelectionModeChangedPayload
			stylePanelStoreRef.current.setSelectionMode(payload.isSelectionMode)
		})

		// 监听历史状态变化
		bridge.on(EditorMessageType.HISTORY_STATE_CHANGED, (message) => {
			const payload = message.payload as HistoryState
			stylePanelStoreRef.current.updateHistoryState({
				canUndo: payload.canUndo,
				canRedo: payload.canRedo,
				currentIndex: payload.currentIndex,
				totalCommands: payload.totalCommands,
			})
		})

		bridge.on(EditorMessageType.CONTENT_CHANGED, () => {
			onContentChangedRef.current?.()
		})

		// Listen to zoom requests from iframe (trackpad pinch-to-zoom)
		bridge.on(EditorMessageType.IFRAME_ZOOM_REQUEST, (message) => {
			if (onZoomRequestRef.current && message.payload) {
				const payload = message.payload as IframeZoomRequestPayload
				onZoomRequestRef.current(payload.delta)
			}
		})

		return () => {
			clearActivationRetry()
			if (bridge.isActive()) {
				console.log("[useHTMLEditorV2] Cleaning up MessageBridge")
				bridge.destroy()
			}

			if (messageBridgeRef.current === bridge) {
				messageBridgeRef.current = null
			}

			setIsRuntimeReady(false)
			setIsEditorReady(false)
			editLifecycleRef.current = "idle"
		}
	}, [clearActivationRetry, sandboxType, iframeLoaded, iframeRef, targetOrigin])

	// 创建编辑器 ref 接口（实现 HTMLEditorV2Ref）
	useImperativeHandle(
		editorRef,
		() => ({
			getIframeElement: () => iframeRef.current,
			getPPTBuilds: async () => {
				const bridge = getActiveBridge()
				if (!bridge) throw new Error("PPT_BUILD_EDITOR_NOT_READY")
				return bridge.request<PPTBuildEntry[]>(EditorMessageType.GET_PPT_BUILDS)
			},
			updatePPTBuilds: async (updates: PPTBuildUpdate[]) => {
				const bridge = getActiveBridge()
				if (!bridge || !desiredEditModeRef.current || editLifecycleRef.current !== "active")
					throw new Error("PPT_BUILD_EDITOR_NOT_READY")
				await bridge.sendCommand(
					EditorMessageType.UPDATE_PPT_BUILDS,
					{ updates },
					{ description: "Update presentation builds", canUndo: true },
				)
			},
			setPPTBuildMarkers: async (visible: boolean) => {
				const bridge = getActiveBridge()
				if (!bridge) {
					if (!visible) return
					throw new Error("PPT_BUILD_EDITOR_NOT_READY")
				}
				if (
					visible &&
					(!desiredEditModeRef.current || editLifecycleRef.current !== "active")
				)
					throw new Error("PPT_BUILD_EDITOR_NOT_READY")
				await bridge.request(EditorMessageType.SET_PPT_BUILD_MARKERS, { visible })
			},
			previewPPTBuild: async (steps: number | null, animate = false) => {
				const bridge = getActiveBridge()
				if (!bridge) {
					if (steps === null) return
					throw new Error("PPT_BUILD_EDITOR_NOT_READY")
				}
				await bridge.request(EditorMessageType.PREVIEW_PPT_BUILD, { steps, animate })
			},
			save: async () => {
				console.log("[useHTMLEditorV2] save content", fileId)

				// Default return value for failure cases
				const defaultResult = {
					cleanContent: "",
					rawContent: "",
					fileId: fileId,
					success: false,
				}

				if (!saveEditContent || !fileId) {
					console.warn(
						"[useHTMLEditorV2] save skipped: missing saveEditContent or fileId",
					)
					return defaultResult
				}

				if (!messageBridgeRef.current) {
					console.error("[useHTMLEditorV2] save failed: MessageBridge not initialized")
					return defaultResult
				}

				// Ensure text editing is disabled before saving to prevent contenteditable from being saved
				const selectedSelector = stylePanelStore.selectedElement?.selector
				if (selectedSelector) {
					try {
						await messageBridgeRef.current.request(
							EditorMessageType.DISABLE_TEXT_EDITING,
							{ selector: selectedSelector },
						)
					} catch (error) {
						console.debug("Failed to disable text editing before save:", error)
					}
				}

				try {
					const result = await messageBridgeRef.current.request(
						EditorMessageType.GET_CONTENT,
					)

					console.log("[useHTMLEditorV2] save result", result)

					const htmlForClean = result?.cleanHtml
					if (!htmlForClean) {
						console.error("[useHTMLEditorV2] save failed: no html in result")
						return defaultResult
					}

					const filteredContent = filterInjectedTags(htmlForClean, filePathMapping)
					// Read the latest metadata after GET_CONTENT finishes, then use this exact
					// snapshot for both persistence and the caller's saved-content baseline.
					const cleanContent =
						prepareSaveContentRef.current?.(filteredContent) ?? filteredContent
					const saved = await saveEditContent(
						cleanContent,
						String(fileId),
						true,
						undefined,
						isPptRender,
					)
					if (saved === false) return defaultResult

					return {
						cleanContent,
						rawContent: result?.html || result?.cleanHtml,
						fileId: fileId,
						success: true,
					}
				} catch (error) {
					console.error("[useHTMLEditorV2] save failed with error:", error)
					return {
						...defaultResult,
						success: false,
					}
				}
			},
			undo: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.UNDO)
			},
			redo: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.REDO)
			},
			getContent: async () => {
				if (!messageBridgeRef.current) return ""
				const result = await messageBridgeRef.current.request(EditorMessageType.GET_CONTENT)
				return result?.html || ""
			},
			getCleanContent: async () => {
				if (!messageBridgeRef.current) return ""
				const result = await messageBridgeRef.current.request(
					EditorMessageType.GET_CLEAN_CONTENT,
				)
				return result?.cleanHtml || ""
			},
			getHistoryState: async () => {
				if (!messageBridgeRef.current)
					return {
						canUndo: false,
						canRedo: false,
						currentIndex: 0,
						totalCommands: 0,
						undoStack: [],
						redoStack: [],
					}
				return await messageBridgeRef.current.request(EditorMessageType.GET_HISTORY_STATE)
			},
			setBackgroundColor: async (selector: string, color: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.SET_BACKGROUND_COLOR,
					{ selector, color },
					{ description: `设置背景颜色为 ${color}`, canUndo: true },
				)
			},
			setTextColor: async (selector: string, color: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.SET_TEXT_COLOR,
					{ selector, color },
					{ description: `设置文字颜色为 ${color}`, canUndo: true },
				)
			},
			setFontSize: async (
				selector: string,
				fontSize: string | number,
				unit: "px" | "em" | "rem" = "px",
			) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.SET_FONT_SIZE,
					{ selector, fontSize, unit },
					{ description: `设置字体大小为 ${fontSize}${unit}`, canUndo: true },
				)
			},
			adjustFontSizeRecursive: async (
				selector: string,
				scaleFactor: number,
				minFontSize = 8,
			) => {
				if (!messageBridgeRef.current) return
				const direction = scaleFactor > 1 ? "增大" : "缩小"
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.ADJUST_FONT_SIZE_RECURSIVE,
					{ selector, scaleFactor, minFontSize },
					{ description: `${direction}字号（包含子元素）`, canUndo: true },
				)
			},
			setBatchStyles: async (selector: string, styles: Record<string, string>) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.BATCH_STYLES,
					{ selector, styles },
					{ description: "批量设置样式", canUndo: true },
				)
			},
			setBatchStylesMultiple: async (selectors: string[], styles: Record<string, string>) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.BATCH_STYLES_MULTIPLE,
					{ selectors, styles },
					{ description: "批量设置多个元素样式", canUndo: true },
				)
			},
			beginBatchOperation: async (selector: string, styles: Record<string, string>) => {
				const bridge = messageBridgeRef.current
				if (!bridge?.isActive()) throw new Error("HTML editor bridge is unavailable")
				await bridge.sendCommand(
					EditorMessageType.BEGIN_BATCH_OPERATION,
					{ selector, styles },
					{ description: "开始批量操作", canUndo: false },
				)
			},
			endBatchOperation: async (selector: string, styles: Record<string, string>) => {
				const bridge = messageBridgeRef.current
				if (!bridge?.isActive()) throw new Error("HTML editor bridge is unavailable")
				await bridge.sendCommand(
					EditorMessageType.END_BATCH_OPERATION,
					{ selector, styles },
					{ description: "结束批量操作", canUndo: true },
				)
			},
			cancelBatchOperation: async () => {
				const bridge = messageBridgeRef.current
				if (!bridge?.isActive()) throw new Error("HTML editor bridge is unavailable")
				await bridge.sendCommand(
					EditorMessageType.CANCEL_BATCH_OPERATION,
					{},
					{ description: "取消批量操作", canUndo: false },
				)
			},
			applyStylesTemporary: async (selector: string, styles: Record<string, string>) => {
				const bridge = messageBridgeRef.current
				if (!bridge?.isActive()) throw new Error("HTML editor bridge is unavailable")
				return bridge.sendCommand(
					EditorMessageType.APPLY_STYLES_TEMPORARY,
					{ selector, styles },
					{ description: "临时应用样式", canUndo: false },
				)
			},
			enterEditMode: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.ENTER_EDIT_MODE)
			},
			exitEditMode: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.EXIT_EDIT_MODE)
			},
			clearHistory: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.CLEAR_HISTORY)
			},
			enableSelectionMode: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.ENTER_SELECTION_MODE)
			},
			disableSelectionMode: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.EXIT_SELECTION_MODE)
			},
			resetEditorState: async () => {
				// Clear the selected element in iframe runtime (but keep selection mode active)
				// This is needed because the DOM has been updated and old selectors are invalid
				if (messageBridgeRef.current) {
					await messageBridgeRef.current
						.request(EditorMessageType.CLEAR_SELECTION)
						.catch((error) => {
							console.debug("清除选中元素:", error.message || error)
						})
				}
				// Clear all selected items in StylePanelStore while keeping selection mode active.
				// Note: Don't use clearSelection() as it also sets isSelectionMode to false.
				stylePanelStore.clearSelectedElements()
			},
			selectElement: async (selector: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.SELECT_ELEMENT, {
					selector,
				})
			},
			getDomTree: async () => {
				// DOM structure handlers are registered by EditorRuntime. Returning null
				// before EDITOR_READY lets the panel retry instead of waiting for a bridge
				// timeout while the iframe is still activating.
				if (!messageBridgeRef.current || !isRuntimeReady || !contentInjected) return null
				return await messageBridgeRef.current.request(EditorMessageType.GET_DOM_TREE)
			},
			selectDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current || !isRuntimeReady || !contentInjected) return
				await messageBridgeRef.current.request(EditorMessageType.SELECT_ELEMENT, { nodeId })
			},
			hoverDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current || !isRuntimeReady || !contentInjected) return
				await messageBridgeRef.current.request(EditorMessageType.HOVER_ELEMENT, { nodeId })
			},
			clearHoveredDomNode: async () => {
				if (!messageBridgeRef.current || !isRuntimeReady || !contentInjected) return
				await messageBridgeRef.current.request(EditorMessageType.CLEAR_HOVER_ELEMENT)
			},
			scrollToDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current || !isRuntimeReady || !contentInjected) return
				await messageBridgeRef.current.request(EditorMessageType.SCROLL_TO_ELEMENT, {
					nodeId,
				})
			},
			moveDomNode: async (nodeId: string, targetParentId: string, targetIndex: number) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.MOVE_DOM_NODE,
					{ nodeId, targetParentId, targetIndex },
					{ description: "调整 DOM 层级", canUndo: true },
				)
			},
			beginDomMovePreview: async (nodeId: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.BEGIN_DOM_MOVE_PREVIEW,
					{ nodeId },
					{ description: "开始预览 DOM 调整", canUndo: false },
				)
			},
			previewDomMove: async (
				nodeId: string,
				targetNodeId: string,
				position: "before" | "inside" | "after",
			): Promise<boolean> => {
				if (!messageBridgeRef.current) return false
				const result = await messageBridgeRef.current.sendCommand<{ applied?: boolean }>(
					EditorMessageType.PREVIEW_DOM_MOVE,
					{ nodeId, targetNodeId, position },
					{ description: "预览 DOM 调整", canUndo: false },
				)
				return result?.applied !== false
			},
			commitDomMovePreview: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.COMMIT_DOM_MOVE_PREVIEW,
					{},
					{ description: "调整 DOM 层级", canUndo: true },
				)
			},
			cancelDomMovePreview: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.CANCEL_DOM_MOVE_PREVIEW,
					{},
					{ description: "取消 DOM 调整预览", canUndo: false },
				)
			},
			insertTextNode: async (parentNodeId: string, textContent: string, index?: number) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.INSERT_TEXT_NODE,
					{ parentNodeId, textContent, index },
					{ description: "新增文字", canUndo: true },
				)
			},
			insertImageNode: async (parentNodeId: string, index?: number) => {
				if (!messageBridgeRef.current) return
				const tree = await messageBridgeRef.current.request<DomTreeResponse>(
					EditorMessageType.GET_DOM_TREE,
				)
				const findNode = (node?: DomTreeNode): DomTreeNode | null => {
					if (node?.nodeId === parentNodeId) return node
					for (const child of node?.children || []) {
						const result = findNode(child)
						if (result) return result
					}
					return null
				}
				const parent = findNode(tree?.root)
				if (!parent?.selector) throw new Error("未找到图片插入目标")
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.RUN_IMAGE_ACTION,
					{ action: "insert-image-node", parentSelector: parent.selector, index },
					{ description: "新增图片", canUndo: true },
				)
			},
			copyDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.COPY_DOM_NODE, { nodeId })
			},
			duplicateDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.DUPLICATE_DOM_NODE,
					{ nodeId },
					{ description: "复制 DOM 节点", canUndo: true },
				)
			},
			cutDomNode: async (nodeId: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.CUT_DOM_NODE,
					{ nodeId },
					{ description: "剪切 DOM 节点", canUndo: true },
				)
			},
			pasteDomNode: async (targetParentId: string, targetIndex?: number) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.PASTE_DOM_NODE,
					{ targetParentId, targetIndex },
					{ description: "粘贴 DOM 节点", canUndo: true },
				)
			},
			getElementComputedStyles: async (selector: string) => {
				if (!messageBridgeRef.current) return {}
				const response = await messageBridgeRef.current.request(
					EditorMessageType.GET_COMPUTED_STYLES,
					{ selector },
				)
				return response?.styles || {}
			},
			enableTextEditing: async (selector: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.ENABLE_TEXT_EDITING, {
					selector,
				})
			},
			disableTextEditing: async (selector: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.DISABLE_TEXT_EDITING, {
					selector,
				})
			},
			updateTextContent: async (selector: string, content: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.UPDATE_TEXT_CONTENT,
					{ selector, content },
					{ description: `更新文本内容`, canUndo: true },
				)
			},
			updateElementAttributes: async (
				selector: string,
				attributes: Record<string, string | null>,
			) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.UPDATE_ELEMENT_ATTRIBUTES,
					{ selector, attributes },
					{ description: "更新链接属性", canUndo: true },
				)
			},
			getTextContent: async (selector: string) => {
				if (!messageBridgeRef.current) return ""
				const response = await messageBridgeRef.current.request(
					EditorMessageType.GET_TEXT_CONTENT,
					{ selector },
				)
				return response?.content || ""
			},
			setElementPosition: async (selector: string, top: number, left: number) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.SET_ELEMENT_POSITION,
					{ selector, top, left },
					{ description: `移动元素位置到 (${left}, ${top})`, canUndo: true },
				)
			},
			refreshSelectedElement: async (selector: string) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(EditorMessageType.REFRESH_SELECTED_ELEMENT, {
					selector,
				})
			},
			refreshSelectedElements: async (selectors: string[]) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.request(
					EditorMessageType.REFRESH_SELECTED_ELEMENTS,
					{ selectors },
				)
			},
			deleteElement: async (selector: string) => {
				console.log("[useHTMLEditorV2] deleteElement called", {
					selector,
					hasMessageBridge: !!messageBridgeRef.current,
				})
				if (!messageBridgeRef.current) {
					console.warn("[useHTMLEditorV2] No message bridge available")
					return
				}
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.DELETE_ELEMENT,
					{ selector },
					{ description: "删除元素", canUndo: true },
				)
				console.log("[useHTMLEditorV2] Delete command sent")
			},
			duplicateElement: async (selector: string) => {
				console.log("[useHTMLEditorV2] duplicateElement called", {
					selector,
					hasMessageBridge: !!messageBridgeRef.current,
				})
				if (!messageBridgeRef.current) {
					console.warn("[useHTMLEditorV2] No message bridge available")
					return
				}
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.DUPLICATE_ELEMENT,
					{ selector },
					{ description: "复制元素", canUndo: true },
				)
				console.log("[useHTMLEditorV2] Duplicate command sent")
			},
			runImageAction: async (payload: ImageActionPayload) => {
				if (!messageBridgeRef.current) return

				const actionDescriptionMap: Record<ImageActionPayload["action"], string> = {
					"replace-element-image": "替换图片",
					"set-element-background-image": "设置背景图",
					"remove-element-background-image": "移除背景图",
					"insert-floating-image": "新增图片",
					"insert-image-node": "新增图片",
				}

				await messageBridgeRef.current.sendCommand(
					EditorMessageType.RUN_IMAGE_ACTION,
					payload,
					{
						description: actionDescriptionMap[payload.action] || "执行图片动作",
						canUndo: true,
					},
				)
			},
			applyTextStyle: async (
				selector: string,
				styles: {
					fontWeight?: string
					fontStyle?: string
					textDecoration?: string
					color?: string
					backgroundColor?: string
					fontSize?: string
				},
			) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.APPLY_TEXT_STYLE,
					{ selector, styles },
					{ description: "应用文本样式", canUndo: true },
				)
			},
			getTextSelection: async () => {
				if (!messageBridgeRef.current) return { hasSelection: false, selectedText: "" }
				const response = await messageBridgeRef.current.request(
					EditorMessageType.GET_TEXT_SELECTION,
				)
				return response || { hasSelection: false, selectedText: "" }
			},
			getTextSelectionStyles: async () => {
				if (!messageBridgeRef.current) return {}
				const response = await messageBridgeRef.current.request(
					EditorMessageType.GET_TEXT_SELECTION_STYLES,
				)
				return response?.styles || {}
			},
		}),
		[
			getActiveBridge,
			iframeRef,
			fileId,
			saveEditContent,
			filePathMapping,
			isPptRender,
			stylePanelStore,
			isRuntimeReady,
			contentInjected,
		],
	)

	// 处理编辑模式变化，动态激活编辑 runtime。
	// setContent 会重建 iframe 文档并重新绑定 shell 监听器，首次 postMessage
	// 可能落在监听器重建窗口内，因此在 runtime 回报 EDITOR_READY 前做有限次数重试。
	useEffect(() => {
		const wasEditMode = prevIsEditModeRef.current
		const nextIsEditMode = Boolean(isEditMode)
		prevIsEditModeRef.current = nextIsEditMode

		// 当 contentInjected 从 false 变为 true 时，重置激活标记和 runtime 状态。
		// setContent 会替换 iframe 文档，shell 内联 runtime 会重新安装，需要再次发送激活消息。
		if (contentInjected && !prevContentInjectedRef.current) {
			clearActivationRetry()
			if (hasPendingRuntimeReadyRef.current) {
				hasPendingRuntimeReadyRef.current = false
				setIsRuntimeReady(true)
			} else {
				setIsRuntimeReady(false)
			}
		}
		// 更新 prevContentInjectedRef
		prevContentInjectedRef.current = contentInjected

		// 退出编辑模式：发送退出请求并清理编辑态（但不销毁 bridge）
		if (!nextIsEditMode) {
			editLifecycleRef.current = "idle"

			if (!wasEditMode) return

			const transitionId = ++editTransitionIdRef.current
			editLifecycleRef.current = "deactivating"
			void runExitEditFlow(transitionId)
			return
		}

		if (
			sandboxType === "iframe" &&
			iframeRef.current?.contentWindow &&
			iframeLoaded &&
			contentInjected
		) {
			clearActivationRetry()
			let attempts = 0
			const maxAttempts = 8

			const activateRuntime = () => {
				if (
					isRuntimeReady ||
					!iframeRef.current?.contentWindow ||
					!contentInjected ||
					!desiredEditModeRef.current ||
					attempts >= maxAttempts
				) {
					clearActivationRetry()
					return
				}

				attempts += 1
				try {
					// iframe-runtime.js 已经通过 shell 内联在 HTML 中，
					// 这里只需发送激活消息触发 Phase 2 编辑器运行时。
					iframeRef.current.contentWindow.postMessage(
						{
							type: "activateEditorRuntime",
							scaleRatio: scaleRatio || 1,
						},
						targetOrigin,
					)
					if (attempts === 1) {
						console.log("[useHTMLEditorV2] 已发送编辑器激活消息")
					}
				} catch (error) {
					console.error("处理编辑模式变化时出错:", error)
				}

				if (!isRuntimeReady && attempts < maxAttempts) {
					activationRetryTimerRef.current = window.setTimeout(activateRuntime, 350)
				}
			}

			activateRuntime()
		}

		return clearActivationRetry
	}, [
		clearActivationRetry,
		isEditMode,
		sandboxType,
		iframeLoaded,
		contentInjected,
		iframeRef,
		isRuntimeReady,
		scaleRatio,
		runExitEditFlow,
		targetOrigin,
	])

	// 当 runtime 就绪且内容已注入后，再启用编辑模式和选择模式，避免「选择元素」在 iframe 未加载完时执行
	useEffect(() => {
		if (!contentInjected || !isEditMode || !isRuntimeReady) {
			setIsEditorReady(false)
			// Exit owns its transition until EXIT_SELECTION_MODE completes. Only invalidate
			// activation here when its document/runtime disappears while editing.
			if (isEditMode) {
				++editTransitionIdRef.current
				editLifecycleRef.current = "idle"
			}
		}
		if (
			!isEditMode ||
			!contentInjected ||
			!isRuntimeReady ||
			!messageBridgeRef.current?.isActive()
		)
			return

		const transitionId = ++editTransitionIdRef.current
		editLifecycleRef.current = "activating"
		setIsEditorReady(false)
		void runEnterEditFlow(transitionId)
	}, [isEditMode, fullEditMode, contentInjected, isRuntimeReady, runEnterEditFlow])

	return {
		isEditorReady: Boolean(isEditMode && contentInjected && isRuntimeReady && isEditorReady),
	}
}
