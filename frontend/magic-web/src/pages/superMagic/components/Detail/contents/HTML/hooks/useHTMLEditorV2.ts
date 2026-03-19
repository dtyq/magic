import { useCallback, useEffect, useRef, useImperativeHandle, useState } from "react"
import { MessageBridge } from "../iframe-bridge/bridge/MessageBridge"
import { useStylePanelStore } from "../iframe-bridge/contexts/StylePanelContext"
import {
	EditorMessageType,
	ElementSelectedPayload,
	SelectionModeChangedPayload,
	HistoryState,
	IframeZoomRequestPayload,
} from "../iframe-bridge/types/messages"
import type { HTMLEditorV2Ref } from "../iframe-bridge/types/props"
import { getIframeRuntimeScript } from "../iframe-bridge/utils/iframe-script"
import { filterInjectedTags } from "../utils"

interface UseHTMLEditorV2Options {
	/** iframe 元素引用 */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 是否处于编辑模式 */
	isEditMode?: boolean
	/** 沙箱类型 */
	sandboxType?: "iframe" | "shadow-dom"
	/** iframe 是否已加载 */
	iframeLoaded: boolean
	/** 内容是否已注入 */
	contentInjected: boolean
	/** 缩放比例 */
	scaleRatio?: number
	/** 保存编辑内容的回调 */
	saveEditContent?: (
		content: string,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
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
}

/**
 * HTMLEditor V2 Hook
 * 管理 V2 编辑脚本的注入、MessageBridge 的初始化和编辑器 ref 的创建
 */
export function useHTMLEditorV2(options: UseHTMLEditorV2Options) {
	const {
		iframeRef,
		isEditMode,
		sandboxType = "iframe",
		iframeLoaded,
		contentInjected,
		scaleRatio,
		saveEditContent,
		fileId,
		filePathMapping,
		editorRef,
		isPptRender,
		onZoomRequest,
	} = options

	const stylePanelStore = useStylePanelStore()
	const messageBridgeRef = useRef<MessageBridge | null>(null)
	const [isRuntimeReady, setIsRuntimeReady] = useState(false)
	const hasInjectedScriptRef = useRef(false)
	const prevContentInjectedRef = useRef(false)
	const prevIsEditModeRef = useRef(Boolean(isEditMode))
	const desiredEditModeRef = useRef(Boolean(isEditMode))
	const stylePanelStoreRef = useRef(stylePanelStore)
	const onZoomRequestRef = useRef(onZoomRequest)
	const editTransitionIdRef = useRef(0)
	const editLifecycleRef = useRef<"idle" | "activating" | "active" | "deactivating">("idle")

	stylePanelStoreRef.current = stylePanelStore
	onZoomRequestRef.current = onZoomRequest
	desiredEditModeRef.current = Boolean(isEditMode)

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

			try {
				const bridge = getActiveBridge()
				if (bridge) {
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

				await bridge.request(EditorMessageType.ENTER_EDIT_MODE)

				if (!isCurrentTransition(transitionId) || !desiredEditModeRef.current) return

				const latestBridge = getActiveBridge()
				if (!latestBridge) return

				await latestBridge.request(EditorMessageType.ENTER_SELECTION_MODE)

				if (isCurrentTransition(transitionId) && desiredEditModeRef.current) {
					editLifecycleRef.current = "active"
				}
			} catch (error) {
				if (isCurrentTransition(transitionId)) editLifecycleRef.current = "idle"
				console.error("[useHTMLEditorV2] Failed to enter edit flow:", error)
			}
		},
		[getActiveBridge, isCurrentTransition],
	)

	// 管理 MessageBridge 生命周期（与编辑模式解耦）
	useEffect(() => {
		if (!iframeLoaded || !iframeRef.current || sandboxType !== "iframe") {
			setIsRuntimeReady(false)
			if (messageBridgeRef.current?.isActive()) {
				messageBridgeRef.current.destroy()
			}
			messageBridgeRef.current = null
			return
		}

		// 创建 MessageBridge 实例
		const bridge = new MessageBridge(iframeRef.current)
		messageBridgeRef.current = bridge

		// 监听 EDITOR_READY 事件
		bridge.on("EDITOR_READY", () => {
			console.log("[useHTMLEditorV2] iframe-runtime 已准备就绪")
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
				isTextElement: payload.isTextElement,
				computedStyles: payload.computedStyles,
			})
		})

		// 监听 ELEMENTS_DESELECTED 事件
		bridge.on(EditorMessageType.ELEMENTS_DESELECTED, () => {
			const store = stylePanelStoreRef.current
			// Only clear selected elements, but keep selection mode active
			// This is important during operations like zooming where selection should persist
			store.selectedElement = null
			store.selectedElements = []
			store.textSelection = null
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

		// Listen to zoom requests from iframe (trackpad pinch-to-zoom)
		bridge.on(EditorMessageType.IFRAME_ZOOM_REQUEST, (message) => {
			if (onZoomRequestRef.current && message.payload) {
				const payload = message.payload as IframeZoomRequestPayload
				onZoomRequestRef.current(payload.delta)
			}
		})

		return () => {
			if (bridge.isActive()) {
				console.log("[useHTMLEditorV2] Cleaning up MessageBridge")
				bridge.destroy()
			}

			if (messageBridgeRef.current === bridge) {
				messageBridgeRef.current = null
			}

			setIsRuntimeReady(false)
			editLifecycleRef.current = "idle"
		}
	}, [sandboxType, iframeLoaded, iframeRef])

	// 创建编辑器 ref 接口（实现 HTMLEditorV2Ref）
	useImperativeHandle(
		editorRef,
		() => ({
			getIframeElement: () => iframeRef.current,
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

					if (!result?.cleanHtml) {
						console.error("[useHTMLEditorV2] save failed: no cleanHtml in result")
						return defaultResult
					}

					const cleanContent = filterInjectedTags(result.cleanHtml, filePathMapping)
					await saveEditContent(
						cleanContent,
						String(fileId),
						true,
						undefined,
						isPptRender,
					)

					return {
						cleanContent,
						rawContent: result.html || result.cleanHtml,
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
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.BEGIN_BATCH_OPERATION,
					{ selector, styles },
					{ description: "开始批量操作", canUndo: false },
				)
			},
			endBatchOperation: async (selector: string, styles: Record<string, string>) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.END_BATCH_OPERATION,
					{ selector, styles },
					{ description: "结束批量操作", canUndo: true },
				)
			},
			cancelBatchOperation: async () => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
					EditorMessageType.CANCEL_BATCH_OPERATION,
					{},
					{ description: "取消批量操作", canUndo: false },
				)
			},
			applyStylesTemporary: async (selector: string, styles: Record<string, string>) => {
				if (!messageBridgeRef.current) return
				await messageBridgeRef.current.sendCommand(
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
				// Clear only the selected element in StylePanelStore (keep selection mode active)
				// Note: Don't use clearSelection() as it also sets isSelectionMode to false
				stylePanelStore.selectedElement = null
			},
			selectElement: async (selector: string) => {
				if (!messageBridgeRef.current) return
				const response = await messageBridgeRef.current.request(
					EditorMessageType.GET_COMPUTED_STYLES,
					{ selector },
				)
				if (response?.styles) {
					stylePanelStore.selectElement({
						selector,
						tagName: "",
						computedStyles: response.styles,
					})
				}
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
		[iframeRef, fileId, saveEditContent, filePathMapping, isPptRender, stylePanelStore],
	)

	// 处理编辑模式变化，动态注入编辑脚本
	// 确保内容已注入后再启用编辑模式，避免编辑脚本找不到 DOM 元素
	useEffect(() => {
		const wasEditMode = prevIsEditModeRef.current
		const nextIsEditMode = Boolean(isEditMode)
		prevIsEditModeRef.current = nextIsEditMode

		// 当 contentInjected 从 false 变为 true 时，重置注入标记和 runtime 状态
		// 这允许在内容更新后重新注入脚本（因为 setContent 会清除所有脚本）
		if (contentInjected && !prevContentInjectedRef.current && hasInjectedScriptRef.current) {
			hasInjectedScriptRef.current = false
			// 重置 runtime 状态，因为脚本重新注入后 runtime 会重新初始化
			setIsRuntimeReady(false)
		}
		// 更新 prevContentInjectedRef
		prevContentInjectedRef.current = contentInjected

		// 退出编辑模式：发送退出请求并清理编辑态（但不销毁 bridge）
		if (!nextIsEditMode) {
			hasInjectedScriptRef.current = false
			setIsRuntimeReady(false)
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
			try {
				// Only inject script once per iframe load
				if (!hasInjectedScriptRef.current) {
					// 优先使用 V2 编辑脚本
					const editScriptV2 = getIframeRuntimeScript()
					iframeRef.current.contentWindow.postMessage(
						{
							type: "injectEditScriptV2",
							scriptContent: editScriptV2,
							scaleRatio: scaleRatio || 1, // 传递初始缩放比例
						},
						"*",
					)
					hasInjectedScriptRef.current = true
					console.log("[useHTMLEditorV2] 已注入 iframe-runtime 脚本")
				}
			} catch (error) {
				console.error("处理编辑模式变化时出错:", error)
			}
		}
	}, [
		isEditMode,
		sandboxType,
		iframeLoaded,
		contentInjected,
		iframeRef,
		scaleRatio,
		runExitEditFlow,
	])

	// 当 runtime 就绪后，启用编辑模式和选择模式
	useEffect(() => {
		if (!isEditMode || !isRuntimeReady || !messageBridgeRef.current?.isActive()) return

		const transitionId = ++editTransitionIdRef.current
		editLifecycleRef.current = "activating"
		void runEnterEditFlow(transitionId)
	}, [isEditMode, isRuntimeReady, runEnterEditFlow])
}
