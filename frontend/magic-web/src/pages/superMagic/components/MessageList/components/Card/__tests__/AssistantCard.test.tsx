import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { withAssistantCard } from "../AssistantCard"

const testState = vi.hoisted(() => {
	const messages = [
		{
			app_message_id: "user-1",
			super_message_id: "user-1",
			role: "user",
			seq_id: "1",
			debug: { stale: true },
		},
		{
			app_message_id: "assistant-1",
			super_message_id: "assistant-1",
			role: "assistant",
			seq_id: "2",
			debug: { stale: true },
		},
		{
			app_message_id: "tool-1",
			super_message_id: "tool-1",
			role: "tool",
			seq_id: "3",
			debug: { stale: true },
		},
		{
			app_message_id: "assistant-2",
			super_message_id: "assistant-2",
			role: "assistant",
			seq_id: "4",
			debug: { stale: true },
		},
		{ app_message_id: "user-2", role: "user", seq_id: "5", debug: { stale: true } },
	]
	const messageNodes = {
		"user-1": { role: "user", content: "question" },
		"assistant-1": { role: "assistant", reasoning_content: "thinking" },
		"tool-1": { role: "tool", tool: { name: "search", status: "finished" } },
		"assistant-2": {
			role: "assistant",
			content: "answer",
			status: "finished",
			usage: { type: "task_points", detail: { consume: 10 } },
		},
		"user-2": { role: "user", content: "next question" },
	}

	return {
		messages,
		messageNodes,
		flushMessagePersistenceForReport: vi.fn().mockResolvedValue(undefined),
		queryConversationRoundLogs: vi.fn().mockResolvedValue([{ storageId: "record-1" }]),
		compressConversationRoundLogs: vi
			.fn()
			.mockReturnValue([{ seq_id: "1", message: { type: "rich_text" } }]),
		getConversationRoundReportWriterId: vi.fn().mockReturnValue("tab-a"),
		report: vi.fn(),
	}
})

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("mobx", async (importOriginal) => ({
	...(await importOriginal<typeof import("mobx")>()),
	toJS: <T,>(value: T) => value,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T,>(fn: T) => fn,
	useRequest: () => ({ loading: false, runAsync: vi.fn() }),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { copyTopicFromMessage: vi.fn() },
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map([["chat-topic-1", testState.messages]]),
		flushMessagePersistenceForReport: testState.flushMessagePersistenceForReport,
		getMessageNode: (messageId?: string) =>
			testState.messageNodes[messageId as keyof typeof testState.messageNodes],
	},
}))

vi.mock("@/pages/superMagic/stores/conversation-round-report", () => ({
	queryConversationRoundLogs: testState.queryConversationRoundLogs,
	compressConversationRoundLogs: testState.compressConversationRoundLogs,
	getConversationRoundReportWriterId: testState.getConversationRoundReportWriterId,
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ report: testState.report, error: vi.fn() }),
	},
}))

vi.mock("@/pages/superMagic/components/MessageList/context", () => ({
	useMessageListContext: () => ({
		allowConversationCopy: false,
		showTaskCompletedBadge: true,
	}),
}))

vi.mock("@/components/settings/FollowUpSuggestionItems/hooks", () => ({
	useGlobalSuggestion: () => ({
		followUpSuggestions: false,
		keepUsedFollowUpSuggestions: false,
		setFollowUpSuggestions: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({ isShareRoute: false, isMagicShareRoute: false }),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModelListByMode: () => [],
		getImageModelListByMode: () => [],
		getVideoModelListByMode: () => [],
	},
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: ({
		children,
		menu,
	}: {
		children?: ReactNode
		menu?: {
			items?: Array<Record<string, unknown> | null>
			onClick?: (info: { key: string }) => void
		}
	}) => (
		<div>
			{children}
			{menu?.items?.map((item) =>
				item ? (
					<button
						key={String(item.key)}
						type="button"
						data-testid={item["data-testid"] as string | undefined}
						onClick={() => menu.onClick?.({ key: String(item.key) })}
					>
						{item.label as ReactNode}
					</button>
				) : null,
			)}
		</div>
	),
	MagicTooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("antd", () => ({
	Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("../components/StatusBadge", () => ({
	StatusBadge: () => <div data-testid="status-badge" />,
}))

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon",
	() => ({ default: () => null }),
)

function Wrapper() {
	return <div data-testid="assistant-message" />
}

const AssistantCard = withAssistantCard(Wrapper as ComponentType<any>)

describe("AssistantCard", () => {
	it("uses the row-provided offset for terminal status badge alignment", () => {
		render(
			<AssistantCard
				node={{
					app_message_id: "assistant-2",
					super_message_id: "assistant-2",
				}}
				selectedTopic={{ id: "topic-1", chat_topic_id: "chat-topic-1" }}
			/>,
		)

		expect(screen.getByTestId("message-list-status-badge")).toHaveClass(
			"ml-[var(--message-status-offset,0px)]",
		)
	})

	it("reports the cleaned persisted conversation round through the global logger", async () => {
		render(
			<AssistantCard
				node={{
					app_message_id: "assistant-2",
					super_message_id: "assistant-2",
					status: "read",
					imStatus: "read",
					superStatus: "finished",
				}}
				selectedTopic={{ id: "topic-1", chat_topic_id: "chat-topic-1" }}
			/>,
		)

		expect(screen.getByTestId("assistant-card-dropdown-trigger")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("assistant-round-log-report-menu-item"))

		await waitFor(() => {
			expect(testState.report).toHaveBeenCalledWith("messages", {
				topic_id: "topic-1",
				chat_topic_id: "chat-topic-1",
				message_id: "assistant-2",
				messages: [{ seq_id: "1", message: { type: "rich_text" } }],
			})
		})
		expect(testState.flushMessagePersistenceForReport).toHaveBeenCalledWith("chat-topic-1")
		expect(testState.queryConversationRoundLogs).toHaveBeenCalledWith("chat-topic-1")
		expect(testState.compressConversationRoundLogs).toHaveBeenCalledWith({
			records: [{ storageId: "record-1" }],
			roundMessages: testState.messages.slice(0, 4),
			preferredWriterId: "tab-a",
		})
	})
})
