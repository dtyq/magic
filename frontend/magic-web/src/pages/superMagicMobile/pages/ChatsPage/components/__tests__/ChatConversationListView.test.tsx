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

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	MobileShellSidebarToggleButton: () => (
		<button type="button" data-testid="mobile-chats-page-menu-button">
			menu
		</button>
	),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "mobile.emptyState.variants.chat.title") return "暂无对话"
			if (key === "mobile.emptyState.variants.chat.description") return "新建对话引导"
			return key
		},
	}),
}))

describe("ChatConversationListView", () => {
	it("shows the clear button when the search input receives focus", () => {
		render(
			<ChatConversationListView
				items={[]}
				isLoading={false}
				searchValue=""
				isEmpty={true}
				isSearchEmpty={false}
				hasMore={false}
				onSearchValueChange={vi.fn()}
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
				newChatAriaLabel="新建对话"
			/>,
		)

		fireEvent.focus(screen.getByPlaceholderText("搜索"))

		expect(screen.getByTestId("mobile-chats-page-search-clear")).toBeInTheDocument()
	})

	it("renders prototype-aligned empty state for the no-chats state", () => {
		render(
			<ChatConversationListView
				items={[]}
				isLoading={false}
				searchValue=""
				isEmpty
				isSearchEmpty={false}
				hasMore={false}
				onSearchValueChange={vi.fn()}
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
				newChatAriaLabel="新建对话"
			/>,
		)

		const emptyState = screen.getByTestId("mobile-chats-page-empty")
		expect(emptyState).toHaveTextContent("暂无对话")
		expect(emptyState).toHaveTextContent("新建对话引导")
	})

	it("renders list row skeletons on first-screen loading", () => {
		render(
			<ChatConversationListView
				items={[]}
				isLoading
				searchValue=""
				isEmpty={false}
				isSearchEmpty={false}
				hasMore={false}
				onSearchValueChange={vi.fn()}
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
				newChatAriaLabel="新建对话"
			/>,
		)

		expect(screen.getByTestId("mobile-resource-list-skeleton-list")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-chats-page-empty")).not.toBeInTheDocument()
	})

	it("shows loading spinner and disables create button while creating chat", () => {
		render(
			<ChatConversationListView
				items={[]}
				isLoading={false}
				searchValue=""
				isEmpty={true}
				isSearchEmpty={false}
				hasMore={false}
				onSearchValueChange={vi.fn()}
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
				newChatAriaLabel="新建对话"
				isCreateChatLoading
			/>,
		)

		const createButton = screen.getByTestId("mobile-chats-page-create-button")
		expect(createButton).toBeDisabled()
		expect(createButton).toHaveAttribute("aria-busy", "true")
		expect(screen.getByTestId("mobile-chats-page-create-button-loading")).toHaveClass(
			"animate-spin",
		)
	})
})
