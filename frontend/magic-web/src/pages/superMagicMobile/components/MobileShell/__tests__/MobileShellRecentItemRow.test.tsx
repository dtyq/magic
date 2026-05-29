import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MobileShellRecentItemRow } from "../MobileShellRecentItemRow"
import type { MobileShellMenuRecentItem } from "../MobileShellMenuContext"

/** Dispatches touch events with coordinates so ahooks useLongPress can read clientX/clientY. */
function touchStart(element: Element) {
	fireEvent.touchStart(element, {
		touches: [{ clientX: 0, clientY: 0 }],
		targetTouches: [{ clientX: 0, clientY: 0 }],
		changedTouches: [{ clientX: 0, clientY: 0 }],
	})
}

function touchEnd(element: Element) {
	fireEvent.touchEnd(element, {
		touches: [],
		targetTouches: [],
		changedTouches: [{ clientX: 0, clientY: 0 }],
	})
}

const baseItem: MobileShellMenuRecentItem = {
	id: "recent-1",
	title: "Recent project",
	project: {
		id: "project-1",
		project_name: "Recent project",
		workspace_id: "ws-1",
	} as MobileShellMenuRecentItem["project"],
	inProgress: false,
	isShared: false,
	isLinked: false,
	isChatProject: false,
}

function renderRow(
	overrides: Partial<MobileShellMenuRecentItem> = {},
	props?: Partial<Parameters<typeof MobileShellRecentItemRow>[0]>,
) {
	const item = { ...baseItem, ...overrides }
	const onRecentNavigate = vi.fn()
	const onOpenActions = vi.fn(
		(
			targetItem: typeof item,
			source: "more" | "longPress",
			anchor?: { clientX: number; clientY: number },
		) => {
			void targetItem
			void source
			void anchor
		},
	)

	render(
		<MobileShellRecentItemRow
			item={item}
			testIdPrefix="mobile-super-shell"
			moreAriaLabel="More"
			onRecentNavigate={onRecentNavigate}
			onOpenActions={onOpenActions}
			{...props}
		/>,
	)

	return { item, onRecentNavigate, onOpenActions }
}

describe("MobileShellRecentItemRow", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("navigates on short tap of the title area", () => {
		const { onRecentNavigate, onOpenActions } = renderRow()

		const titleButton = screen.getByTestId("mobile-super-shell-recent-recent-1")
		touchStart(titleButton)
		touchEnd(titleButton)

		expect(onRecentNavigate).toHaveBeenCalledWith(
			expect.objectContaining({ id: "recent-1" }),
		)
		expect(onOpenActions).not.toHaveBeenCalled()
	})

	it("opens actions menu on long press of the title area", () => {
		const { onRecentNavigate, onOpenActions } = renderRow()

		const titleButton = screen.getByTestId("mobile-super-shell-recent-recent-1")
		touchStart(titleButton)
		vi.advanceTimersByTime(500)
		touchEnd(titleButton)

		expect(onOpenActions).toHaveBeenCalledWith(
			expect.objectContaining({ id: "recent-1" }),
			"longPress",
			expect.objectContaining({ clientX: 0, clientY: 0 }),
		)
		expect(onRecentNavigate).not.toHaveBeenCalled()
	})

	it("does not open actions on long press when project is missing", () => {
		const { onOpenActions } = renderRow({ project: undefined })

		const titleButton = screen.getByTestId("mobile-super-shell-recent-recent-1")
		touchStart(titleButton)
		vi.advanceTimersByTime(500)
		touchEnd(titleButton)

		expect(onOpenActions).not.toHaveBeenCalled()
	})

	it("opens actions when the more button is clicked", () => {
		const { onOpenActions } = renderRow()

		fireEvent.click(screen.getByTestId("mobile-super-shell-recent-actions-recent-1"))

		expect(onOpenActions).toHaveBeenCalledWith(
			expect.objectContaining({ id: "recent-1" }),
			"more",
		)
	})
})
