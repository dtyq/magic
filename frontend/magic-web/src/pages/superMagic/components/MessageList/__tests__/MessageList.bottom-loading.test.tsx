import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MessageStatus, TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import MessageList from "../index"
import type { SuperMagicMessageItem } from "../type"

const storeState = vi.hoisted(() => ({
	activeStreamsByTopic: new Map<string, string[]>(),
	messageNodesById: new Map<string, Record<string, unknown>>(),
	streamStatesByTopicAndId: new Map<string, Record<string, unknown>>(),
	virtualItems: undefined as Array<{ key: string }> | undefined,
	virtualListProps: undefined as
		| {
				userIndices?: number[]
		  }
		| undefined,
	isMobile: true,
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => storeState.isMobile,
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
	Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/components/shadcn-ui/spinner", () => ({
	Spinner: () => <div data-testid="initial-spinner" />,
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
	Node: ({ node }: { node: SuperMagicMessageItem }) => (
		<div data-testid={`message-${node.super_message_id}`}>{node.content}</div>
	),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/VirtualMessageList", () => ({
	VirtualMessageList: ({
		items,
		renderNode,
		footer,
		userIndices,
	}: {
		items: Array<{ key: string }>
		renderNode: (args: { item: any }) => ReactNode
		footer?: ReactNode
		userIndices?: number[]
	}) => {
		storeState.virtualItems = items
		storeState.virtualListProps = {
			userIndices,
		}
		return (
			<div data-testid="virtual-message-stream">
				{items.map((item) => (
					<div key={item.key}>{renderNode({ item })}</div>
				))}
				{footer}
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/components/MessageList/components/RevokedEditableUserMessage", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/BackToLatestButton", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/LoadingMessage", () => ({
	default: ({ showLoading }: { showLoading?: boolean }) =>
		showLoading ? <div data-testid="super-magic-message-list-loading" /> : null,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageListFallback", () => ({
	default: () => <div data-testid="message-list-fallback" />,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/Empty", () => ({
	default: () => <div data-testid="message-list-empty" />,
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
		isTopicStreaming: (topicId: string) =>
			(storeState.activeStreamsByTopic.get(topicId)?.length || 0) > 0,
		getActiveStreamSuperMessageIds: (topicId: string) => [
			...(storeState.activeStreamsByTopic.get(topicId) || []),
		],
		getMessageNode: (superMessageId?: string) =>
			storeState.messageNodesById.has(superMessageId || "")
				? storeState.messageNodesById.get(superMessageId || "")
				: { status: "finished", content: "visible" },
		getStreamState: (topicId: string, superMessageId: string) =>
			storeState.streamStatesByTopicAndId.get(`${topicId}\u0000${superMessageId}`),
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

const topicA = {
	id: "topic-a",
	chat_topic_id: "chat-topic-a",
	topic_name: "Topic A",
} as Topic

const topicB = {
	id: "topic-b",
	chat_topic_id: "chat-topic-b",
	topic_name: "Topic B",
} as Topic

function createMessage({
	appMessageId,
	superMessageId = appMessageId,
	role = "user",
	status = "read",
	correlationId = "",
}: {
	appMessageId: string
	superMessageId?: string
	role?: "user" | "assistant" | "tool"
	status?: string
	correlationId?: string
}): SuperMagicMessageItem {
	return {
		type: role === "user" ? "rich_text" : "super_magic_message",
		role,
		app_message_id: appMessageId,
		super_message_id: superMessageId,
		message_id: appMessageId,
		content: appMessageId,
		status,
		correlation_id: correlationId,
		send_time: 1,
		debug: {
			role,
			status: role === "assistant" ? "running" : "finished",
			correlation_id: correlationId,
		},
	} as SuperMagicMessageItem
}

const userMessage = createMessage({ appMessageId: "user-message" })

afterEach(() => {
	cleanup()
	storeState.activeStreamsByTopic.clear()
	storeState.messageNodesById.clear()
	storeState.streamStatesByTopicAndId.clear()
	storeState.virtualItems = undefined
	storeState.virtualListProps = undefined
	storeState.isMobile = true
})

describe("MessageList bottom loading", () => {
	it.each([false, true])(
		"keeps user turns sticky in a short viewport (mobile=%s)",
		(isMobile) => {
			const originalHeight = window.innerHeight
			storeState.isMobile = isMobile
			Object.defineProperty(window, "innerHeight", {
				configurable: true,
				value: 700,
			})

			try {
				render(
					<MessageList
						data={[
							userMessage,
							createMessage({
								appMessageId: "assistant-sticky",
								role: "assistant",
							}),
						]}
						selectedTopic={topicA}
						classNames={{ content: "pt-[10px]" }}
					/>,
				)

				expect(storeState.virtualListProps?.userIndices).toEqual([0])
			} finally {
				Object.defineProperty(window, "innerHeight", {
					configurable: true,
					value: originalHeight,
				})
			}
		},
	)

	it("routes every converted top-level message through the virtual list", () => {
		render(
			<MessageList
				data={[
					userMessage,
					createMessage({
						appMessageId: "assistant-virtual",
						role: "assistant",
						correlationId: "assistant-virtual-correlation",
					}),
				]}
				selectedTopic={topicA}
			/>,
		)

		expect(screen.getByTestId("virtual-message-stream")).toBeInTheDocument()
		expect(screen.getByTestId("message-user-message")).toBeInTheDocument()
		expect(screen.getByTestId("message-assistant-virtual")).toBeInTheDocument()
	})

	it("reuses virtual item references when only the outer data array is recreated", () => {
		const data = [
			userMessage,
			createMessage({
				appMessageId: "assistant-stable",
				role: "assistant",
			}),
		]
		const { rerender } = render(<MessageList data={data} selectedTopic={topicA} />)
		const firstItems = storeState.virtualItems

		rerender(<MessageList data={[...data]} selectedTopic={topicA} />)

		expect(storeState.virtualItems).toBe(firstItems)
	})

	it("rebuilds the projection when one message element changes", () => {
		const data = [
			userMessage,
			createMessage({ appMessageId: "assistant-changing", role: "assistant" }),
		]
		const { rerender } = render(<MessageList data={data} selectedTopic={topicA} />)
		const firstItems = storeState.virtualItems

		rerender(
			<MessageList
				data={[data[0], { ...data[1], content: "updated" }]}
				selectedTopic={topicA}
			/>,
		)

		expect(storeState.virtualItems).not.toBe(firstItems)
		expect(storeState.virtualItems?.[0]).toBe(firstItems?.[0])
		expect(storeState.virtualItems?.[1]).not.toBe(firstItems?.[1])
	})

	it("does not rebuild virtual items for an equivalent selected Topic object", () => {
		const data = [
			userMessage,
			createMessage({ appMessageId: "assistant-topic-stable", role: "assistant" }),
		]
		const { rerender } = render(<MessageList data={data} selectedTopic={topicA} />)
		const firstItems = storeState.virtualItems

		rerender(<MessageList data={data} selectedTopic={{ ...topicA }} />)

		expect(storeState.virtualItems).toBe(firstItems)
	})

	it("刷新恢复时活跃流不可见则显示 Loading，可见后隐藏，Final 清理后不会重新出现。", () => {
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, ["stream-message-a"])
		const { rerender } = render(
			<MessageList data={[userMessage]} selectedTopic={topicA} showLoading={false} />,
		)

		expect(screen.getByTestId("super-magic-message-list-loading")).toBeInTheDocument()
		expect(screen.queryByText("ui.aiGeneratedTip")).not.toBeInTheDocument()

		const assistantMessage = createMessage({
			appMessageId: "assistant-message-a",
			superMessageId: "stream-message-a",
			role: "assistant",
			correlationId: "correlation-a",
		})
		rerender(
			<MessageList
				data={[userMessage, assistantMessage]}
				selectedTopic={topicA}
				showLoading={false}
			/>,
		)
		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()

		storeState.activeStreamsByTopic.delete(topicA.chat_topic_id)
		rerender(
			<MessageList
				data={[userMessage, assistantMessage]}
				selectedTopic={topicA}
				showLoading={false}
			/>,
		)
		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("活跃流空壳消息行已进入列表但尚无可见正文时继续显示 Loading。", () => {
		const superMessageId = "stream-empty-content"
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, [superMessageId])
		storeState.messageNodesById.set(superMessageId, {
			role: "assistant",
			reasoning_content: "",
			content: "",
			tool_calls: [],
		})
		storeState.streamStatesByTopicAndId.set(`${topicA.chat_topic_id}\u0000${superMessageId}`, {
			stage: "content",
			content: "",
			reasoning_content: "",
			tool_calls: [],
			isFinalMessageReceived: false,
		})
		const assistantMessage = createMessage({
			appMessageId: "assistant-empty-content",
			superMessageId,
			role: "assistant",
			correlationId: "correlation-empty-content",
		})

		const { rerender } = render(
			<MessageList
				data={[userMessage, assistantMessage]}
				selectedTopic={topicA}
				showLoading={false}
			/>,
		)

		expect(screen.getByTestId("super-magic-message-list-loading")).toBeInTheDocument()

		storeState.messageNodesById.set(superMessageId, {
			role: "assistant",
			reasoning_content: "",
			content: "正文已经可见",
			tool_calls: [],
		})
		rerender(
			<MessageList
				data={[userMessage, assistantMessage]}
				selectedTopic={topicA}
				showLoading={false}
			/>,
		)

		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it.each([
		{ label: "reasoning/content 消息行", appMessageId: "assistant-content" },
		{ label: "Tool Call 卡片消息行", appMessageId: "assistant-tool-call" },
	])("$label 已可见时不重复显示底部 Loading。", ({ appMessageId }) => {
		const superMessageId = `super-${appMessageId}`
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, [superMessageId])

		render(
			<MessageList
				data={[
					userMessage,
					createMessage({
						appMessageId,
						superMessageId,
						role: "assistant",
						correlationId: `correlation-${appMessageId}`,
					}),
				]}
				selectedTopic={topicA}
				showLoading
			/>,
		)

		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("Topic A 的活跃流不影响 Topic B。", () => {
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, ["stream-topic-a"])

		render(<MessageList data={[userMessage]} selectedTopic={topicB} showLoading={false} />)

		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("Topic waiting_for_user 时不显示 MessageList 底部 Loading。", () => {
		render(
			<MessageList
				data={[userMessage]}
				selectedTopic={topicA}
				showLoading
				currentTopicStatus={TaskStatus.WAITING_FOR_USER}
			/>,
		)

		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("当前撤回分支已经渲染活跃消息时不会错误重新打开 Loading。", () => {
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, ["revoked-assistant"])
		const revokedUser = createMessage({
			appMessageId: "revoked-user",
			status: MessageStatus.REVOKED,
		})
		const revokedAssistant = createMessage({
			appMessageId: "revoked-assistant-app",
			superMessageId: "revoked-assistant",
			role: "assistant",
			correlationId: "revoked-correlation",
		})

		render(
			<MessageList
				data={[userMessage, revokedUser, revokedAssistant]}
				selectedTopic={topicA}
				showLoading
			/>,
		)

		expect(screen.getByTestId("message-revoked-assistant")).toBeInTheDocument()
		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("空消息列表继续使用原有 Initial Spinner 或 Fallback。", () => {
		storeState.activeStreamsByTopic.set(topicA.chat_topic_id, ["stream-message-a"])
		const { rerender } = render(
			<MessageList data={[]} selectedTopic={topicA} showLoading={false} isMessagesLoading />,
		)
		expect(screen.getByTestId("initial-spinner")).toBeInTheDocument()
		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()

		rerender(
			<MessageList
				data={[]}
				selectedTopic={topicA}
				showLoading={false}
				isMessagesLoading={false}
			/>,
		)
		expect(screen.getByTestId("message-list-fallback")).toBeInTheDocument()
		expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
	})

	it("首次权威同步期间即使已有本地占位卡也不提前投影消息列表", () => {
		render(
			<MessageList
				data={[userMessage]}
				selectedTopic={topicA}
				showLoading={false}
				isMessagesLoading
			/>,
		)

		expect(screen.getByTestId("initial-spinner")).toBeInTheDocument()
		expect(screen.queryByTestId("message-user-1")).not.toBeInTheDocument()
	})

	describe("生成停滞(stalled)时的底部 Loading", () => {
		const STALL_SHOW_DELAY_MS = 800
		const STALL_MIN_VISIBLE_MS = 500

		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		function setupStalledContentStream({
			superMessageId,
			projectedContent,
			receivedContent,
			toolCalls = [],
		}: {
			superMessageId: string
			projectedContent: string
			receivedContent: string
			toolCalls?: Array<Record<string, unknown>>
		}) {
			storeState.activeStreamsByTopic.set(topicA.chat_topic_id, [superMessageId])
			storeState.messageNodesById.set(superMessageId, {
				role: "assistant",
				reasoning_content: "",
				content: projectedContent,
				tool_calls: toolCalls,
			})
			storeState.streamStatesByTopicAndId.set(
				`${topicA.chat_topic_id}\u0000${superMessageId}`,
				{
					stage: toolCalls.length > 0 ? "tool" : "content",
					content: receivedContent,
					reasoning_content: "",
					tool_calls: toolCalls,
					isFinalMessageReceived: false,
				},
			)
			return createMessage({
				appMessageId: `app-${superMessageId}`,
				superMessageId,
				role: "assistant",
				correlationId: `correlation-${superMessageId}`,
			})
		}

		it("content 已全部投影且等待 tool_call chunk 时,停顿超过阈值后重新显示 Loading;推进恢复后按最短展示时长隐藏。", () => {
			const superMessageId = "stream-stalled-content"
			const assistantMessage = setupStalledContentStream({
				superMessageId,
				projectedContent: "正文已经流完",
				receivedContent: "正文已经流完",
			})

			const { rerender } = render(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.RUNNING}
				/>,
			)

			// 停顿未超过阈值前不显示,吸收 chunk 之间的正常间隙。
			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()

			act(() => {
				vi.advanceTimersByTime(STALL_SHOW_DELAY_MS)
			})
			expect(screen.getByTestId("super-magic-message-list-loading")).toBeInTheDocument()

			// 新 chunk 到达:接收缓冲超过投影,恢复推进。
			storeState.streamStatesByTopicAndId.set(
				`${topicA.chat_topic_id}\u0000${superMessageId}`,
				{
					stage: "content",
					content: "正文已经流完,又来了新内容",
					reasoning_content: "",
					tool_calls: [],
					isFinalMessageReceived: false,
				},
			)
			rerender(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.RUNNING}
				/>,
			)

			// 最短展示时长内保持可见,避免闪烁。
			expect(screen.getByTestId("super-magic-message-list-loading")).toBeInTheDocument()
			act(() => {
				vi.advanceTimersByTime(STALL_MIN_VISIBLE_MS)
			})
			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
		})

		it("打字机仍在追赶(投影落后于接收缓冲)时不显示底部 Loading。", () => {
			const assistantMessage = setupStalledContentStream({
				superMessageId: "stream-advancing",
				projectedContent: "正文",
				receivedContent: "正文还有更多内容没播完",
			})

			render(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.RUNNING}
				/>,
			)

			act(() => {
				vi.advanceTimersByTime(STALL_SHOW_DELAY_MS)
			})
			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
		})

		it("接收缓冲已有可渲染 tool_call 时由工具卡片承接状态,不叠加底部 Loading。", () => {
			const assistantMessage = setupStalledContentStream({
				superMessageId: "stream-tool-owner",
				projectedContent: "正文已经流完",
				receivedContent: "正文已经流完",
				toolCalls: [{ id: "tool-1", function: { name: "read_file" } }],
			})

			render(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.RUNNING}
				/>,
			)

			act(() => {
				vi.advanceTimersByTime(STALL_SHOW_DELAY_MS)
			})
			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
		})

		it("Topic RUNNING 且无活跃流(两条消息之间的空档)时,防抖后显示 Loading。", () => {
			const assistantMessage = createMessage({
				appMessageId: "assistant-finished",
				superMessageId: "assistant-finished",
				role: "assistant",
				correlationId: "correlation-finished",
			})
			storeState.messageNodesById.set("assistant-finished", {
				role: "assistant",
				status: "finished",
				content: "上一条消息已完成",
				tool_calls: [],
			})

			render(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.RUNNING}
				/>,
			)

			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()

			act(() => {
				vi.advanceTimersByTime(STALL_SHOW_DELAY_MS)
			})
			expect(screen.getByTestId("super-magic-message-list-loading")).toBeInTheDocument()
		})

		it("Topic 已结束(非 RUNNING、无活跃流)时停顿不会触发 Loading。", () => {
			const assistantMessage = createMessage({
				appMessageId: "assistant-done",
				superMessageId: "assistant-done",
				role: "assistant",
				correlationId: "correlation-done",
			})

			render(
				<MessageList
					data={[userMessage, assistantMessage]}
					selectedTopic={topicA}
					showLoading={false}
					currentTopicStatus={TaskStatus.FINISHED}
				/>,
			)

			act(() => {
				vi.advanceTimersByTime(STALL_SHOW_DELAY_MS)
			})
			expect(screen.queryByTestId("super-magic-message-list-loading")).not.toBeInTheDocument()
		})
	})
})
