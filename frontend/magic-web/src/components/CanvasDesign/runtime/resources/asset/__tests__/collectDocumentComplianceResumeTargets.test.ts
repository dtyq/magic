import { describe, expect, it } from "vitest"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import {
	collectAssetBoundComplianceResumeIds,
	collectDocumentComplianceResumeTargets,
} from "../collectDocumentComplianceResumeTargets"
import type { CanvasAssetComplianceTaskHost } from "../CanvasAssetComplianceTaskManager"

function createImageElement(
	overrides: Partial<ImageElement["contents"][number]> = {},
): ImageElement {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		name: "Image",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		contents: [
			{
				contentId: "content-1",
				src: "workspace://images/demo.png",
				complianceStatus: "PROCESSING",
				complianceCheckId: "check-1",
				...overrides,
			},
		],
		activeContentId: "content-1",
		mainContentId: "content-1",
	} as ImageElement
}

function createHost(
	elements: ImageElement[],
	options?: {
		cachedCompliance?: Record<string, string>
		pollingState?: Record<string, string>
	},
): CanvasAssetComplianceTaskHost {
	return {
		elementManager: {
			getAllElements: () => elements,
		} as CanvasAssetComplianceTaskHost["elementManager"],
		assetResourceManager: {
			getCachedResource: (assetId: string) =>
				options?.cachedCompliance?.[assetId]
					? {
							assetId,
							mediaType: "image",
							fileUrl: null,
							complianceStatus: options.cachedCompliance[assetId],
						}
					: undefined,
		} as CanvasAssetComplianceTaskHost["assetResourceManager"],
		assetCompliancePollingManager: {
			getState: (assetId: string) =>
				options?.pollingState?.[assetId]
					? {
							assetId,
							status: options.pollingState[assetId],
							failedReason: null,
						}
					: undefined,
		} as CanvasAssetComplianceTaskHost["assetCompliancePollingManager"],
	}
}

describe("collectDocumentComplianceResumeTargets", () => {
	it("collects in-progress workspace compliance tasks from all contents", () => {
		const host = createHost([createImageElement()])
		expect(collectDocumentComplianceResumeTargets(host)).toEqual([
			{
				checkId: "check-1",
				targets: [
					{
						elementId: "image-1",
						contentId: "content-1",
						sourcePath: "workspace://images/demo.png",
					},
				],
			},
		])
	})

	it("skips asset-backed contents and non-workspace paths", () => {
		const host = createHost([
			createImageElement({ assetId: "asset-1" }),
			createImageElement({
				contentId: "content-2",
				src: "asset://asset-2",
				complianceCheckId: "check-2",
			}),
		])
		expect(collectDocumentComplianceResumeTargets(host)).toEqual([])
	})
})

describe("collectAssetBoundComplianceResumeIds", () => {
	it("returns asset ids whose cached detail is still processing", () => {
		const host = createHost(
			[
				createImageElement({
					assetId: "asset-1",
					complianceStatus: undefined,
					complianceCheckId: undefined,
				}),
			],
			{ cachedCompliance: { "asset-1": "PROCESSING" } },
		)
		expect(collectAssetBoundComplianceResumeIds(host)).toEqual(["asset-1"])
	})
})
