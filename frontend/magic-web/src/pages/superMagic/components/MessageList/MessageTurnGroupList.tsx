import { memo, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { SuperMagicMessageItem } from "./type"
import { getMessageNodeKey } from "./helpers"
import type { MessageTurnGroup } from "./message-turn-groups"

export const USER_MESSAGE_STICKY_OVERLAY_CLASS = cn(
	"sticky z-20 overflow-visible",
	"[--sticky-message-mask-bg:rgb(var(--sidebar-rgb))] [--sticky-message-mask-fade-from:rgb(var(--sidebar-rgb))]",
	"before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[var(--sticky-message-mask-bg)] before:content-['']",
	"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-gradient-to-b after:from-[var(--sticky-message-mask-fade-from)] after:to-transparent after:content-['']",
)

export function getUserMessageStickyTopClass(isMobile: boolean): "top-[10px]" | "top-[40px]" {
	return isMobile ? "top-[10px]" : "top-[40px]"
}

/** User bubble: right-aligned for sticky turns */
export function wrapUserMessageRow(
	node: SuperMagicMessageItem | undefined,
	content: ReactNode,
): ReactNode {
	if (!node || node.role === "assistant") return content
	return (
		<div className="flex w-full min-w-0 justify-end">
			<div className="w-full">{content}</div>
		</div>
	)
}

export interface MessageTurnGroupListProps {
	groups: Array<MessageTurnGroup>
	isMobile: boolean
	stickyMessageClassName?: string
	/** Inner message UI (e.g. Node); wrapped with user right-align + sticky section */
	renderNode: (args: { node: SuperMagicMessageItem; index: number }) => ReactNode
}

function MessageTurnGroupListInner({
	groups,
	isMobile,
	stickyMessageClassName,
	renderNode,
}: MessageTurnGroupListProps) {
	const userMessageStickyTopClass = getUserMessageStickyTopClass(isMobile)

	function row(node: SuperMagicMessageItem, index: number) {
		const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`
		const inner = renderNode({ node, index })
		if (inner == null || inner === false) return null
		return (
			<div
				key={nodeKey}
				data-message-id={nodeKey}
				data-message-role={node?.role || "user"}
				className="relative"
			>
				{wrapUserMessageRow(node, inner)}
			</div>
		)
	}

	return (
		<>
			{groups.map((group) => {
				if (!group.stickyItem) {
					return (
						<div key={group.key} className="relative flex flex-col gap-2">
							{group.items.map(({ node, index }) => row(node, index))}
						</div>
					)
				}

				const { stickyItem, items } = group
				const stickyNodeKey =
					getMessageNodeKey(stickyItem.node) ||
					`${stickyItem.node?.role || "message"}-${stickyItem.index}`

				return (
					<section key={group.key} className="relative flex flex-col gap-2">
						<div
							data-sticky-message-id={stickyNodeKey}
							className={cn(
								USER_MESSAGE_STICKY_OVERLAY_CLASS,
								userMessageStickyTopClass,
								stickyMessageClassName,
							)}
						>
							{row(stickyItem.node, stickyItem.index)}
						</div>
						{items.slice(1).map(({ node, index }) => row(node, index))}
					</section>
				)
			})}
		</>
	)
}

export const MessageTurnGroupList = memo(MessageTurnGroupListInner)
