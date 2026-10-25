import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "../constants"
import {
	resolveStreamingHtmlCommitContentIncrementally,
	type StreamingHtmlScanState,
} from "../streaming-html-commit"
import {
	resolveStreamingHtmlNextCheckDelay,
	shouldCommitStreamingHtml,
} from "../streaming-html-scheduler"

const HTML_CODE_BLOCK_STREAMING_PREVIEW_MIN_LOADING_DURATION = Math.max(
	HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION,
	260,
)
interface UseStreamingHtmlPreviewStateProps {
	content: string
	isSuspended?: boolean
	isPreviewActive?: boolean
}

export function useStreamingHtmlPreviewState(props: UseStreamingHtmlPreviewStateProps) {
	const { content, isSuspended = false, isPreviewActive = true } = props
	const [hasPreviewRenderedOnce, setHasPreviewRenderedOnce] = useState(false)
	const [hasMinLoadingDurationElapsed, setHasMinLoadingDurationElapsed] = useState(false)
	const initialScanResultRef = useRef<
		ReturnType<typeof resolveStreamingHtmlCommitContentIncrementally> | undefined
	>(undefined)
	if (!initialScanResultRef.current) {
		initialScanResultRef.current = resolveStreamingHtmlCommitContentIncrementally(
			undefined,
			content,
		)
	}
	const initialScanResult = initialScanResultRef.current
	const [committedContent, setCommittedContent] = useState(initialScanResult.content)
	const loadingTimerRef = useRef<number | null>(null)
	const readyFrameRef = useRef<number | null>(null)
	const commitTimerRef = useRef<number | null>(null)
	const latestSafeContentRef = useRef(initialScanResult.content)
	const scannerStateRef = useRef<StreamingHtmlScanState>(initialScanResult.state)
	const suspendedRef = useRef(isSuspended)
	const previewActiveRef = useRef(isPreviewActive)
	const firstPendingAtRef = useRef<number | null>(null)
	const lastCommittedAtRef = useRef(Date.now())
	const committedContentLengthRef = useRef(initialScanResult.content.length)
	const committedContentRef = useRef(committedContent)
	const hasCommittedContent = useMemo(
		() => committedContent.trim().length > 0,
		[committedContent],
	)

	useEffect(() => {
		suspendedRef.current = isSuspended
	}, [isSuspended])

	useEffect(() => {
		previewActiveRef.current = isPreviewActive
	}, [isPreviewActive])

	useEffect(() => {
		loadingTimerRef.current = window.setTimeout(() => {
			setHasMinLoadingDurationElapsed(true)
			loadingTimerRef.current = null
		}, HTML_CODE_BLOCK_STREAMING_PREVIEW_MIN_LOADING_DURATION)

		return () => {
			if (loadingTimerRef.current) window.clearTimeout(loadingTimerRef.current)
			if (readyFrameRef.current) window.cancelAnimationFrame(readyFrameRef.current)
			if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current)
		}
	}, [])

	useEffect(() => {
		const scanResult = resolveStreamingHtmlCommitContentIncrementally(
			scannerStateRef.current,
			content,
		)
		scannerStateRef.current = scanResult.state
		latestSafeContentRef.current = scanResult.content

		const clearCommitTimer = () => {
			if (commitTimerRef.current !== null) {
				window.clearTimeout(commitTimerRef.current)
				commitTimerRef.current = null
			}
		}

		const commitLatestSafeContent = (force = false) => {
			if (suspendedRef.current || !previewActiveRef.current) return false
			const nextContent = latestSafeContentRef.current
			if (!force && nextContent === committedContentRef.current) return false

			setCommittedContent(nextContent)
			committedContentLengthRef.current = nextContent.length
			lastCommittedAtRef.current = Date.now()
			firstPendingAtRef.current = null
			return true
		}

		if (isSuspended || !isPreviewActive) {
			// Semantic suspension freezes the current frame; viewport suspension keeps
			// only the latest safe source and catches up once the card becomes visible.
			clearCommitTimer()
			return
		}

		// A replacement or truncation invalidates the old scanner prefix. Reset the
		// visible snapshot only when active; hidden previews catch up on resume.
		if (
			latestSafeContentRef.current.length < committedContent.length ||
			!content.startsWith(committedContent)
		) {
			clearCommitTimer()
			firstPendingAtRef.current = null
			if (isPreviewActive && !isSuspended) commitLatestSafeContent(true)
			return
		}

		if (latestSafeContentRef.current === committedContent) return

		if (firstPendingAtRef.current === null) firstPendingAtRef.current = Date.now()
		if (commitTimerRef.current !== null) return

		const scheduleCommit = () => {
			commitTimerRef.current = window.setTimeout(
				() => {
					commitTimerRef.current = null
					if (suspendedRef.current || !previewActiveRef.current) return

					const now = Date.now()
					const firstPendingAt = firstPendingAtRef.current ?? now
					const shouldCommit = shouldCommitStreamingHtml({
						now,
						firstPendingAt,
						lastCommittedAt: lastCommittedAtRef.current,
						committedLength: committedContentLengthRef.current,
						safeContent: latestSafeContentRef.current,
					})
					if (shouldCommit) {
						commitLatestSafeContent()
						return
					}

					if (firstPendingAtRef.current !== null) scheduleCommit()
				},
				resolveStreamingHtmlNextCheckDelay({
					now: Date.now(),
					firstPendingAt: firstPendingAtRef.current ?? Date.now(),
					lastCommittedAt: lastCommittedAtRef.current,
					committedLength: committedContentLengthRef.current,
					safeContent: latestSafeContentRef.current,
				}),
			)
		}

		scheduleCommit()
	}, [committedContent, content, isPreviewActive, isSuspended])

	useEffect(() => {
		committedContentRef.current = committedContent
	}, [committedContent])

	useEffect(() => {
		if (!isPreviewActive || isSuspended) return
		if (latestSafeContentRef.current === committedContentRef.current) return
		if (commitTimerRef.current !== null) {
			window.clearTimeout(commitTimerRef.current)
			commitTimerRef.current = null
		}
		setCommittedContent(latestSafeContentRef.current)
		committedContentLengthRef.current = latestSafeContentRef.current.length
		lastCommittedAtRef.current = Date.now()
		firstPendingAtRef.current = null
	}, [isPreviewActive, isSuspended])

	const handlePreviewRenderReady = useCallback(() => {
		if (readyFrameRef.current) window.cancelAnimationFrame(readyFrameRef.current)
		readyFrameRef.current = window.requestAnimationFrame(() => {
			setHasPreviewRenderedOnce(true)
			readyFrameRef.current = null
		})
	}, [])

	return {
		committedContent,
		isPreviewLoading:
			!hasPreviewRenderedOnce || !hasCommittedContent || !hasMinLoadingDurationElapsed,
		handlePreviewRenderReady,
	}
}
