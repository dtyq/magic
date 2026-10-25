import { useCallback, useEffect } from "react"
import { useCanvasSelectionUI } from "../../providers/CanvasUIProvider"
import { isOnlySelectedElement } from "../canvas/canvasSelectionUtils"
import useCloseOnCanvasElementClick from "../canvas/useCloseOnCanvasElementClick"
import useElementPositionEffect from "./useElementPositionEffect"
import { useFloatingComponent } from "./useFloatingComponent"

interface UseCanvasSelectionFloatingPanelOptions {
	/** Floating surface id used by the shared z-index and event forwarding registry. */
	id: string
	/** The selected element that owns this panel. */
	elementId: string
	/** Closes the panel when the anchored canvas element is clicked again. */
	onClose?: () => void
	/** Closes the panel when the current single-element selection changes. */
	closeOnSelectionChange?: boolean
	/** Keeps a panel open while an async operation owns its draft. */
	isCloseBlocked?: boolean
}

/**
 * Shared behavior for panels anchored to the current canvas selection.
 *
 * History and rename panels intentionally follow `selection:position` instead of
 * independently tracking element geometry. This keeps their position and lifecycle
 * in sync with the selected element while allowing the floating surface to forward
 * canvas pan gestures in the same way. Panels that already support repeated-click
 * dismissal can opt into the shared Canvas input path without adding a DOM listener.
 */
export default function useCanvasSelectionFloatingPanel({
	id,
	elementId,
	onClose,
	closeOnSelectionChange = false,
	isCloseBlocked = false,
}: UseCanvasSelectionFloatingPanelOptions) {
	const { selectedElementIds } = useCanvasSelectionUI()
	const shouldShow = useCallback(
		() => isOnlySelectedElement(selectedElementIds, elementId),
		[selectedElementIds, elementId],
	)
	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow,
	})
	const { containerRef: floatingRef } = useFloatingComponent({
		id,
		interactive: true,
		enableWheelForwarding: true,
		enablePointerPanForwarding: true,
	})
	useCloseOnCanvasElementClick(elementId, onClose)

	useEffect(() => {
		if (!closeOnSelectionChange || !onClose || isCloseBlocked) return
		if (!isOnlySelectedElement(selectedElementIds, elementId)) onClose()
	}, [closeOnSelectionChange, elementId, isCloseBlocked, onClose, selectedElementIds])

	return {
		setRefs: useCallback(
			(node: HTMLDivElement | null) => {
				positionRef.current = node
				floatingRef.current = node
			},
			[floatingRef, positionRef],
		),
	}
}
