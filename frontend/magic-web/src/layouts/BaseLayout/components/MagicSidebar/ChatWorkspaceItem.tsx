import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, MessageCircle, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sidebarStore } from "@/stores/layout/SidebarStore"
import { cn } from "@/utils/cn"
import ChatsSubMenu, { type ChatsSubMenuHandle } from "./ChatsSubMenu"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useChatSidebarSelection } from "./hooks/useChatSidebarSelection"

const CHAT_WORKSPACE_KEY = "sidebar-my-chats"

export interface ChatWorkspaceItemHandle {
	refresh: () => Promise<void>
}

/** Mount on first expansion/search/create, then retain list state while collapsed. */
const ChatWorkspaceItem = forwardRef<
	ChatWorkspaceItemHandle,
	{
		active: boolean
		searchKeyword?: string
		onBusyChange?: (busy: boolean) => void
		onSelect?: () => void
	}
>(function ChatWorkspaceItem({ active, searchKeyword = "", onBusyChange, onSelect }, ref) {
	const { t } = useTranslation("sidebar")
	const { isChatRoute, projectId } = useChatSidebarSelection()
	const searching = Boolean(searchKeyword.trim())
	const expanded = searching || sidebarStore.expandedWorkspaces.has(CHAT_WORKSPACE_KEY)
	const [visited, setVisited] = useState(false)
	const [busy, setBusy] = useState(false)
	const [createPending, setCreatePending] = useState(false)
	const listRef = useRef<ChatsSubMenuHandle>(null)
	useEffect(() => {
		// Reveal the selected conversation on entry, but still allow manual collapse afterwards.
		if (projectId) sidebarStore.setWorkspaceExpanded(CHAT_WORKSPACE_KEY, true)
	}, [projectId])
	useImperativeHandle(
		ref,
		() => ({
			// Unvisited lists fetch fresh data when first opened; mounted lists refresh even while collapsed.
			refresh: async () => {
				await listRef.current?.refresh()
			},
		}),
		[],
	)
	useEffect(() => {
		// A create click can mount the list for the first time; wait until its actions are attached.
		if (!createPending || !listRef.current) return
		setCreatePending(false)
		void listRef.current.create()
	}, [createPending])
	useEffect(() => {
		if (active && expanded) setVisited(true)
	}, [active, expanded])
	useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])

	return (
		<div className="mb-1 w-full" data-testid="sidebar-my-chats-workspace">
			<div
				className={cn(
					"group/chat-workspace flex w-full items-center rounded-md focus-within:bg-sidebar-accent hover:bg-sidebar-accent",
					isChatRoute && "bg-sidebar-accent",
				)}
			>
				<button
					type="button"
					className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[13px] font-normal text-sidebar-foreground hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
					aria-expanded={expanded}
					aria-current={isChatRoute ? "page" : undefined}
					data-active={isChatRoute}
					disabled={busy || searching}
					onClick={() => sidebarStore.toggleWorkspaceExpanded(CHAT_WORKSPACE_KEY)}
					data-testid="sidebar-my-chats-toggle"
				>
					<ChevronRight
						size={16}
						className={cn("shrink-0 transition-transform", expanded && "rotate-90")}
					/>
					<MessageCircle size={16} className="shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1 truncate">{t("chats.myChats")}</span>
				</button>
				<MagicTooltip title={t("chats.newChat")} disabled={busy || createPending}>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("chats.newChat")}
						disabled={busy || createPending}
						className="relative h-7 w-0 shrink-0 overflow-hidden bg-transparent p-0 text-sidebar-foreground transition-[width] before:absolute before:inset-0.5 before:rounded-md before:transition-colors hover:bg-transparent hover:before:bg-sidebar-foreground/10 focus-visible:ring-0 focus-visible:before:bg-sidebar-foreground/10 active:before:bg-sidebar-foreground/15 group-focus-within/chat-workspace:w-7 group-hover/chat-workspace:w-7 no-hover:w-7"
						onClick={() => {
							setVisited(true)
							sidebarStore.setWorkspaceExpanded(CHAT_WORKSPACE_KEY, true)
							setCreatePending(true)
						}}
						data-testid="sidebar-my-chats-add"
					>
						<Plus
							size={16}
							className="relative opacity-0 transition-opacity group-focus-within/chat-workspace:opacity-100 group-hover/chat-workspace:opacity-100 no-hover:opacity-100"
						/>
					</Button>
				</MagicTooltip>
			</div>
			{/* A bounded child viewport keeps the next workspace reachable, as in project lists. */}
			<div hidden={!expanded} className="relative pl-6 pt-1">
				{/* Match the project list guide without taking width from conversation rows. */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 left-4 top-0 w-0 border-l border-[#e5e5e5] duration-300 animate-in fade-in dark:border-[#404040]"
				/>
				{(visited || (active && expanded)) && (
					<ChatsSubMenu
						ref={listRef}
						searchKeyword={searchKeyword}
						standalone
						workspace
						active={active && expanded}
						onBusyChange={setBusy}
						onSelect={onSelect}
					/>
				)}
			</div>
		</div>
	)
})

export default observer(ChatWorkspaceItem)
