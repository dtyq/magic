import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatConversationListView } from "../ChatConversationListView"

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="infinite-scroll" />,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../ChatConversationListItem", () => ({
	ChatConversationListItem: () => <div data-testid="mobile-chats-page-item" />,
}))

describe("ChatConversationListView", () => {
	it("shows the clear button when the search input receives focus", () => {
		render(
			<ChatConversationListView
				items={[]}
				isLoading={false}
				searchValue=""
				debouncedSearchValue=""
				isEmpty={true}
				isSearchEmpty={false}
				hasMore={false}
				onSearchValueChange={vi.fn()}
				onOpenSidebar={vi.fn()}
				onCreateChat={vi.fn()}
				onOpenConversation={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
				onRefresh={vi.fn(async () => {})}
				loadMore={vi.fn(async () => {})}
				title="对话"
				searchPlaceholder="搜索"
				clearSearchAriaLabel="取消"
				emptyTitle="暂无对话"
				emptyDescription="去新建一个对话"
				newChatAriaLabel="新建对话"
				menuAriaLabel="菜单"
			/>,
		)

		fireEvent.focus(screen.getByPlaceholderText("搜索"))

		expect(screen.getByTestId("mobile-chats-page-search-clear")).toBeInTheDocument()
	})
})