export type ResourceDiagnosticCounterSnapshot<TCounter extends string> = Record<TCounter, number>

export class CanvasResourceDiagnostics<TCounter extends string> {
	private counters: ResourceDiagnosticCounterSnapshot<TCounter>

	constructor(counterNames: readonly TCounter[]) {
		this.counters = Object.fromEntries(
			counterNames.map((counter) => [counter, 0]),
		) as ResourceDiagnosticCounterSnapshot<TCounter>
	}

	public increment(counter: TCounter, by = 1): void {
		this.counters[counter] += by
	}

	public snapshot(): ResourceDiagnosticCounterSnapshot<TCounter> {
		return { ...this.counters }
	}

	public reset(): void {
		for (const counter of Object.keys(this.counters) as TCounter[]) {
			this.counters[counter] = 0
		}
	}
}

export const IMAGE_RESOURCE_DIAGNOSTIC_COUNTERS = [
	"memoryHitCount",
	"loadingDedupedCount",
	"cachedResourceHitCount",
	"cachedResourceMissCount",
	"bodyCacheHitCount",
	"bodyFetchAttemptCount",
	"bodyFetchDedupedCount",
	"bodyFetchSuccessCount",
	"bodyFetchFailedCount",
	"decodeAttemptCount",
	"decodeRepeatAttemptCount",
	"decodeSuccessCount",
	"decodeFailedCount",
	"decodedEvictedCount",
	"decodedEvictedBytes",
	"decodedEvictedLow",
	"decodedEvictedPreview",
	"decodedEvictedFull",
	"staleRequestDropCount",
	"getFileInfoCount",
	"getFileInfoForceRefreshCount",
	"backgroundRefreshQueuedCount",
	"backgroundRefreshDedupedCount",
	"backgroundRefreshSkippedCount",
	"metadataProbeCount",
	"metadataUnchangedCount",
	"metadataChangedCount",
	"metadataUnknownCount",
	"metadataDeletedCount",
	"persistentLowHitCount",
	"persistentLowMissCount",
	"refreshResourceCount",
] as const

export type ImageResourceDiagnosticCounter = (typeof IMAGE_RESOURCE_DIAGNOSTIC_COUNTERS)[number]
export type ImageResourceDiagnosticsSnapshot =
	ResourceDiagnosticCounterSnapshot<ImageResourceDiagnosticCounter>

export interface ImageResourceCurrentSnapshot {
	managerInstanceId: number
	destroyed: boolean
	entries: number
	lowLoaded: number
	lowDecodedBytes: number
	previewLoaded: number
	previewDecodedBytes: number
	fullLoaded: number
	fullDecodedBytes: number
	decodedBytesTotal: number
	lowDecodedBudgetBytes: number
	previewDecodedBudgetBytes: number
	fullDecodedBudgetBytes: number
	decodedBudgetSoftBytes: number
	decodedBudgetHardBytes: number
	decodedLowLeaseCount: number
	decodedPinnedBytes: number
	decodedPinnedCount: number
	decodedVisiblePinnedCount: number
	decodedNearProtectedCount: number
	bodyCacheCount: number
	bodyCacheBytes: number
	bodyFetchInFlightCount: number
	activePreviewLoadPipelineCount: number
	queuedPreviewLoadCount: number
	workerActiveRequestCount: number
	workerActivePixelCost: number
	workerQueuedRequestCount: number
	activeDecodePixelCost: number
	queuedDecodePermitCount: number
	loadingCount: number
	exchangingCount: number
	fullLoadingCount: number
}

export type ImageResourceSnapshot = ImageResourceCurrentSnapshot &
	ImageResourceDiagnosticsSnapshot & {
		stats: ImageResourceDiagnosticsSnapshot
	}

export function createImageResourceDiagnostics(): CanvasResourceDiagnostics<ImageResourceDiagnosticCounter> {
	return new CanvasResourceDiagnostics(IMAGE_RESOURCE_DIAGNOSTIC_COUNTERS)
}

export function buildImageResourceSnapshot(
	current: ImageResourceCurrentSnapshot,
	stats: ImageResourceDiagnosticsSnapshot,
): ImageResourceSnapshot {
	return {
		...current,
		stats,
		...stats,
	}
}

export const VIDEO_RESOURCE_DIAGNOSTIC_COUNTERS = [
	"memoryHitCount",
	"loadingDedupedCount",
	"cachedResourceHitCount",
	"cachedResourceMissCount",
	"previewLoadAttemptCount",
	"previewLoadRetryCount",
	"previewLoadSuccessCount",
	"previewLoadFailedCount",
	"previewLoadAbortCount",
	"previewLoadTimeoutCount",
	"staleRequestDropCount",
	"getFileInfoCount",
	"getFileInfoForceRefreshCount",
	"backgroundRefreshQueuedCount",
	"backgroundRefreshDedupedCount",
	"backgroundRefreshSkippedCount",
	"metadataProbeCount",
	"metadataUnchangedCount",
	"metadataChangedCount",
	"metadataUnknownCount",
	"metadataDeletedCount",
	"refreshResourceCount",
] as const

export type VideoResourceDiagnosticCounter = (typeof VIDEO_RESOURCE_DIAGNOSTIC_COUNTERS)[number]
export type VideoResourceDiagnosticsSnapshot =
	ResourceDiagnosticCounterSnapshot<VideoResourceDiagnosticCounter>

export interface VideoResourceFailureInfo {
	path: string
	reason: string
	source?: unknown
	fileName?: string
	resourceVersion: string | null
	sourceUpdatedAt: string | null
	contentLength: number | null
	hasOssSrc: boolean
	hasSourceUrl: boolean
}

export interface VideoResourceCurrentSnapshot {
	managerInstanceId: number
	destroyed: boolean
	entries: number
	loaded: number
	loading: number
	exchanging: number
	failed: number
	failureReasonCounts: Record<string, number>
	failedResources: VideoResourceFailureInfo[]
	failedResourcesTruncated: boolean
	posterCanvasBytes: number
	activePreviewLoadCount: number
	queuedPreviewLoadCount: number
}

export type VideoResourceSnapshot = VideoResourceCurrentSnapshot &
	VideoResourceDiagnosticsSnapshot & {
		stats: VideoResourceDiagnosticsSnapshot
	}

export function createVideoResourceDiagnostics(): CanvasResourceDiagnostics<VideoResourceDiagnosticCounter> {
	return new CanvasResourceDiagnostics(VIDEO_RESOURCE_DIAGNOSTIC_COUNTERS)
}

export function buildVideoResourceSnapshot(
	current: VideoResourceCurrentSnapshot,
	stats: VideoResourceDiagnosticsSnapshot,
): VideoResourceSnapshot {
	return {
		...current,
		stats,
		...stats,
	}
}
