import { describe, expect, it } from "vitest"
import {
	resolveConnectionHandleOverlayIntent,
	type ConnectionHandleOverlayIntentContext,
} from "../connectionHandleOverlayIntent"

const baseContext: ConnectionHandleOverlayIntentContext = {
	blockReason: null,
	hasMultipleSelection: false,
	menuPinnedElementId: null,
	hoveredElementId: null,
	bridgeCandidateElementId: null,
	pointerInsideKeepAliveRegion: false,
	touchSelectedElementId: null,
}

describe("resolveConnectionHandleOverlayIntent", () => {
	it("hides before resolving any display source when the overlay is blocked", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				blockReason: "connection-dragging",
				menuPinnedElementId: "menu-element",
				hoveredElementId: "hover-element",
			}),
		).toEqual({ visible: false, reason: "connection-dragging" })
	})

	it("hides for multiple selection before resolving display sources", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				hasMultipleSelection: true,
				hoveredElementId: "hover-element",
			}),
		).toEqual({ visible: false, reason: "multiple-selection" })
	})

	it("uses the selection bounding rect when the shared creation menu is available", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				hasMultipleSelection: true,
				canShowSelectionHandles: true,
				selectionTarget: {
					elementIds: ["video-1", "video-2"],
					boundingRect: { x: 10, y: 20, width: 300, height: 160 },
					selectionRevision: "video-1\u0000video-2",
				},
			}),
		).toEqual({
			visible: true,
			kind: "selection",
			elementIds: ["video-1", "video-2"],
			boundingRect: { x: 10, y: 20, width: 300, height: 160 },
			selectionRevision: "video-1\u0000video-2",
			source: "selection",
		})
	})

	it("uses menu pin before hover and pointer bridge", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				menuPinnedElementId: "menu-element",
				hoveredElementId: "hover-element",
				bridgeCandidateElementId: "bridge-element",
				pointerInsideKeepAliveRegion: true,
			}),
		).toEqual({ visible: true, elementId: "menu-element", source: "menu" })
	})

	it("uses hover before pointer bridge and touch selection", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				hoveredElementId: "hover-element",
				bridgeCandidateElementId: "bridge-element",
				pointerInsideKeepAliveRegion: true,
				touchSelectedElementId: "selected-element",
			}),
		).toEqual({ visible: true, elementId: "hover-element", source: "hover" })
	})

	it("uses the bridge candidate only while the pointer is inside its keep-alive region", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				bridgeCandidateElementId: "bridge-element",
				pointerInsideKeepAliveRegion: true,
			}),
		).toEqual({ visible: true, elementId: "bridge-element", source: "pointer-bridge" })

		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				bridgeCandidateElementId: "bridge-element",
			}),
		).toEqual({ visible: false, reason: "no-target" })
	})

	it("falls back to a touch-selected element", () => {
		expect(
			resolveConnectionHandleOverlayIntent({
				...baseContext,
				touchSelectedElementId: "selected-element",
			}),
		).toEqual({
			visible: true,
			elementId: "selected-element",
			source: "touch-selection",
		})
	})

	it("hides when no source resolves", () => {
		expect(resolveConnectionHandleOverlayIntent(baseContext)).toEqual({
			visible: false,
			reason: "no-target",
		})
	})
})
