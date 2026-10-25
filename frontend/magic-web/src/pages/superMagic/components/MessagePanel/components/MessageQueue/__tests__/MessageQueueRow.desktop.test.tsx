import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import MessageQueue from "../index"
import CollapsibleText from "../components/CollapsibleText"
import type { QueuedMessage } from "../../../hooks/useMessageQueue"

// RichText 会挂载 ProseMirror 视图，这里只验证折叠盒的折叠契约，不渲染真实富文本。
vi.mock("@/pages/superMagic/components/MessageList/components/Text/components/RichText", () => ({
	default: () => <div data-testid="mock-rich-text" />,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

const queueStats = { total: 1, pending: 1, processing: 0, failed: 0 }

function createQueueItem(id: string, text: string): QueuedMessage {
	return {
		id,
		content: {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text }] }],
		},
		mentionItems: [],
		timestamp: 1000,
		status: "pending",
	}
}

const queueActions = {
	onRemoveMessage: vi.fn(),
	onSendMessage: vi.fn(),
	onStartEdit: vi.fn(),
	onWithdraw: vi.fn(),
	onMove: vi.fn(),
}

describe("MessageQueue desktop preview clipping", () => {
	it("folds the preview with the native line clamp instead of a pixel line height", () => {
		render(
			<MessageQueue
				queue={[createQueueItem("queue-item-chip", "常态沟通机制：业务中心每季度沟通节点")]}
				queueStats={queueStats}
				{...queueActions}
			/>,
		)

		const collapsed = screen.getByTestId("collapsible-text")
		// 折叠行数下发给 -webkit-line-clamp，裁剪高度由浏览器按真实行盒计算。
		expect(collapsed.style.getPropertyValue("--collapsible-lines")).toBe("1")
		expect(collapsed.style.maxHeight).toBe("")
		// 队列正文不得再覆盖 <p> 行高：行盒高度由内容决定（AI 选取元素标签会把行盒撑高），
		// 一旦重新写死行高，折叠盒就会再次裁掉标签下边框。
		expect(collapsed.closest('[class*="!leading-"]')).toBeNull()
	})

	it("keeps the requested line count for callers that fold more lines", () => {
		const content: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "任务标题" }] }],
		}

		render(<CollapsibleText content={content} maxLines={2} />)

		const collapsed = screen.getByTestId("collapsible-text")
		expect(collapsed.style.getPropertyValue("--collapsible-lines")).toBe("2")
		expect(collapsed).toHaveAttribute("data-collapsed-lines", "2")
		expect(collapsed.style.maxHeight).toBe("")
	})

	it("flattens inline-node offsets that would push chips past the folding edge", () => {
		const content: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "队列预览" }] }],
		}

		render(<CollapsibleText content={content} maxLines={1} />)

		const css = Array.from(document.querySelectorAll("style"))
			.map((node) => {
				const sheetRules = node.sheet
					? Array.from(node.sheet.cssRules)
							.map((rule) => rule.cssText)
							.join("\n")
					: ""
				return `${node.textContent ?? ""}\n${sheetRules}`
			})
			.join("\n")

		// 折叠边界就是行盒下沿。AI 选取元素标签用 top-1px 做基线微调，会把可视盒推出行盒，
		// 探出的那 1px 正好落在边界外，标签下边框随之消失；折叠态必须把这些位移归零。
		expect(css).toMatch(/\.magic-mention[^{}]*\{[^{}]*top:\s*0\s*!important/)
	})
})
