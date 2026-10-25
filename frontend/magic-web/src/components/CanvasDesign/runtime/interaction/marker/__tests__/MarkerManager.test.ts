import { describe, expect, it, vi } from "vitest"
import { MarkerManager } from "../MarkerManager"
import {
	ElementTypeEnum,
	MarkerTypeEnum,
	type ImageElement,
	type Marker,
} from "../../../document/types"
import type { Canvas } from "../../../core/Canvas"

function createMarker(id: string, contentId?: string): Marker {
	return {
		id,
		type: MarkerTypeEnum.Mark,
		elementId: "image-1",
		contentId,
		relativeX: 0.5,
		relativeY: 0.5,
	}
}

function createManager(activeContentId = "v2") {
	const image: ImageElement = {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId,
		mainContentId: "v1",
		contents: [
			{ contentId: "v1", src: "./images/v1.png", status: "completed" },
			{ contentId: "v2", src: "./images/v2.png", status: "completed" },
		],
	}
	const emit = vi.fn()
	const canvas = {
		elementManager: {
			getElementData: vi.fn((elementId: string) =>
				elementId === image.id ? image : undefined,
			),
			hasElement: vi.fn((elementId: string) => elementId === image.id),
		},
		eventEmitter: {
			on: vi.fn(() => vi.fn()),
			off: vi.fn(),
			emit,
		},
		permissionManager: {
			canCreateMarker: vi.fn(() => true),
			canAddImageMarker: vi.fn(() => true),
			canDeleteMarker: vi.fn(() => false),
		},
		getEffectiveContentId: vi.fn(() => image.activeContentId),
		runtimeScheduler: { requestLayerDraw: vi.fn() },
	} as unknown as Canvas
	const manager = new MarkerManager({ canvas })
	const internals = manager as unknown as {
		markers: Marker[]
		renderAllMarkers: ReturnType<typeof vi.fn>
		isMarkerVisible: (marker: Marker) => boolean
	}
	internals.renderAllMarkers = vi.fn()
	return { manager, internals, emit, image }
}

describe("MarkerManager image Contents", () => {
	it("binds loaded markers without a Content to the active Content", () => {
		const { manager } = createManager("v1")
		manager.setMarkers([createMarker("legacy"), createMarker("existing", "v2")])

		expect(manager.getMarker("legacy")?.contentId).toBe("v1")
		expect(manager.getMarker("existing")?.contentId).toBe("v2")
	})

	it("permanently removes every previous-Content marker during a system Content switch", () => {
		const { manager, internals, emit } = createManager("v2")
		internals.markers = [
			createMarker("old-1", "v1"),
			createMarker("old-2", "v1"),
			createMarker("current", "v2"),
		]

		manager.handleImageContentChanged("image-1", "v1", "v2")

		expect(manager.exportMarkers().map((marker) => marker.id)).toEqual(["current"])
		expect(emit).toHaveBeenCalledWith({ type: "marker:deleted", data: { id: "old-1" } })
		expect(emit).toHaveBeenCalledWith({ type: "marker:deleted", data: { id: "old-2" } })
	})

	it("removes markers for the replaced image Content", () => {
		const { manager, internals, emit } = createManager("v2")
		internals.markers = [createMarker("v1-marker", "v1"), createMarker("v2-marker", "v2")]

		manager.removeMarkersByImageContent("image-1", "v1")

		expect(manager.exportMarkers().map((marker) => marker.id)).toEqual(["v2-marker"])
		expect(emit).toHaveBeenCalledWith({
			type: "marker:deleted",
			data: { id: "v1-marker" },
		})
	})

	it("attaches loaded Content-less markers to active and hides inactive Contents", () => {
		const { manager, internals } = createManager("v2")
		manager.setMarkers([createMarker("legacy"), createMarker("inactive", "v1")])

		expect(manager.getMarker("legacy")?.contentId).toBe("v2")
		expect(internals.isMarkerVisible(manager.getMarker("legacy") as Marker)).toBe(true)
		expect(internals.isMarkerVisible(manager.getMarker("inactive") as Marker)).toBe(false)
	})
})
