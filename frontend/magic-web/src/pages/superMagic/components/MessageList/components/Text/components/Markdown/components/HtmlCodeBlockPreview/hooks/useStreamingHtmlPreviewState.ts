import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "../constants"

const HTML_CODE_BLOCK_STREAMING_PREVIEW_MIN_LOADING_DURATION = Math.max(
	HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION,
	260,
)
const HTML_CODE_BLOCK_STREAMING_PREVIEW_COMMIT_INTERVAL = 96

interface UseStreamingHtmlPreviewStateProps {
	content: string
	isSuspended?: boolean
	onCommittedContentChange?: (nextContent: string) => void
}

export function useStreamingHtmlPreviewState(props: UseStreamingHtmlPreviewStateProps) {
	const { content, isSuspended = false, onCommittedContentChange } = props
	const [hasPreviewRenderedOnce, setHasPreviewRenderedOnce] = useState(false)
	const [hasMinLoadingDurationElapsed, setHasMinLoadingDurationElapsed] = useState(false)
	const [committedContent, setCommittedContent] = useState(content)
	const loadingTimerRef = useRef<number | null>(null)
	const readyFrameRef = useRef<number | null>(null)
	const commitTimerRef = useRef<number | null>(null)
	const latestContentRef = useRef(content)
	const suspendedRef = useRef(isSuspended)
	const hasCommittedContent = useMemo(
		() => committedContent.trim().length > 0,
		[committedContent],
	)

	useEffect(() => {
		latestContentRef.current = content
	}, [content])

	useEffect(() => {
		onCommittedContentChange?.(committedContent)
	}, [committedContent, onCommittedContentChange])

	useEffect(() => {
		suspendedRef.current = isSuspended
	}, [isSuspended])

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
		if (!isSuspended || !commitTimerRef.current) return

		// 重要：服务端暂停后立即停止本地 commit timer，保留当前已经渲染到预览里的内容。
		// 否则会导致即时暂停按钮后 流式消息中的html片段 无法暂停渲染
		window.clearTimeout(commitTimerRef.current)
		commitTimerRef.current = null
	}, [committedContent.length, content.length, isSuspended])

	useEffect(() => {
		if (isSuspended) return

		const nextContent = content
		const shouldResetCommittedContent =
			nextContent.length < committedContent.length ||
			!nextContent.startsWith(committedContent)

		if (shouldResetCommittedContent) {
			if (commitTimerRef.current) {
				window.clearTimeout(commitTimerRef.current)
				commitTimerRef.current = null
			}
			setCommittedContent(nextContent)
			return
		}

		if (nextContent === committedContent) {
			return
		}

		if (commitTimerRef.current) return

		commitTimerRef.current = window.setTimeout(() => {
			if (suspendedRef.current) {
				commitTimerRef.current = null
				return
			}
			commitTimerRef.current = null
			setCommittedContent(latestContentRef.current)
		}, HTML_CODE_BLOCK_STREAMING_PREVIEW_COMMIT_INTERVAL)
	}, [committedContent, content, isSuspended])

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
