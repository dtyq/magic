import { HtmlCodeBlockDesktopPreview } from "./components/HtmlCodeBlockDesktopPreview"
import { StreamingHtmlPreview } from "./StreamingHtmlPreview"

interface HtmlPreviewSwitcherProps {
	isStreaming: boolean
	isSuspended?: boolean
	isPreviewActive?: boolean
	resolvedCode: string
	isPreviewLoading: boolean
	onPreviewRenderReady: () => void
	onCommittedContentChange?: (nextContent: string) => void
	availableWidth?: number
	initialDesktopViewportWidth?: number
	onSuggestedCardWidthChange?: (nextWidth: number | null) => void
	previewLayout?: "desktop" | "phone"
}

export function HtmlPreviewSwitcher(props: HtmlPreviewSwitcherProps) {
	const {
		isStreaming,
		isSuspended = false,
		isPreviewActive = true,
		resolvedCode,
		isPreviewLoading,
		onPreviewRenderReady,
		onCommittedContentChange,
		availableWidth,
		initialDesktopViewportWidth,
		onSuggestedCardWidthChange,
		previewLayout = "phone",
	} = props

	if (isStreaming) {
		return (
			<StreamingHtmlPreview
				content={resolvedCode}
				isSuspended={isSuspended}
				isPreviewActive={isPreviewActive}
				onCommittedContentChange={onCommittedContentChange}
				previewLayout={previewLayout}
				availableWidth={availableWidth}
				onSuggestedCardWidthChange={onSuggestedCardWidthChange}
			/>
		)
	}

	return (
		<HtmlCodeBlockDesktopPreview
			resolvedCode={resolvedCode}
			isPreviewLoading={isPreviewLoading}
			onPreviewRenderReady={onPreviewRenderReady}
			availableWidth={availableWidth}
			initialDesktopViewportWidth={initialDesktopViewportWidth}
			onSuggestedCardWidthChange={onSuggestedCardWidthChange}
			previewLayout={previewLayout}
		/>
	)
}
