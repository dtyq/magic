import { beforeEach, describe, expect, it, vi } from "vitest"
import { MarkerTypeEnum } from "@/components/CanvasDesign/runtime/document/types"
import { SuperMagicMarkerManager } from "../SuperMagicMarkerManager"

describe("SuperMagicMarkerManager dependency scopes", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("releases document callbacks without clearing another mounted tab", () => {
		const fallbackPublish = vi.fn()
		const firstPublish = vi.fn()
		const secondPublish = vi.fn()
		const manager = new SuperMagicMarkerManager({
			publishToMessageEditor: fallbackPublish,
		})
		manager.addMarker("design-1", {
			id: "marker-1",
			elementId: "image-1",
			type: MarkerTypeEnum.Mark,
			relativeX: 0.5,
			relativeY: 0.5,
		})
		const releaseFirst = manager.registerDependencies("design-1", {
			publishToMessageEditor: firstPublish,
		})
		const releaseSecond = manager.registerDependencies("design-1", {
			publishToMessageEditor: secondPublish,
		})

		manager.requestMarkerDataRefresh("design-1", "marker-1")
		expect(secondPublish).toHaveBeenCalledTimes(1)
		releaseSecond()
		manager.requestMarkerDataRefresh("design-1", "marker-1")
		expect(firstPublish).toHaveBeenCalledTimes(1)
		releaseFirst()
		manager.requestMarkerDataRefresh("design-1", "marker-1")
		expect(fallbackPublish).toHaveBeenCalledTimes(1)
	})
})
