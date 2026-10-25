import { act, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PPTTransitionPreview, { type PPTTransitionPreviewSource } from "../PPTTransitionPreview"

const mocks = vi.hoisted(() => ({
	pages: [] as Array<Record<string, unknown> & { content: string; onRenderReady: () => void }>,
	animate: vi.fn(),
	cancel: vi.fn(),
}))
vi.mock("../../../../contents/HTML/IsolatedHTMLRenderer", () => ({
	default: (props: (typeof mocks.pages)[number]) => {
		mocks.pages.push(props)
		return <div data-testid="preview-document">{props.content}</div>
	},
}))
vi.mock("../../utils/pptTransitionAnimation", () => ({ animatePPTTransition: mocks.animate }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const current = {
	id: "body",
	path: "body.html",
	index: 1,
	content: '<main class="slide-container" data-width="1024" data-height="768">Body</main>',
	fileId: "body-file",
	htmlRelativeFolderPath: "project/deck/",
}
const previous = { id: "cover", path: "cover.html", index: 0, content: "Cover HTML" }
const source: PPTTransitionPreviewSource = {
	current,
	previous,
	projectId: "project",
	filePathMapping: new Map([["logo.svg", "logo-file"]]),
}
const transition = { effect: "push" as const, duration_ms: 450, direction: "left" as const }

function markReady(content: string) {
	const page = mocks.pages.findLast((item) => item.content === content)
	act(() => page?.onRenderReady())
}

describe("PPTTransitionPreview real pages", () => {
	beforeEach(() => {
		mocks.pages = []
		mocks.animate.mockReset()
		mocks.cancel.mockReset()
		mocks.animate.mockReturnValue({
			cancel: mocks.cancel,
			finished: new Promise(() => undefined),
		})
	})

	it("renders the selected HTML and its predecessor in noninteractive, correctly scaled sandboxes", () => {
		const onReadyChange = vi.fn()
		render(
			<PPTTransitionPreview
				source={source}
				transition={transition}
				run={0}
				reducedMotion={false}
				onReadyChange={onReadyChange}
			/>,
		)
		const stage = screen.getByTestId("ppt-transition-preview")
		expect(stage).toHaveAttribute("inert")
		expect(stage.style.aspectRatio).toBe("1024 / 768")
		expect(within(stage).getByText(current.content)).toBeInTheDocument()
		expect(within(stage).getByText(previous.content)).toBeInTheDocument()
		expect(within(stage).queryByText(/^[AB]$/)).not.toBeInTheDocument()
		expect(mocks.pages.find((item) => item.content === current.content)).toMatchObject({
			isPptRender: true,
			isEditMode: false,
			isTabActive: false,
			isPlaybackPaused: true,
			disableIframeDocumentClickBridge: true,
			fileId: "body-file",
			htmlRelativeFolderPath: "project/deck/",
			projectId: "project",
			filePathMapping: source.filePathMapping,
			scaleContentDimensions: { width: 1024, height: 768 },
		})
		expect(onReadyChange).toHaveBeenLastCalledWith(false)
		markReady(current.content)
		expect(onReadyChange).toHaveBeenLastCalledWith(false)
		markReady(previous.content)
		expect(onReadyChange).toHaveBeenLastCalledWith(true)
		expect(mocks.animate).not.toHaveBeenCalled()
	})

	it("cancels a running preview on same-length HTML updates and ignores the old ready callback", () => {
		const original = { ...source, current: { ...current, content: "Old page" } }
		const refreshed = { ...source, current: { ...current, content: "New page" } }
		const onReadyChange = vi.fn()
		const view = (value: PPTTransitionPreviewSource, run: number) => (
			<PPTTransitionPreview
				source={value}
				transition={transition}
				run={run}
				reducedMotion={false}
				onReadyChange={onReadyChange}
			/>
		)
		const { rerender } = render(view(original, 0))
		const staleReady = mocks.pages.find((item) => item.content === "Old page")?.onRenderReady
		expect(staleReady).toBeDefined()
		markReady("Old page")
		markReady(previous.content)
		rerender(view(original, 1))
		expect(mocks.animate).toHaveBeenCalledTimes(1)
		rerender(view(refreshed, 1))
		expect(mocks.cancel).toHaveBeenCalledTimes(1)
		expect(onReadyChange).toHaveBeenLastCalledWith(false)
		act(() => staleReady?.())
		expect(onReadyChange).toHaveBeenLastCalledWith(false)
		markReady("New page")
		expect(onReadyChange).toHaveBeenLastCalledWith(true)
		expect(mocks.animate).toHaveBeenCalledTimes(1)
		rerender(view(refreshed, 2))
		expect(mocks.animate).toHaveBeenCalledTimes(2)
	})

	it("uses an empty outgoing canvas for the first slide, without inventing another page", () => {
		const onReadyChange = vi.fn()
		render(
			<PPTTransitionPreview
				source={{ current: { ...current, index: 0 } }}
				transition={transition}
				run={0}
				reducedMotion={false}
				onReadyChange={onReadyChange}
			/>,
		)
		expect(screen.getAllByTestId("preview-document")).toHaveLength(1)
		expect(screen.getByText("ppt.transitions.previewCurrent")).toBeInTheDocument()
		markReady(current.content)
		expect(onReadyChange).toHaveBeenLastCalledWith(true)
	})

	it("keeps failed page loads unavailable and shows a refresh hint", () => {
		const onReadyChange = vi.fn()
		render(
			<PPTTransitionPreview
				source={{ ...source, previous: { ...previous, loadingState: "error" } }}
				transition={transition}
				run={0}
				reducedMotion={false}
				onReadyChange={onReadyChange}
			/>,
		)
		markReady(current.content)
		markReady(previous.content)
		expect(onReadyChange).toHaveBeenLastCalledWith(false)
		expect(screen.getByText("ppt.transitions.previewFailed")).toBeInTheDocument()
	})

	it("settles to the selected page and releases animations after playback", async () => {
		let finish!: () => void
		mocks.animate.mockReturnValue({
			cancel: mocks.cancel,
			finished: new Promise<void>((resolve) => {
				finish = resolve
			}),
		})
		const view = (run: number) => (
			<PPTTransitionPreview
				source={source}
				transition={transition}
				run={run}
				reducedMotion={false}
			/>
		)
		const { rerender } = render(view(0))
		markReady(current.content)
		markReady(previous.content)
		rerender(view(1))
		const outgoing = mocks.animate.mock.calls[0][0] as HTMLElement
		expect(outgoing.style.visibility).toBe("visible")
		await act(async () => finish())
		expect(outgoing.style.visibility).toBe("hidden")
		expect(mocks.cancel).toHaveBeenCalled()
		expect(screen.getByText(current.content)).toBeInTheDocument()
	})
})
