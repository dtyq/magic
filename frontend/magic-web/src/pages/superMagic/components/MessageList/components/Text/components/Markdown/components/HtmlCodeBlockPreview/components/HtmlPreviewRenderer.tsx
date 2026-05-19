import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererContentMetrics,
} from "@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"
import { inlineDashboardDataJs } from "@/pages/superMagic/components/Detail/contents/HTML/dashboard/resourceVersioning"
import { processHtmlContent } from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"
import { rewriteHtmlWithMagicCdn } from "@/pages/superMagic/components/Detail/contents/HTML/utils"
import { injectFetchInterceptorScript } from "@/pages/superMagic/components/Detail/contents/HTML/utils/fetchInterceptor"
import projectFilesStore from "@/stores/projectFiles"
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
	verticalScrollbarWidth?: number
}

interface HtmlPreviewRendererProps {
	content: string
	onReady: () => void
	onMetrics: (metrics: HtmlPreviewRendererMetrics) => void
	containIframeOverscroll?: boolean
	hideVerticalScroll?: boolean
}

export type { HtmlPreviewRendererProps }

interface HtmlPreviewState {
	content: string
	filePathMapping: Map<string, string>
}

export const HtmlPreviewRenderer = observer(function HtmlPreviewRenderer(
	props: HtmlPreviewRendererProps,
) {
	const {
		content,
		onReady,
		onMetrics,
		containIframeOverscroll = true,
		hideVerticalScroll = false,
	} = props
	const workspaceFilesList = projectFilesStore.workspaceFilesList
	const workspaceFilesSignature = workspaceFilesList
		.map(
			(file) =>
				`${file.file_id ?? ""}:${file.updated_at ?? ""}:${file.relative_file_path ?? ""}`,
		)
		.join("|")
	const [previewState, setPreviewState] = useState<HtmlPreviewState>(() => ({
		content,
		filePathMapping: HTML_CODE_BLOCK_PREVIEW_EMPTY_FILE_PATH_MAPPING,
	}))

	useEffect(() => {
		let cancelled = false

		// 预处理结果里的内容和路径映射总是一起变化，这里保持单一状态源，避免两份 state 先后更新。
		function resetPreviewState(nextContent: string) {
			setPreviewState({
				content: nextContent,
				filePathMapping: HTML_CODE_BLOCK_PREVIEW_EMPTY_FILE_PATH_MAPPING,
			})
		}

		// 消息列表只在消息完成态挂载这个 renderer；
		// 这里直接复用编辑区同一条 HTML 处理链，保证完成后的预览语义一致。
		async function processPreviewContent() {
			// 新内容进来时先清空上一版预处理结果，避免短暂复用旧消息的资源映射。
			resetPreviewState(content)

			try {
				const result = await processHtmlContent({
					content,
					attachments: workspaceFilesList,
					attachmentList: workspaceFilesList,
				})

				let finalPreviewContent = inlineDashboardDataJs({
					html: result.processedContent,
				})

				// 完成态消息预览与编辑区保持一致，继续注入运行时 fetch 拦截脚本。
				finalPreviewContent = injectFetchInterceptorScript(finalPreviewContent, {
					fileId: "",
				})

				if (cancelled) return
				setPreviewState({
					content: finalPreviewContent,
					filePathMapping: result.filePathMapping,
				})
			} catch (error) {
				if (cancelled) return
				// 预处理失败时退回现有 CDN 改写逻辑，避免把整张预览卡片打挂。
				resetPreviewState(rewriteHtmlWithMagicCdn(content))
				console.error("Error processing message HTML preview content:", error)
			}
		}

		processPreviewContent()

		return () => {
			cancelled = true
		}
	}, [content, workspaceFilesList, workspaceFilesSignature])

	// 将 iframe 内部上报的内容尺寸统一转成消息列表预览所需的指标格式。
	function handleMetrics(metrics: IsolatedHTMLRendererContentMetrics) {
		onMetrics({
			contentWidth: metrics.contentWidth,
			contentHeight: metrics.contentHeight,
			phase: metrics.phase,
			hasHorizontalOverflow: metrics.hasHorizontalOverflow,
			hasVerticalOverflow: metrics.hasVerticalOverflow,
			verticalScrollbarWidth: metrics.verticalScrollbarWidth,
		})
	}

	return (
		<IsolatedHTMLRenderer
			content={previewState.content}
			filePathMapping={previewState.filePathMapping}
			openNewTab={HTML_CODE_BLOCK_PREVIEW_OPEN_NEW_TAB_NOOP}
			containIframeOverscroll={
				containIframeOverscroll && HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL
			}
			/** 重要！ 控制HTML预览增强组件内部是否禁用 iframe 到父层的通用 DOM_CLICK 桥接 */
			disableIframeDocumentClickBridge
			hideVerticalScroll={hideVerticalScroll}
			isVisible
			onRenderReady={onReady}
			onContentMetrics={handleMetrics}
		/>
	)
})
