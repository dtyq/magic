import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MessageStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import MessageList from "../index"
import type { SuperMagicMessageItem } from "../type"

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeOverlays: () => null,
	useScrollEdgeFadeMask: () => ({
		scrollRef: { current: null },
		showTopMask: false,
		showBottomMask: false,
	}),
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/components/shadcn-ui/spinner", () => ({
	Spinner: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/hooks/useVirtualMessageScroll", () => ({
	useVirtualMessageScroll: () => ({
		showBackToLatest: false,
		scrollToBottom: vi.fn(),
		notifyPullMoreStarted: vi.fn(),
		onVirtualizerChange: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/Nodes", () => ({
	Node: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/VirtualMessageList", () => ({
	VirtualMessageList: ({
		items,
		renderNode,
	}: {
		items: Array<{ key: string; renderMode: string }>
		renderNode: (args: { item: any }) => React.ReactNode
	}) => (
		<div data-testid="virtual-message-stream">
			<div data-testid="normal-message-stream">
				{items
					.filter((item) => item.renderMode === "message")
					.map((item) => (
						<div key={item.key}>{renderNode({ item })}</div>
					))}
			</div>
			<div data-testid="revoked-message-stream">
				{items
					.filter((item) => item.renderMode !== "message")
					.map((item) => (
						<div key={item.key}>{renderNode({ item })}</div>
					))}
			</div>
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/RevokedEditableUserMessage", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/BackToLatestButton", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/LoadingMessage", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageListFallback", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/Empty", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/hooks/useExportSelection", () => ({
	MAX_EXPORT_COUNT: 50,
	getSelectableTurnKeys: () => [],
	useExportSelectionStore: () => ({
		exportMode: false,
		selectedKeys: new Set<string>(),
		count: 0,
		previewOpen: false,
		includeToolCall: false,
		enter: vi.fn(),
		exit: vi.fn(),
		toggle: vi.fn(),
		openPreview: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/ExportToolbar", () => ({
	ExportToolbar: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/ExportPreviewModal", () => ({
	ExportPreviewModal: () => null,
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		isTopicStreaming: () => false,
		getActiveStreamSuperMessageIds: () => [],
		getMessageNode: () => ({ status: "finished" }),
	},
}))

vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	optimisticMessageStore: {
		getHiddenRevokedOptimisticMessageIds: () => [],
		getActiveRevokedAnchor: () => undefined,
		clearHiddenRevokedOptimisticMessageIds: vi.fn(),
		clearActiveRevokedAnchor: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { cancelUndoMessage: vi.fn() },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
		publish: vi.fn(),
	},
	PubSubEvents: {
		Hide_Revoked_Messages: "Hide_Revoked_Messages",
		Show_Revoked_Messages: "Show_Revoked_Messages",
		Refresh_Topic_Messages: "Refresh_Topic_Messages",
	},
}))

const selectedTopic = {
	id: "topic-id",
	chat_topic_id: "chat-topic-id",
	topic_name: "Topic",
} as Topic

function createMessage(
	id: string,
	status: string,
	options: {
		role?: "user" | "assistant" | "tool"
		correlationId?: string
		parentCorrelationId?: string
		runtimeStatus?: string
	} = {},
): SuperMagicMessageItem {
	const role = options.role || "user"
	return {
		type: role === "user" ? "rich_text" : "super_magic_message",
		role,
		app_message_id: id,
		message_id: id,
		content: id,
		status,
		correlation_id: options.correlationId || "",
		parent_correlation_id: options.parentCorrelationId || "",
		debug: {
			role,
			status: options.runtimeStatus,
			correlation_id: options.correlationId,
			parent_correlation_id: options.parentCorrelationId,
		},
	} as SuperMagicMessageItem
}

function createTwoTurnAgentMessages({
	bUserStatus = "read",
	bAssistantStatus = "unread",
	bAssistantRuntimeStatus = "finished",
}: {
	bUserStatus?: string
	bAssistantStatus?: string
	bAssistantRuntimeStatus?: string
} = {}): SuperMagicMessageItem[] {
	return [
		createMessage("a-user", "read"),
		createMessage("a-assistant", "unread", {
			role: "assistant",
			correlationId: "a-correlation",
			runtimeStatus: "finished",
		}),
		createMessage("a-tool-1", "read", {
			role: "tool",
			parentCorrelationId: "a-correlation",
		}),
		createMessage("a-tool-2", "read", {
			role: "tool",
			parentCorrelationId: "a-correlation",
		}),
		createMessage("b-user", bUserStatus),
		createMessage("b-assistant", bAssistantStatus, {
			role: "assistant",
			correlationId: "b-correlation",
			runtimeStatus: bAssistantRuntimeStatus,
		}),
		createMessage("b-tool-1", "read", {
			role: "tool",
			parentCorrelationId: "b-correlation",
		}),
		createMessage("b-tool-2", "read", {
			role: "tool",
			parentCorrelationId: "b-correlation",
		}),
	]
}

function renderVisibleMessageIds(data: SuperMagicMessageItem[]): string[] {
	render(
		<MessageList data={data} selectedTopic={selectedTopic}>
			{(node) => <span data-testid="visible-message">{node.app_message_id}</span>}
		</MessageList>,
	)

	return screen.queryAllByTestId("visible-message").map((node) => node.textContent || "")
}

function renderAgentMessageList(data: SuperMagicMessageItem[]) {
	return render(
		<MessageList data={data} selectedTopic={selectedTopic}>
			{(node) => (
				<span
					data-testid={`message-${node.app_message_id}`}
					data-child-message-ids={(node.childMessages || [])
						.map((child: SuperMagicMessageItem) => child.app_message_id)
						.join(",")}
				>
					{node.app_message_id}
				</span>
			)}
		</MessageList>,
	)
}

describe("MessageList revoked visible projection", () => {
	afterEach(() => {
		cleanup()
	})

	it.each([
		{
			label: "历史撤回后已有普通消息",
			input: [
				createMessage("revoked-1", MessageStatus.REVOKED),
				createMessage("normal-2", "finished"),
			],
			expected: ["normal-2"],
		},
		{
			label: "普通消息后存在当前连续撤回段",
			input: [
				createMessage("normal-1", "finished"),
				createMessage("revoked-2", MessageStatus.REVOKED),
				createMessage("revoked-3", MessageStatus.REVOKED),
			],
			expected: ["normal-1", "revoked-2", "revoked-3"],
		},
		{
			label: "历史撤回和当前撤回段同时存在",
			input: [
				createMessage("revoked-1", MessageStatus.REVOKED),
				createMessage("normal-2", "finished"),
				createMessage("revoked-3", MessageStatus.REVOKED),
			],
			expected: ["normal-2", "revoked-3"],
		},
	])("projects $label to the current visible branch", ({ input, expected }) => {
		expect(renderVisibleMessageIds(input)).toEqual(expected)
	})

	it("[REV-09] 两轮 8 条消息撤回 B User 后，完整 B 轮进入撤回容器。", () => {
		renderAgentMessageList(
			createTwoTurnAgentMessages({
				bUserStatus: MessageStatus.REVOKED,
				bAssistantStatus: "unread",
				bAssistantRuntimeStatus: "running",
			}),
		)

		const normalMessageStream = screen.getByTestId("normal-message-stream")
		expect(normalMessageStream).toContainElement(screen.getByTestId("message-a-user"))
		expect(normalMessageStream).not.toContainElement(screen.getByTestId("message-b-user"))
		expect(normalMessageStream).not.toContainElement(screen.getByTestId("message-b-assistant"))
	})

	it("[REV-10] read Tool 必须作为 childMessages 跟随 B Assistant 留在撤回容器。", () => {
		renderAgentMessageList(
			createTwoTurnAgentMessages({
				bUserStatus: MessageStatus.REVOKED,
				bAssistantStatus: "unread",
				bAssistantRuntimeStatus: "running",
			}),
		)

		const assistant = screen.getByTestId("message-b-assistant")
		expect(screen.getByTestId("normal-message-stream")).not.toContainElement(assistant)
		expect(assistant).toHaveAttribute("data-child-message-ids", "b-tool-1,b-tool-2")
	})

	it("[REV-11] 恢复后即使 Assistant 暂时残留 revoked，B 轮也必须完整回到普通消息流。", () => {
		renderAgentMessageList(
			createTwoTurnAgentMessages({
				bUserStatus: "read",
				bAssistantStatus: MessageStatus.REVOKED,
			}),
		)

		const normalMessageStream = screen.getByTestId("normal-message-stream")
		expect(normalMessageStream).toContainElement(screen.getByTestId("message-b-user"))
		const assistant = screen.getByTestId("message-b-assistant")
		expect(normalMessageStream).toContainElement(assistant)
		expect(assistant).toHaveAttribute("data-child-message-ids", "b-tool-1,b-tool-2")
	})
})
