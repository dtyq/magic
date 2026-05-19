import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetTemporaryDownloadUrl, mockProcessHtmlContent } = vi.hoisted(() => ({
	mockGetTemporaryDownloadUrl: vi.fn(),
	mockProcessHtmlContent: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: mockGetTemporaryDownloadUrl,
}))

vi.mock("../../../contents/HTML/htmlProcessor", () => ({
	processHtmlContent: mockProcessHtmlContent,
}))

vi.mock("../../../contents/HTML/utils/fetchInterceptor", () => ({
	injectFetchInterceptorScript: vi.fn((content: string) => content),
	createParentMessageHandler: vi.fn(),
	createKeyboardMessageHandler: vi.fn(),
}))

vi.mock("../../../contents/HTML/utils/nested-iframe-content", () => ({
	createNestedIframeContentHandler: vi.fn(),
}))

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", () => {
	return {
		__esModule: true,
		default: () => <div data-testid="isolated-html-renderer">mock renderer</div>,
	}
})

import CardFrame from "../components/CardFrame"

class MockResizeObserver {
	observe() {}
	disconnect() {}
}

describe("CardFrame", () => {
	beforeEach(() => {
		mockGetTemporaryDownloadUrl.mockReset()
		mockProcessHtmlContent.mockReset()
		vi.restoreAllMocks()
		vi.stubGlobal("ResizeObserver", MockResizeObserver)
	})

	it("renders preprocessed html directly through iframe srcDoc", async () => {
		mockGetTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.com/card.html" }])
		mockProcessHtmlContent.mockResolvedValue({
			processedContent: "<html><head></head><body>processed card</body></html>",
			filePathMapping: new Map(),
			hasSlides: false,
			slidesMap: new Map(),
			originalSlidesPaths: [],
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			text: async () => "<html><body>raw card</body></html>",
		} as Response)

		const onLoaded = vi.fn()
		const attachmentList = [
			{
				file_id: "file-1",
				file_name: "01.html",
				relative_file_path: "posts/post-one/cards/01.html",
			},
		]

		render(
			<CardFrame
				cardId="card-1"
				fileId="file-1"
				attachmentList={attachmentList}
				onLoaded={onLoaded}
			/>,
		)

		const iframe = await screen.findByTitle("card-1")
		expect(iframe.tagName).toBe("IFRAME")
		expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin")
		expect(iframe.getAttribute("srcdoc")).toContain("processed card")
		expect(screen.queryByTestId("isolated-html-renderer")).not.toBeInTheDocument()

		fireEvent.load(iframe)
		expect(onLoaded).toHaveBeenCalled()

		await waitFor(() => {
			expect(mockProcessHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({
					content: "<html><body>raw card</body></html>",
					fileId: "file-1",
					attachmentList,
					attachments: attachmentList,
				}),
			)
		})
	})

	it("scales iframe by body width after load", async () => {
		mockGetTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.com/card.html" }])
		mockProcessHtmlContent.mockResolvedValue({
			processedContent: "<html><head></head><body>scaled card</body></html>",
			filePathMapping: new Map(),
			hasSlides: false,
			slidesMap: new Map(),
			originalSlidesPaths: [],
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			text: async () => "<html><body>raw card</body></html>",
		} as Response)

		render(<CardFrame cardId="card-scale" fileId="file-scale" />)

		const iframe = await screen.findByTitle("card-scale")
		const frame = screen.getByTestId("self-media-card-frame")

		Object.defineProperty(frame, "clientWidth", {
			configurable: true,
			value: 400,
		})
		Object.defineProperty(iframe, "contentDocument", {
			configurable: true,
			value: {
				body: {
					scrollWidth: 800,
					scrollHeight: 1600,
					getBoundingClientRect: () => ({ width: 800, height: 1600 }),
				},
				documentElement: {
					scrollWidth: 800,
					scrollHeight: 1600,
				},
			},
		})

		fireEvent.load(iframe)

		await waitFor(() => {
			expect(iframe.style.width).toBe("800px")
			expect(iframe.style.height).toBe("1600px")
			expect(iframe.style.transform).toBe("scale(0.5)")
		})
		expect(frame.style.height).toBe("800px")
	})

	it("keeps explicit frame height instead of replacing it with scaled height", async () => {
		mockGetTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.com/card.html" }])
		mockProcessHtmlContent.mockResolvedValue({
			processedContent: "<html><head></head><body>fixed-height card</body></html>",
			filePathMapping: new Map(),
			hasSlides: false,
			slidesMap: new Map(),
			originalSlidesPaths: [],
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			text: async () => "<html><body>raw card</body></html>",
		} as Response)

		render(
			<CardFrame
				cardId="card-fixed-height"
				fileId="file-fixed-height"
				style={{ height: "100%" }}
			/>,
		)

		const iframe = await screen.findByTitle("card-fixed-height")
		const frame = screen.getByTestId("self-media-card-frame")

		Object.defineProperty(frame, "clientWidth", {
			configurable: true,
			value: 400,
		})
		Object.defineProperty(iframe, "contentDocument", {
			configurable: true,
			value: {
				body: {
					scrollWidth: 800,
					scrollHeight: 1600,
					getBoundingClientRect: () => ({ width: 800, height: 1600 }),
				},
				documentElement: {
					scrollWidth: 800,
					scrollHeight: 1600,
				},
			},
		})

		fireEvent.load(iframe)

		await waitFor(() => {
			expect(iframe.style.transform).toBe("scale(0.5)")
		})
		expect(frame.style.height).toBe("100%")
	})

	it("reuses cached srcDoc for the same card after remount", async () => {
		mockGetTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.com/card.html" }])
		mockProcessHtmlContent.mockResolvedValue({
			processedContent: "<html><head></head><body>cached card</body></html>",
			filePathMapping: new Map(),
			hasSlides: false,
			slidesMap: new Map(),
			originalSlidesPaths: [],
		})
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			text: async () => "<html><body>raw card</body></html>",
		} as Response)

		const attachmentList = [
			{
				file_id: "file-cache",
				file_name: "01.html",
				relative_file_path: "posts/post-cache/cards/01.html",
			},
		]

		const firstRender = render(
			<CardFrame cardId="card-cache" fileId="file-cache" attachmentList={attachmentList} />,
		)

		const firstIframe = await screen.findByTitle("card-cache")
		expect(firstIframe.getAttribute("srcdoc")).toContain("cached card")

		firstRender.unmount()

		render(
			<CardFrame cardId="card-cache" fileId="file-cache" attachmentList={attachmentList} />,
		)

		const secondIframe = await screen.findByTitle("card-cache")
		expect(secondIframe.getAttribute("srcdoc")).toContain("cached card")

		expect(mockGetTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(fetchSpy).toHaveBeenCalledTimes(1)
		expect(mockProcessHtmlContent).toHaveBeenCalledTimes(1)
	})
})
