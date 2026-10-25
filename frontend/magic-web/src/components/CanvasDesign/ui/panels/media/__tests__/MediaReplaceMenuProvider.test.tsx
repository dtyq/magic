import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import { MediaReplaceMenuProvider } from "../MediaReplaceMenuProvider"

const mocks = vi.hoisted(() => ({
	handlers: {} as Record<string, (event: { data: Record<string, unknown> }) => void>,
	canvas: undefined as
		| {
				can: ReturnType<typeof vi.fn>
				container: HTMLDivElement
				elementManager: { getElementData: ReturnType<typeof vi.fn> }
				mediaReplaceController: {
					openLocalFilePicker: ReturnType<typeof vi.fn>
					replaceWithProjectFile: ReturnType<typeof vi.fn>
					getReplacementState: ReturnType<typeof vi.fn>
				}
		  }
		| undefined,
}))

function createAnimationFrameHarness() {
	let nextFrameId = 0
	const callbacks = new Map<number, FrameRequestCallback>()
	const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
		nextFrameId += 1
		callbacks.set(nextFrameId, callback)
		return nextFrameId
	})
	const cancelAnimationFrame = vi.fn((frameId: number) => {
		callbacks.delete(frameId)
	})
	const flush = () => {
		const queued = Array.from(callbacks.values())
		callbacks.clear()
		queued.forEach((callback) => callback(0))
	}

	vi.stubGlobal("requestAnimationFrame", requestAnimationFrame)
	vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame)

	return { cancelAnimationFrame, flush }
}

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasEvent: (
		event: string,
		handler: (event: { data: Record<string, unknown> }) => void,
	) => {
		mocks.handlers[event] = handler
	},
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../editors/message/reference-assets/ReferenceResourcePopover", () => ({
	default: (props: {
		referenceResourceType: string
		onSelectSource: (source: string) => void
		onProjectSelect: (
			item: { data: { file_path: string; file_name: string } },
			context: { reset: () => void },
		) => void
	}) => (
		<div data-testid="media-replace-popover" data-resource-type={props.referenceResourceType}>
			<button type="button" onClick={() => props.onSelectSource("local-upload")}>
				local-upload
			</button>
			<button
				type="button"
				onClick={() =>
					props.onProjectSelect(
						{ data: { file_path: "/project/media.webm", file_name: "media.webm" } },
						{ reset: vi.fn() },
					)
				}
			>
				project-select
			</button>
		</div>
	),
}))

describe("MediaReplaceMenuProvider", () => {
	beforeEach(() => {
		const container = document.createElement("div")
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			x: 10,
			y: 20,
			left: 10,
			top: 20,
			right: 1010,
			bottom: 820,
			width: 1000,
			height: 800,
			toJSON: () => ({}),
		})
		mocks.canvas = {
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			container,
			elementManager: { getElementData: vi.fn() },
			mediaReplaceController: {
				openLocalFilePicker: vi.fn(),
				replaceWithProjectFile: vi.fn(async () => true),
				getReplacementState: vi.fn((): unknown => null),
			},
		}
		mocks.handlers = {}
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("routes video local upload and image project selection through one menu", () => {
		render(
			<MediaReplaceMenuProvider>
				<div>canvas</div>
			</MediaReplaceMenuProvider>,
		)

		act(() => {
			mocks.handlers["element:media:replaceClick"]?.({
				data: {
					elementId: "video-1",
					mediaType: ElementTypeEnum.Video,
					contentId: "video-content-1",
					anchorRect: { left: 110, top: 220, width: 80, height: 32 },
				},
			})
		})

		const popover = screen.getByTestId("media-replace-popover")
		expect(popover).toHaveAttribute("data-resource-type", "video")
		expect(popover.parentElement).toHaveStyle({ left: "100px", top: "232px" })
		fireEvent.click(screen.getByRole("button", { name: "local-upload" }))
		expect(mocks.canvas?.mediaReplaceController.openLocalFilePicker).toHaveBeenCalledWith({
			elementId: "video-1",
			mediaType: ElementTypeEnum.Video,
			contentId: "video-content-1",
		})

		act(() => {
			mocks.handlers["element:image:replaceClick"]?.({
				data: {
					elementId: "image-1",
					contentId: "image-content-2",
					clientX: 210,
					clientY: 320,
				},
			})
		})
		fireEvent.click(screen.getByRole("button", { name: "project-select" }))
		expect(mocks.canvas?.mediaReplaceController.replaceWithProjectFile).toHaveBeenCalledWith({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "image-content-2",
			path: "/project/media.webm",
		})
	})

	it("captures the active audio Content for the legacy element corner action", () => {
		mocks.canvas?.elementManager.getElementData.mockReturnValue({
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			contents: [{ contentId: "audio-content-2", src: "/audios/current.mp3" }],
			activeContentId: "audio-content-2",
			mainContentId: "audio-content-2",
		})
		render(
			<MediaReplaceMenuProvider>
				<div>canvas</div>
			</MediaReplaceMenuProvider>,
		)

		act(() => {
			mocks.handlers["element:audio:replaceClick"]?.({
				data: { elementId: "audio-1", clientX: 110, clientY: 220 },
			})
		})
		fireEvent.click(screen.getByRole("button", { name: "local-upload" }))

		expect(mocks.canvas?.mediaReplaceController.openLocalFilePicker).toHaveBeenCalledWith({
			elementId: "audio-1",
			mediaType: ElementTypeEnum.Audio,
			contentId: "audio-content-2",
		})
	})

	it("keeps the menu aligned with the replacement button while it moves", () => {
		const { cancelAnimationFrame, flush } = createAnimationFrameHarness()
		const anchorElement = document.createElement("button")
		document.body.appendChild(anchorElement)
		const getAnchorRect = vi.spyOn(anchorElement, "getBoundingClientRect")
		getAnchorRect.mockReturnValue({
			x: 110,
			y: 220,
			left: 110,
			top: 220,
			right: 190,
			bottom: 252,
			width: 80,
			height: 32,
			toJSON: () => ({}),
		})
		const { unmount } = render(
			<MediaReplaceMenuProvider>
				<div>canvas</div>
			</MediaReplaceMenuProvider>,
		)

		act(() => {
			mocks.handlers["element:media:replaceClick"]?.({
				data: {
					elementId: "image-1",
					mediaType: ElementTypeEnum.Image,
					contentId: "image-content-1",
					anchorElement,
				},
			})
		})
		const menuAnchor = screen.getByTestId("media-replace-popover").parentElement
		expect(menuAnchor).toHaveStyle({ left: "100px", top: "232px" })

		getAnchorRect.mockReturnValue({
			x: 160,
			y: 260,
			left: 160,
			top: 260,
			right: 240,
			bottom: 292,
			width: 80,
			height: 32,
			toJSON: () => ({}),
		})
		act(() => flush())
		expect(menuAnchor).toHaveStyle({ left: "150px", top: "272px" })

		unmount()
		expect(cancelAnimationFrame).toHaveBeenCalled()
		anchorElement.remove()
	})

	it("does not open or keep a source menu while another replacement is active", () => {
		render(
			<MediaReplaceMenuProvider>
				<div>canvas</div>
			</MediaReplaceMenuProvider>,
		)

		mocks.canvas?.mediaReplaceController.getReplacementState.mockReturnValue({
			elementId: "audio-1",
		})
		act(() => {
			mocks.handlers["element:media:replaceClick"]?.({
				data: {
					elementId: "image-1",
					mediaType: ElementTypeEnum.Image,
					contentId: "image-content-1",
					clientX: 100,
					clientY: 100,
				},
			})
		})
		expect(screen.queryByTestId("media-replace-popover")).toBeNull()

		mocks.canvas?.mediaReplaceController.getReplacementState.mockReturnValue(null)
		act(() => {
			mocks.handlers["element:media:replaceClick"]?.({
				data: {
					elementId: "image-1",
					mediaType: ElementTypeEnum.Image,
					contentId: "image-content-1",
					clientX: 100,
					clientY: 100,
				},
			})
		})
		expect(screen.getByTestId("media-replace-popover")).toBeInTheDocument()

		act(() => {
			mocks.handlers["element:media:replaceStateChanged"]?.({
				data: { elementId: "image-1", status: "uploading" },
			})
		})
		expect(screen.queryByTestId("media-replace-popover")).toBeNull()
	})
})
