import type rehypeSanitize from "rehype-sanitize"
import type { VirtualMarkdownChunk } from "../../largeMarkdown"
import { SOURCE_START, SOURCE_END } from "../../source-location"

type Root = Parameters<ReturnType<typeof rehypeSanitize>>[0]
type RootContent = Root["children"][number]

/** 安全清理后添加位置标记，合成的围栏不会越过片段真实范围。 */
export function createSourceLocationPlugin(chunk: VirtualMarkdownChunk, enabled: boolean) {
	return () => (tree: Root) => {
		if (!enabled) return
		const prefixLength = chunk.prefix?.length ?? 0
		const visit = (node: Root | RootContent) => {
			if (node.type === "element" && node.position) {
				const start = node.position.start.offset
				const end = node.position.end.offset
				if (start !== undefined && end !== undefined) {
					const sourceStart = Math.max(chunk.start, chunk.start + start - prefixLength)
					const sourceEnd = Math.min(chunk.end, chunk.start + end - prefixLength)
					if (sourceEnd > sourceStart) {
						node.properties[SOURCE_START] = sourceStart
						node.properties[SOURCE_END] = sourceEnd
					}
				}
			}
			if ("children" in node) node.children.forEach(visit)
		}
		visit(tree)
	}
}
