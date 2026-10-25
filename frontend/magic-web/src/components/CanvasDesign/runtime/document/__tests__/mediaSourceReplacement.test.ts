import { describe, expect, it, vi } from "vitest"
import {
	buildMediaSourceReplacementPatch,
	finalizeMediaSourceReplacement,
	isMediaSourceChanged,
	mergeMediaSourceReplacementFields,
	purgeWorkspaceMediaComplianceFields,
} from "../mediaSourceReplacement"

describe("mediaSourceReplacement", () => {
	it("detects src identity changes", () => {
		expect(isMediaSourceChanged("./images/a.png", "./images/b.png")).toBe(true)
		expect(isMediaSourceChanged("./images/a.png", "./images/a.png")).toBe(false)
		expect(isMediaSourceChanged(undefined, "./images/a.png")).toBe(true)
		expect(isMediaSourceChanged("./images/a.png", undefined)).toBe(false)
	})

	it("clears asset and compliance fields when src changes", () => {
		expect(
			buildMediaSourceReplacementPatch("./images/old.png", "./images/new.png", {
				status: "completed",
			}),
		).toEqual({
			status: "completed",
			src: "./images/new.png",
			assetId: undefined,
			complianceStatus: undefined,
			complianceFailedReason: undefined,
			complianceCheckId: undefined,
		})
	})

	it("keeps extra fields when src is unchanged", () => {
		expect(
			buildMediaSourceReplacementPatch("./images/a.png", "./images/a.png", {
				status: "completed",
			}),
		).toEqual({ status: "completed" })
	})

	it("merges replacement clearing into an existing patch", () => {
		expect(
			mergeMediaSourceReplacementFields(
				{
					src: "./videos/old.mp4",
					assetId: "asset-1",
					complianceStatus: "FAILED",
				},
				{
					src: "./videos/new.mp4",
					status: "completed",
				},
			),
		).toEqual({
			src: "./videos/new.mp4",
			status: "completed",
			assetId: undefined,
			complianceStatus: undefined,
			complianceFailedReason: undefined,
			complianceCheckId: undefined,
		})
	})

	it("purges workspace compliance fields from content objects", () => {
		const content = {
			src: "./images/a.png",
			assetId: "asset-1",
			complianceStatus: "FAILED",
			complianceFailedReason: "reason",
			complianceCheckId: "check-1",
		}
		purgeWorkspaceMediaComplianceFields(content)
		expect(content).toEqual({
			src: "./images/a.png",
			assetId: "asset-1",
		})
	})

	it("stops stale workspace compliance polling after replacement", () => {
		const stop = vi.fn()
		const refreshMediaComplianceFailedTags = vi.fn()
		finalizeMediaSourceReplacement(
			{
				assetCompliancePollingManager: { stop } as never,
				refreshMediaComplianceFailedTags,
			},
			{
				previousSrc: "./images/old.png",
				nextSrc: "./images/new.png",
				previousComplianceCheckId: "check-1",
				previousAssetId: "asset-1",
			},
		)
		expect(stop).toHaveBeenCalledWith("check-1")
		expect(stop).toHaveBeenCalledWith("asset-1")
		expect(refreshMediaComplianceFailedTags).toHaveBeenCalledTimes(1)
	})
})
