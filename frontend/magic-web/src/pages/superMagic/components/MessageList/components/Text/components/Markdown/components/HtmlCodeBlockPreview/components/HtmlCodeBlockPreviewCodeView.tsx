import { useMemo } from "react"
import type { HTMLAttributes, Ref } from "react"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"

const CHUNK_THRESHOLD = 20
const CHUNK_SIZE = 50
const LINE_HEIGHT_PX = 18
const CHUNK_SPAN_STYLE = {
	display: "block",
	contentVisibility: "auto" as const,
	font: "inherit",
	color: "inherit",
	lineHeight: "inherit",
	whiteSpace: "inherit",
	letterSpacing: "inherit",
	textRendering: "inherit",
}

interface Chunk {
	text: string
	lineCount: number
}

function buildChunks(lines: string[], chunkSize: number): Chunk[] {
	const chunks: Chunk[] = []
	for (let i = 0; i < lines.length; i += chunkSize) {
		const slice = lines.slice(i, i + chunkSize)
		chunks.push({
			text: slice.join("\n") + (i + chunkSize < lines.length ? "\n" : ""),
			lineCount: slice.length,
		})
	}
	return chunks
}

function ChunkedCodeContent({ text }: { text: string }) {
	const chunks = useMemo(() => {
		const lines = text.split("\n")
		if (lines.length < CHUNK_THRESHOLD) return null
		return buildChunks(lines, CHUNK_SIZE)
	}, [text])

	if (!chunks) return text

	return chunks.map((chunk, i) => (
		<span
			key={i}
			style={{
				...CHUNK_SPAN_STYLE,
				containIntrinsicBlockSize: `auto ${chunk.lineCount * LINE_HEIGHT_PX}px`,
			}}
		>
			{chunk.text}
		</span>
	))
}

interface HtmlCodeBlockPreviewCodeViewProps {
	preClassName?: string
	preProps?: HTMLAttributes<HTMLPreElement>
	codeClassName?: string
	codeDisplayContent: string
	scrollAreaRef: Ref<HTMLDivElement>
	isCodeWrapped: boolean
}

export function HtmlCodeBlockPreviewCodeView(props: HtmlCodeBlockPreviewCodeViewProps) {
	const {
		preClassName,
		preProps,
		codeClassName,
		codeDisplayContent,
		scrollAreaRef,
		isCodeWrapped,
	} = props
	const { title, ...restPreProps } = preProps ?? {}

	return (
		<div className="mt-1.5 w-full overflow-hidden rounded-[10px] bg-muted/60">
			<ScrollArea
				ref={scrollAreaRef}
				className="w-full bg-muted/60 [&>[data-slot=scroll-area-viewport]]:h-fit [&>[data-slot=scroll-area-viewport]]:max-h-[480px]"
				data-testid="html-code-block-scroll-area"
			>
				<div
					className={cn(
						"min-w-full [&_pre]:!m-0 [&_pre]:!max-h-none [&_pre]:!overflow-visible [&_pre]:!rounded-none",
						isCodeWrapped ? "w-full" : "w-max [&_pre]:!whitespace-pre",
					)}
				>
					<pre
						className={cn(
							preClassName,
							isCodeWrapped
								? "whitespace-pre-wrap break-words bg-muted/60 px-2.5 py-2 !text-[12px] text-foreground"
								: "whitespace-pre bg-muted/60 px-2.5 py-2 !text-[12px] text-foreground",
						)}
						title={typeof title === "string" ? title : undefined}
						{...restPreProps}
					>
						<code className={codeClassName}>
							<ChunkedCodeContent text={codeDisplayContent} />
						</code>
					</pre>
				</div>
				{!isCodeWrapped && <ScrollBar orientation="horizontal" />}
			</ScrollArea>
		</div>
	)
}
