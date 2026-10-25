import type { PropsWithChildren } from "react"
import { fireEvent, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Tools from "../index"

const mocks = vi.hoisted(() => ({
	createAudioAtCenter: vi.fn(),
	createImageAtCenter: vi.fn(),
	createVideoAtCenter: vi.fn(),
}))

vi.mock("../../primitives/shadcn/tooltip", () => ({
	Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
	TooltipTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
	TooltipContent: ({ children }: PropsWithChildren) => <>{children}</>,
}))

vi.mock("@radix-ui/react-tooltip", () => ({
	Portal: ({ children }: PropsWithChildren) => <>{children}</>,
	Arrow: () => null,
}))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: null }),
}))

vi.mock("@/components/business/MemberDepartmentSelector", () => ({
	default: () => null,
}))

vi.mock("@/apis", () => ({
	AssetsApi: {
		getAssetOwners: vi.fn().mockResolvedValue([]),
		queryAssets: vi.fn().mockResolvedValue({ list: [] }),
	},
}))

vi.mock("../../primitives/custom/IconButton/index", () => ({
	default: ({ children, onClick }: PropsWithChildren<{ onClick?: () => void }>) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}))

vi.mock("../../primitives/custom/PortalContainerContext", () => ({
	usePortalContainer: () => null,
}))

vi.mock("../../../app/providers/LayersUIProvider", () => ({
	useLayersUI: () => ({ collapsed: true, width: 0, transitionAnimation: "none" }),
}))

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useOptionalCanvas: () => null,
	useCanvas: () => ({
		canvas: {
			can: vi.fn(() => true),
			toolManager: {
				getAudioGeneratorTool: () => ({
					createAudioAtCenter: mocks.createAudioAtCenter,
				}),
				getImageGeneratorTool: () => ({
					createImageAtCenter: mocks.createImageAtCenter,
				}),
				getVideoGeneratorTool: () => ({
					createVideoAtCenter: mocks.createVideoAtCenter,
				}),
				setActiveToolByType: vi.fn(),
				setActiveTool: vi.fn(),
			},
		},
	}),
}))

vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

vi.mock("../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({ imageModelList: [], videoModelList: [], permissions: {} }),
}))

vi.mock("../../../app/hooks/canvas", () => ({
	useCanvasEvent: vi.fn(),
	useCanvasEventOnce: vi.fn(),
}))

vi.mock("../ToolItemWithPopover", () => ({ default: () => null }))
vi.mock("../PluginTool", () => ({ default: () => null }))

describe("CanvasDesign toolbar", () => {
	beforeEach(() => {
		mocks.createAudioAtCenter.mockClear()
		mocks.createImageAtCenter.mockClear()
		mocks.createVideoAtCenter.mockClear()
	})

	it("creates one empty audio node when the audio generator button is clicked", () => {
		const { container } = render(<Tools />)
		const audioButton = container.querySelector(".lucide-mic")?.closest("button")

		expect(audioButton).toBeTruthy()
		if (!audioButton) throw new Error("Audio generator button was not rendered")
		fireEvent.click(audioButton)

		expect(mocks.createAudioAtCenter).toHaveBeenCalledTimes(1)
		expect(mocks.createImageAtCenter).not.toHaveBeenCalled()
		expect(mocks.createVideoAtCenter).not.toHaveBeenCalled()
	})

	it("opens the empty material library modal when its toolbar button is clicked", async () => {
		const { container } = render(<Tools />)
		const assetsButton = container.querySelector(".lucide-users-round")?.closest("button")

		expect(assetsButton).toBeTruthy()
		if (!assetsButton) throw new Error("Assets button was not rendered")
		expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument()

		fireEvent.click(assetsButton)

		expect(document.querySelector('[role="dialog"]')).toBeInTheDocument()
		expect(document.querySelector('[data-testid="assets-modal"]')).toBeInTheDocument()
		await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeInTheDocument())

		const closeButton = document.querySelector('[data-slot="dialog-close"]')
		expect(closeButton).toBeTruthy()
		if (!closeButton) throw new Error("Material library close button was not rendered")
		expect(document.activeElement).not.toBe(closeButton)
		fireEvent.click(closeButton)
		await waitFor(() =>
			expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument(),
		)
	})
})
