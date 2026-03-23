import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererContentMetrics,
} from "@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"
import {
	HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL,
	HTML_CODE_BLOCK_PREVIEW_EMPTY_FILE_PATH_MAPPING,
	HTML_CODE_BLOCK_PREVIEW_OPEN_NEW_TAB_NOOP,
} from "../constants"

export interface HtmlPreviewRendererMetrics {
	contentWidth: number
	contentHeight: number
	phase?: "initial" | "settled"
	hasHorizontalOverflow?: boolean
	hasVerticalOverflow?: boolean
}

interface HtmlPreviewRendererProps {
	content: string
	onReady: () => void
	onMetrics: (metrics: HtmlPreviewRendererMetrics) => void
}

export function HtmlPreviewRenderer(props: HtmlPreviewRendererProps) {
	const { content, onReady, onMetrics } = props

	function handleMetrics(metrics: IsolatedHTMLRendererContentMetrics) {
		onMetrics({
			contentWidth: metrics.contentWidth,
			contentHeight: metrics.contentHeight,
			phase: metrics.phase,
			hasHorizontalOverflow: metrics.hasHorizontalOverflow,
			hasVerticalOverflow: metrics.hasVerticalOverflow,
		})
	}

	return (
		<IsolatedHTMLRenderer
			content={content}
			filePathMapping={HTML_CODE_BLOCK_PREVIEW_EMPTY_FILE_PATH_MAPPING}
			openNewTab={HTML_CODE_BLOCK_PREVIEW_OPEN_NEW_TAB_NOOP}
			containIframeOverscroll={HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL}
			/** 重要！ 控制HTML预览增强组件内部是否禁用 iframe 到父层的通用 DOM_CLICK 桥接 */
			disableIframeDocumentClickBridge
			isVisible
			onRenderReady={onReady}
			onContentMetrics={handleMetrics}
		/>
	)
}
