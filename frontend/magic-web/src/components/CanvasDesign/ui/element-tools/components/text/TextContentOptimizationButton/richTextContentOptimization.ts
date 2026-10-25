import type {
	RichTextParagraph,
	RichTextNode,
	TextStyle,
} from "../../../../../runtime/document/types"
import { normalizeRichTextParagraphs } from "../../../../../runtime/text/richText"

export function buildRichTextContentFromPlainText(
	text: string,
	sourceContent: RichTextParagraph[] | undefined,
	defaultStyle: TextStyle | undefined,
): RichTextParagraph[] {
	const normalizedSource = normalizeRichTextParagraphs(sourceContent, defaultStyle)
	const fallbackParagraph = normalizedSource[0]
	const fallbackNodeStyle = fallbackParagraph?.children?.[0]?.style
	const lines = text.replace(/\r\n?/g, "\n").split("\n")

	return lines.map((line, index) => {
		const sourceParagraph = normalizedSource[index] ?? fallbackParagraph
		const sourceNodeStyle = sourceParagraph?.children?.[0]?.style ?? fallbackNodeStyle
		const node: RichTextNode = {
			type: "text",
			text: line,
			style: sourceNodeStyle ? { ...sourceNodeStyle } : undefined,
		}

		return {
			children: [node],
			style: sourceParagraph?.style ? { ...sourceParagraph.style } : undefined,
		}
	})
}

export function normalizeOptimizedTextLineBreaks(text: string, sourceText: string): string {
	if (!sourceText.replace(/\r\n?/g, "\n").includes("\n")) {
		return text
	}
	return text.replace(/\\r\\n|\\n|\\r/g, "\n")
}
