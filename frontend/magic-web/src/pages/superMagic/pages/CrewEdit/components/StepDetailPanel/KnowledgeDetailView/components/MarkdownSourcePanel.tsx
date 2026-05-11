import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface MarkdownSourcePanelProps {
	content: string
}

function MarkdownSourcePanel({ content }: MarkdownSourcePanelProps) {
	return (
		<ScrollArea className="h-full">
			<pre className="p-6 text-sm leading-relaxed text-foreground">
				<code>{content}</code>
			</pre>
		</ScrollArea>
	)
}

export default MarkdownSourcePanel
