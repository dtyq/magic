import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { parseUsedPixelValue } from "../../StylePanel/utils/dimensionValue"
import type { SelectedInfo } from "../types"
import { getGapHandleLayout, mapGapHandlesToSelectionBox } from "../utils/gapHandleLayout"
import type { GapAxis, GapHandleFrame } from "../utils/gapHandleLayout"

interface UseGapHandlesOptions {
	editorRef?: RefObject<HTMLEditorV2Ref>
	selectedInfo: SelectedInfo | null
	gapAxesLinked: boolean
	onPreviewStyles: (styles: Partial<{ rowGap: string; columnGap: string }>) => void
	isPptRender?: boolean
	scaleRatio?: number
	setSelectedInfo?: Dispatch<SetStateAction<SelectedInfo | null>>
}

interface PointerCaptureState {
	pointerId: number
	target: HTMLElement
}

interface GapDragState {
	axis: GapAxis
	startX: number
	startY: number
	startPx: number
}

type GapStyleMap = Partial<{ rowGap: string; columnGap: string }>

function resolveStartGapPx(computedStyles: Record<string, string>, axis: GapAxis): number {
	const primary = axis === "column" ? computedStyles.columnGap : computedStyles.rowGap
	return parseUsedPixelValue(primary ?? computedStyles.gap) ?? 0
}

function buildGapStyles(nextPx: number, axis: GapAxis, linked: boolean): GapStyleMap {
	const value = `${Math.round(nextPx)}px`
	if (linked) return { rowGap: value, columnGap: value }
	if (axis === "column") return { columnGap: value }
	return { rowGap: value }
}

function snapshotStartStyles(computedStyles: Record<string, string>): Record<string, string> {
	const rowGap = computedStyles.rowGap ?? computedStyles.gap
	const columnGap = computedStyles.columnGap ?? computedStyles.gap
	const styles: Record<string, string> = {}
	if (rowGap) styles.rowGap = rowGap
	if (columnGap) styles.columnGap = columnGap
	return styles
}

function sameStyleMap(left: Record<string, string>, right: Record<string, string>): boolean {
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)
	if (leftKeys.length !== rightKeys.length) return false
	return leftKeys.every((key) => left[key] === right[key])
}

export function useGapHandles({
	editorRef,
	selectedInfo,
	gapAxesLinked,
	onPreviewStyles,
	isPptRender = false,
	scaleRatio = 1,
	setSelectedInfo,
}: UseGapHandlesOptions) {
	const [isGapDragging, setIsGapDragging] = useState(false)
	const [gapPreview, setGapPreview] = useState<{
		extra: number
		axis: GapAxis
		linked: boolean
		nextPx: number
	} | null>(null)
	const [liveLayout, setLiveLayout] = useState<{
		rect: SelectedInfo["rect"]
		childRects: NonNullable<SelectedInfo["childRects"]>
	} | null>(null)
	const selectedInfoRef = useRef<SelectedInfo | null>(selectedInfo)
	const gapAxesLinkedRef = useRef(gapAxesLinked)
	const onPreviewStylesRef = useRef(onPreviewStyles)
	const overlayScaleRef = useRef(1)
	const isDraggingRef = useRef(false)
	const dragStateRef = useRef<GapDragState | null>(null)
	const gapRafRef = useRef<number | null>(null)
	const pendingGapRef = useRef<{ selector: string; styles: Record<string, string> } | null>(null)
	const lastAppliedGapRef = useRef<{ selector: string; styles: Record<string, string> } | null>(
		null,
	)
	const gapSessionRef = useRef(0)
	const pointerCaptureRef = useRef<PointerCaptureState | null>(null)

	gapAxesLinkedRef.current = gapAxesLinked
	onPreviewStylesRef.current = onPreviewStyles
	overlayScaleRef.current = isPptRender && scaleRatio > 0 ? scaleRatio : 1

	const gapHandles = useMemo<GapHandleFrame[]>(() => {
		if (!selectedInfo) return []
		const containerRect = liveLayout?.rect ?? selectedInfo.rect
		const childRects = liveLayout?.childRects ?? selectedInfo.childRects ?? []
		const columnPx =
			gapPreview && (gapPreview.linked || gapPreview.axis === "column")
				? gapPreview.nextPx
				: (parseUsedPixelValue(
						selectedInfo.computedStyles.columnGap ?? selectedInfo.computedStyles.gap,
					) ?? 0)
		const rowPx =
			gapPreview && (gapPreview.linked || gapPreview.axis === "row")
				? gapPreview.nextPx
				: (parseUsedPixelValue(
						selectedInfo.computedStyles.rowGap ?? selectedInfo.computedStyles.gap,
					) ?? 0)
		const frames = getGapHandleLayout(
			containerRect,
			childRects,
			selectedInfo.computedStyles.display ?? "",
		).map((frame) => ({
			...frame,
			valueLabel: `${Math.round(frame.axis === "column" ? columnPx : rowPx)}px`,
		}))
		const overlayScale = isPptRender ? scaleRatio : 1
		return mapGapHandlesToSelectionBox(frames, containerRect, overlayScale)
	}, [gapPreview, isPptRender, liveLayout, scaleRatio, selectedInfo])

	const scheduleGapUpdate = useCallback(
		(selector: string, styles: Record<string, string>) => {
			pendingGapRef.current = { selector, styles }
			if (gapRafRef.current) return

			gapRafRef.current = window.requestAnimationFrame(() => {
				const pending = pendingGapRef.current
				const session = gapSessionRef.current
				gapRafRef.current = null
				if (!pending || !editorRef?.current) return
				lastAppliedGapRef.current = pending
				editorRef.current
					.applyStylesTemporary(pending.selector, pending.styles)
					.then((result) => {
						if (session !== gapSessionRef.current || !isDraggingRef.current) return
						if (!result?.rect || !result.childRects) return
						const nextLayout = {
							rect: result.rect,
							childRects: result.childRects,
						}
						setLiveLayout(nextLayout)
						setSelectedInfo?.((prev) =>
							prev
								? {
										...prev,
										rect: nextLayout.rect,
										childRects: nextLayout.childRects,
									}
								: prev,
						)
					})
					.catch((error) => {
						console.error("[useGapHandles] Temporary gap update failed:", error)
					})
			})
		},
		[editorRef, setSelectedInfo],
	)

	const finishGapDrag = useCallback(
		async (commit = true) => {
			if (!isDraggingRef.current) return

			const currentSelector = selectedInfoRef.current?.selector
			isDraggingRef.current = false
			gapSessionRef.current += 1
			dragStateRef.current = null
			setIsGapDragging(false)
			setGapPreview(null)
			setLiveLayout(null)

			if (pointerCaptureRef.current) {
				try {
					pointerCaptureRef.current.target.releasePointerCapture(
						pointerCaptureRef.current.pointerId,
					)
				} catch {
					// Pointer capture may already be released.
				}
				pointerCaptureRef.current = null
			}

			if (gapRafRef.current) {
				window.cancelAnimationFrame(gapRafRef.current)
				gapRafRef.current = null
			}

			if (commit && pendingGapRef.current && editorRef?.current) {
				const { selector, styles } = pendingGapRef.current
				try {
					const lastApplied = lastAppliedGapRef.current
					const alreadyApplied =
						lastApplied?.selector === selector &&
						sameStyleMap(lastApplied.styles, styles)
					if (!alreadyApplied) {
						await editorRef.current.applyStylesTemporary(selector, styles)
					}
					await editorRef.current.endBatchOperation(selector, styles)
				} catch (error) {
					console.error("[useGapHandles] Final gap update failed:", error)
				}
				pendingGapRef.current = null
				lastAppliedGapRef.current = null
			} else if (editorRef?.current) {
				try {
					await editorRef.current.cancelBatchOperation()
				} catch (error) {
					console.error("[useGapHandles] Failed to cancel gap batch:", error)
				}
			}

			document.body.style.userSelect = ""
			document.body.style.cursor = ""

			if (currentSelector && editorRef?.current) {
				try {
					await editorRef.current.refreshSelectedElement(currentSelector)
				} catch (error) {
					console.error("[useGapHandles] Failed to refresh after gap drag:", error)
				}
			}
		},
		[editorRef],
	)

	const updateGapDrag = useCallback(
		(event: globalThis.PointerEvent) => {
			if (!isDraggingRef.current) return
			if (event.buttons === 0) {
				finishGapDrag()
				return
			}

			const dragState = dragStateRef.current
			const current = selectedInfoRef.current
			if (!dragState || !current) {
				finishGapDrag()
				return
			}

			const delta =
				dragState.axis === "column"
					? event.clientX - dragState.startX
					: event.clientY - dragState.startY
			const next = Math.max(0, dragState.startPx + delta / overlayScaleRef.current)
			const styles = buildGapStyles(next, dragState.axis, false)

			setGapPreview({
				extra: next - dragState.startPx,
				axis: dragState.axis,
				linked: false,
				nextPx: next,
			})
			onPreviewStylesRef.current(styles)
			scheduleGapUpdate(current.selector, styles)
		},
		[scheduleGapUpdate, finishGapDrag],
	)

	const onGapHandlePointerDown = useCallback(
		async (event: React.PointerEvent, axis: GapAxis) => {
			if (!selectedInfoRef.current) return

			event.preventDefault()
			event.stopPropagation()

			if (isDraggingRef.current) await finishGapDrag()

			gapSessionRef.current += 1
			lastAppliedGapRef.current = null

			const target = event.currentTarget as HTMLElement
			try {
				target.setPointerCapture(event.pointerId)
				pointerCaptureRef.current = { pointerId: event.pointerId, target }
			} catch (error) {
				console.warn("[useGapHandles] Failed to capture pointer:", error)
			}

			const current = selectedInfoRef.current
			isDraggingRef.current = true
			dragStateRef.current = {
				axis,
				startX: event.clientX,
				startY: event.clientY,
				startPx: resolveStartGapPx(current.computedStyles, axis),
			}
			setIsGapDragging(true)

			if (editorRef?.current) {
				try {
					await editorRef.current.beginBatchOperation(
						current.selector,
						snapshotStartStyles(current.computedStyles),
					)
				} catch (error) {
					console.error("[useGapHandles] Failed to begin gap batch:", error)
				}
			}

			document.body.style.userSelect = "none"
			document.body.style.cursor = axis === "column" ? "col-resize" : "row-resize"
		},
		[editorRef, finishGapDrag],
	)

	useEffect(() => {
		if (
			isDraggingRef.current &&
			selectedInfo &&
			selectedInfoRef.current &&
			selectedInfo.selector !== selectedInfoRef.current.selector
		) {
			finishGapDrag()
		}

		selectedInfoRef.current = selectedInfo

		if (isDraggingRef.current && !selectedInfo) finishGapDrag()
	}, [selectedInfo, finishGapDrag])

	useEffect(() => {
		const handlePointerMove = (event: globalThis.PointerEvent) => {
			if (isDraggingRef.current) event.preventDefault()
			updateGapDrag(event)
		}

		const handlePointerUp = (event: globalThis.PointerEvent) => {
			if (!isDraggingRef.current) return
			event.preventDefault()
			finishGapDrag()
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !isDraggingRef.current) return
			event.preventDefault()
			finishGapDrag(false)
		}

		document.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: false,
		})
		document.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false })
		document.addEventListener("pointercancel", handlePointerUp, {
			capture: true,
			passive: false,
		})
		const handleWindowBlur = () => {
			void finishGapDrag()
		}

		document.addEventListener("keydown", handleKeyDown, true)
		window.addEventListener("blur", handleWindowBlur)

		return () => {
			document.removeEventListener("pointermove", handlePointerMove, true)
			document.removeEventListener("pointerup", handlePointerUp, true)
			document.removeEventListener("pointercancel", handlePointerUp, true)
			document.removeEventListener("keydown", handleKeyDown, true)
			window.removeEventListener("blur", handleWindowBlur)
			if (gapRafRef.current) window.cancelAnimationFrame(gapRafRef.current)
		}
	}, [finishGapDrag, updateGapDrag])

	useEffect(() => {
		return () => {
			if (!isDraggingRef.current) return
			isDraggingRef.current = false
			dragStateRef.current = null
			if (pointerCaptureRef.current) {
				try {
					pointerCaptureRef.current.target.releasePointerCapture(
						pointerCaptureRef.current.pointerId,
					)
				} catch {
					// Ignore release errors on unmount.
				}
				pointerCaptureRef.current = null
			}
			if (gapRafRef.current) {
				window.cancelAnimationFrame(gapRafRef.current)
				gapRafRef.current = null
			}
			gapSessionRef.current += 1
			pendingGapRef.current = null
			lastAppliedGapRef.current = null
			document.body.style.userSelect = ""
			document.body.style.cursor = ""
		}
	}, [])

	return {
		gapHandles,
		isGapDragging,
		onGapHandlePointerDown,
	}
}
