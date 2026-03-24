// 收口 Markdown 主入口和 HTML 预览增强链的类型定义，避免入口文件继续膨胀。

// Markdown 主入口 props。`isStreaming` 用于区分流式代码态和完成后的预览态。
export interface MarkdownComponentProps {
	content: string
	className?: string
	maxLength?: number
	isStreaming?: boolean
}

// 内部 Markdown 渲染层 props。保留原始源码，供 `pre` 渲染器回溯完整 HTML block。
export interface MarkdownHtmlPreviewContentProps {
	content: string
	className?: string
	sourceContent: string
	isStreaming?: boolean
}
