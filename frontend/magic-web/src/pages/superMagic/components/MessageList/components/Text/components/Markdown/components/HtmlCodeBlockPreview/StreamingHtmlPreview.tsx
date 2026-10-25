import { HtmlCodeBlockDesktopPreview } from "./components/HtmlCodeBlockDesktopPreview"
import { StreamingHtmlPreviewRenderer } from "./components/StreamingHtmlPreviewRenderer"
import { useStreamingHtmlPreviewState } from "./hooks/useStreamingHtmlPreviewState"

interface StreamingHtmlPreviewProps {
	content: string
	isSuspended?: boolean
	isPreviewActive?: boolean
	onCommittedContentChange?: (nextContent: string) => void
	previewLayout?: "desktop" | "phone"
	availableWidth?: number
	onSuggestedCardWidthChange?: (nextWidth: number | null) => void
}

export function StreamingHtmlPreview(props: StreamingHtmlPreviewProps) {
	const {
		content,
		isSuspended = false,
		isPreviewActive = true,
		onCommittedContentChange,
		previewLayout = "phone",
		availableWidth,
		onSuggestedCardWidthChange,
	} = props
	const { committedContent, handlePreviewRenderReady, isPreviewLoading } =
		useStreamingHtmlPreviewState({ content, isSuspended, isPreviewActive })

	return (
		<HtmlCodeBlockDesktopPreview
			resolvedCode={committedContent}
			isPreviewLoading={isPreviewLoading}
			onPreviewRenderReady={handlePreviewRenderReady}
			onPreviewContentCommitted={onCommittedContentChange}
			isPreviewActive={isPreviewActive}
			availableWidth={availableWidth}
			onSuggestedCardWidthChange={onSuggestedCardWidthChange}
			previewLayout={previewLayout}
			resetMetricsOnCodeChange={false}
			containIframeOverscroll={false}
			hideVerticalScroll={false}
			PreviewRendererComponent={StreamingHtmlPreviewRenderer}
		/>
	)
}
