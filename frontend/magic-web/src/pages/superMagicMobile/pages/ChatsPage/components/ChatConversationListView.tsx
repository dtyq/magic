import { useCallback, useEffect, useId, useState } from "react"
import { Loader2, MessageCirclePlus } from "lucide-react"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import { InfiniteScroll } from "antd-mobile"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { cn } from "@/lib/utils"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { ChatConversationListItem } from "./ChatConversationListItem"
import type { ChatConversationListItem as ChatConversationListItemData } from "../hooks/useChatConversationList"

interface ChatConversationListViewProps {
	items: ChatConversationListItemData[]
	isLoading: boolean
	searchValue: string
	isEmpty: boolean
	isSearchEmpty: boolean
	/** 是否还有更多分页数据，传给 InfiniteScroll */
	hasMore: boolean
	onSearchValueChange: (value: string) => void
	onCreateChat: () => void
	onOpenConversation: (item: ChatConversationListItemData) => void
	onMore: (item: ChatConversationListItemData) => void
	/** Omitted when mobile chat pin is disabled (backend not ready). */
	onPin?: (item: ChatConversationListItemData) => void
	onDelete: (item: ChatConversationListItemData) => void
	/** 下拉刷新回调，重置到第 1 页重新加载 */
	onRefresh: () => Promise<void>
	/** 加载下一页数据并追加到列表 */
	loadMore: () => Promise<void>
	title: string
	searchPlaceholder: string
	clearSearchAriaLabel: string
	newChatAriaLabel: string
}

/**
 * 该视图仅承载原型级列表视觉和基础交互壳，真实跳转与更多操作留给后续工作包接线。
 */
export function ChatConversationListView({
	items,
	isLoading,
	searchValue,
	isEmpty,
	isSearchEmpty,
	hasMore,
	onSearchValueChange,
	onCreateChat,
	onOpenConversation,
	onMore,
	onPin,
	onDelete,
	onRefresh,
	loadMore,
	title,
	searchPlaceholder,
	clearSearchAriaLabel,
	newChatAriaLabel,
}: ChatConversationListViewProps) {
	/**
	 * 同时只允许一行处于左滑展开状态。
	 * 当用户开始滑动另一行时，当前行自动收起（通过 isOpen 变为 false 实现）。
	 */
	const [openItemId, setOpenItemId] = useState<string | null>(null)
	const scrollContainerId = useId()
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)
	/** 仅首屏无数据时展示全屏 loading，操作后静默刷新不遮挡已有列表 */
	const showInitialLoading = isLoading && items.length === 0
	const shouldStretchPullToRefresh = !showInitialLoading && (isEmpty || isSearchEmpty)
	/*
	 * 对话页只有空态需要把 PullToRefresh 内容拉满；正常列表保持默认高度，
	 * 避免共享样式长期干预滚动容器，导致下拉刷新不再触发。
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	/**
	 * 顶底遮罩直接跟随真实滚动容器，保留原型里列表“还能继续滚”的视觉提示。
	 */
	const updateMasks = useCallback(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return

		setShowTopMask(scrollElement.scrollTop > 4)
		setShowBottomMask(
			scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 4,
		)
	}, [scrollContainerId])

	useEffect(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return

		updateMasks()
		scrollElement.addEventListener("scroll", updateMasks, { passive: true })

		return () => {
			scrollElement.removeEventListener("scroll", updateMasks)
		}
	}, [items.length, isLoading, isEmpty, isSearchEmpty, scrollContainerId, updateMasks])

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-mobile-background"
			data-testid="mobile-chats-page-root"
		>
			{/* 顶部用绝对居中的标题布局，避免左右操作按钮变化时标题发生肉眼可见的偏移。 */}
			<div className="mobile-page-header">
				<MobileShellSidebarToggleButton testId="mobile-chats-page-menu-button" />

				<p className="mobile-page-header-title">{title}</p>

				<button
					type="button"
					onClick={onCreateChat}
					className="mobile-page-header-btn ml-auto transition-transform active:scale-95"
					aria-label={newChatAriaLabel}
					data-testid="mobile-chats-page-create-button"
				>
					<MessageCirclePlus className="size-[22px] text-foreground" />
				</button>
			</div>

			{/*
			 * 真实滚动容器挂 id 供顶底遮罩监听 scroll 事件。
			 * MagicPullToRefresh 放在内部，antd-mobile PullToRefresh 会在滚到顶时拦截下拉手势。
			 */}
			<div id={scrollContainerId} className="relative min-h-0 flex-1 overflow-y-auto">
				<MagicPullToRefresh
					onRefresh={onRefresh}
					containerClassName={cn(
						"relative min-h-0 flex-1",
						shouldStretchPullToRefresh &&
							cn("!overflow-hidden", pullToRefreshStretchClassName),
					)}
					showSuccessMessage={false}
				>
					<div
						data-testid="mobile-chats-page-scroll"
						className="flex min-h-full flex-col gap-1 px-3 pb-4 pt-2"
					>
						{showInitialLoading ? (
							<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
								<Loader2 className="size-8 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{!showInitialLoading && isEmpty ? (
							<DataEmptyState
								variant="chat"
								className="min-h-0 flex-1 py-12"
								testId="mobile-chats-page-empty"
							/>
						) : null}

						{!showInitialLoading && isSearchEmpty ? (
							<DataEmptyState
								variant="search"
								className="min-h-0 flex-1 py-12"
								testId="mobile-chats-page-search-empty"
							/>
						) : null}

						{!showInitialLoading && !isEmpty && !isSearchEmpty
							? items.map((item) => (
									<ChatConversationListItem
										key={item.id}
										item={item}
										isOpen={openItemId === item.id}
										onOpen={() => setOpenItemId(item.id)}
										onClose={() => setOpenItemId(null)}
										onClick={onOpenConversation}
										onMore={onMore}
										{...(onPin ? { onPin } : {})}
										onDelete={onDelete}
									/>
								))
							: null}

						{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
						{!showInitialLoading && !isEmpty && !isSearchEmpty ? (
							<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
						) : null}
					</div>
				</MagicPullToRefresh>

				<div
					className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to bottom, var(--mobile-background) 0%, transparent 100%)",
						opacity: showTopMask ? 1 : 0,
					}}
				/>
				<div
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to top, var(--mobile-background) 0%, transparent 100%)",
						opacity: showBottomMask ? 1 : 0,
					}}
				/>
			</div>

			{/* 搜索条走后端 keyword 模糊查询，这里只负责输入与展示。 */}
			<MobileBottomSearchBar
				value={searchValue}
				placeholder={searchPlaceholder}
				clearAriaLabel={clearSearchAriaLabel}
				onValueChange={onSearchValueChange}
				// 与其他移动端底部搜索条统一：聚焦后立即展示清除入口，减少页面间的行为切换成本。
				clearButtonVisibility="focus-or-value"
				testIdPrefix="mobile-chats-page-search"
			/>
		</div>
	)
}
