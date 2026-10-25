import { memo } from "react"
import XMarkdown from "@ant-design/x-markdown"
import { cn } from "@/utils/cn"

const ASK_USER_NUMBERED_TITLE_RE = /^\s*\d+[.\u3001)\uff09]\s*/

interface AskUserQuestionMarkdownTitleProps {
	content: string
	index: number
	total: number
	className?: string
	testId?: string
}

export const AskUserQuestionMarkdownTitle = memo(function AskUserQuestionMarkdownTitle({
	content,
	index,
	total,
	className,
	testId,
}: AskUserQuestionMarkdownTitleProps) {
	const showIndex = total > 1 && !ASK_USER_NUMBERED_TITLE_RE.test(content)

	return (
		<div className={cn("flex min-w-0 items-start gap-1", className)} data-testid={testId}>
			{showIndex ? <span className="shrink-0">{`${index + 1}.`}</span> : null}
			{content ? (
				<XMarkdown
					className="contents [&_p]:m-0"
					content={content}
					openLinksInNewTab
					escapeRawHtml
				/>
			) : (
				<span className="text-muted-foreground">...</span>
			)}
		</div>
	)
})
