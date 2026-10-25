import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import ElementBottomToolbarHost from "../ElementBottomToolbarHost"

const mocks = vi.hoisted(() => {
	const state = {
		isReplacing: false,
		editingElementId: null as string | null,
		croppingElementId: null as string | null,
		extendingElementId: null as string | null,
		erasingElementId: null as string | null,
		selectedElements: [] as Array<Record<string, unknown>>,
		elementInstance: null as Record<string, unknown> | null,
	}

	return {
		state,
		canvas: {
			eventEmitter: { on: vi.fn(() => vi.fn()), off: vi.fn() },
			permissionManager: { can: vi.fn(() => true) },
			getEffectiveContentId: vi.fn(
				(elementId: string) =>
					mocks.state.selectedElements.find((element) => element.id === elementId)
						?.activeContentId,
			),
			elementManager: {
				getElementData: vi.fn((elementId: string) =>
					mocks.state.selectedElements.find((element) => element.id === elementId),
				),
				getElementInstance: vi.fn(() => state.elementInstance),
			},
		},
	}
})

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: mocks.canvas,
	}),
}))

vi.mock("../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasSelectionUI: () => ({
		selectedElements: mocks.state.selectedElements,
		isDragging: false,
		isSelecting: false,
		activeToolSession: null,
	}),
	useCanvasModeUI: () => ({
		croppingElementId: mocks.state.croppingElementId,
		extendingElementId: mocks.state.extendingElementId,
		erasingElementId: mocks.state.erasingElementId,
		editingElementId: mocks.state.editingElementId,
	}),
	useCanvasPanelUI: () => ({ fullscreenMediaElement: null }),
}))

vi.mock("../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string | { defaultValue?: string }) =>
			typeof fallback === "string" ? fallback : (fallback.defaultValue ?? ""),
	}),
}))

vi.mock("../../../../app/hooks/canvas", () => ({
	useIsMediaReplacing: () => mocks.state.isReplacing,
}))

vi.mock("../../../../app/hooks/layout/useElementPositionEffect", () => ({
	default: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

describe("ElementBottomToolbarHost replacement gating", () => {
	beforeEach(() => {
		mocks.state.isReplacing = false
		mocks.state.editingElementId = null
		mocks.state.croppingElementId = null
		mocks.state.extendingElementId = null
		mocks.state.erasingElementId = null
		mocks.state.elementInstance = null
		mocks.state.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				contents: [{ contentId: "image-content-1", src: "/images/current.png" }],
				activeContentId: "image-content-1",
				mainContentId: "image-content-1",
			},
		]
	})

	it("hides result actions while the selected image is replacing", () => {
		const { rerender } = render(<ElementBottomToolbarHost />)

		expect(screen.getByRole("button", { name: "重新编辑" })).toBeInTheDocument()

		mocks.state.isReplacing = true
		rerender(<ElementBottomToolbarHost />)

		expect(screen.queryByRole("button", { name: "重新编辑" })).toBeNull()
		expect(screen.getByRole("toolbar", { hidden: true })).toHaveAttribute("aria-hidden", "true")
	})

	it("keeps only version controls while the selected image editor is active", () => {
		const { rerender } = render(<ElementBottomToolbarHost />)

		expect(screen.getByRole("button", { name: "重新编辑" })).toBeInTheDocument()

		mocks.state.editingElementId = "image-1"
		rerender(<ElementBottomToolbarHost />)

		expect(screen.queryByRole("button", { name: "重新编辑" })).toBeNull()
		expect(screen.getByRole("toolbar", { hidden: true })).toBeInTheDocument()
	})

	it("shows image version controls while the editor is active", () => {
		mocks.state.editingElementId = "image-1"
		mocks.state.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				contents: [
					{ contentId: "image-content-1", src: "/images/current.png" },
					{ contentId: "image-content-2", src: "/images/previous.png" },
				],
				activeContentId: "image-content-1",
				mainContentId: "image-content-1",
			},
		]

		render(<ElementBottomToolbarHost />)

		expect(screen.getByTestId("element-version-controls")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "重新编辑" })).toBeNull()
	})

	it("shows video version controls while the editor is active", () => {
		mocks.state.editingElementId = "video-1"
		mocks.state.selectedElements = [
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				contents: [
					{ contentId: "video-content-1", src: "/videos/current.mp4" },
					{ contentId: "video-content-2", src: "/videos/previous.mp4" },
				],
				activeContentId: "video-content-1",
				mainContentId: "video-content-1",
			},
		]

		render(<ElementBottomToolbarHost />)

		expect(screen.getByTestId("element-version-controls")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "重新编辑" })).toBeNull()
	})

	it("does not hide the selected element toolbar for a stale edit state from another element", () => {
		const { rerender } = render(<ElementBottomToolbarHost />)

		mocks.state.croppingElementId = "another-image"
		rerender(<ElementBottomToolbarHost />)

		expect(screen.getByRole("button", { name: "重新编辑" })).toBeInTheDocument()
	})

	it("keeps image version controls mounted while a version is generating", () => {
		mocks.state.elementInstance = {
			switchActiveContent: vi.fn(),
			setMainContent: vi.fn(),
			deleteActiveContent: vi.fn(),
		}
		mocks.state.selectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				contents: [
					{
						contentId: "image-content-1",
						src: "/images/current.png",
						status: "completed",
					},
					{ contentId: "image-content-2", status: "processing" },
				],
				activeContentId: "image-content-2",
				mainContentId: "image-content-1",
			},
		]

		render(<ElementBottomToolbarHost />)

		expect(screen.getByTestId("element-version-controls")).toBeInTheDocument()
		expect(screen.queryByRole("status")).toBeNull()
	})

	it("keeps video version controls mounted while a version is generating", () => {
		mocks.state.elementInstance = {
			switchActiveContent: vi.fn(),
			setMainContent: vi.fn(),
			deleteActiveContent: vi.fn(),
		}
		mocks.state.selectedElements = [
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				contents: [
					{
						contentId: "video-content-1",
						src: "/videos/current.mp4",
						status: "completed",
					},
					{ contentId: "video-content-2", status: "processing" },
				],
				activeContentId: "video-content-2",
				mainContentId: "video-content-1",
			},
		]

		render(<ElementBottomToolbarHost />)

		expect(screen.getByTestId("element-version-controls")).toBeInTheDocument()
		expect(screen.queryByRole("status")).toBeNull()
	})
})
