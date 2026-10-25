import { describe, expect, it, vi } from "vitest"
import type { CanvasAssetComplianceState } from "../../../../public/magic-types"
import {
	getMediaAssetId,
	resolveMediaComplianceFailedReason,
	resolveMediaComplianceStatus,
} from "../assetComplianceState"

vi.mock("../AssetDetailStore", () => ({
	assetDetailStore: {
		getCached: vi.fn(() => undefined),
	},
}))

describe("asset compliance state resolution", () => {
	it("uses polling, cached detail, then legacy content status for asset media", () => {
		const getState = vi.fn<(assetId: string) => CanvasAssetComplianceState | undefined>(() => ({
			assetId: "asset-1",
			status: "PROCESSING",
			failedReason: null,
		}))
		const getCachedResource = vi.fn<
			(assetId: string) => { complianceStatus?: "PASS" } | undefined
		>(() => ({ complianceStatus: "PASS" }))

		expect(
			resolveMediaComplianceStatus(
				{
					assetCompliancePollingManager: { getState },
					assetResourceManager: { getCachedResource },
				},
				{ assetId: "asset-1", complianceStatus: "FAILED" },
			),
		).toBe("PROCESSING")

		getState.mockReturnValue(undefined)
		expect(
			resolveMediaComplianceStatus(
				{
					assetCompliancePollingManager: { getState },
					assetResourceManager: { getCachedResource },
				},
				{ assetId: "asset-1", complianceStatus: "FAILED" },
			),
		).toBe("PASS")

		getCachedResource.mockReturnValue(undefined)
		expect(
			resolveMediaComplianceStatus(
				{
					assetCompliancePollingManager: { getState },
					assetResourceManager: { getCachedResource },
				},
				{ assetId: "asset-1", complianceStatus: "FAILED" },
			),
		).toBe("FAILED")
	})

	it("keeps workspace status independent from asset services", () => {
		expect(resolveMediaComplianceStatus({}, { complianceStatus: "PROCESSING" })).toBe(
			"PROCESSING",
		)
		expect(getMediaAssetId({ assetId: "  asset-1  " })).toBe("asset-1")
		expect(getMediaAssetId({ assetId: "  " })).toBeUndefined()
	})

	it("resolves a failed reason from the same runtime sources as the status", () => {
		const getState = vi.fn<(assetId: string) => CanvasAssetComplianceState | undefined>(() => ({
			assetId: "asset-1",
			status: "FAILED",
			failedReason: "polling reason",
		}))
		const getCachedResource = vi.fn<
			(assetId: string) =>
				| {
						complianceStatus: "FAILED"
						complianceFailedReason: string
				  }
				| undefined
		>(() => ({
			complianceStatus: "FAILED",
			complianceFailedReason: "cached reason",
		}))
		const source = {
			assetCompliancePollingManager: { getState },
			assetResourceManager: { getCachedResource },
		}

		expect(
			resolveMediaComplianceFailedReason(source, {
				assetId: "asset-1",
				complianceFailedReason: "content reason",
			}),
		).toBe("polling reason")

		getState.mockReturnValue({
			assetId: "asset-1",
			status: "FAILED",
			failedReason: null,
		})
		expect(resolveMediaComplianceFailedReason(source, { assetId: "asset-1" })).toBe(
			"cached reason",
		)

		getCachedResource.mockReturnValue(undefined)
		expect(
			resolveMediaComplianceFailedReason(source, {
				assetId: "asset-1",
				complianceFailedReason: "  content reason  ",
			}),
		).toBe("content reason")
	})
})
