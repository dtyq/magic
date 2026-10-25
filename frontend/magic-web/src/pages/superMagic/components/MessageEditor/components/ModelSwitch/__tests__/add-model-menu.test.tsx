import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ModelSwitch from "../index"

const { addModelStore } = vi.hoisted(() => ({
	addModelStore: {
		myModels: [] as Array<{ model_type: number; category?: string }>,
		isLoadingMyModels: false,
		hasLoadedMyModels: true,
		loadMyModels: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			isPersonalOrganization: true,
		},
	},
}))

vi.mock("../components/AddModel/context", () => ({
	useOptionalAddModelStore: () => addModelStore,
}))

vi.mock("../hooks/useModelSwitchLogic", () => ({
	useModelSwitchLogic: () => ({
		isOpen: true,
		searchKeyword: "",
		setSearchKeyword: vi.fn(),
		isMobile: false,
		selectedItemRef: { current: null },
		desktopScrollContainerRef: { current: null },
		mobileScrollContainerRef: { current: null },
		handleModelClick: vi.fn(),
		handleClose: vi.fn(),
		handleOpenChange: vi.fn(),
		getModelDescription: vi.fn(),
	}),
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: ({
		children,
		open,
		onOpenChange,
		popupRender,
	}: {
		children: React.ReactNode
		open?: boolean
		onOpenChange?: (open: boolean) => void
		popupRender?: () => React.ReactNode
	}) => (
		<div>
			<div data-testid="add-model-menu-trigger" onClick={() => onOpenChange?.(!open)}>
				{children}
			</div>
			{open ? popupRender?.() : null}
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/tooltip", () => ({
	TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@radix-ui/react-tooltip", () => ({
	Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../components/ModelListContent", () => ({
	ModelListContent: () => <div data-testid="model-list-content" />,
}))

vi.mock("../components/ModelSwitchTriggerContent", () => ({
	ModelSwitchTriggerContent: () => null,
}))

vi.mock("../components/ModelTabSwitcher", () => ({
	ModelTabSwitcher: ({
		showImageTab,
		showVideoTab,
		onTabChange,
	}: {
		showImageTab?: boolean
		showVideoTab?: boolean
		onTabChange: (tab: "image" | "video") => void
	}) => (
		<div>
			{showImageTab && (
				<button type="button" onClick={() => onTabChange("image")}>
					Image tab
				</button>
			)}
			{showVideoTab && (
				<button type="button" onClick={() => onTabChange("video")}>
					Video tab
				</button>
			)}
		</div>
	),
}))

vi.mock("../components/ModelPreferenceTooltip", () => ({
	ModelPreferenceTooltip: () => null,
}))

describe("ModelSwitch add model menu", () => {
	beforeEach(() => {
		addModelStore.myModels = []
		addModelStore.isLoadingMyModels = false
		addModelStore.hasLoadedMyModels = true
		addModelStore.loadMyModels.mockReset()
	})

	it("opens the video model form from the custom model menu", () => {
		const onAddModel = vi.fn()

		render(<ModelSwitch modelList={[]} onAddModel={onAddModel} />)

		fireEvent.click(screen.getByTestId("add-model-menu-trigger"))
		fireEvent.click(screen.getByTestId("add-model-type-video"))

		expect(onAddModel).toHaveBeenCalledWith("video")
	})

	it("keeps the image tab available when only a custom image model exists", () => {
		// 分页按 category 判断，model_type 不可靠（vlm 可能返回 1）。
		addModelStore.myModels = [{ model_type: 1, category: "vlm" }]

		render(<ModelSwitch modelList={[]} onAddModel={vi.fn()} />)

		fireEvent.click(screen.getByRole("button", { name: "Image tab" }))

		expect(screen.getByTestId("model-list-content")).toBeInTheDocument()
	})

	it("keeps the video tab available when only a custom video model exists", () => {
		addModelStore.myModels = [{ model_type: 5, category: "vgm" }]

		render(<ModelSwitch modelList={[]} onAddModel={vi.fn()} />)

		fireEvent.click(screen.getByRole("button", { name: "Video tab" }))

		expect(screen.getByTestId("model-list-content")).toBeInTheDocument()
	})

	it("does not count custom models without a category for the image or video tab", () => {
		// 缺少 category 的模型不归入任何分页，生图、视频分页不会因为它出现。
		addModelStore.myModels = [{ model_type: 0 }, { model_type: 5 }]

		render(<ModelSwitch modelList={[]} />)

		expect(screen.queryByRole("button", { name: "Image tab" })).toBeNull()
		expect(screen.queryByRole("button", { name: "Video tab" })).toBeNull()
	})
})
