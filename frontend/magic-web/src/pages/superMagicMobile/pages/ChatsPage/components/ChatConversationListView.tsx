import { useState } from "react"
import { Loader2, MessageCirclePlus } from "lucide-react"
import { MobileResourceListSkeletonList } from "@/pages/superMagicMobile/components/skeletons"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import { InfiniteScroll } from "antd-mobile"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
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
	/** 新建对话请求进行中时，右上角按钮展示 loading 并禁用点击 */
	isCreateChatLoading?: boolean
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
	isCreateChatLoading = false,
}: ChatConversationListViewProps) {
	const isCreateChatDisabled = isCreateChatLoading
	/**
	 * 同时只允许一行处于左滑展开状态。
	 * 当用户开始滑动另一行时，当前行自动收起（通过 isOpen 变为 false 实现）。
	 */
	const [openItemId, setOpenItemId] = useState<string | null>(null)
	/** 仅首屏无数据时展示全屏 loading，操作后静默刷新不遮挡已有列表 */
	const showInitialLoading = isLoading && items.length === 0
	const shouldStretchPullToRefresh = !showInitialLoading && (isEmpty || isSearchEmpty)
	/*
	 * 对话页只有空态需要把 PullToRefresh 内容拉满；正常列表保持默认高度，
	 * 避免共享样式长期干预滚动容器，导致下拉刷新不再触发。
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-mobile-background"
			data-testid="mobile-chats-page-root"
		>
			{/* 顶部用绝对居中的标题布局，避免左右操作按钮变化时标题发生肉眼可见的偏移。 */}
			<div className="mobile-page-header">
				<MobileShellSidebarToggleButton testId="mobile-chats-page-menu-button" />

				<p className="mobile-page-header-title">{title}</p>

				<div className="mobile-page-header-btn ml-auto">
					<button
						type="button"
						onClick={onCreateChat}
						disabled={isCreateChatDisabled}
						aria-disabled={isCreateChatDisabled}
						aria-busy={isCreateChatLoading}
						className="flex size-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
						aria-label={newChatAriaLabel}
						data-testid="mobile-chats-page-create-button"
					>
						{isCreateChatLoading ? (
							<Loader2
								className="size-[22px] animate-spin text-foreground"
								data-testid="mobile-chats-page-create-button-loading"
							/>
						) : (
							<MessageCirclePlus className="size-[22px] text-foreground" />
						)}
					</button>
				</div>
			</div>

			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				contentDeps={[items.length, isLoading, isEmpty, isSearchEmpty]}
			>
				<MagicPullToRefresh
					embedInParentScroll
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
						{showInitialLoading ? <MobileResourceListSkeletonList /> : null}

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
			</ScrollEdgeFadeContainer>

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
