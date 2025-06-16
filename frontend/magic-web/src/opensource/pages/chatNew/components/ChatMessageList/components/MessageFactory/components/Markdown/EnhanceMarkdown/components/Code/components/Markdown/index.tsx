import { lazy, memo, Suspense } from "react"
import { CodeRenderProps } from "../../types"

const EnhanceMarkdown = lazy(
	() =>
		import(
			"@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown"
		),
)

interface MarkdownProps extends CodeRenderProps {}

const Markdown = memo(function Markdown(props: MarkdownProps) {
	const { data, ...rest } = props

	return (
		<Suspense fallback={null}>
			<EnhanceMarkdown content={data} {...rest} />
		</Suspense>
	)
})

export default Markdown
