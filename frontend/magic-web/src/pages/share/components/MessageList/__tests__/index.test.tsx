import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import type { VirtualMessageItem } from "@/pages/superMagic/components/MessageList/virtual-message-items"
import MessageList from "../index"

vi.mock("@/pages/superMagic/components/MessageList/components/Nodes", () => ({
	Node: ({ node }: { node: { super_message_id?: string } }) => (
		<div data-testid={`share-message-${node.super_message_id}`} />
	),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/VirtualMessageList", () => ({
	VirtualMessageList: ({
		items,
		userIndices,
		renderNode,
		virtualizerRef,
		onVirtualizerChange,
	}: {
		items: VirtualMessageItem[]
		userIndices: number[]
		renderNode: (args: { item: VirtualMessageItem }) => React.ReactNode
		virtualizerRef?: { current: unknown }
		onVirtualizerChange?: (virtualizer: unknown, sync: boolean) => void
	}) => (
		<div
			data-testid="share-virtual-message-list"
			data-item-count={items.length}
			data-user-indices={userIndices.join(",")}
			// Stands in for the virtualizer mounting a render late and then reporting its canvas.
			onClick={() => {
				const virtualizer = { itemCount: items.length }
				if (virtualizerRef) virtualizerRef.current = virtualizer
				onVirtualizerChange?.(virtualizer, false)
			}}
		>
			{items.map((item) => (
				<div key={item.key}>{renderNode({ item })}</div>
			))}
		</div>
	),
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))

vi.mock("../style", () => ({
	useStyles: () => ({ styles: { aiGeneratedTip: "ai-generated-tip" } }),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

describe("share MessageList", () => {
	it("uses the shared flat virtual path for every renderable top-level message", () => {
		const scrollContainerRef = { current: document.createElement("div") }

		render(
			<MessageList
				topicId="share-topic"
				// The shape `messagesTransformer` hands over: the SuperMagic payload already
				// lifted out of the IM envelope, which is where the projection looks for it.
				messageList={[
					{
						app_message_id: "user-1",
						super_message_id: "user-1",
						role: "user",
						content: "shared question",
					},
					{
						app_message_id: "assistant-1",
						super_message_id: "assistant-1",
						role: "assistant",
						content: "shared answer",
						debug: { status: "finished" },
					},
					{
						app_message_id: "tool-1",
						super_message_id: "tool-1",
						role: "tool",
						content: "shared tool result",
						// Only tool rows with renderable attachments enter the flat projection.
						attachments: [{ filename: "result.html" }],
						debug: { status: "finished" },
					},
				]}
				onSelectDetail={vi.fn()}
				currentTopicStatus={TaskStatus.RUNNING}
				scrollContainerRef={scrollContainerRef}
			/>,
		)

		const virtualList = screen.getByTestId("share-virtual-message-list")
		expect(virtualList).toHaveAttribute("data-item-count", "3")
		expect(virtualList).toHaveAttribute("data-user-indices", "0")
		expect(screen.getByTestId("share-message-assistant-1")).toBeInTheDocument()
	})

	it("hands the virtualizer to the shell and tells it when the canvas is addressable", () => {
		// The shell cannot reach the scroll end through `scrollHeight`, which stays an estimate
		// until rows measure, so it addresses the last row through this handle instead. It also
		// commits its scroll element after this subtree, so the handle only becomes usable a
		// render after the shell's own effects have already run and found nothing to scroll.
		const virtualizerRef: { current: unknown } = { current: null }
		const onVirtualizerChange = vi.fn()

		render(
			<MessageList
				topicId="share-topic"
				messageList={[
					{
						app_message_id: "user-1",
						super_message_id: "user-1",
						role: "user",
						content: "q",
					},
				]}
				onSelectDetail={vi.fn()}
				currentTopicStatus={TaskStatus.RUNNING}
				scrollContainerRef={{ current: document.createElement("div") }}
				virtualizerRef={virtualizerRef as never}
				onVirtualizerChange={onVirtualizerChange}
			/>,
		)

		expect(onVirtualizerChange).not.toHaveBeenCalled()

		fireEvent.click(screen.getByTestId("share-virtual-message-list"))

		expect(virtualizerRef.current).toEqual({ itemCount: 1 })
		expect(onVirtualizerChange).toHaveBeenCalledWith({ itemCount: 1 })
	})
})
