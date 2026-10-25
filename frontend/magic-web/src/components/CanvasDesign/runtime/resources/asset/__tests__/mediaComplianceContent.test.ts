import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import {
	applyWorkspaceMediaComplianceState,
	clearWorkspaceMediaComplianceState,
} from "../mediaComplianceContent"

function createImageElement(): ImageElement {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId: "content-1",
		mainContentId: "content-1",
		contents: [
			{
				contentId: "content-1",
				src: "./images/demo.png",
				complianceStatus: "UNVERIFIED",
				complianceCheckId: "check-bug",
			},
		],
	}
}

describe("mediaComplianceContent", () => {
	it("clears workspace compliance fields when API reports UNVERIFIED", () => {
		const element = createImageElement()
		const update = vi.fn()
		const canvas = {
			elementManager: {
				getElementData: () => element,
				update,
			},
		}

		const cleared = applyWorkspaceMediaComplianceState(canvas, {
			elementId: "image-1",
			contentId: "content-1",
			sourcePath: "./images/demo.png",
			complianceStatus: "UNVERIFIED",
			complianceCheckId: "check-bug",
		})

		expect(cleared).toBe(true)
		expect(update).toHaveBeenCalledWith(
			"image-1",
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						contentId: "content-1",
						src: "./images/demo.png",
					}),
				],
			}),
			expect.objectContaining({ historyPolicy: "exclude" }),
		)
		const submittedContents = update.mock.calls[0]?.[1]?.contents as ImageElement["contents"]
		expect(submittedContents[0].complianceStatus).toBeUndefined()
		expect(submittedContents[0].complianceCheckId).toBeUndefined()
	})

	it("does not write UNVERIFIED through write path guard", () => {
		const element = createImageElement()
		const update = vi.fn()
		const canvas = {
			elementManager: {
				getElementData: () => element,
				update,
			},
		}

		expect(
			clearWorkspaceMediaComplianceState(canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/demo.png",
			}),
		).toBe(true)
	})
})
