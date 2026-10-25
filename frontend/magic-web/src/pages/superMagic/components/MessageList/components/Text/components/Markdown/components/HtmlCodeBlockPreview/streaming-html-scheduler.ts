export interface StreamingHtmlCommitPolicy {
	minInterval: number
	minDelta: number
	maxWait: number
}

const SMALL_HTML_THRESHOLD = 8 * 1024
const LARGE_HTML_THRESHOLD = 50 * 1024

const STRUCTURAL_BOUNDARIES = ["</head>", "</style>", "</script>", "</body>"] as const

export function resolveStreamingHtmlCommitPolicy(contentLength: number): StreamingHtmlCommitPolicy {
	if (contentLength < SMALL_HTML_THRESHOLD) {
		return { minInterval: 120, minDelta: 256, maxWait: 480 }
	}

	if (contentLength <= LARGE_HTML_THRESHOLD) {
		return { minInterval: 200, minDelta: 768, maxWait: 640 }
	}

	return { minInterval: 320, minDelta: 2048, maxWait: 900 }
}

export function hasStreamingHtmlStructuralBoundary(source: string, fromIndex: number) {
	const normalizedSuffix = source.slice(Math.max(0, fromIndex)).toLowerCase()
	return STRUCTURAL_BOUNDARIES.some((boundary) => normalizedSuffix.includes(boundary))
}

interface ShouldCommitStreamingHtmlOptions {
	now: number
	firstPendingAt: number
	lastCommittedAt: number
	committedLength: number
	safeContent: string
}

export function shouldCommitStreamingHtml(options: ShouldCommitStreamingHtmlOptions) {
	const { now, firstPendingAt, lastCommittedAt, committedLength, safeContent } = options
	const policy = resolveStreamingHtmlCommitPolicy(safeContent.length)
	const elapsedSinceCommit = now - lastCommittedAt
	const pendingDuration = now - firstPendingAt
	const delta = Math.max(0, safeContent.length - committedLength)
	const hasBoundary = hasStreamingHtmlStructuralBoundary(safeContent, committedLength)

	if (pendingDuration >= policy.maxWait) return true
	if (elapsedSinceCommit < policy.minInterval) return false

	return delta >= policy.minDelta || hasBoundary
}

export function resolveStreamingHtmlNextCheckDelay(options: ShouldCommitStreamingHtmlOptions) {
	const { now, firstPendingAt, lastCommittedAt, safeContent } = options
	const policy = resolveStreamingHtmlCommitPolicy(safeContent.length)
	const untilMinInterval = Math.max(0, policy.minInterval - (now - lastCommittedAt))
	const untilMaxWait = Math.max(0, policy.maxWait - (now - firstPendingAt))

	return Math.max(1, Math.min(untilMinInterval || policy.minInterval, untilMaxWait || 1))
}
