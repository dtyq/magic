import type { HTMLAttributes, MutableRefObject } from "react"

export type HtmlCodeBlockPreviewMode = "code" | "desktop"

// 流式代码块滚动状态。
// 当前只记录用户是否已经主动滚离底部，后续如果需要可继续扩展。
export interface HtmlCodeBlockPreviewStreamingScrollState {
	hasUserInteracted: boolean
}

// HTML 代码块预览组件的 props。
// 它本质上是作为 `pre` 的增强渲染器，因此复用了 `HTMLPreElement` 的属性。
export interface HtmlCodeBlockPreviewProps extends HTMLAttributes<HTMLPreElement> {
	// 当前代码块是否仍处于流式生成阶段。
	isStreaming?: boolean
	// 完整 HTML 源码。非流式完成态下，优先使用它保证复制/预览拿到的是完整代码。
	fullCode?: string
	// 多个预览实例之间传递滚动状态时使用的 ref。
	streamingScrollStateRef?: MutableRefObject<HtmlCodeBlockPreviewStreamingScrollState>
}

// 从 markdown-to-jsx 的 `<pre><code /></pre>` 结构中抽出的代码块信息。
export interface HtmlCodeBlockPreviewCodeBlockInfo {
	// `language-html` / `lang-html` 这类语言 class。
	className?: string
	// 代码块实际文本内容。
	code: string
}

// iframe 内部上报给外层预览容器的内容尺寸指标。
// 用于动态修正预览画布尺寸和视口高度。
export interface HtmlCodeBlockPreviewContentMetrics {
	contentWidth: number
	contentHeight: number
	// 当前指标属于初始阶段还是稳定阶段。
	phase?: "initial" | "settled"
	// 是否存在水平/垂直溢出，用于辅助外层布局判断。
	hasHorizontalOverflow?: boolean
	hasVerticalOverflow?: boolean
}
