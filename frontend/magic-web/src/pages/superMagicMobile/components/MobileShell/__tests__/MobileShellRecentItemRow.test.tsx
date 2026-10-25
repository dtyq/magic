import { fireEvent, render, screen, within } from "@testing-library/react"
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

function touchMove(element: Element, clientX: number, clientY: number) {
	fireEvent.touchMove(element, {
		touches: [{ clientX, clientY }],
		targetTouches: [{ clientX, clientY }],
		changedTouches: [{ clientX, clientY }],
	})
}

function touchEnd(element: Element, clientX = 0, clientY = 0) {
	fireEvent.touchEnd(element, {
		touches: [],
		targetTouches: [],
		changedTouches: [{ clientX, clientY }],
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

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		const titleButton = within(row).getByTestId("mobile-super-shell-recent-title-button")
		touchStart(titleButton)
		touchEnd(titleButton)

		expect(onRecentNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "recent-1" }))
		expect(onOpenActions).not.toHaveBeenCalled()
	})

	it("does not navigate when touch moves beyond threshold before release", () => {
		const { onRecentNavigate, onOpenActions } = renderRow()

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		const titleButton = within(row).getByTestId("mobile-super-shell-recent-title-button")
		touchStart(titleButton)
		touchMove(titleButton, 0, 30)
		touchEnd(titleButton, 0, 30)

		expect(onRecentNavigate).not.toHaveBeenCalled()
		expect(onOpenActions).not.toHaveBeenCalled()
	})

	it("opens actions menu on long press of the title area", () => {
		const { onRecentNavigate, onOpenActions } = renderRow()

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		const titleButton = within(row).getByTestId("mobile-super-shell-recent-title-button")
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

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		const titleButton = within(row).getByTestId("mobile-super-shell-recent-title-button")
		touchStart(titleButton)
		vi.advanceTimersByTime(500)
		touchEnd(titleButton)

		expect(onOpenActions).not.toHaveBeenCalled()
	})

	it("opens actions when the more button is clicked", () => {
		const { onOpenActions } = renderRow()

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		fireEvent.click(within(row).getByTestId("mobile-super-shell-recent-actions-button"))

		expect(onOpenActions).toHaveBeenCalledWith(
			expect.objectContaining({ id: "recent-1" }),
			"more",
		)
	})

	it("keeps recent row test ids stable across page prefixes and business ids", () => {
		renderRow(
			{
				id: "project-from-api-1",
				title: "Recent project",
			},
			{ testIdPrefix: "mobile-workspaces-page" },
		)

		const row = screen.getByTestId("mobile-super-shell-recent-item")
		expect(
			within(row).getByTestId("mobile-super-shell-recent-title-button"),
		).toBeInTheDocument()
		expect(
			within(row).getByTestId("mobile-super-shell-recent-actions-button"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-workspaces-page-recent-project-from-api-1"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-workspaces-page-recent-actions-project-from-api-1"),
		).not.toBeInTheDocument()
	})

	it("shows the same marks as the web recent rows (type, pinned, collaboration)", () => {
		renderRow({
			project: {
				...baseItem.project,
				project_mode: "ai-canvas",
				is_pinned: true,
				tag: "collaboration",
				user_role: "owner",
			} as MobileShellMenuRecentItem["project"],
		})

		// One 14px size for every mark (see RECENT_PROJECT_MARK_CLASS_NAME).
		expect(screen.getByTestId("project-type-tag").style.width).toBe("14px")
		expect(screen.getByTestId("project-item-pinned-tag")).toHaveClass("h-3.5", "w-3.5")
		expect(screen.getByTestId("super-collaboration-project-tag")).toHaveClass("h-3.5", "w-3.5")
	})

	it("shows no marks for an ordinary project", () => {
		renderRow()

		expect(screen.queryByTestId("project-type-tag")).toBeNull()
		expect(screen.queryByTestId("super-collaboration-project-tag")).toBeNull()
	})
})
