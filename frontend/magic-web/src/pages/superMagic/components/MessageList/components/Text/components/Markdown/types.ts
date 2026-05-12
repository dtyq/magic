// 收口 Markdown 主入口和 HTML 预览增强链的类型定义，避免入口文件继续膨胀。

// Markdown 主入口 props。`isStreaming` 用于区分流式代码态和完成后的预览态。
export interface MarkdownComponentProps {
	content: string
	className?: string
	maxLength?: number
	isStreaming?: boolean
	isSuspended?: boolean
	showCursor?: boolean
	/**
	 * 是否允许 fence 外的裸 HTML 原样渲染（不转义）。
	 * - `true`（默认）：跳过预处理转义，所有裸 HTML 将被 XMarkdown 当作原生 HTML 渲染。
	 * - `false`：完整 HTML 文档（`<!DOCTYPE`/`<html>` 开头）包裹在代码块中显示源码；
	 *   混合内容中 fence 外的裸 HTML 转义为纯文本（白名单标签如 file-path 除外）。
	 */
	allowRawHtml?: boolean
	onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void
	onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void
}

// 内部 Markdown 渲染层 props。保留原始源码，供 `pre` 渲染器回溯完整 HTML block。
export interface MarkdownHtmlPreviewContentProps {
	content: string
	className?: string
	sourceContent: string
	isStreaming?: boolean
	isSuspended?: boolean
}
