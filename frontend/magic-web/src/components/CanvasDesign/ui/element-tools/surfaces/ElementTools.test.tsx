import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../../runtime/document/types"
import ElementTools from "../index"

const mocks = vi.hoisted(() => ({
	selectedElements: [] as Array<Record<string, unknown>>,
	magic: {
		convertHightConfig: { enabled: false },
	} as Record<string, unknown>,
	canvas: undefined as
		| {
				mediaReplaceController: { getReplacingElementId: () => string | null }
				can: ReturnType<typeof vi.fn>
				elementManager?: {
					getAllElementIds: () => string[]
					getElementData: (elementId: string) => unknown
				}
				connectionManager?: {
					getUpstreamConnections: (elementId: string) => Array<{
						sourceElementId: string
						targetElementId: string
					}>
				}
				eventEmitter?: {
					on: () => () => void
				}
		  }
		| undefined,
	mediaReplaceStateHandler: undefined as
		| ((event: {
				data: { elementId: string; status: "idle" | "uploading" | "applying" | "error" }
		  }) => void)
		| undefined,
}))

vi.mock("./ElementToolTopSurfaceRender", () => ({
	default: (props: { tools: Array<{ id: string }> }) => (
		<div data-testid="element-tools">
			{props.tools.map((tool) => (
				<span key={tool.id}>{tool.id}</span>
			))}
		</div>
	),
}))

vi.mock("../../../app/providers/CanvasUIProvider", () => ({
	useCanvasSelectionUI: () => ({
		selectedElements: mocks.selectedElements,
		isDragging: false,
		isSelecting: false,
		activeToolSession: null,
	}),
}))

vi.mock("../../../app/providers/MagicProvider", () => ({
	useMagic: () => mocks.magic,
}))

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../app/hooks/canvas", () => ({
	useCanvasEvent: vi.fn(
		(
			event: string,
			handler: (event: {
				data: {
					elementId: string
					status: "idle" | "uploading" | "applying" | "error"
				}
			}) => void,
		) => {
			if (event === "element:media:replaceStateChanged") {
				mocks.mediaReplaceStateHandler = handler
			}
		},
	),
}))

vi.mock("../shared/hooks/useShowMediaOriginalSizeButton", () => ({
	default: () => false,
}))

describe("ElementTools image replacement ordering", () => {
	beforeEach(() => {
		mocks.selectedElements = []
		mocks.magic = { convertHightConfig: { enabled: false } }
		mocks.canvas = undefined
		mocks.mediaReplaceStateHandler = undefined
	})

	it("defaults missing AI ability fields to disabled", () => {
		mocks.magic = {
			convertHightConfig: { enabled: false },
			hasAiAbilityAvailabilityProvider: true,
			isAiAbilityAvailabilityReady: true,
			aiAbilityAvailability: {
				abilities: {
					image_convert_high: { enabled: true },
					image_remove_background: { enabled: true },
					image_eraser: { enabled: true },
					// image_expand is intentionally missing to cover older API responses.
				},
			},
		}
		mocks.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				activeContentId: "version-1",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./images/one.png", status: "completed" },
				],
			},
		]

		expect(() => render(<ElementTools />)).not.toThrow()
		expect(screen.getByTestId("element-tools")).not.toHaveTextContent(
			ElementToolTypeEnum.ContentExtend,
		)
	})

	it("keeps gated tools hidden until the host returns an availability result", () => {
		mocks.magic = {
			hasAiAbilityAvailabilityProvider: true,
			isAiAbilityAvailabilityReady: false,
			aiAbilityAvailability: null,
		}
		mocks.selectedElements = [
			{
				id: "image-pending-availability",
				type: ElementTypeEnum.Image,
				activeContentId: "version-1",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./images/one.png", status: "completed" },
				],
			},
		]

		render(<ElementTools />)

		const toolbar = screen.getByTestId("element-tools")
		expect(toolbar).not.toHaveTextContent(ElementToolTypeEnum.ContentEnhance)
		expect(toolbar).not.toHaveTextContent(ElementToolTypeEnum.ContentRemoveBackground)
		expect(toolbar).not.toHaveTextContent(ElementToolTypeEnum.ContentEraser)
		expect(toolbar).not.toHaveTextContent(ElementToolTypeEnum.ContentExtend)
	})

	it("does not show replace for a new empty image node", () => {
		mocks.selectedElements = [
			{
				id: "image-empty",
				type: ElementTypeEnum.Image,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "version-1",
				mainContentId: "version-1",
				contents: [{ contentId: "version-1" }],
			},
		]

		render(<ElementTools />)

		expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()
	})

	it("keeps the legacy text tool order and groups", () => {
		mocks.selectedElements = [
			{
				id: "text-1",
				type: ElementTypeEnum.Text,
				contents: [{ contentId: "text-content" }],
				activeContentId: "text-content",
				mainContentId: "text-content",
			},
		]

		render(<ElementTools />)

		expect(
			Array.from(screen.getByTestId("element-tools").children).map(
				(node) => node.textContent,
			),
		).toEqual([
			ElementToolTypeEnum.TextFillColor,
			ElementToolTypeEnum.TextFontFamily,
			ElementToolTypeEnum.TextFontSize,
			ElementToolTypeEnum.TextFontStyle,
			ElementToolTypeEnum.TextAlign,
			ElementToolTypeEnum.TextAdvanced,
			ElementToolTypeEnum.TextDownload,
			ElementToolTypeEnum.TextContentOptimization,
		])
	})

	it("keeps the legacy frame tool order", () => {
		mocks.selectedElements = [
			{
				id: "frame-1",
				type: ElementTypeEnum.Frame,
				contents: [],
			},
		]

		render(<ElementTools />)

		expect(
			Array.from(screen.getByTestId("element-tools").children).map(
				(node) => node.textContent,
			),
		).toEqual([
			ElementToolTypeEnum.FrameRemove,
			ElementToolTypeEnum.ElementResize,
			ElementToolTypeEnum.FrameDownload,
			ElementToolTypeEnum.ElementAlign,
			ElementToolTypeEnum.ElementDistribute,
		])
	})

	it("moves pending multi-version deletion out of the top toolbar", () => {
		mocks.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "version-2",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./images/one.png", status: "completed" },
					{ contentId: "version-2", status: "pending" },
				],
			},
		]

		render(<ElementTools />)
		expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()
	})

	it("keeps replace and download in the image top toolbar", () => {
		mocks.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "version-2",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./images/one.png", status: "completed" },
					{ contentId: "version-2", src: "./images/two.png", status: "completed" },
				],
			},
		]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toContain(ElementToolTypeEnum.ContentReplace)
		expect(labels).toContain(ElementToolTypeEnum.ContentDownload)
	})

	it("keeps normal image tools while another version is generating", () => {
		mocks.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "version-1",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./images/one.png", status: "completed" },
					{ contentId: "version-2", status: "processing" },
				],
			},
		]

		render(<ElementTools />)
		expect(screen.getByTestId("element-tools")).toHaveTextContent(
			ElementToolTypeEnum.ContentCrop,
		)
		expect(screen.getByTestId("element-tools")).toHaveTextContent(
			ElementToolTypeEnum.ContentReplace,
		)
		expect(screen.getByTestId("element-tools")).toHaveTextContent(
			ElementToolTypeEnum.ContentDownload,
		)
	})

	it("keeps normal video tools while another version is generating", () => {
		mocks.selectedElements = [
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "version-1",
				mainContentId: "version-1",
				contents: [
					{ contentId: "version-1", src: "./videos/one.mp4", status: "completed" },
					{ contentId: "version-2", status: "processing" },
				],
			},
		]

		render(<ElementTools />)
		expect(screen.getByTestId("element-tools")).toHaveTextContent(
			ElementToolTypeEnum.ContentReplace,
		)
		expect(screen.getByTestId("element-tools")).toHaveTextContent(
			ElementToolTypeEnum.ContentDownload,
		)
	})

	it("shows batch download for a single frame", () => {
		mocks.selectedElements = [
			{
				id: "frame-1",
				type: ElementTypeEnum.Frame,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			},
		]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toContain(ElementToolTypeEnum.FrameDownload)
	})

	it("shows storyboard video batch execution for a storyboard output frame", () => {
		const image = {
			id: "image-output",
			type: ElementTypeEnum.Image,
			contents: [{ contentId: "image-content", src: "./images/output.png" }],
			activeContentId: "image-content",
			mainContentId: "image-content",
		}
		const storyboard = {
			id: "storyboard-1",
			type: ElementTypeEnum.Storyboard,
			contents: [
				{
					contentId: "storyboard-content",
					shots: [{ id: "shot-1", description: "shot", outputImageElementId: image.id }],
				},
			],
			activeContentId: "storyboard-content",
			mainContentId: "storyboard-content",
		}
		const frame = {
			id: "output-frame",
			type: ElementTypeEnum.Frame,
			children: [image],
		}
		mocks.canvas = {
			mediaReplaceController: { getReplacingElementId: () => null },
			can: vi.fn(() => true),
			eventEmitter: { on: () => () => undefined },
			elementManager: {
				getAllElementIds: () => [frame.id, image.id, storyboard.id],
				getElementData: (elementId) =>
					elementId === frame.id ? frame : elementId === image.id ? image : storyboard,
			},
			connectionManager: {
				getUpstreamConnections: (elementId) =>
					elementId === image.id
						? [{ sourceElementId: storyboard.id, targetElementId: image.id }]
						: [],
			},
		}
		mocks.selectedElements = [frame]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toContain(ElementToolTypeEnum.FrameStoryboardVideoBatch)
	})

	it("does not show storyboard video batch execution for an ordinary image frame", () => {
		const image = {
			id: "ordinary-image",
			type: ElementTypeEnum.Image,
			contents: [{ contentId: "image-content", src: "./images/output.png" }],
			activeContentId: "image-content",
			mainContentId: "image-content",
		}
		const frame = {
			id: "ordinary-frame",
			type: ElementTypeEnum.Frame,
			children: [image],
		}
		mocks.canvas = {
			mediaReplaceController: { getReplacingElementId: () => null },
			can: vi.fn(() => true),
			eventEmitter: { on: () => () => undefined },
			elementManager: {
				getAllElementIds: () => [frame.id, image.id],
				getElementData: (elementId) => (elementId === frame.id ? frame : image),
			},
			connectionManager: { getUpstreamConnections: () => [] },
		}
		mocks.selectedElements = [frame]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).not.toContain(ElementToolTypeEnum.FrameStoryboardVideoBatch)
	})

	it("shows download for a single audio element", () => {
		mocks.selectedElements = [
			{
				id: "audio-1",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 320,
				height: 96,
				contents: [{ contentId: "audio-content", src: "./audios/demo.mp3" }],
				activeContentId: "audio-content",
				mainContentId: "audio-content",
			},
		]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toEqual([
			ElementToolTypeEnum.ContentReplace,
			ElementToolTypeEnum.ContentDownload,
		])
	})

	it("shows the common download and replace tools for a video", () => {
		mocks.selectedElements = [
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				x: 0,
				y: 0,
				width: 640,
				height: 360,
				contents: [{ contentId: "video-content", src: "./videos/demo.mp4" }],
				activeContentId: "video-content",
				mainContentId: "video-content",
			},
		]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toEqual([
			ElementToolTypeEnum.ContentReplace,
			ElementToolTypeEnum.ContentDownload,
		])
	})

	it("shows upload for an empty audio element", () => {
		mocks.selectedElements = [
			{
				id: "audio-empty",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 320,
				height: 96,
				contents: [{ contentId: "audio-content" }],
				activeContentId: "audio-content",
				mainContentId: "audio-content",
			},
		]

		render(<ElementTools />)
		const labels = Array.from(screen.getByTestId("element-tools").children).map(
			(node) => node.textContent,
		)

		expect(labels).toEqual([ElementToolTypeEnum.ContentReplace])
	})

	it("keeps shape controls in the unified top tool surface", () => {
		mocks.selectedElements = [
			{
				id: "shape-1",
				type: ElementTypeEnum.Rectangle,
				contents: [{ contentId: "shape-content", stroke: "#000000", strokeWidth: 1 }],
				activeContentId: "shape-content",
				mainContentId: "shape-content",
			},
		]

		render(<ElementTools />)

		expect(
			Array.from(screen.getByTestId("element-tools").children).map(
				(node) => node.textContent,
			),
		).toEqual([ElementToolTypeEnum.ShapeStrokeColor, ElementToolTypeEnum.ShapeStyle])
	})

	it("hides the audio toolbar while the selected empty node uploads", () => {
		mocks.selectedElements = [
			{
				id: "audio-empty",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 320,
				height: 96,
				contents: [{ contentId: "audio-content" }],
				activeContentId: "audio-content",
				mainContentId: "audio-content",
			},
		]

		render(<ElementTools />)
		expect(screen.getByTestId("element-tools")).toBeInTheDocument()

		act(() => {
			mocks.mediaReplaceStateHandler?.({
				data: { elementId: "audio-empty", status: "uploading" },
			})
		})
		expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()

		act(() => {
			mocks.mediaReplaceStateHandler?.({
				data: { elementId: "audio-empty", status: "idle" },
			})
		})
		expect(screen.getByTestId("element-tools")).toBeInTheDocument()
	})

	it("hides the entire media toolbar during replacement", () => {
		mocks.selectedElements = [
			{
				id: "audio-1",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 320,
				height: 96,
				contents: [{ contentId: "audio-content", src: "./audios/voice.mp3" }],
				activeContentId: "audio-content",
				mainContentId: "audio-content",
			},
		]

		render(<ElementTools />)
		act(() => {
			mocks.mediaReplaceStateHandler?.({
				data: { elementId: "audio-1", status: "uploading" },
			})
		})

		expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()
	})

	it.each([ElementTypeEnum.Image, ElementTypeEnum.Video] as const)(
		"hides the %s toolbar while replacement is active",
		(type) => {
			mocks.selectedElements = [
				{
					id: `${type}-1`,
					type,
					x: 0,
					y: 0,
					width: 320,
					height: 180,
					contents: [{ contentId: `${type}-content`, src: `./${type}/demo` }],
					activeContentId: `${type}-content`,
					mainContentId: `${type}-content`,
				},
			]

			render(<ElementTools />)
			act(() => {
				mocks.mediaReplaceStateHandler?.({
					data: { elementId: `${type}-1`, status: "applying" },
				})
			})

			expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()
		},
	)

	it("restores replacement state when a video is reselected", () => {
		mocks.canvas = {
			mediaReplaceController: { getReplacingElementId: () => "video-1" },
			can: vi.fn(() => true),
			eventEmitter: { on: () => () => undefined },
		}
		mocks.selectedElements = [
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				x: 0,
				y: 0,
				width: 320,
				height: 180,
				contents: [{ contentId: "video-content", src: "./videos/demo.mp4" }],
				activeContentId: "video-content",
				mainContentId: "video-content",
			},
		]

		render(<ElementTools />)

		expect(screen.queryByTestId("element-tools")).not.toBeInTheDocument()
	})
})
