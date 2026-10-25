import { describe, expect, it } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { reconcileMentionPathsWithPersistedReferences } from "../mentionPathReconciliation"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

describe("reconcileMentionPathsWithPersistedReferences", () => {
	it("keeps persisted references when sync temporarily resolves no mentions", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: [],
				persistedPaths: ["/images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["/images/x.png"])
	})

	it("allows user-originated changes to remove all persisted references", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: [],
				persistedPaths: ["/images/x.png"],
				source: "user",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual([])
	})

	it("preserves a workspace-root reference when sync resolves the same filename to canvas-relative", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["./images/x.png"],
				persistedPaths: ["/images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["/images/x.png"])
	})

	it("preserves a canvas-relative reference when sync resolves the same filename to workspace-root", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["/images/x.png"],
				persistedPaths: ["./images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["./images/x.png"])
	})

	it("keeps same-name persisted resources distinct and ordered", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["./images/x.png", "/images/x.png"],
				persistedPaths: ["/images/x.png", "./images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["/images/x.png", "./images/x.png"])
	})

	it("preserves the stored representation for host-equivalent paths", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["./images/x.png"],
				persistedPaths: ["/画布A/images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["/画布A/images/x.png"])
	})

	it("leaves filenames without a persisted match unchanged", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["./images/a.png", "/images/b.png"],
				persistedPaths: ["/images/x.png"],
				source: "sync",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["./images/a.png", "/images/b.png"])
	})

	it("allows user-originated changes to switch same-name resources", () => {
		expect(
			reconcileMentionPathsWithPersistedReferences({
				incomingPaths: ["./images/x.png"],
				persistedPaths: ["/images/x.png"],
				source: "user",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toEqual(["./images/x.png"])
	})
})
