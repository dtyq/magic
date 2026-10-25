import { describe, expect, it } from "vitest"
import {
	CanvasResourceDiagnostics,
	buildImageResourceSnapshot,
	buildVideoResourceSnapshot,
	createImageResourceDiagnostics,
	createVideoResourceDiagnostics,
} from "../diagnostics/CanvasResourceDiagnostics"

describe("CanvasResourceDiagnostics", () => {
	it("tracks, snapshots, and resets named counters", () => {
		const diagnostics = new CanvasResourceDiagnostics(["hit", "miss"] as const)

		diagnostics.increment("hit")
		diagnostics.increment("hit", 4)
		diagnostics.increment("miss", 2)

		expect(diagnostics.snapshot()).toEqual({
			hit: 5,
			miss: 2,
		})

		diagnostics.reset()

		expect(diagnostics.snapshot()).toEqual({
			hit: 0,
			miss: 0,
		})
	})

	it("creates image and video resource diagnostics with stable counters", () => {
		expect(createImageResourceDiagnostics().snapshot()).toEqual(
			expect.objectContaining({
				memoryHitCount: 0,
				decodeAttemptCount: 0,
				cachedResourceHitCount: 0,
				decodedEvictedCount: 0,
				backgroundRefreshSkippedCount: 0,
			}),
		)
		expect(createVideoResourceDiagnostics().snapshot()).toEqual(
			expect.objectContaining({
				memoryHitCount: 0,
				previewLoadAttemptCount: 0,
				refreshResourceCount: 0,
				backgroundRefreshSkippedCount: 0,
			}),
		)
	})

	it("builds resource snapshots from manager current state and diagnostics stats", () => {
		const imageStats = createImageResourceDiagnostics().snapshot()
		imageStats.memoryHitCount = 3
		const imageSnapshot = buildImageResourceSnapshot(
			{
				managerInstanceId: 1,
				destroyed: false,
				entries: 2,
				lowLoaded: 1,
				lowDecodedBytes: 4,
				previewLoaded: 1,
				previewDecodedBytes: 16,
				fullLoaded: 0,
				fullDecodedBytes: 0,
				decodedBytesTotal: 20,
				lowDecodedBudgetBytes: 80,
				previewDecodedBudgetBytes: 80,
				fullDecodedBudgetBytes: 128,
				decodedBudgetSoftBytes: 160,
				decodedBudgetHardBytes: 224,
				decodedLowLeaseCount: 0,
				decodedPinnedBytes: 0,
				decodedPinnedCount: 0,
				decodedVisiblePinnedCount: 0,
				decodedNearProtectedCount: 0,
				bodyCacheCount: 1,
				bodyCacheBytes: 10,
				bodyFetchInFlightCount: 0,
				activePreviewLoadPipelineCount: 0,
				queuedPreviewLoadCount: 0,
				workerActiveRequestCount: 0,
				workerActivePixelCost: 0,
				workerQueuedRequestCount: 0,
				activeDecodePixelCost: 0,
				queuedDecodePermitCount: 0,
				loadingCount: 0,
				exchangingCount: 0,
				fullLoadingCount: 0,
			},
			imageStats,
		)

		expect(imageSnapshot.memoryHitCount).toBe(3)
		expect(imageSnapshot.stats.memoryHitCount).toBe(3)
		expect(imageSnapshot.previewDecodedBytes).toBe(16)

		const videoStats = createVideoResourceDiagnostics().snapshot()
		videoStats.previewLoadAttemptCount = 5
		const videoSnapshot = buildVideoResourceSnapshot(
			{
				managerInstanceId: 2,
				destroyed: false,
				entries: 1,
				loaded: 1,
				loading: 0,
				exchanging: 0,
				failed: 0,
				failureReasonCounts: {},
				failedResources: [],
				failedResourcesTruncated: false,
				posterCanvasBytes: 64,
				activePreviewLoadCount: 0,
				queuedPreviewLoadCount: 0,
			},
			videoStats,
		)

		expect(videoSnapshot.previewLoadAttemptCount).toBe(5)
		expect(videoSnapshot.stats.previewLoadAttemptCount).toBe(5)
		expect(videoSnapshot.posterCanvasBytes).toBe(64)
	})
})
