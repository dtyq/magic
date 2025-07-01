import { memo, type HTMLAttributes } from "react"
import { createStyles } from "antd-style"
import ReasoningContent from "./ReasoningContent"
import streamLoadingIcon from "@/assets/resources/stream-loading-2.png"
import EnhanceMarkdown from "./EnhanceMarkdown"

interface MagicTextProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: string
	reasoningContent?: string
	isSelf?: boolean
	isStreaming?: boolean
	isReasoningStreaming?: boolean
	enableLatex?: boolean
}

const useStyles = createStyles(({ css }) => ({
	container: css`
		user-select: text;
	`,
}))

const Markdown = memo(function Markdown({
	content,
	reasoningContent,
	className,
	isSelf,
	isStreaming,
	isReasoningStreaming,
	enableLatex = true,
}: MagicTextProps) {
	const { styles, cx } = useStyles()

	if (isStreaming || isReasoningStreaming) {
		if (!reasoningContent && !content) {
			return (
				<img
					draggable={false}
					src={streamLoadingIcon}
					width={16}
					height={16}
					alt="loading"
				/>
			)
		}
	}

	return (
		<>
			<ReasoningContent content={reasoningContent} isStreaming={isReasoningStreaming} />
			<EnhanceMarkdown
				content={content as string}
				className={cx(styles.container, className)}
				isSelf={isSelf}
				isStreaming={isStreaming}
				enableLatex={enableLatex}
			/>
		</>
	)
})

export default Markdown
