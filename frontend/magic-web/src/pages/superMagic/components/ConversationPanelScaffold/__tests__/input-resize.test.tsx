import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useConversationInputLayout } from "@/pages/superMagic/components/ConversationInputResize/context"

const scaffoldMocks = vi.hoisted(() => ({
	isMobile: false,
	useConversationInputHeight: vi.fn(),
	restoreAutoHeight: vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => scaffoldMocks.isMobile,
}))

vi.mock("@/pages/superMagic/components/ConversationInputResize/useConversationInputHeight", () => ({
	useConversationInputHeight: scaffoldMocks.useConversationInputHeight,
}))

vi.mock("@/pages/superMagic/components/MessageList", () => ({
	/** Keep message rendering focused on the surrounding layout contract. */
	default: () => <div data-testid="message-list" />,
	/** Preserve provider children without depending on message context internals. */
	MessageListProvider: ({ children }: { children: ReactNode }) => children,
}))

import ConversationPanelScaffold from ".."

/** Expose shared input context values so the scaffold contract can be asserted. */
function LayoutConsumer() {
	const layout = useConversationInputLayout()
	return <div data-testid="layout-consumer" data-fill-height={layout?.fillHeight} />
}

/** Provide a minimal empty state node for scaffold transitions. */
function EmptyState() {
	return <div />
}

describe("ConversationPanelScaffold input resizing", () => {
	beforeEach(() => {
		scaffoldMocks.isMobile = false
		scaffoldMocks.restoreAutoHeight.mockClear()
		scaffoldMocks.useConversationInputHeight.mockReset()
		scaffoldMocks.useConversationInputHeight.mockImplementation(
			({ enabled }: { enabled: boolean }) => ({
				enabled,
				effectiveHeight: 320,
				maxHeight: 400,
				fillHeight: enabled,
				startPointerResize: vi.fn(),
				resizeByPointerDelta: vi.fn(),
				finishPointerResize: vi.fn(),
				onSplitterResizeStart: vi.fn(),
				onSplitterResize: vi.fn(),
				onSplitterResizeEnd: vi.fn(),
				restoreAutoHeight: scaffoldMocks.restoreAutoHeight,
			}),
		)
	})

	it("enables the handle and fill-height context for a desktop message layout", () => {
		render(
			<ConversationPanelScaffold
				scope="test-conversation"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				messageListProviderValue={{} as never}
				messages={[{ id: "message-1", role: "assistant" }] as never}
				selectedTopic={{ id: "topic-1" } as never}
			/>,
		)

		expect(screen.getByTestId("conversation-input-resize-handle")).toBeInTheDocument()
		expect(screen.getByTestId("conversation-input-resize-handle")).toHaveClass("top-0")
		expect(screen.getByTestId("layout-consumer")).toHaveAttribute("data-fill-height", "true")
		expect(screen.getByTestId("test-conversation-editor-layout")).toHaveStyle({
			height: "320px",
		})
		expect(screen.queryByTestId("test-conversation-composer-shell")).not.toBeInTheDocument()

		fireEvent.doubleClick(screen.getByTestId("conversation-input-resize-handle"))
		expect(scaffoldMocks.restoreAutoHeight).toHaveBeenCalledTimes(1)
	})

	it("keeps the message queue inside the desktop composer shell", () => {
		render(
			<ConversationPanelScaffold
				scope="test-conversation"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				editorNodes={{
					messageQueueNode: <div data-testid="queued-message-node" />,
				}}
				desktopComposerShell
				messageListProviderValue={{} as never}
				messages={[{ id: "message-1", role: "assistant" }] as never}
				selectedTopic={{ id: "topic-1" } as never}
			/>,
		)

		const composerShell = screen.getByTestId("test-conversation-composer-shell")
		expect(composerShell).toHaveClass(
			"gap-1.5",
			"rounded-2xl",
			"border-border",
			"bg-sidebar",
			"p-2",
		)
		expect(composerShell).toContainElement(screen.getByTestId("queued-message-node"))
		expect(composerShell).toContainElement(screen.getByTestId("layout-consumer"))
		expect(
			screen
				.getByTestId("queued-message-node")
				.compareDocumentPosition(screen.getByTestId("conversation-input-resize-handle")) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	/** Verifies that a page-specific handle offset is applied without changing the scaffold contract. */
	it("supports a custom resize handle position", () => {
		render(
			<ConversationPanelScaffold
				scope="custom-position"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				messageListProviderValue={{} as never}
				messages={[{ id: "synthetic-message", role: "assistant" }] as never}
				selectedTopic={{ id: "synthetic-topic" } as never}
				resizeHandlePositionClassName="top-2"
			/>,
		)

		expect(screen.getByTestId("conversation-input-resize-handle")).toHaveClass("top-2")
	})

	it("disables layout transitions while the input height is being dragged", () => {
		render(
			<ConversationPanelScaffold
				scope="test-conversation"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				messageListProviderValue={{} as never}
				messages={[{ id: "message-1", role: "assistant" }] as never}
				selectedTopic={{ id: "topic-1" } as never}
			/>,
		)

		const editorLayout = screen.getByTestId("test-conversation-editor-layout")
		const handle = screen.getByTestId("conversation-input-resize-handle")
		fireEvent.pointerDown(handle, {
			button: 0,
			clientY: 100,
			pointerId: 1,
			isPrimary: true,
		})
		expect(editorLayout).toHaveClass("transition-none")
	})

	it("disables desktop resizing for mobile and centered empty layouts", () => {
		scaffoldMocks.isMobile = true
		const { rerender } = render(
			<ConversationPanelScaffold
				scope="test-conversation"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				messageListProviderValue={{} as never}
				messages={[{ id: "message-1", role: "assistant" }] as never}
				selectedTopic={{ id: "topic-1" } as never}
				desktopComposerShell
			/>,
		)

		expect(screen.queryByTestId("conversation-input-resize-handle")).not.toBeInTheDocument()
		expect(screen.queryByTestId("test-conversation-composer-shell")).not.toBeInTheDocument()

		scaffoldMocks.isMobile = false
		rerender(
			<ConversationPanelScaffold
				scope="test-conversation"
				emptyHero={<EmptyState />}
				emptyCompact={<div />}
				editor={<LayoutConsumer />}
				messageListProviderValue={{} as never}
				messages={[]}
				selectedTopic={{ id: "topic-1" } as never}
				detailPanelVisible={false}
				isMessagesLoading={false}
			/>,
		)

		expect(screen.queryByTestId("conversation-input-resize-handle")).not.toBeInTheDocument()
		expect(scaffoldMocks.useConversationInputHeight).toHaveBeenLastCalledWith(
			expect.objectContaining({
				enabled: false,
				scope: "test-conversation",
				maxRatio: 0.5,
				manualMaxRatio: 0.7,
				manualMinAvailableHeight: 240,
			}),
		)
	})
})
