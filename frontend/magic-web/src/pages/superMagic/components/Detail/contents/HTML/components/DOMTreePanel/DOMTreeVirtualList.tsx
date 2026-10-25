import * as React from "react"
import { cn } from "@/utils/cn"
import type { DomTreeNode } from "../../iframe-bridge/types/messages"
import { DOMTreeVirtualRow } from "./DOMTreeVirtualRow"

interface VirtualItemLike {
	index: number
	key: string | number
	start: number
}

interface Props {
	label: string
	visibleRows: Array<{ nodeId: string; depth: number }>
	nodeMap: Map<string, DomTreeNode>
	virtualItems: VirtualItemLike[]
	totalSize: number
	isScrolling: boolean
	renderNode: (node: DomTreeNode, depth?: number, renderChildren?: boolean) => React.ReactNode
	renderStateToken: object
}

export function DOMTreeVirtualList({
	label,
	visibleRows,
	nodeMap,
	virtualItems,
	totalSize,
	isScrolling,
	renderNode,
	renderStateToken,
}: Props) {
	return (
		<div
			className={cn(
				"w-full min-w-0 max-w-full overflow-hidden px-1.5 py-1.5",
				isScrolling && "pointer-events-none [&_*]:transition-none",
			)}
			role="tree"
			aria-label={label}
			data-testid="dom-tree-virtual-list"
			data-scrolling={isScrolling ? "true" : undefined}
		>
			<div
				style={{
					height: `${totalSize + 12}px`,
					position: "relative",
					width: "100%",
					contain: "layout paint style",
				}}
			>
				{virtualItems.map((virtualItem) => {
					const row = visibleRows[virtualItem.index]
					const node = row ? nodeMap.get(row.nodeId) : undefined
					if (!row || !node) return null

					return (
						<DOMTreeVirtualRow
							key={virtualItem.key}
							start={virtualItem.start}
							node={node}
							depth={row.depth}
							renderNode={renderNode}
							renderStateToken={renderStateToken}
						/>
					)
				})}
			</div>
		</div>
	)
}

DOMTreeVirtualList.displayName = "DOMTreeVirtualList"
