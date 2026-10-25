import { fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Applications from "../Applications"

const request = vi.hoisted(() => ({
	data: [{ id: "app-1" }],
	run: vi.fn(),
	loading: false,
	hasMorePage: true,
	nextRequestToken: "next-page",
}))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base/MagicSpin", () => ({ default: () => null }))
vi.mock("../../SearchItem", () => ({ default: { Application: () => <div>Application</div> } }))
vi.mock("../../../store", () => ({ useMagicSearchStore: () => "query" }))
vi.mock("../../request", () => ({ useRequest: () => request }))

describe("search result scrolling", () => {
	beforeEach(() => {
		request.run.mockClear()
		request.loading = false
		request.hasMorePage = true
	})

	it("loads the next page from the actual ScrollArea viewport near the bottom", () => {
		const { container } = render(<Applications maxHeight={240} />)
		const viewport = container.querySelector("[data-radix-scroll-area-viewport]")!
		Object.defineProperties(viewport, {
			scrollHeight: { configurable: true, value: 800 },
			clientHeight: { configurable: true, value: 240 },
			scrollTop: { configurable: true, value: 480 },
		})
		fireEvent.scroll(viewport)
		expect(request.run).toHaveBeenCalledWith({
			type: 5,
			key_word: "query",
			page_token: "next-page",
		})
	})

	it.each(["loading", "exhausted"])("does not request more results while %s", (state) => {
		request.loading = state === "loading"
		request.hasMorePage = state !== "exhausted"
		const { container } = render(<Applications maxHeight={240} />)
		fireEvent.scroll(container.querySelector("[data-radix-scroll-area-viewport]")!)
		expect(request.run).not.toHaveBeenCalled()
	})
})
