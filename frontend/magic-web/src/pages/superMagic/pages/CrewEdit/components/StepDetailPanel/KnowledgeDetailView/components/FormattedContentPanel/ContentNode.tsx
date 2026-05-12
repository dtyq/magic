import { Knowledge } from "@/types/knowledge"
import type { ContentNode } from "../../types/content-node"

interface ContentNodeComponentProps {
	node: ContentNode
	depth: number
}

function ContentNodeComponent({ node, depth }: ContentNodeComponentProps) {
	// 计算缩进像素值 (每层 12px = pl-3)
	const paddingLeft = depth * 12

	// 文本节点 (Figma 14854-1908024) - 仅 title 类型
	if (node.type === Knowledge.DocumentNodeType.TEXT) {
		return (
			<div
				className="py-2 text-sm leading-relaxed text-foreground"
				style={{ paddingLeft: `${paddingLeft}px` }}
			>
				{node.text}
			</div>
		)
	}

	// 一级标题节点
	if (
		node.type === Knowledge.DocumentNodeType.SECTION_TITLE ||
		node.type === Knowledge.DocumentNodeType.TITLE
	) {
		// 根据 level 决定标题大小
		if (node.level === -1) {
			return (
				<div
					id={`node-${node.id}`}
					className="py-3 text-lg font-semibold text-foreground"
					style={{ paddingLeft: `${paddingLeft}px` }}
				>
					{node.text}
				</div>
			)
		}
		if (node.level === 0) {
			return (
				<div
					id={`node-${node.id}`}
					className="py-2.5 text-base font-semibold text-foreground"
					style={{ paddingLeft: `${paddingLeft}px` }}
				>
					{node.text}
				</div>
			)
		}
		// level >= 2
		return (
			<div
				id={`node-${node.id}`}
				className="py-2 text-sm font-semibold text-foreground"
				style={{ paddingLeft: `${paddingLeft}px` }}
			>
				{node.text}
			</div>
		)
	}

	// 代码块 - section-text 和 code 都用代码块模式
	if (
		node.type === Knowledge.DocumentNodeType.CODE ||
		node.type === Knowledge.DocumentNodeType.SECTION_TEXT
	) {
		return (
			<div className="my-2" style={{ paddingLeft: `${paddingLeft}px` }}>
				<pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
					<code>{node.text}</code>
				</pre>
			</div>
		)
	}

	return null
}

export default ContentNodeComponent
