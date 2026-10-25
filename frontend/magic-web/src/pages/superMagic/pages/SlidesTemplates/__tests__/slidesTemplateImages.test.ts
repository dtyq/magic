import { describe, expect, it } from "vitest"
import { getSlidesTemplatePreviewImageUrl } from "../slidesTemplateImages"

describe("slides template preview image URLs", () => {
	it("uses one full-preview TOS variant for every detail image", () => {
		const url = getSlidesTemplatePreviewImageUrl(
			"https://bucket.tos-cn-beijing.volces.com/slides/page-1.png?x-tos-process=image%2Fresize%2Cw_4096%2Fformat%2Cpng",
		)

		expect(new URL(url ?? "").searchParams.get("x-tos-process")).toBe(
			"image/resize,w_1920/quality,Q_84/format,webp",
		)
	})
})
