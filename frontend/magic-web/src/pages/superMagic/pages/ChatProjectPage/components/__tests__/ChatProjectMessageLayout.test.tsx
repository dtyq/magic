import { fireEvent, render, screen } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useConversationInputLayout } from "@/pages/superMagic/components/ConversationInputResize/context"
import { DEFAULT_COMPOSER_MIN_INPUT_HEIGHT } from "@/pages/superMagic/components/ConversationInputResize/constants"

const inputHeightMocks = vi.hoisted(() => ({
	useConversationInputHeight: vi.fn(),
	onSplitterResizeStart: vi.fn(),
	onSplitterResize: vi.fn(),
	onSplitterResizeEnd: vi.fn(),
	restoreAutoHeight: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/ConversationInputResize/useConversationInputHeight", () => ({
	useConversationInputHeight: inputHeightMocks.useConversationInputHeight,
}))

vi.mock("@/components/base/MagicSplitter", () => {
	interface MockSplitterProps extends PropsWithChildren {
		onResizeStart?: (sizes: number[]) => void
		onResize?: (sizes: number[]) => void
		onResizeEnd?: (sizes: number[]) => void
	}

	interface MockPanelProps extends PropsWithChildren {
		className?: string
		max?: number | string
		min?: number | string
		resizable?: boolean
		size?: number | string
	}

	/** Provide explicit controls for exercising the Splitter lifecycle without Ant Design internals. */
	function MockSplitter({ children, onResizeStart, onResize, onResizeEnd }: MockSplitterProps) {
		return (
			<div data-testid="chat-project-message-splitter">
				<button type="button" onClick={() => onResizeStart?.([480, 320])}>
					resize-start
				</button>
				<button type="button" onClick={() => onResize?.([460, 340])}>
					resize
				</button>
				<button type="button" onClick={() => onResizeEnd?.([440, 360])}>
					resize-end
				</button>
				{children}
			</div>
		)
	}

	/** Expose panel sizing props as DOM attributes for focused layout assertions. */
	function MockPanel({ children, className, max, min, resizable, size }: MockPanelProps) {
		return (
			<section
				className={className}
				data-testid="splitter-panel"
				data-max={max}
				data-min={min}
				data-resizable={resizable}
				data-size={size}
			>
				{children}
			</section>
		)
	}

	return { default: Object.assign(MockSplitter, { Panel: MockPanel }) }
})

import ChatProjectMessageLayout from "../ChatProjectMessageLayout"

/** Mount the layout-injected handle so tests can assert its ChatProject-specific offset. */
function InputWithResizeHandle() {
	const layout = useConversationInputLayout()
	return (
		<div data-testid="message-input" className="relative">
			{layout?.inputResizeHandle}
			editor
		</div>
	)
}

describe("ChatProjectMessageLayout", () => {
	beforeEach(() => {
		inputHeightMocks.onSplitterResizeStart.mockClear()
		inputHeightMocks.onSplitterResize.mockClear()
		inputHeightMocks.onSplitterResizeEnd.mockClear()
		inputHeightMocks.restoreAutoHeight.mockClear()
		inputHeightMocks.useConversationInputHeight.mockReset()
		inputHeightMocks.useConversationInputHeight.mockReturnValue({
			enabled: true,
			effectiveHeight: 240,
			maxHeight: 400,
			fillHeight: false,
			startPointerResize: vi.fn(),
			resizeByPointerDelta: vi.fn(),
			finishPointerResize: vi.fn(),
			onSplitterResizeStart: inputHeightMocks.onSplitterResizeStart,
			onSplitterResize: inputHeightMocks.onSplitterResize,
			onSplitterResizeEnd: inputHeightMocks.onSplitterResizeEnd,
			restoreAutoHeight: inputHeightMocks.restoreAutoHeight,
		})
	})

	it("renders a controlled input panel and forwards the Splitter lifecycle", () => {
		render(
			<ChatProjectMessageLayout
				messageList={<div data-testid="message-list">messages</div>}
				input={<InputWithResizeHandle />}
				isConversationPanelCollapsed={false}
			/>,
		)

		expect(screen.getByTestId("message-list")).toBeInTheDocument()
		expect(screen.getByTestId("message-input")).toBeInTheDocument()
		expect(screen.getByTestId("message-list").parentElement).toHaveClass(
			"flex",
			"h-full",
			"min-h-0",
			"w-full",
			"flex-col",
		)
		const panels = screen.getAllByTestId("splitter-panel")
		expect(panels).toHaveLength(2)
		expect(panels[1]).toHaveAttribute("data-size", "240")
		expect(panels[1]).toHaveAttribute("data-min", String(DEFAULT_COMPOSER_MIN_INPUT_HEIGHT))
		expect(panels[1]).toHaveAttribute("data-max", "400")
		expect(panels[1]).toHaveAttribute("data-resizable", "true")
		// Keep the grip above shortcut chips without changing the shared handle default.
		expect(screen.getByTestId("conversation-input-resize-handle")).toHaveClass("-top-2.5")
		expect(inputHeightMocks.useConversationInputHeight).toHaveBeenCalledWith(
			expect.objectContaining({
				minHeight: DEFAULT_COMPOSER_MIN_INPUT_HEIGHT,
				maxRatio: 0.5,
				manualMaxRatio: 0.7,
				manualMinAvailableHeight: 240,
			}),
		)
		expect(screen.getByTestId("conversation-input-resize-handle")).toHaveAttribute(
			"aria-valuemin",
			String(DEFAULT_COMPOSER_MIN_INPUT_HEIGHT),
		)

		fireEvent.click(screen.getByRole("button", { name: "resize-start" }))
		fireEvent.click(screen.getByRole("button", { name: "resize" }))
		fireEvent.click(screen.getByRole("button", { name: "resize-end" }))
		expect(inputHeightMocks.onSplitterResizeStart).toHaveBeenCalledWith([480, 320])
		expect(inputHeightMocks.onSplitterResize).toHaveBeenCalledWith([460, 340])
		expect(inputHeightMocks.onSplitterResizeEnd).toHaveBeenCalledWith([440, 360])
	})

	// Verify one caller-provided value reaches the controller, panel boundary, and grab handle.
	it("uses the caller-provided minimum for the full input height chain", () => {
		render(
			<ChatProjectMessageLayout
				messageList={<div>messages</div>}
				input={<InputWithResizeHandle />}
				isConversationPanelCollapsed={false}
				inputMinHeight={260}
				layoutKey="general:employee-a"
			/>,
		)

		const panels = screen.getAllByTestId("splitter-panel")
		expect(panels[1]).toHaveAttribute("data-min", "260")
		expect(screen.getByTestId("conversation-input-resize-handle")).toHaveAttribute(
			"aria-valuemin",
			"260",
		)
		expect(inputHeightMocks.useConversationInputHeight).toHaveBeenCalledWith(
			expect.objectContaining({ layoutKey: "general:employee-a", minHeight: 260 }),
		)
	})

	it("restores automatic sizing only when the Splitter bar is double-clicked", () => {
		render(
			<ChatProjectMessageLayout
				messageList={<div>messages</div>}
				input={<InputWithResizeHandle />}
				isConversationPanelCollapsed={false}
			/>,
		)

		fireEvent.doubleClick(screen.getByTestId("message-input"))
		expect(inputHeightMocks.restoreAutoHeight).not.toHaveBeenCalled()

		fireEvent.doubleClick(screen.getByTestId("conversation-input-resize-handle"))
		expect(inputHeightMocks.restoreAutoHeight).toHaveBeenCalledTimes(1)
	})

	it("disables resizing and the shared controller while the panel is collapsed", () => {
		render(
			<ChatProjectMessageLayout
				messageList={<div>messages</div>}
				input={<div>editor</div>}
				isConversationPanelCollapsed
			/>,
		)

		const panels = screen.getAllByTestId("splitter-panel")
		expect(panels[0]).toHaveAttribute("data-resizable", "false")
		expect(panels[1]).toHaveAttribute("data-resizable", "false")
		expect(inputHeightMocks.useConversationInputHeight).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: false, scope: "topic-page" }),
		)
	})
})
