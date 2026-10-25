import * as React from "react"
import type { DomTreeNode } from "../../iframe-bridge/types/messages"

export type RenderDomTreeNode = (
	node: DomTreeNode,
	depth?: number,
	renderChildren?: boolean,
) => React.ReactNode

interface Props {
	start: number
	node: DomTreeNode
	depth: number
	renderNode: RenderDomTreeNode
	renderStateToken: object
}

export const DOMTreeVirtualRow = React.memo(
	function DOMTreeVirtualRow({ start, node, depth, renderNode }: Props) {
		return (
			<div
				className="absolute left-1.5 top-1.5 w-[calc(100%_-_0.75rem)]"
				style={{
					transform: `translateY(${start}px)`,
					contain: "layout paint style",
				}}
			>
				{renderNode(node, depth, false)}
			</div>
		)
	},
	(prev, next) =>
		prev.start === next.start &&
		prev.node === next.node &&
		prev.depth === next.depth &&
		prev.renderNode === next.renderNode &&
		prev.renderStateToken === next.renderStateToken,
)

DOMTreeVirtualRow.displayName = "DOMTreeVirtualRow"
