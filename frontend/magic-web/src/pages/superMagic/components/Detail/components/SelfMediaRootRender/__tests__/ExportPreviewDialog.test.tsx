import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (!options) return key
			const params = Object.entries(options)
				.map(([k, v]) => `${k}=${v}`)
				.join(",")
			return `${key}|${params}`
		},
	}),
}))

vi.mock("../components/CardFrame", () => ({
	__esModule: true,
	default: ({ cardId }: { cardId: string }) => (
		<div data-testid="mock-card-frame" data-card-id={cardId} />
	),
}))

import ExportPreviewDialog from "../components/ExportPreviewDialog"
import type { SelfMediaPost } from "../types"

const posts: SelfMediaPost[] = [
	{
		meta: { id: "post-1", title: "First post" },
		cards: [
			{ path: "01.html", fileId: "file-1-1" },
			{ path: "02.html", fileId: "file-1-2" },
			{ path: "03.html", fileId: "file-1-3" },
		],
	},
	{
		meta: { id: "post-2", title: "Second post" },
		cards: [
			{ path: "01.html", fileId: "file-2-1" },
			{ path: "02.html", fileId: "file-2-2" },
		],
	},
]

function renderDialog(overrides: Partial<React.ComponentProps<typeof ExportPreviewDialog>> = {}) {
	const onOpenChange = vi.fn()
	const onSyncActivePost = vi.fn()
	const onConfirm = vi.fn()
	const defaultProps = {
		open: true,
		onOpenChange,
		posts,
		initialPostIndex: 0,
		onSyncActivePost,
		onConfirm,
	}
	render(<ExportPreviewDialog {...defaultProps} {...overrides} />)
	return { onOpenChange, onSyncActivePost, onConfirm }
}

describe("ExportPreviewDialog", () => {
	it("defaults to the current active post and selects all of its cards", () => {
		renderDialog({ initialPostIndex: 1 })

		const dialog = screen.getByTestId("self-media-export-dialog")
		const grid = within(dialog).getByTestId("self-media-export-card-grid")
		const items = within(grid).getAllByTestId(/^self-media-export-card-item-/)
		expect(items).toHaveLength(posts[1].cards.length)

		const summary = within(dialog).getByTestId("self-media-export-selected-summary")
		expect(summary.textContent).toContain("count=2")
		expect(summary.textContent).toContain("total=2")
	})

	it("supports clearing and re-selecting all cards via the toggle button", () => {
		const { onSyncActivePost } = renderDialog()

		const summary = screen.getByTestId("self-media-export-selected-summary")
		expect(summary.textContent).toContain("count=3")

		fireEvent.click(screen.getByTestId("self-media-export-toggle-all"))
		expect(screen.getByTestId("self-media-export-selected-summary").textContent).toContain(
			"count=0",
		)

		fireEvent.click(screen.getByTestId("self-media-export-toggle-all"))
		expect(screen.getByTestId("self-media-export-selected-summary").textContent).toContain(
			"count=3",
		)

		expect(onSyncActivePost).not.toHaveBeenCalled()
	})

	it("passes the sorted subset and chosen pixel ratio to onConfirm", async () => {
		const { onConfirm } = renderDialog({ initialPostIndex: 0 })

		// Deselect card index 1 to prove only the remaining indexes are passed.
		fireEvent.click(screen.getByTestId("self-media-export-card-item-1"))

		fireEvent.click(screen.getByTestId("self-media-export-confirm"))
		expect(onConfirm).toHaveBeenCalledWith(
			expect.objectContaining({
				postIndex: 0,
				cardIndexes: [0, 2],
				pixelRatio: 2,
			}),
		)
	})

	it("disables confirm when nothing is selected", () => {
		renderDialog()

		fireEvent.click(screen.getByTestId("self-media-export-toggle-all"))
		const confirm = screen.getByTestId("self-media-export-confirm") as HTMLButtonElement
		expect(confirm.disabled).toBe(true)
	})
})
