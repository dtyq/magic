import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react"
import { interfaceStore } from "@/stores/interface"
import type {
	ChatInputHeightMode,
	ConversationInputHeightController,
	ChatInputHeightPreference,
} from "./types"

const DEFAULT_MIN_HEIGHT = 200
const DEFAULT_MAX_RATIO = 0.5
const ACCESSORY_SELECTOR = "[data-conversation-input-accessory]"
type MeasureReason = "initial" | "layout" | "content"

interface UseConversationInputHeightOptions {
	scope: string
	/** Identifies the employee/mode layout whose current height should be preserved. */
	layoutKey?: string
	enabled: boolean
	containerRef: RefObject<HTMLDivElement | null>
	availableRef: RefObject<HTMLDivElement | null>
	minHeight?: number
	maxRatio?: number
	manualMaxRatio?: number
	manualMinAvailableHeight?: number
}

/** Keep numeric resize values safe before they are applied to a controlled layout. */
function isValidHeight(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** Clamp a requested height to the current conversation layout bounds. */
function clampHeight(value: number, minHeight: number, maxHeight: number) {
	const safeValue = isValidHeight(value) ? value : minHeight
	const safeMaxHeight = Math.max(minHeight, maxHeight)
	return Math.min(Math.max(safeValue, minHeight), safeMaxHeight)
}

/** Calculate a height ceiling from both a proportional limit and reserved content space. */
function getMaxHeight(
	availableHeight: number,
	minHeight: number,
	ratio: number,
	reservedHeight = 0,
) {
	const ratioLimit = availableHeight * ratio || minHeight
	const reservedSpaceLimit = availableHeight - reservedHeight
	return Math.max(minHeight, Math.min(ratioLimit, reservedSpaceLimit))
}

/** Estimate content height when an inner editor is already scrolling inside a fixed outer panel. */
function measureNaturalHeight(container: HTMLDivElement) {
	const baseHeight = Math.max(container.offsetHeight, container.scrollHeight)
	const editor = container.querySelector<HTMLElement>(
		'[data-testid="super-message-editor-content"] [contenteditable="true"], [contenteditable="true"]',
	)
	let naturalHeight = baseHeight

	if (editor) {
		const currentEditorHeight = editor.getBoundingClientRect().height
		const contentRoot = editor.matches(".ProseMirror")
			? editor
			: (editor.querySelector<HTMLElement>(".ProseMirror") ?? editor)
		const contentRootRect = contentRoot.getBoundingClientRect()
		const contentChildren = Array.from(contentRoot.children) as HTMLElement[]
		const contentBottom = contentChildren.reduce(
			(bottom, child) => Math.max(bottom, child.getBoundingClientRect().bottom),
			contentRootRect.top,
		)
		const naturalEditorHeight = contentChildren.length
			? contentBottom - contentRootRect.top
			: Math.max(editor.scrollHeight, contentRootRect.height)
		// Remove the currently allocated editor height before adding its intrinsic height.
		// This allows automatic sizing to shrink after content is deleted, not only grow.
		const containerWithoutEditor = Math.max(0, baseHeight - currentEditorHeight)
		naturalHeight = containerWithoutEditor + naturalEditorHeight
	}

	return naturalHeight
}

/** Measure only fixed task/queue chrome so manual editor height remains user-controlled. */
function measureAccessoryHeight(container: HTMLDivElement) {
	return Array.from(container.querySelectorAll<HTMLElement>(ACCESSORY_SELECTOR)).reduce(
		(total, element) => total + Math.ceil(element.getBoundingClientRect().height),
		0,
	)
}

/** Manage automatic growth, manual override, and scoped persistence for a conversation input. */
export function useConversationInputHeight({
	scope,
	layoutKey,
	enabled,
	containerRef,
	availableRef,
	minHeight = DEFAULT_MIN_HEIGHT,
	maxRatio = DEFAULT_MAX_RATIO,
	manualMaxRatio = maxRatio,
	manualMinAvailableHeight = 0,
}: UseConversationInputHeightOptions): ConversationInputHeightController {
	const initialPreference = useMemo<ChatInputHeightPreference>(
		() => interfaceStore.getChatInputHeightPreference(scope),
		[scope],
	)
	const [heightMode, setHeightMode] = useState<ChatInputHeightMode>(initialPreference.mode)
	const [manualHeight, setManualHeight] = useState(initialPreference.height)
	const [autoHeight, setAutoHeight] = useState(initialPreference.height)
	const [availableHeight, setAvailableHeight] = useState(0)
	const [accessoryHeight, setAccessoryHeight] = useState(0)
	const [queueListHeight, setQueueListHeight] = useState(0)
	const [measurementReady, setMeasurementReady] = useState(false)
	const manualHeightRef = useRef(initialPreference.height)
	const previousLayoutKeyRef = useRef(layoutKey)
	const pointerStartHeightRef = useRef(initialPreference.height)
	const measureFrameRef = useRef<number | null>(null)
	const pendingMeasureReasonRef = useRef<MeasureReason>("layout")
	const initialMeasureFrameRef = useRef<number | null>(null)
	const initialMeasureSecondFrameRef = useRef<number | null>(null)
	const restoreAutoMeasureRef = useRef(false)
	const pendingContentMeasureRef = useRef(false)

	const effectiveMinHeight = minHeight + accessoryHeight
	const autoMaxHeight = getMaxHeight(availableHeight, effectiveMinHeight, maxRatio)
	const manualMaxHeight = getMaxHeight(
		availableHeight,
		effectiveMinHeight,
		manualMaxRatio,
		manualMinAvailableHeight,
	)
	const safeAutoHeight = clampHeight(
		autoHeight + accessoryHeight,
		effectiveMinHeight,
		autoMaxHeight,
	)
	const safeManualHeight = clampHeight(
		manualHeight + accessoryHeight,
		effectiveMinHeight,
		manualMaxHeight,
	)
	const effectiveHeight = heightMode === "manual" ? safeManualHeight : safeAutoHeight
	// Once the available panel has been measured, let automatic layouts fill their controlled panel.
	// This avoids measuring a fill-height container and toggling the layout in a feedback loop.
	const fillHeight =
		enabled && (heightMode === "manual" || (heightMode === "auto" && measurementReady))

	// Persist only the editor portion so temporary task chrome is measured again when it changes.
	const persistPreference = useCallback(
		(mode: ChatInputHeightMode, height: number) => {
			interfaceStore.setChatInputHeightPreference(scope, {
				mode,
				height: clampHeight(
					height,
					minHeight,
					Math.max(minHeight, manualMaxHeight - accessoryHeight),
				),
			})
		},
		[accessoryHeight, manualMaxHeight, minHeight, scope],
	)

	useEffect(() => {
		if (!enabled) {
			// Background initialization while collapsed must not look like a visible mode switch on expand.
			previousLayoutKeyRef.current = layoutKey
			return
		}
		if (previousLayoutKeyRef.current === layoutKey) return

		previousLayoutKeyRef.current = layoutKey
		if (effectiveHeight <= effectiveMinHeight) return

		// Freeze a larger user-visible height during employee/mode switches so new content measurements do not shrink it.
		const preservedHeight = clampHeight(effectiveHeight, effectiveMinHeight, manualMaxHeight)
		const preservedEditorHeight = clampHeight(
			preservedHeight - accessoryHeight,
			minHeight,
			Math.max(minHeight, manualMaxHeight - accessoryHeight),
		)
		setHeightMode("manual")
		manualHeightRef.current = preservedEditorHeight
		setManualHeight(preservedEditorHeight)
		persistPreference("manual", preservedEditorHeight)
	}, [
		accessoryHeight,
		effectiveHeight,
		effectiveMinHeight,
		enabled,
		layoutKey,
		manualMaxHeight,
		minHeight,
		persistPreference,
	])

	// Recalculate available space and accessory chrome before updating automatic editor height.
	const measure = useCallback(
		(reason: MeasureReason = "layout") => {
			if (!enabled) return

			const container = containerRef.current
			const available = availableRef.current
			if (!container || !available) return
			if (heightMode === "auto" && !measurementReady && reason === "layout") return

			const nextAvailableHeight = available.getBoundingClientRect().height
			const nextAccessoryHeight = measureAccessoryHeight(container)
			const nextQueueListHeight =
				container
					.querySelector<HTMLElement>("[data-message-queue-viewport]")
					?.getBoundingClientRect().height ?? 0
			setQueueListHeight((previous) =>
				Math.abs(previous - nextQueueListHeight) < 1 ? previous : nextQueueListHeight,
			)
			// The Splitter can retain its previous size during the first expanded frames.
			// Keep the persisted/default height for this pass and establish only live bounds.
			if (reason === "initial") {
				setAvailableHeight(nextAvailableHeight)
				setAccessoryHeight(nextAccessoryHeight)
				setMeasurementReady(true)
				return
			}
			// Do not use a fill-height container as natural content height.
			if (reason === "layout" && heightMode === "auto" && fillHeight) {
				setAvailableHeight((previous) =>
					Math.abs(previous - nextAvailableHeight) < 1 ? previous : nextAvailableHeight,
				)
				setAccessoryHeight((previous) =>
					Math.abs(previous - nextAccessoryHeight) < 1 ? previous : nextAccessoryHeight,
				)
				return
			}
			const nextMinHeight = minHeight + nextAccessoryHeight
			const nextMaxHeight = getMaxHeight(nextAvailableHeight, nextMinHeight, maxRatio)
			const naturalHeight = measureNaturalHeight(container)
			const nextAutoHeight = clampHeight(
				naturalHeight - nextAccessoryHeight,
				minHeight,
				Math.max(minHeight, nextMaxHeight - nextAccessoryHeight),
			)

			setAvailableHeight((previous) =>
				Math.abs(previous - nextAvailableHeight) < 1 ? previous : nextAvailableHeight,
			)
			setAccessoryHeight((previous) =>
				Math.abs(previous - nextAccessoryHeight) < 1 ? previous : nextAccessoryHeight,
			)
			if (heightMode === "manual") return

			setAutoHeight((previous) =>
				Math.abs(previous - nextAutoHeight) < 1 ? previous : nextAutoHeight,
			)
			if (reason === "content") setMeasurementReady(true)
		},
		[
			availableRef,
			containerRef,
			enabled,
			fillHeight,
			heightMode,
			maxRatio,
			measurementReady,
			minHeight,
		],
	)

	const scheduleMeasure = useCallback(
		(reason: MeasureReason = "layout") => {
			if (reason === "content") {
				if (measureFrameRef.current !== null) {
					window.cancelAnimationFrame(measureFrameRef.current)
					measureFrameRef.current = null
				}
				pendingMeasureReasonRef.current = "layout"
				measure("content")
				return
			}
			if (reason !== "layout" || pendingMeasureReasonRef.current === "layout") {
				pendingMeasureReasonRef.current = reason
			}
			if (measureFrameRef.current !== null) return

			measureFrameRef.current = window.requestAnimationFrame(() => {
				measureFrameRef.current = null
				const pendingReason = pendingMeasureReasonRef.current
				pendingMeasureReasonRef.current = "layout"
				measure(pendingReason)
			})
		},
		[measure],
	)
	useLayoutEffect(() => {
		if (!enabled) return
		if (heightMode === "auto" && restoreAutoMeasureRef.current) {
			restoreAutoMeasureRef.current = false
			scheduleMeasure("content")
		}
		if (!measurementReady) {
			initialMeasureFrameRef.current = window.requestAnimationFrame(() => {
				initialMeasureFrameRef.current = null
				initialMeasureSecondFrameRef.current = window.requestAnimationFrame(() => {
					initialMeasureSecondFrameRef.current = null
					const shouldMeasureContent =
						restoreAutoMeasureRef.current || pendingContentMeasureRef.current
					scheduleMeasure("initial")
					restoreAutoMeasureRef.current = false
					pendingContentMeasureRef.current = false
					window.requestAnimationFrame(() => {
						if (shouldMeasureContent || editorElement?.textContent?.trim()) {
							scheduleMeasure("content")
						}
					})
				})
			})
		}

		const container = containerRef.current
		const available = availableRef.current
		if (!container || !available || typeof ResizeObserver === "undefined") return

		const resizeObserver = new ResizeObserver(() => {
			// 队列可以独立拉高；手动模式仍需重新测量附件区，输入区自身偏好保持不变。
			scheduleMeasure("layout")
		})
		resizeObserver.observe(available)
		if (heightMode === "auto") resizeObserver.observe(container)
		container.querySelectorAll<HTMLElement>(ACCESSORY_SELECTOR).forEach((element) => {
			resizeObserver.observe(element)
		})
		let editorElement: HTMLElement | null = null
		const handleEditorInput = () => scheduleMeasure("content")
		const handleContainerInput = () =>
			scheduleMeasure(heightMode === "auto" ? "content" : "layout")
		const bindEditorInput = () => {
			const nextEditor = container.querySelector<HTMLElement>('[contenteditable="true"]')
			if (nextEditor === editorElement) return
			editorElement?.removeEventListener("input", handleEditorInput)
			editorElement = nextEditor
			editorElement?.addEventListener("input", handleEditorInput)
		}
		bindEditorInput()
		container.addEventListener("input", handleContainerInput)

		const mutationObserver = new MutationObserver((mutations) => {
			container.querySelectorAll<HTMLElement>(ACCESSORY_SELECTOR).forEach((element) => {
				resizeObserver.observe(element)
			})
			bindEditorInput()
			const editorChanged = mutations.some((mutation) => {
				const target =
					mutation.target instanceof Element
						? mutation.target
						: mutation.target.parentElement
				return Boolean(target?.closest('[contenteditable="true"]'))
			})
			if (editorChanged) {
				if (measurementReady) scheduleMeasure("content")
				else pendingContentMeasureRef.current = true
			} else {
				scheduleMeasure("layout")
			}
		})
		mutationObserver.observe(container, { childList: true, characterData: true, subtree: true })

		return () => {
			resizeObserver.disconnect()
			mutationObserver.disconnect()
			editorElement?.removeEventListener("input", handleEditorInput)
			container.removeEventListener("input", handleContainerInput)
			if (measureFrameRef.current !== null) {
				window.cancelAnimationFrame(measureFrameRef.current)
				measureFrameRef.current = null
			}
			if (initialMeasureFrameRef.current !== null) {
				window.cancelAnimationFrame(initialMeasureFrameRef.current)
				initialMeasureFrameRef.current = null
			}
			if (initialMeasureSecondFrameRef.current !== null) {
				window.cancelAnimationFrame(initialMeasureSecondFrameRef.current)
				initialMeasureSecondFrameRef.current = null
			}
		}
	}, [availableRef, containerRef, enabled, heightMode, measurementReady, scheduleMeasure])

	// Only content and layout changes re-measure, so a lower floor (e.g. the AI canvas composer
	// switching to its small size once the canvas opens) would leave auto height at the old floor.
	const previousMinHeightRef = useRef(minHeight)
	useEffect(() => {
		if (previousMinHeightRef.current === minHeight) return
		previousMinHeightRef.current = minHeight
		if (enabled && measurementReady && heightMode === "auto") scheduleMeasure("content")
	}, [enabled, heightMode, measurementReady, minHeight, scheduleMeasure])

	useEffect(() => {
		if (enabled) return
		// Read the live persisted preference so collapsing then reopening the panel
		// restores the latest manual height instead of a stale mount-time snapshot.
		const currentPreference = interfaceStore.getChatInputHeightPreference(scope)
		setHeightMode(currentPreference.mode)
		manualHeightRef.current = currentPreference.height
		setManualHeight(currentPreference.height)
		setAvailableHeight(0)
		setAccessoryHeight(0)
		setQueueListHeight(0)
		setMeasurementReady(false)
	}, [enabled, scope])

	const updateManualHeight = useCallback(
		(nextHeight: number) => {
			const safeHeight = clampHeight(
				nextHeight - accessoryHeight,
				minHeight,
				Math.max(minHeight, manualMaxHeight - accessoryHeight),
			)
			setHeightMode("manual")
			manualHeightRef.current = safeHeight
			setManualHeight(safeHeight)
		},
		[accessoryHeight, manualMaxHeight, minHeight],
	)

	const startPointerResize = useCallback(() => {
		if (!enabled) return
		pointerStartHeightRef.current = effectiveHeight
		updateManualHeight(effectiveHeight)
	}, [effectiveHeight, enabled, updateManualHeight])

	const resizeByPointerDelta = useCallback(
		(deltaY: number) => {
			if (!enabled) return
			updateManualHeight(pointerStartHeightRef.current - deltaY)
		},
		[enabled, updateManualHeight],
	)

	const finishPointerResize = useCallback(() => {
		if (!enabled) return
		persistPreference("manual", manualHeightRef.current)
	}, [enabled, persistPreference])

	const getSplitterHeight = useCallback((sizes: number[]) => sizes[1], [])

	const onSplitterResizeStart = useCallback(
		(sizes: number[]) => {
			if (!enabled) return
			const nextHeight = getSplitterHeight(sizes)
			if (!isValidHeight(nextHeight)) return
			pointerStartHeightRef.current = nextHeight
			updateManualHeight(nextHeight)
		},
		[enabled, getSplitterHeight, updateManualHeight],
	)

	const onSplitterResize = useCallback(
		(sizes: number[]) => {
			if (!enabled) return
			const nextHeight = getSplitterHeight(sizes)
			if (!isValidHeight(nextHeight)) return
			updateManualHeight(nextHeight)
		},
		[enabled, getSplitterHeight, updateManualHeight],
	)

	const onSplitterResizeEnd = useCallback(
		(sizes: number[]) => {
			if (!enabled) return
			const nextHeight = getSplitterHeight(sizes)
			if (isValidHeight(nextHeight)) {
				updateManualHeight(nextHeight)
				persistPreference("manual", manualHeightRef.current)
				return
			}
			persistPreference("manual", manualHeightRef.current)
		},
		[enabled, getSplitterHeight, persistPreference, updateManualHeight],
	)

	const restoreAutoHeight = useCallback(() => {
		if (!enabled) return
		restoreAutoMeasureRef.current = true
		setHeightMode("auto")
		manualHeightRef.current = initialPreference.height
		setManualHeight(initialPreference.height)
		persistPreference("auto", initialPreference.height)
	}, [enabled, initialPreference.height, persistPreference])

	return {
		enabled,
		effectiveHeight,
		minHeight: effectiveMinHeight,
		maxHeight: manualMaxHeight,
		// 队列和附件区来自同次测量，输出绝对上限，避免两个 ResizeObserver 互相增减高度。
		queueListMaxHeight: Math.max(
			0,
			getMaxHeight(
				availableHeight,
				minHeight,
				heightMode === "manual" ? manualMaxRatio : maxRatio,
				heightMode === "manual" ? manualMinAvailableHeight : 0,
			) -
				Math.max(minHeight, heightMode === "manual" ? manualHeight : autoHeight) -
				accessoryHeight +
				queueListHeight,
		),
		fillHeight,
		startPointerResize,
		resizeByPointerDelta,
		finishPointerResize,
		onSplitterResizeStart,
		onSplitterResize,
		onSplitterResizeEnd,
		restoreAutoHeight,
	}
}
