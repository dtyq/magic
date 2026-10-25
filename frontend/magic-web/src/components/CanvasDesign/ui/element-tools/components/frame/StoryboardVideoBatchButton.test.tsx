import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import StoryboardVideoBatchButton from "./StoryboardVideoBatchButton"

const mocks = vi.hoisted(() => ({
	canvas: { can: vi.fn(() => true), permissionManager: { can: vi.fn(() => true) } },
	selectedElements: [{ id: "output-frame", type: "frame" }] as Array<{
		id: string
		type: string
	}>,
	videoModelList: [{ model_id: "video-model" }],
	isStoryboardOutputFrame: vi.fn(() => true),
	canCreateStoryboardVideosFromConnection: vi.fn(() => true),
	createStoryboardVideosFromConnection: vi.fn(),
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasUI: () => ({ selectedElements: mocks.selectedElements }),
}))

vi.mock("../../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({ videoModelList: mocks.videoModelList }),
}))

vi.mock("../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("../../../../runtime/interaction/connection/imageVideoBatchCreation", () => ({
	canCreateStoryboardVideosFromConnection: mocks.canCreateStoryboardVideosFromConnection,
	createStoryboardVideosFromConnection: mocks.createStoryboardVideosFromConnection,
}))

vi.mock("../../../../runtime/interaction/storyboard/storyboardOutputFrame", () => ({
	isStoryboardOutputFrame: mocks.isStoryboardOutputFrame,
}))

describe("StoryboardVideoBatchButton", () => {
	beforeEach(() => {
		mocks.canvas.can.mockReturnValue(true)
		mocks.selectedElements = [{ id: "output-frame", type: ElementTypeEnum.Frame }]
		mocks.isStoryboardOutputFrame.mockReturnValue(true)
		mocks.canCreateStoryboardVideosFromConnection.mockReturnValue(true)
		mocks.createStoryboardVideosFromConnection.mockClear()
	})

	it("creates the same storyboard video group as the connection menu", () => {
		render(<StoryboardVideoBatchButton />)

		const button = screen.getByTitle("整组执行")
		expect(button).not.toHaveAttribute("aria-disabled", "true")
		fireEvent.click(button)

		expect(mocks.createStoryboardVideosFromConnection).toHaveBeenCalledWith({
			canvas: mocks.canvas,
			origin: { kind: "element", elementId: "output-frame", side: "right" },
			videoModelList: mocks.videoModelList,
		})
	})

	it("disables execution when the current frame cannot create storyboard videos", () => {
		mocks.canCreateStoryboardVideosFromConnection.mockReturnValue(false)
		render(<StoryboardVideoBatchButton />)

		const button = screen.getByTitle("整组执行")
		expect(button.className).toContain("disabled")
		fireEvent.click(button)

		expect(mocks.createStoryboardVideosFromConnection).not.toHaveBeenCalled()
	})
})
