import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import TopicHistoryDropdown from "../TopicHistoryDropdown"

vi.mock("@/components/base", () => ({
	MagicDropdown: ({
		children,
		open,
		onOpenChange,
	}: {
		children: ReactNode
		open?: boolean
		onOpenChange?: (open: boolean) => void
	}) => (
		<div>
			<button
				type="button"
				data-testid="history-dropdown-open"
				onClick={() => onOpenChange?.(true)}
			>
				{children}
			</button>
			{open ? <div data-testid="history-dropdown-panel" /> : null}
		</div>
	),
}))

vi.mock("../TopicHistoryPanelContent", () => ({
	default: () => <div data-testid="history-panel-content" />,
}))

/** Builds the dropdown props that are required but unused by the open gate. */
function renderDropdown(onTriggerAction?: () => Promise<void> | void) {
	return render(
		<TopicHistoryDropdown
			topics={[]}
			projectId="project-mock"
			editingTopicId={null}
			editingValue=""
			onEditingValueChange={vi.fn()}
			onEditSubmit={vi.fn()}
			onEditCancel={vi.fn()}
			onEditTopic={vi.fn()}
			onAiRenameTopic={vi.fn()}
			onDeleteTopic={vi.fn()}
			onSelectTopic={vi.fn()}
			canDeleteTopic={false}
			onCreateTopic={vi.fn()}
			onPinTopic={vi.fn()}
			onUnpinTopic={vi.fn()}
			onArchiveTopic={vi.fn()}
			onUnarchiveTopic={vi.fn()}
			onTriggerAction={onTriggerAction}
		>
			<span>history</span>
		</TopicHistoryDropdown>,
	)
}

describe("TopicHistoryDropdown", () => {
	it("opens history and then notifies the caller", async () => {
		const onTriggerAction = vi.fn()
		renderDropdown(onTriggerAction)

		fireEvent.click(screen.getByTestId("history-dropdown-open"))

		expect(await screen.findByTestId("history-dropdown-panel")).toBeInTheDocument()
		await vi.waitFor(() => {
			expect(onTriggerAction).toHaveBeenCalledTimes(1)
		})
	})

	it("keeps history open when the caller notification fails", async () => {
		renderDropdown(vi.fn().mockRejectedValue(new Error("notify failed")))

		fireEvent.click(screen.getByTestId("history-dropdown-open"))

		expect(await screen.findByTestId("history-dropdown-panel")).toBeInTheDocument()
	})
})
