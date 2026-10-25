import type { Nodes, PhrasingContent, Root } from "mdast"
import type { Processor, Transformer } from "unified"
import {
	decodeMarkdownFileText,
	parseMarkdownFileLinkSyntaxAt,
	type MarkdownFileLinkSyntax,
} from "./markdownFileLinkSyntax"

/** 只转换原行内文本的文件引用；保留原始 offset，使搜索和文档选取仍指向源码。 */
export function remarkSpacedFileLinks(this: Processor): Transformer<Root> {
	return (tree, file) => {
		const source = String(file)
		if (!source.includes("](")) return
		const lineStarts = [0]
		for (let index = 0; index < source.length; index++)
			if (source[index] === "\n") lineStarts.push(index + 1)
		const point = (offset: number) => {
			let low = 0
			let high = lineStarts.length
			while (low + 1 < high) {
				const middle = (low + high) >>> 1
				if (lineStarts[middle] <= offset) low = middle
				else high = middle
			}
			return { offset, line: low + 1, column: offset - lineStarts[low] + 1 }
		}
		const position = (start: number, end: number) => ({
			start: point(start),
			end: point(end),
		})
		const slice = (
			children: PhrasingContent[],
			start: number,
			end: number,
		): PhrasingContent[] =>
			children.flatMap((child): PhrasingContent[] => {
				const from = child.position?.start.offset
				const to = child.position?.end.offset
				if (from === undefined || to === undefined || to <= start || from >= end) return []
				if (from >= start && to <= end) return [child]
				const clippedStart = Math.max(from, start)
				const clippedEnd = Math.min(to, end)
				if (child.type === "text")
					return [
						{
							type: "text",
							value: decodeMarkdownFileText(source.slice(clippedStart, clippedEnd)),
							position: position(clippedStart, clippedEnd),
						},
					]
				if (child.type === "strong" || child.type === "emphasis" || child.type === "delete")
					return [
						{
							...child,
							children: slice(child.children, start, end),
							position: position(clippedStart, clippedEnd),
						},
					]
				return []
			})
		const rebase = (node: Nodes, offset: number) => {
			if (node.position) {
				const start = node.position.start.offset
				const end = node.position.end.offset
				if (start !== undefined && end !== undefined)
					node.position = position(start + offset, end + offset)
			}
			if ("children" in node) node.children.forEach((child) => rebase(child, offset))
		}
		const visit = (node: Nodes) => {
			if (
				node.type === "link" ||
				node.type === "linkReference" ||
				node.type === "image" ||
				node.type === "imageReference"
			)
				return
			if (!("children" in node)) return
			node.children.forEach(visit)
			if (
				node.type !== "paragraph" &&
				node.type !== "heading" &&
				node.type !== "tableCell" &&
				node.type !== "strong" &&
				node.type !== "emphasis" &&
				node.type !== "delete"
			)
				return
			const children = node.children
			const start = children[0]?.position?.start.offset
			const end = children.at(-1)?.position?.end.offset
			if (start === undefined || end === undefined) return
			const protectedRanges: Array<{ start: number; end: number; type: Nodes["type"] }> = []
			const protect = (child: Nodes) => {
				if (
					child.type === "inlineCode" ||
					child.type === "html" ||
					child.type === "link" ||
					child.type === "image" ||
					child.type === "linkReference" ||
					child.type === "imageReference"
				) {
					const from = child.position?.start.offset
					const to = child.position?.end.offset
					if (from !== undefined && to !== undefined)
						protectedRanges.push({ start: from, end: to, type: child.type })
				} else if ("children" in child) child.children.forEach(protect)
			}
			children.forEach(protect)
			const matches: MarkdownFileLinkSyntax[] = []
			let index = start
			let protectedIndex = 0
			while (index < end) {
				if (source[index] === "\\") {
					index += 2
					continue
				}
				while (protectedRanges[protectedIndex]?.end <= index) protectedIndex++
				const protectedRange = protectedRanges[protectedIndex]
				if (protectedRange && index >= protectedRange.start) {
					index = protectedRange.end
					continue
				}
				if (source[index] !== "[" && source[index] !== "!") {
					index++
					continue
				}
				const match = parseMarkdownFileLinkSyntaxAt(source, index, end)
				if (
					match?.compatible &&
					!protectedRanges.some(
						(range) =>
							range.start < match.endIndex &&
							range.end > match.startIndex &&
							!(
								range.type === "inlineCode" &&
								range.start >= match.labelStart &&
								range.end <= match.labelEnd
							),
					)
				) {
					matches.push(match)
					index = match.endIndex
				} else index++
			}
			if (matches.length === 0) return
			const result: PhrasingContent[] = []
			let cursor = start
			for (const match of matches) {
				// 目标被编码后交给同一个 remark parser，标签内强调仍按原 Markdown 解释。
				const normalized =
					(match.image ? "!" : "") + "[" + match.rawLabel + "](<" + match.href + ">)"
				const parsed = (this.parse(normalized) as Root).children[0]
				const reference = parsed?.type === "paragraph" ? parsed.children[0] : undefined
				if (reference?.type !== "link" && reference?.type !== "image") continue
				result.push(...slice(children, cursor, match.startIndex))
				rebase(reference, match.startIndex)
				reference.position = position(match.startIndex, match.endIndex)
				result.push(reference)
				cursor = match.endIndex
			}
			result.push(...slice(children, cursor, end))
			node.children = result
		}
		visit(tree)
	}
}
