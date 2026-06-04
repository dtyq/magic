import type { ComponentProps } from "@dtyq/x-markdown"
import React, { useMemo } from "react"

const CHUNK_THRESHOLD = 20
const CHUNK_SIZE = 50
const LINE_HEIGHT_PX = 18

interface Chunk {
	text: string
	lineCount: number
}

function extractTextContent(node: React.ReactNode): string {
	if (typeof node === "string") return node
	if (typeof node === "number") return String(node)
	if (!node) return ""
	if (Array.isArray(node)) return node.map(extractTextContent).join("")
	if (React.isValidElement(node) && node.props.children) {
		return extractTextContent(node.props.children as React.ReactNode)
	}
	return ""
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

function ChunkedCodeBlock({ children, block, className, ...rest }: ComponentProps) {
	const chunks = useMemo(() => {
		if (!block) return null
		const text = extractTextContent(children)
		const lines = text.split("\n")
		if (lines.length < CHUNK_THRESHOLD) return null
		return buildChunks(lines, CHUNK_SIZE)
	}, [block, children])

	if (!chunks) {
		return (
			<code className={className} {...rest}>
				{children}
			</code>
		)
	}

	return (
		<code className={className} {...rest}>
			{chunks.map((chunk, i) => (
				<span
					key={i}
					style={{
						display: "block",
						contentVisibility: "auto",
						containIntrinsicBlockSize: `auto ${chunk.lineCount * LINE_HEIGHT_PX}px`,
					}}
				>
					{chunk.text}
				</span>
			))}
		</code>
	)
}

export default ChunkedCodeBlock
