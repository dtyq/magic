import { preprocessMarkdown } from "@/pages/superMagic/utils/handleMarkDown"
import Markdown from "markdown-to-jsx"
import { memo, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import type { MarkdownComponentProps, MarkdownHtmlPreviewContentProps } from "./types"
import { FilePath } from "./parser/FilePath"
import { Image } from "./parser/Image"
import { Cursor } from "./parser/Cursor"
import { MarkdownLink } from "./parser/MarkdownLink"
import type { HtmlCodeBlockPreviewStreamingScrollState } from "./components/HtmlCodeBlockPreview/types"
import {
	extractHtmlFencedCodeBlocksFromMarkdown,
	normalizeMarkdownWrappedHtmlFencedCodeBlocks,
} from "./components/HtmlCodeBlockPreview/utils"
import { useMarkdownHtmlCodeBlockPreRenderer } from "./hooks/useMarkdownHtmlCodeBlockPreRenderer"

// 以下是“超长内容截断 + 查看全文按钮/弹窗”的旧实现说明，当前按需求先保留为注释，不恢复行为：
// 1. 旧逻辑会在内容超过 maxLength 时截断渲染结果
// 2. 截断后在消息下方显示“查看全文”按钮
// 3. 点击后通过 LongContentModal 展示完整长文本
// 本次 HTML 预览增强主链不继续启用这套逻辑，但为了保留历史实现和后续恢复参考，先注释留档在此。
//
// function LongContentModal({
// 	open,
// 	content,
// 	onClose,
// }: {
// 	open: boolean
// 	content: string
// 	onClose: () => void
// }) {
// 	const { t } = useTranslation("interface")
//
// 	return (
// 		<MagicModal
// 			title={t("chat.markdown.viewFullText")}
// 			open={open}
// 			onCancel={onClose}
// 			width="80%"
// 			footer={null}
// 			styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
// 			centered
// 		>
// 			<div
// 				style={{
// 					marginBottom: "6px",
// 					fontSize: "12px",
// 					color: "#666",
// 					textAlign: "right",
// 				}}
// 			>
// 				{t("chat.markdown.totalLength")}: {content?.length?.toLocaleString() || 0}{" "}
// 				{t("chat.markdown.characters")}
// 			</div>
// 			<div
// 				style={{
// 					fontFamily: "monospace",
// 					fontSize: "13px",
// 					lineHeight: "1.6",
// 					whiteSpace: "pre-wrap",
// 					padding: "12px",
// 					backgroundColor: "#f5f5f5",
// 					borderRadius: "4px",
// 					border: "1px solid #d9d9d9",
// 				}}
// 			>
// 				{content}
// 			</div>
// 		</MagicModal>
// 	)
// }
//
// 旧的 MarkdownComponent 长内容处理逻辑如下：
// const [showModal, setShowModal] = useState(false)
// const maxLength = 20000
// const {
// 	content: markdownContent,
// 	length: contentLength,
// 	shouldRenderAsPlainText,
// } = useMemo(() => {
// 	const shouldRenderAsPlainText = false
//
// 	if (content?.length > maxLength) {
// 		const markdownContent = shouldRenderAsPlainText
// 			? content.slice(0, maxLength)
// 			: preprocessMarkdown(content.slice(0, maxLength))
// 		return {
// 			content: markdownContent + "...",
// 			length: content.length || 0,
// 			shouldRenderAsPlainText,
// 		}
// 	}
//
// 	const markdownContent = shouldRenderAsPlainText ? content : preprocessMarkdown(content)
// 	return {
// 		content: markdownContent,
// 		length: markdownContent?.length || 0,
// 		shouldRenderAsPlainText,
// 	}
// }, [content, maxLength])
//
// if (contentLength > maxLength) {
// 	return (
// 		<div className={className}>
// 			{shouldRenderAsPlainText ? (
// 				<pre
// 					style={{
// 						whiteSpace: "pre-wrap",
// 						wordBreak: "break-word",
// 						fontFamily: "monospace",
// 						fontSize: "13px",
// 						lineHeight: "1.6",
// 						margin: 0,
// 						padding: 0,
// 					}}
// 				>
// 					{markdownContent}
// 				</pre>
// 			) : (
// 				<MarkdownContent className={className} content={markdownContent} />
// 			)}
// 			<button className={styles.viewMore} onClick={() => setShowModal(true)}>
// 				{t("chat.markdown.viewFullText")}
// 			</button>
// 			<LongContentModal
// 				open={showModal}
// 				content={markdownContent}
// 				onClose={() => setShowModal(false)}
// 			/>
// 		</div>
// 	)
// }

function stripStreamingCursorPlaceholder(content: string) {
	return content.replace(/<cursor\/>\s*$/i, "")
}

function MarkdownContent({
	content,
	className,
	sourceContent,
	isStreaming = false,
}: MarkdownHtmlPreviewContentProps) {
	const htmlCodeBlocks = useMemo(
		() => extractHtmlFencedCodeBlocksFromMarkdown(sourceContent),
		[sourceContent],
	)
	const htmlCodeBlockStreamingScrollStateRef = useRef<HtmlCodeBlockPreviewStreamingScrollState>({
		hasUserInteracted: false,
	})
	const MarkdownHtmlCodeBlockPreRenderer = useMarkdownHtmlCodeBlockPreRenderer({
		htmlCodeBlocks,
		isStreaming,
		streamingScrollStateRef: htmlCodeBlockStreamingScrollStateRef,
	})

	return (
		<Markdown
			className={className}
			options={{
				overrides: {
					a: {
						component: MarkdownLink,
					},
					cursor: {
						component: Cursor,
					},
					"file-path": {
						component: FilePath,
					},
					img: {
						component: Image,
					},
					pre: {
						component: MarkdownHtmlCodeBlockPreRenderer,
					},
				},
			}}
		>
			{content}
		</Markdown>
	)
}

function MarkdownComponent({ content, className, isStreaming = false }: MarkdownComponentProps) {
	const normalizedContent = useMemo(
		() =>
			normalizeMarkdownWrappedHtmlFencedCodeBlocks(stripStreamingCursorPlaceholder(content)),
		[content],
	)

	const { content: markdownContent, shouldRenderAsPlainText } = useMemo(() => {
		const shouldRenderAsPlainText = false
		const shouldUseNormalizedStreamingContent = isStreaming && normalizedContent.includes("```")
		const renderContent =
			shouldUseNormalizedStreamingContent || !isStreaming ? normalizedContent : content
		const nextMarkdownContent = shouldRenderAsPlainText
			? renderContent
			: preprocessMarkdown(renderContent)

		return {
			content: nextMarkdownContent,
			shouldRenderAsPlainText,
		}
	}, [content, isStreaming, normalizedContent])

	if (shouldRenderAsPlainText) {
		return (
			<pre
				className={cn(
					"m-0 whitespace-pre-wrap break-words p-0 font-mono text-[13px] leading-[1.6]",
					className,
				)}
			>
				{markdownContent}
			</pre>
		)
	}

	return (
		<MarkdownContent
			className={className}
			content={markdownContent}
			sourceContent={normalizedContent}
			isStreaming={isStreaming}
		/>
	)
}

export default memo(MarkdownComponent)
