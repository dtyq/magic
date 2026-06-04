import { fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ScrollEdgeFadeContainer } from "../ScrollEdgeFadeContainer"
import * as scrollMaskModule from "../useScrollEdgeFadeMask"

describe("ScrollEdgeFadeContainer scroll wiring", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not bind hook onScroll callback to the scroll port", () => {
		const onScroll = vi.fn()
		const scrollRef = { current: null as HTMLDivElement | null }

		vi.spyOn(scrollMaskModule, "useScrollEdgeFadeMask").mockReturnValue({
			scrollRef,
			showTopMask: false,
			showBottomMask: true,
			onScroll,
		})

		const { container } = render(
			<ScrollEdgeFadeContainer fadeColor="mobile-background">
				<div>content</div>
			</ScrollEdgeFadeContainer>,
		)
		const scrollPort = container.querySelector(".overflow-y-auto")
		expect(scrollPort).toBeTruthy()

		fireEvent.scroll(scrollPort as HTMLElement)
		expect(onScroll).not.toHaveBeenCalled()
	})
})
