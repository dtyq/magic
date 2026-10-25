import { describe, expect, it } from "vitest"
import { MarkerTypeEnum, type Marker } from "@/components/CanvasDesign/runtime/document/types"
import { buildMarkerCompositeKey } from "../MarkerStorage"

function createMarker(): Marker {
	return {
		id: "marker-1",
		type: MarkerTypeEnum.Mark,
		elementId: "image-1",
		contentId: "content-1",
		relativeX: 0.25,
		relativeY: 0.75,
		elementCrop: { x: 10, y: 20, width: 100, height: 80 },
	}
}

describe("buildMarkerCompositeKey", () => {
	it("uses the active Content crop when it differs from the marker snapshot", () => {
		const marker = createMarker()

		const key = buildMarkerCompositeKey("images/source.png", marker, undefined, {
			x: 30,
			y: 40,
			width: 60,
			height: 50,
		})

		expect(key).toContain("|crop:30,40,60,50")
		expect(key).not.toContain("|crop:10,20,100,80")
	})

	it("keeps the marker crop as a backwards-compatible fallback", () => {
		const key = buildMarkerCompositeKey("images/source.png", createMarker())

		expect(key).toContain("|crop:10,20,100,80")
	})
})
