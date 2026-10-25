import { fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNotesOverviewScroll } from "../useNotesOverviewScroll"

describe("useNotesOverviewScroll", () => {
	let resize: () => void
	let disconnected: boolean
	let noteTop: number

	beforeEach(() => {
		noteTop = 480
		disconnected = false
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: () => void) {
					disconnected = false
					resize = () => {
						if (!disconnected) callback()
					}
				}
				observe() {
					// Tests explicitly deliver layout changes through resize().
				}
				disconnect() {
					disconnected = true
				}
			},
		)
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
			const viewport = this.closest('[data-testid="viewport"]') as HTMLElement | null
			return {
				top:
					this.dataset.testid === "note"
						? 100 + noteTop - (viewport?.scrollTop ?? 0)
						: 100,
			} as DOMRect
		})
	})
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	function Panel({ enabled = true, index = 1 }: { enabled?: boolean; index?: number }) {
		const { viewportRef, currentNoteRef } = useNotesOverviewScroll(
			enabled,
			String(index),
			index,
		)
		return (
			<div>
				<div ref={viewportRef} data-testid="viewport">
					<div>
						<div ref={currentNoteRef} data-testid="note" />
					</div>
				</div>
			</div>
		)
	}

	it("aligns on entering overview and changing slides, but preserves manual scroll on rerender", () => {
		const { getByTestId, rerender } = render(<Panel enabled={false} />)
		const viewport = getByTestId("viewport")
		expect(viewport.scrollTop).toBe(0)
		rerender(<Panel />)
		expect(viewport.scrollTop).toBe(480)
		viewport.scrollTop = 200
		rerender(<Panel />)
		expect(viewport.scrollTop).toBe(200)
		noteTop = 900
		rerender(<Panel index={2} />)
		expect(viewport.scrollTop).toBe(900)
		rerender(<Panel enabled={false} index={2} />)
		viewport.scrollTop = 0
		rerender(<Panel index={2} />)
		expect(viewport.scrollTop).toBe(900)
	})

	it("corrects late content layout until the user takes over", () => {
		const { getByTestId, unmount } = render(<Panel />)
		const viewport = getByTestId("viewport")
		noteTop = 700
		resize()
		expect(viewport.scrollTop).toBe(700)
		fireEvent.wheel(viewport)
		viewport.scrollTop = 250
		noteTop = 900
		resize()
		expect(viewport.scrollTop).toBe(250)
		unmount()
		expect(disconnected).toBe(true)
	})
})
