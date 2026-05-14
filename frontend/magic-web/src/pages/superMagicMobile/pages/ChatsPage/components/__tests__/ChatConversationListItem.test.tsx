import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	ProjectStatus,
	TopicMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import type { ChatConversationListItem as ChatConversationListItemData } from "../../hooks/useChatConversationList"
import { ChatConversationListItem } from "../ChatConversationListItem"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base-mobile/SwipeActionRow", () => ({
	SwipeActionRow: ({
		children,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		"data-testid"?: string
	}) => <div data-testid={dataTestId}>{children}</div>,
}))

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_status: overrides.project_status ?? ProjectStatus.WAITING,
		project_mode: overrides.project_mode ?? TopicMode.Chat,
		workspace_id: overrides.workspace_id ?? "chat-workspace-1",
		work_dir: overrides.work_dir ?? "",
		workspace_name: overrides.workspace_name ?? "Chat",
		project_name: overrides.project_name ?? "Alpha",
		current_topic_id: overrides.current_topic_id ?? "",
		current_topic_status: overrides.current_topic_status ?? "",
		created_at: overrides.created_at ?? "2026-04-27 10:00:00",
		updated_at: overrides.updated_at ?? "2026-04-27 10:05:00",
		last_active_at: overrides.last_active_at ?? "2026-04-27 10:05:00",
		tag: overrides.tag ?? "",
		...overrides,
	}
}

function createItem(
	overrides: Partial<ChatConversationListItemData> = {},
): ChatConversationListItemData {
	return {
		id: overrides.id ?? "chat-1",
		title: overrides.title ?? "Alpha",
		timeLabel: overrides.timeLabel ?? "刚刚",
		isPinned: overrides.isPinned ?? false,
		isRunning: overrides.isRunning ?? false,
		project: overrides.project ?? createProject(),
	}
}

describe("ChatsPage ChatConversationListItem", () => {
	it("shows loading icon when the conversation is running", () => {
		render(
			<ChatConversationListItem
				item={createItem({ id: "running-chat", isRunning: true })}
				isOpen={false}
				onOpen={vi.fn()}
				onClose={vi.fn()}
				onClick={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		const row = screen.getByTestId("mobile-chats-page-item-running-chat")
		expect(within(row).getByTestId("mobile-chats-page-item-loading")).toBeInTheDocument()
		expect(
			within(row).queryByTestId("mobile-chats-page-item-default-icon"),
		).not.toBeInTheDocument()
	})

	it("shows pinned badge beside the title and keeps the default left icon", () => {
		render(
			<ChatConversationListItem
				item={createItem({ id: "pinned-chat", isPinned: true })}
				isOpen={false}
				onOpen={vi.fn()}
				onClose={vi.fn()}
				onClick={vi.fn()}
				onMore={vi.fn()}
				onPin={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		const row = screen.getByTestId("mobile-chats-page-item-pinned-chat")
		expect(within(row).getByTestId("mobile-chats-page-item-pinned-badge")).toBeInTheDocument()
		expect(within(row).getByTestId("mobile-chats-page-item-default-icon")).toBeInTheDocument()
		expect(within(row).queryByTestId("mobile-chats-page-item-loading")).not.toBeInTheDocument()
	})
})
