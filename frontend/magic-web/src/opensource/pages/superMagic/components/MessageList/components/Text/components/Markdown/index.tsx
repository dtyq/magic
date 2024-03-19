import { preprocessMarkdown } from "@/opensource/pages/superMagic/utils/handleMarkDown"
import Markdown from "markdown-to-jsx"
import { useState, useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useStyles } from "./styles"
import { FilePath } from "./parser/FilePath"
import { Image } from "./parser/Image"
import { Cursor } from "./parser/Cursor"

interface MarkdownComponentProps {
	content: string
	className?: string
	maxLength?: number
}

function MarkdownContent({ content, className }: { content: string; className?: string }) {
	return (
		<Markdown
			className={className}
			options={{
				overrides: {
					a: {
						props: {
							target: "_blank",
							rel: "noopener noreferrer",
						},
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
				},
			}}
		>
			{content}
		</Markdown>
	)
}

function MarkdownComponent({ content, className, maxLength = 20000 }: MarkdownComponentProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	const [showModal, setShowModal] = useState(false)

	const {
		content: markdownContent,
		length: contentLength,
		shouldRenderAsPlainText,
	} = useMemo(() => {
		// // 检测是否为 XML 或包含大量标签的内容
		// // 计算标签密度：标签数量 / 总字符数
		// // 注意：排除 cursor 标签，因为它是流式加载时的光标指示器，不应影响内容类型判断
		// const tagMatches = content?.match(/<[^>]+>/g) || []
		// const tagCount = tagMatches.filter((tag) => !tag.match(/<\/?cursor\s*\/?>/i)).length
		// const tagDensity = content?.length > 0 ? tagCount / content.length : 0

		// 如果标签密度 > 0.01 (即每100个字符有1个标签) 或标签数量 > 50，视为 XML/HTML 内容
		// const shouldRenderAsPlainText = tagDensity > 0.01 || tagCount > 50
		const shouldRenderAsPlainText = false

		if (content?.length > maxLength) {
			// 如果是纯文本模式，不进行预处理
			const markdownContent = shouldRenderAsPlainText
				? content.slice(0, maxLength)
				: preprocessMarkdown(content.slice(0, maxLength))
			return {
				content: markdownContent + "...",
				length: content.length || 0,
				shouldRenderAsPlainText,
			}
		}

		const markdownContent = shouldRenderAsPlainText ? content : preprocessMarkdown(content)
		return {
			content: markdownContent,
			length: markdownContent?.length || 0,
			shouldRenderAsPlainText,
		}
	}, [content, maxLength])

	if (contentLength > maxLength) {
		return (
			<div className={className}>
				{shouldRenderAsPlainText ? (
					<pre
						style={{
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							fontFamily: "monospace",
							fontSize: "13px",
							lineHeight: "1.6",
							margin: 0,
							padding: 0,
						}}
					>
						{markdownContent}
					</pre>
				) : (
					<MarkdownContent className={className} content={markdownContent} />
				)}
				<button className={styles.viewMore} onClick={() => setShowModal(true)}>
					{t("chat.markdown.viewFullText")}
				</button>
				<LongContentModal
					open={showModal}
					content={markdownContent}
					onClose={() => setShowModal(false)}
				/>
			</div>
		)
	}

	// Normal content - render as plain text or markdown based on content type
	if (shouldRenderAsPlainText) {
		return (
			<pre
				className={className}
				style={{
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					fontFamily: "monospace",
					fontSize: "13px",
					lineHeight: "1.6",
					margin: 0,
					padding: 0,
				}}
			>
				{markdownContent}
			</pre>
		)
	}

	return <MarkdownContent className={className} content={markdownContent} />
}

// Modal component for displaying long content as plain text
function LongContentModal({
	open,
	content,
	onClose,
}: {
	open: boolean
	content: string
	onClose: () => void
}) {
	const { t } = useTranslation("interface")

	return (
		<MagicModal
			title={t("chat.markdown.viewFullText")}
			open={open}
			onCancel={onClose}
			width="80%"
			footer={null}
			styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
			centered
		>
			<div
				style={{
					marginBottom: "6px",
					fontSize: "12px",
					color: "#666",
					textAlign: "right",
				}}
			>
				{t("chat.markdown.totalLength")}: {content?.length?.toLocaleString() || 0}{" "}
				{t("chat.markdown.characters")}
			</div>
			<div
				style={{
					fontFamily: "monospace",
					fontSize: "13px",
					lineHeight: "1.6",
					whiteSpace: "pre-wrap",
					padding: "12px",
					backgroundColor: "#f5f5f5",
					borderRadius: "4px",
					border: "1px solid #d9d9d9",
				}}
			>
				{content}
			</div>
		</MagicModal>
	)
}

export default memo(MarkdownComponent)
