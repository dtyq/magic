import type { HTMLAttributes, Ref } from "react"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"

interface HtmlCodeBlockPreviewCodeViewProps {
	preClassName?: string
	preProps: HTMLAttributes<HTMLPreElement>
	codeClassName?: string
	codeDisplayContent: string
	scrollAreaRef: Ref<HTMLDivElement>
}

export function HtmlCodeBlockPreviewCodeView(props: HtmlCodeBlockPreviewCodeViewProps) {
	const { preClassName, preProps, codeClassName, codeDisplayContent, scrollAreaRef } = props

	return (
		<div className="mt-1.5 w-full overflow-hidden rounded-[10px] bg-muted/60">
			<ScrollArea
				ref={scrollAreaRef}
				className="w-full bg-muted/60 [&>[data-slot=scroll-area-viewport]]:h-fit [&>[data-slot=scroll-area-viewport]]:max-h-[480px]"
				data-testid="html-code-block-scroll-area"
			>
				<div className="w-max min-w-full [&_pre]:!m-0 [&_pre]:!max-h-none [&_pre]:!overflow-visible [&_pre]:!whitespace-pre [&_pre]:!rounded-none">
					<pre
						className={cn(
							preClassName,
							"whitespace-pre bg-muted/60 px-2.5 py-2 text-foreground",
						)}
						{...preProps}
					>
						<code className={codeClassName}>{codeDisplayContent}</code>
					</pre>
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	)
}
