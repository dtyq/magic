import { useRef, type ReactNode } from "react"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"

interface SelfMediaCardContextMenuTestIds {
	menu?: string
	addCurrent?: string
	addNew?: string
	refresh?: string
	goToEdit?: string
}

interface SelfMediaCardContextMenuProps {
	children: ReactNode
	addToCurrentChatLabel: string
	addToNewChatLabel?: string
	refreshLabel?: string
	goToEditLabel?: string
	onAddToCurrentChat?: () => void
	onAddToNewChat?: () => void
	onRefresh?: () => void
	onGoToEdit?: () => void
	testIds?: SelfMediaCardContextMenuTestIds
}

export function SelfMediaCardContextMenu({
	children,
	addToCurrentChatLabel,
	addToNewChatLabel,
	refreshLabel,
	goToEditLabel,
	onAddToCurrentChat,
	onAddToNewChat,
	onRefresh,
	onGoToEdit,
	testIds,
}: SelfMediaCardContextMenuProps) {
	const hasChatActions = Boolean(onAddToCurrentChat || onAddToNewChat)
	const hasMenu = hasChatActions || Boolean(onRefresh) || Boolean(onGoToEdit)
	const hasHandledActionRef = useRef(false)

	const runActionOnce = (
		actionKey: "add-current" | "add-new" | "refresh" | "go-to-edit",
		handler?: () => void,
	) => {
		void actionKey
		if (!handler || hasHandledActionRef.current) return
		hasHandledActionRef.current = true
		handler()
	}

	if (!hasMenu) {
		return children
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent
				data-testid={testIds?.menu}
				onCloseAutoFocus={() => {
					hasHandledActionRef.current = false
				}}
				onPointerDownCapture={(event) => {
					event.stopPropagation()
				}}
			>
				{onAddToCurrentChat ? (
					<ContextMenuItem
						data-testid={testIds?.addCurrent}
						onSelect={() => {
							runActionOnce("add-current", onAddToCurrentChat)
						}}
						onClick={(event) => {
							event.stopPropagation()
						}}
					>
						{addToCurrentChatLabel}
					</ContextMenuItem>
				) : null}
				{onAddToNewChat ? (
					<ContextMenuItem
						data-testid={testIds?.addNew}
						onSelect={() => {
							runActionOnce("add-new", onAddToNewChat)
						}}
						onClick={(event) => {
							event.stopPropagation()
						}}
					>
						{addToNewChatLabel}
					</ContextMenuItem>
				) : null}
				{hasChatActions && onRefresh ? <ContextMenuSeparator /> : null}
				{onRefresh ? (
					<ContextMenuItem
						data-testid={testIds?.refresh}
						onClick={(event) => {
							event.stopPropagation()
							runActionOnce("refresh", onRefresh)
						}}
					>
						{refreshLabel}
					</ContextMenuItem>
				) : null}
				{(hasChatActions || onRefresh) && onGoToEdit ? <ContextMenuSeparator /> : null}
				{onGoToEdit ? (
					<ContextMenuItem
						data-testid={testIds?.goToEdit}
						onClick={(event) => {
							event.stopPropagation()
							runActionOnce("go-to-edit", onGoToEdit)
						}}
					>
						{goToEditLabel}
					</ContextMenuItem>
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}
