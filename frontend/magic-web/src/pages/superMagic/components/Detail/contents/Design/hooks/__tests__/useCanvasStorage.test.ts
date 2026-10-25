import { describe, expect, it } from "vitest"
import type { CanvasDesignStorageData } from "@/components/CanvasDesign/public/magic-types"
import { normalizeCanvasStorageData } from "../useCanvasStorage"

describe("normalizeCanvasStorageData", () => {
	it("keeps project UI storage independent from media generation drafts", () => {
		const storage: CanvasDesignStorageData = {
			viewport: { x: 10, y: 20, scale: 1 },
			minimapOpen: true,
			expandedElementIds: ["image-1"],
		}

		expect(normalizeCanvasStorageData(storage)).toEqual(storage)
	})

	it("removes legacy media draft keys from existing local storage", () => {
		const storage = {
			viewport: { x: 10, y: 20, scale: 1 },
			tempImageConfigs: { "image-1": { prompt: "legacy" } },
			tempVideoConfigs: { "video-1": { prompt: "legacy" } },
			tempVideoModeDrafts: { "video-1": {} },
		} as CanvasDesignStorageData

		expect(normalizeCanvasStorageData(storage)).toEqual({
			viewport: { x: 10, y: 20, scale: 1 },
		})
	})
})
