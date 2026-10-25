import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import {
	collectMediaContentAssetBindings,
	reconcileDeletedAssetOnCanvas,
	reconcileUnverifiedComplianceInDocument,
} from "../canvasAssetDocumentReconcile"

function createBoundImage(assetId: string): ImageElement {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId: "content-1",
		mainContentId: "content-1",
		contents: [
			{
				contentId: "content-1",
				src: "./images/demo.png",
				assetId,
				complianceStatus: "FAILED",
				complianceCheckId: "check-1",
			},
		],
	}
}

describe("canvasAssetDocumentReconcile", () => {
	it("collects bindings by asset id", () => {
		const canvas = {
			elementManager: {
				getAllElements: () => [createBoundImage("asset-9")],
			},
		}
		expect(collectMediaContentAssetBindings(canvas, "asset-9")).toEqual([
			{ elementId: "image-1", contentId: "content-1", assetId: "asset-9" },
		])
	})

	it("unbinds deleted asset while keeping src", () => {
		const element = createBoundImage("asset-9")
		const update = vi.fn()
		const invalidate = vi.fn()
		const stop = vi.fn()
		const refreshMediaComplianceFailedTags = vi.fn()
		const canvas = {
			elementManager: {
				getAllElements: () => [element],
				getElementData: () => element,
				update,
			},
			permissionManager: { can: () => true },
			assetResourceManager: { invalidate },
			assetCompliancePollingManager: { stop },
			refreshMediaComplianceFailedTags,
		}

		expect(reconcileDeletedAssetOnCanvas(canvas, "asset-9")).toBe(1)
		expect(invalidate).toHaveBeenCalledWith("asset-9")
		expect(stop).toHaveBeenCalledWith("asset-9")
		expect(update).toHaveBeenCalled()
		const contents = update.mock.calls[0]?.[1]?.contents as ImageElement["contents"]
		expect(contents[0].src).toBe("./images/demo.png")
		expect(contents[0].assetId).toBeUndefined()
		expect(contents[0].complianceStatus).toBeUndefined()
		expect(refreshMediaComplianceFailedTags).toHaveBeenCalled()
	})

	it("strips UNVERIFIED compliance snapshots on load reconcile", () => {
		const element: ImageElement = {
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
		const update = vi.fn()
		const canvas = {
			elementManager: {
				getAllElements: () => [element],
				update,
			},
			permissionManager: { can: () => true },
		}

		expect(reconcileUnverifiedComplianceInDocument(canvas)).toBe(1)
		const contents = update.mock.calls[0]?.[1]?.contents as ImageElement["contents"]
		expect(contents[0].complianceStatus).toBeUndefined()
		expect(contents[0].complianceCheckId).toBeUndefined()
		expect(contents[0].src).toBe("./images/demo.png")
	})

	it("clears a deleted legacy asset source instead of leaving a broken asset:// path", () => {
		const element = createBoundImage("asset-legacy")
		element.contents[0] = {
			...element.contents[0],
			src: "asset://asset-legacy",
		}
		const update = vi.fn()
		const canvas = {
			elementManager: {
				getAllElements: () => [element],
				getElementData: () => element,
				update,
			},
			permissionManager: { can: () => true },
			assetResourceManager: { invalidate: vi.fn() },
			assetCompliancePollingManager: { stop: vi.fn() },
			refreshMediaComplianceFailedTags: vi.fn(),
		}

		expect(reconcileDeletedAssetOnCanvas(canvas, "asset-legacy")).toBe(1)
		const contents = update.mock.calls[0]?.[1]?.contents as ImageElement["contents"]
		expect(contents[0]?.assetId).toBeUndefined()
		expect(contents[0]?.src).toBeUndefined()
	})
})
