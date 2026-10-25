import { describe, expect, it } from "vitest"
import {
	isMentionPanelImageFileExtension,
	isMentionPanelVideoFileExtension,
} from "../preview-utils"

describe("mention preview media extensions", () => {
	it("separates image and video previews", () => {
		expect(isMentionPanelImageFileExtension("png")).toBe(true)
		expect(isMentionPanelImageFileExtension("mp4")).toBe(false)
		expect(isMentionPanelVideoFileExtension("mp4")).toBe(true)
		expect(isMentionPanelVideoFileExtension("png")).toBe(false)
	})
})
