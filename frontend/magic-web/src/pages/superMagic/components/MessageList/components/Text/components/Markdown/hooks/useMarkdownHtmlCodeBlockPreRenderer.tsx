import { useMemo, useRef } from "react"
import type { ComponentProps, MutableRefObject } from "react"
import HtmlCodeBlockPreview from "../components/HtmlCodeBlockPreview"
import type { HtmlCodeBlockPreviewStreamingScrollState } from "../components/HtmlCodeBlockPreview/types"
import {
	extractCodeBlockInfo,
	resolveFullHtmlCodeBlock,
	resolveHtmlPreviewCode,
} from "../components/HtmlCodeBlockPreview/utils"

// 为 markdown-to-jsx 生成 `pre` 覆盖渲染器：
// 识别 HTML fenced block，在非流式完成态下补齐完整源码，并交给 `HtmlCodeBlockPreview`。
interface UseMarkdownHtmlCodeBlockPreRendererOptions {
	htmlCodeBlocks: string[]
	isStreaming: boolean
	streamingScrollStateRef: MutableRefObject<HtmlCodeBlockPreviewStreamingScrollState>
}

export function useMarkdownHtmlCodeBlockPreRenderer(
	options: UseMarkdownHtmlCodeBlockPreRendererOptions,
) {
	const { htmlCodeBlocks, isStreaming, streamingScrollStateRef } = options
	const htmlCodeBlocksRef = useRef(htmlCodeBlocks)
	const isStreamingRef = useRef(isStreaming)

	htmlCodeBlocksRef.current = htmlCodeBlocks
	isStreamingRef.current = isStreaming

	return useMemo(() => {
		function MarkdownHtmlCodeBlockPreRenderer(props: ComponentProps<"pre">) {
			const codeBlockInfo = extractCodeBlockInfo(props.children)
			const previewCode = resolveHtmlPreviewCode(codeBlockInfo)
			let fullCode: string | undefined

			if (previewCode && !isStreamingRef.current) {
				try {
					fullCode = resolveFullHtmlCodeBlock(previewCode, htmlCodeBlocksRef.current)
				} catch {
					fullCode = undefined
				}
			}

			return (
				<HtmlCodeBlockPreview
					{...props}
					isStreaming={isStreamingRef.current}
					fullCode={fullCode}
					streamingScrollStateRef={streamingScrollStateRef}
				/>
			)
		}

		return MarkdownHtmlCodeBlockPreRenderer
	}, [streamingScrollStateRef])
}
