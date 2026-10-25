import { fireEvent, render, screen, within } from "@testing-library/react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { describe, expect, it, vi } from "vitest"

import MessageQueue from "../index"
import type { QueuedMessage } from "../../../hooks/useMessageQueue"

// RichText 会挂载 ProseMirror 视图，这里保留真实的 CollapsibleText（折叠盒契约），
// 只把富文本渲染器换成占位节点。
vi.mock("@/pages/superMagic/components/MessageList/components/Text/components/RichText", () => ({
	default: () => <div data-testid="mock-rich-text" />,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, number>) => {
			const translations: Record<string, string> = {
				"messageQueue.mobile.title": "队列中",
				"messageQueue.mobile.count": `${values?.count ?? 0} 条`,
				"messageQueue.mobile.emptyContent": "⋯",
				"messageQueue.edit": "编辑消息",
				"messageQueue.withdraw": "撤下",
				"messageQueue.delete": "从队列移除",
				"messageQueue.exitEdit": "退出编辑",
				"messageQueue.submitNow": "立即发送",
				"messageQueue.removeFromQueue": "从队列移除",
			}
			return translations[key] ?? key
		},
	}),
}))

/** Build a minimal TipTap document so queue preview tests exercise the real text serializer. */
function createTextContent(text: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	}
}

/** Create a synthetic queue item with fictional identifiers for UI-only assertions. */
function createQueueItem(id: string, text: string): QueuedMessage {
	return {
		id,
		content: createTextContent(text),
		mentionItems: [],
		timestamp: 1000,
		status: "pending",
	}
}

/** Build an AI 选取元素 document in the serialized form the queue stores. */
function createInspectorContent(): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "<magic-selection>" },
					{ type: "text", text: "Type: html" },
					{ type: "text", text: "\\nSelector: #app" },
					{ type: "text", text: "</magic-selection>" },
					{ type: "text", text: "这个标题的样式对不对" },
				],
			},
		],
	}
}

/** Build a mention-only document to verify mobile fallback preview text. */
function createMentionContent(type: string, data: Record<string, unknown>): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{
						type: "mention",
						attrs: { type, data },
					},
				],
			},
		],
	}
}

const queueStats = {
	total: 3,
	pending: 3,
	processing: 0,
	failed: 0,
}

describe("MessageQueue mobile variant", () => {
	it("renders prototype-like shell and keeps three items collapsed by default", () => {
		render(
			<MessageQueue
				variant="mobile"
				queue={[
					createQueueItem("queue-item-alpha", "Mock queued task alpha"),
					createQueueItem("queue-item-beta", "Mock queued task beta"),
					createQueueItem("queue-item-gamma", "Mock queued task gamma"),
				]}
				queueStats={queueStats}
				onRemoveMessage={vi.fn()}
				onSendMessage={vi.fn()}
				onStartEdit={vi.fn()}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-message-queue")
		expect(root.className).toContain("rounded-3xl")
		expect(root.className).toContain("bg-card")
		expect(screen.getByText("队列中")).toBeInTheDocument()
		expect(screen.getByText("· 3 条")).toBeInTheDocument()
		expect(screen.queryByText("Mock queued task alpha")).not.toBeInTheDocument()
	})

	it("expands rows with prototype action order and invokes original handlers", () => {
		const onStartEdit = vi.fn()
		const onSendMessage = vi.fn()
		const onRemoveMessage = vi.fn()

		render(
			<MessageQueue
				variant="mobile"
				queue={[
					createQueueItem("queue-item-alpha", "Mock queued task alpha"),
					createQueueItem("queue-item-beta", "Mock queued task beta"),
					createQueueItem("queue-item-gamma", "Mock queued task gamma"),
				]}
				queueStats={queueStats}
				onRemoveMessage={onRemoveMessage}
				onSendMessage={onSendMessage}
				onStartEdit={onStartEdit}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-message-queue-toggle"))

		const rows = screen.getAllByTestId("mobile-message-queue-item")
		expect(rows).toHaveLength(3)

		const firstRow = rows.find((row) => row.textContent?.includes("Mock queued task alpha"))
		expect(firstRow).toBeTruthy()

		const rowScope = within(firstRow as HTMLElement)
		const actions = [
			rowScope.getByTestId("on-start-edit"),
			rowScope.getByTestId("on-send-message"),
			rowScope.getByTestId("on-remove-message"),
		]
		expect(actions.map((button) => button.getAttribute("aria-label"))).toEqual([
			"编辑消息",
			"立即发送",
			"从队列移除",
		])

		fireEvent.click(actions[0])
		fireEvent.click(actions[1])
		fireEvent.click(actions[2])

		expect(onStartEdit).toHaveBeenCalledWith("queue-item-alpha")
		expect(onSendMessage).toHaveBeenCalledWith("queue-item-alpha")
		expect(onRemoveMessage).toHaveBeenCalledWith("queue-item-alpha")
	})

	it("keeps one or two queued messages expanded by default", () => {
		render(
			<MessageQueue
				variant="mobile"
				queue={[
					createQueueItem("queue-item-alpha", "Mock queued task alpha"),
					createQueueItem("queue-item-beta", "Mock queued task beta"),
				]}
				queueStats={{
					total: 2,
					pending: 2,
					processing: 0,
					failed: 0,
				}}
				onRemoveMessage={vi.fn()}
				onSendMessage={vi.fn()}
				onStartEdit={vi.fn()}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		const rows = screen.getAllByTestId("mobile-message-queue-item")
		expect(rows).toHaveLength(2)
		expect(rows[0]).toHaveTextContent("Mock queued task alpha")
		expect(rows[1]).toHaveTextContent("Mock queued task beta")
	})

	it("renders the queued preview through the shared rich-text fold", () => {
		render(
			<MessageQueue
				variant="mobile"
				queue={[
					{
						...createQueueItem("queue-item-alpha", ""),
						content: createInspectorContent(),
					},
				]}
				queueStats={{
					total: 1,
					pending: 1,
					processing: 0,
					failed: 0,
				}}
				onRemoveMessage={vi.fn()}
				onSendMessage={vi.fn()}
				onStartEdit={vi.fn()}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		// 移动端与桌面共用 CollapsibleText：AI 选取元素、文件提及都需要节点视图，
		// 只有纯文本摘要会把它们渲染成原始标记。
		expect(screen.getByTestId("collapsible-text")).toBeInTheDocument()
		// 纯文本摘要若被直接渲染，正文里会出现 `<magic-selection>` 序列化标记。
		expect(screen.queryByText(/<magic-selection>/)).toBeNull()
		expect(screen.getByText(/这个标题的样式对不对/)).toBeInTheDocument()
	})

	it("disables queue actions while a queue operation is saving", () => {
		const onStartEdit = vi.fn()
		const editingItem = {
			...createQueueItem("queue-item-alpha", "Mock queued task alpha"),
			isEditingLoading: true,
		}

		render(
			<MessageQueue
				variant="mobile"
				queue={[editingItem]}
				queueStats={{
					total: 1,
					pending: 1,
					processing: 0,
					failed: 0,
				}}
				isOperationPending
				onRemoveMessage={vi.fn()}
				onSendMessage={vi.fn()}
				onStartEdit={onStartEdit}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		const editButton = screen.getByTestId("on-start-edit")
		expect(editButton).toBeDisabled()

		fireEvent.click(editButton)
		expect(onStartEdit).not.toHaveBeenCalled()
	})

	it("shows mention fallback preview text when mention data has no display name", () => {
		render(
			<MessageQueue
				variant="mobile"
				queue={[
					{
						...createQueueItem("queue-item-alpha", ""),
						content: createMentionContent("project_file", {}),
					},
				]}
				queueStats={{
					total: 1,
					pending: 1,
					processing: 0,
					failed: 0,
				}}
				onRemoveMessage={vi.fn()}
				onSendMessage={vi.fn()}
				onStartEdit={vi.fn()}
				onWithdraw={vi.fn()}
				onMove={vi.fn()}
			/>,
		)

		// 可见正文已改走富文本节点（提及渲染成节点视图），这里校验的是预览摘要文案：
		// mention 没有展示名时必须退化成 @File，不能变成空串（空串会让整行退化成占位符）。
		const row = screen.getByTestId("mobile-message-queue-item")
		expect(row.querySelector('[aria-hidden="true"] span')?.textContent).toBe("@File")
	})
})
