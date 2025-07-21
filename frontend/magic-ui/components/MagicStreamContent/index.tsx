import { useTyping } from "./useTyping"
import { useUpdateEffect } from "ahooks"
import type { HTMLAttributes, ReactNode } from "react"
import { memo } from "react"

export interface MagicStreamContentProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	content: string
	children?: (content: string) => ReactNode
}

const MagicStreamContent = memo(function MagicStreamContent({
	content,
	children,
	...props
}: MagicStreamContentProps) {
	const { content: typingContent, add } = useTyping(content)

	useUpdateEffect(() => {
		add(content)
	}, [content, add])

	return <div {...props}>{children ? children(typingContent) : typingContent}</div>
})

export default MagicStreamContent
