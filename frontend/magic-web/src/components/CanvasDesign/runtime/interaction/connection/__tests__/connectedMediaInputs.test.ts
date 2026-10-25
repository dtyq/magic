import { describe, expect, it } from "vitest"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import type { ConnectedInputSourceElement } from "../connectedInputSources"
import { resolveConnectedMediaCandidatesFromSources } from "../connectedMediaInputs"

function createImage(
	id: string,
	options: {
		activeSrc?: string
		mainSrc?: string
		mainStatus?: "processing" | "completed" | "failed"
	},
): ImageElement {
	return {
		id,
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: `${id}-active`,
		mainContentId: `${id}-main`,
		contents: [
			{ contentId: `${id}-active`, src: options.activeSrc },
			{
				contentId: `${id}-main`,
				src: options.mainSrc,
				status: options.mainStatus,
			},
		],
	}
}

function createSource(element: ImageElement): ConnectedInputSourceElement {
	return {
		connectionId: `connection-${element.id}`,
		sourceElementId: element.id,
		element,
	}
}

describe("connected image media inputs", () => {
	it("uses downstream content with src even when status is stale", () => {
		const ready = createImage("ready", {
			activeSrc: "/active.png",
			mainSrc: "/main.png",
			mainStatus: "completed",
		})
		const processing = createImage("processing", {
			activeSrc: "/active-processing.png",
			mainSrc: "/processing.png",
			mainStatus: "processing",
		})

		const candidates = resolveConnectedMediaCandidatesFromSources([
			createSource(ready),
			createSource(processing),
		])

		expect(candidates).toEqual([
			expect.objectContaining({ sourceElementId: ready.id, path: "/main.png" }),
			expect.objectContaining({ sourceElementId: processing.id, path: "/processing.png" }),
		])
	})

	it("applies the same readiness rule to runtime-resolved image content", () => {
		const image = createImage("runtime", {
			mainSrc: "/main.png",
			mainStatus: "completed",
		})

		const candidates = resolveConnectedMediaCandidatesFromSources([createSource(image)], {
			resolveImageContent: () => ({
				contentId: "runtime-content",
				src: "/runtime.png",
				status: "failed",
			}),
		})

		expect(candidates[0]?.path).toBe("/runtime.png")
	})
})
