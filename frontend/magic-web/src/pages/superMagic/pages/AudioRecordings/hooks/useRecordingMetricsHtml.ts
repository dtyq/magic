import { useCallback, useEffect, useState } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { processHtmlContent } from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"

interface UseRecordingMetricsHtmlInput {
	content: string
	attachmentList: AttachmentItem[]
	fileId?: string
	fileName: string
}

/** Coordinates resource processing and iframe readiness for the recording metrics preview. */
export function useRecordingMetricsHtml({
	content,
	attachmentList,
	fileId,
	fileName,
}: UseRecordingMetricsHtmlInput) {
	const [processedContent, setProcessedContent] = useState("")
	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [processing, setProcessing] = useState(true)
	const [iframeReady, setIframeReady] = useState(false)

	useEffect(() => {
		let cancelled = false

		// Hold the iframe until processing finishes so raw HTML cannot run location.reload
		// or resolve relative assets against the host origin.
		setProcessing(true)
		setIframeReady(false)
		setProcessedContent("")
		setFilePathMapping(new Map())

		void processHtmlContent({
			content,
			attachments: attachmentList,
			attachmentList,
			fileId,
			fileName,
		})
			.then((result) => {
				if (cancelled) return
				setIframeReady(false)
				setProcessedContent(result.processedContent)
				setFilePathMapping(result.filePathMapping)
			})
			.catch((error) => {
				if (cancelled) return
				// Keep the original HTML usable when an optional attachment cannot be resolved.
				console.error("Failed to process recording metrics HTML:", error)
				setProcessedContent(content)
				setFilePathMapping(new Map())
			})
			.finally(() => {
				if (!cancelled) setProcessing(false)
			})

		return () => {
			cancelled = true
		}
	}, [attachmentList, content, fileId, fileName])

	/** Marks the IsolatedHTMLRenderer as painted so the local overlay can dismiss. */
	const handleRenderReady = useCallback(() => {
		setIframeReady(true)
	}, [])

	// A broken iframe must not leave the local overlay blocking the entire tab forever.
	useEffect(() => {
		if (processing || iframeReady || !processedContent) return

		const fallbackTimer = window.setTimeout(() => setIframeReady(true), 4000)
		return () => window.clearTimeout(fallbackTimer)
	}, [iframeReady, processing, processedContent])

	return {
		processedContent,
		filePathMapping,
		isLoading: processing || !iframeReady,
		handleRenderReady,
	}
}
