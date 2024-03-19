import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useWindowSize } from "@/opensource/hooks/use-window-size"
import { useBodyRect } from "./use-element-rect"

export interface CursorVisibilityOptions {
	/**
	 * The Tiptap editor instance
	 */
	editor?: Editor | null
	/**
	 * Reference to the toolbar element that may obscure the cursor
	 */
	overlayHeight?: number
}

/**
 * Custom hook that ensures the cursor remains visible when typing in a Tiptap editor.
 * Automatically scrolls the window when the cursor would be hidden by the toolbar.
 *
 * @param options.editor The Tiptap editor instance
 * @param options.overlayHeight Toolbar height to account for
 * @returns The bounding rect of the body
 */
export function useCursorVisibility({ editor, overlayHeight = 0 }: CursorVisibilityOptions) {
	const { height: windowHeight } = useWindowSize()
	const rect = useBodyRect({
		enabled: true,
		throttleMs: 100,
		useResizeObserver: true,
	})

	React.useEffect(() => {
		const ensureCursorVisibility = () => {
			if (!editor || editor.isDestroyed) return

			const { state, view } = editor
			if (!view.hasFocus()) return

			// Get current cursor position coordinates
			const { from } = state.selection
			const cursorCoords = view.coordsAtPos(from)

			if (windowHeight < rect.height && cursorCoords) {
				const availableSpace = windowHeight - cursorCoords.top

				// If the cursor is hidden behind the overlay or offscreen, scroll it into view
				if (availableSpace < overlayHeight) {
					const targetCursorY = Math.max(windowHeight / 2, overlayHeight)
					const currentScrollY = window.scrollY
					const cursorAbsoluteY = cursorCoords.top + currentScrollY
					const newScrollY = cursorAbsoluteY - targetCursorY

					window.scrollTo({
						top: Math.max(0, newScrollY),
						behavior: "smooth",
					})
				}
			}
		}

		ensureCursorVisibility()
	}, [editor, overlayHeight, windowHeight, rect.height])

	return rect
}
