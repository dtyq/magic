import { useEffect, useRef, useState } from "react"
import { ChevronRight, CirclePlus, MessageCircle, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import ChatsSubMenu, { type ChatsSubMenuHandle } from "./ChatsSubMenu"
import { useChatSidebarSelection } from "./hooks/useChatSidebarSelection"

interface CollapsedWorkspaceChatItemProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onBusyChange: (busy: boolean) => void
	onSelect: () => void
	keepPopoverOpen?: boolean
}

export default function CollapsedWorkspaceChatItem({
	open,
	onOpenChange,
	onBusyChange,
	onSelect,
	keepPopoverOpen = false,
}: CollapsedWorkspaceChatItemProps) {
	const { t } = useTranslation(["sidebar", "super"])
	const { isChatRoute } = useChatSidebarSelection()
	const [busy, setBusy] = useState(false)
	const [searchInput, setSearchInput] = useState("")
	const [searchKeyword, setSearchKeyword] = useState("")
	const isComposingRef = useRef(false)
	const listRef = useRef<ChatsSubMenuHandle>(null)
	useEffect(() => onBusyChange(busy), [busy, onBusyChange])
	useEffect(() => () => onBusyChange(false), [onBusyChange])
	useEffect(() => {
		if (open) return
		setSearchInput("")
		setSearchKeyword("")
		isComposingRef.current = false
	}, [open])

	function clearSearch() {
		setSearchInput("")
		setSearchKeyword("")
	}

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && (busy || keepPopoverOpen)) return
				onOpenChange(nextOpen)
			}}
			modal={false}
		>
			<PopoverTrigger asChild>
				<Button
					variant={isChatRoute ? "secondary" : "ghost"}
					aria-current={isChatRoute ? "page" : undefined}
					data-active={isChatRoute}
					size="sm"
					className="h-8 w-full justify-start gap-2 px-2 font-normal text-sidebar-foreground hover:bg-sidebar-accent/50 focus-visible:bg-sidebar-accent focus-visible:ring-0 data-[state=open]:bg-sidebar-accent"
					data-testid="sidebar-collapsed-my-chats"
				>
					<MessageCircle size={16} className="shrink-0" />
					<span className="min-w-0 flex-1 truncate text-left text-sm leading-5">
						{t("chats.myChats")}
					</span>
					<ChevronRight size={16} className="shrink-0" />
				</Button>
			</PopoverTrigger>
			{/* Match workspace project popovers; mount the list only when this submenu opens. */}
			<PopoverContent
				side="right"
				align="center"
				sideOffset={8}
				collisionPadding={{ top: 12, right: 12, bottom: 32, left: 12 }}
				className="flex max-h-[min(70vh,640px,var(--radix-popover-content-available-height))] w-[240px] flex-col p-1 shadow-xs supports-[height:100dvh]:max-h-[min(70dvh,640px,var(--radix-popover-content-available-height))] supports-[height:100dvh]:[--sidebar-popup-height:70dvh]"
				data-testid="sidebar-collapsed-my-chats-popover"
				onEscapeKeyDown={(event) => {
					if (isComposingRef.current) {
						event.preventDefault()
						return
					}
					if (searchInput || searchKeyword) {
						event.preventDefault()
						clearSearch()
					}
				}}
			>
				<div className="flex h-8 shrink-0 items-center rounded-md px-2">
					<span className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-sidebar-foreground">
						{t("chats.myChats")}
					</span>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={busy}
					className="h-8 w-full shrink-0 justify-start gap-2 px-2 text-sm font-normal leading-5 text-sidebar-foreground hover:bg-sidebar-accent"
					onClick={() => void listRef.current?.create()}
					data-testid="sidebar-collapsed-my-chats-add"
				>
					<CirclePlus size={16} className="shrink-0" />
					<span className="min-w-0 flex-1 truncate text-left">{t("chats.newChat")}</span>
				</Button>
				<div className="my-1 h-px w-full shrink-0 bg-border" />
				<div className="relative mb-1 w-full shrink-0">
					<Search
						size={16}
						className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						value={searchInput}
						onChange={(event) => {
							setSearchInput(event.target.value)
							if (!isComposingRef.current) setSearchKeyword(event.target.value)
						}}
						// Search only committed IME text; the list hook handles request debouncing.
						onCompositionStart={() => {
							isComposingRef.current = true
						}}
						onCompositionEnd={(event) => {
							isComposingRef.current = false
							setSearchInput(event.currentTarget.value)
							setSearchKeyword(event.currentTarget.value)
						}}
						onKeyDown={(event) => {
							event.stopPropagation()
							if (
								event.key === "Escape" &&
								!isComposingRef.current &&
								(searchInput || searchKeyword)
							) {
								event.preventDefault()
								clearSearch()
							}
						}}
						placeholder={t("super:chatList.searchPlaceholder")}
						aria-label={t("super:chatList.searchPlaceholder")}
						autoComplete="off"
						className="h-8 w-full pl-7 text-sm"
						data-testid="sidebar-collapsed-my-chats-search"
					/>
				</div>
				{/* Reserve space for the title, create action and search so only the list scrolls. */}
				<ChatsSubMenu
					ref={listRef}
					standalone
					workspace
					active={open}
					searchKeyword={searchKeyword}
					viewportMaxHeight="min(calc(var(--sidebar-popup-height, 70vh) - 128px), 512px, calc(var(--radix-popover-content-available-height) - 128px))"
					onBusyChange={setBusy}
					onSelect={onSelect}
				/>
			</PopoverContent>
		</Popover>
	)
}
