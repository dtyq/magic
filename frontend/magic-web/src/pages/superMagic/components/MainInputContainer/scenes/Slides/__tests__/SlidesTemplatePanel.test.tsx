import { useMemo, useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import {
	SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT,
	SLIDES_TEMPLATE_RANDOM_DRAG_TYPE,
} from "../../../constants"
import { getPromptRichTextPlainText } from "../../../panels/promptRichText"
import type { OptionItem } from "../../../panels/types"
import { ScenePanelVariant } from "../../../components/LazyScenePanel/types"
import SlidesTemplatePanel from "../SlidesTemplatePanel"
import SlidesTemplatePanelContent from "../SlidesTemplatePanelContent"
import SlidesTemplateHomeSelectionPreview from "../SlidesTemplateHomeSelectionPreview"
import {
	createSlidesTemplateCategoryGroupKey,
	createSlidesTemplateTagGroupKey,
	createSlidesPresetPanelConfig,
	type SlidesTemplateCategoryItem,
	type SlidesTemplateItem,
	type SlidesTemplateTagGroupItem,
} from "../slidesTemplateState"
import type { SlidesTemplatePanelState } from "../useSlidesTemplatePanelState"

const apiMock = vi.hoisted(() => ({
	getSlidesTemplateCategories: vi.fn(),
	getSlidesTemplateTagGroups: vi.fn(),
	getSlidesTemplateCount: vi.fn(),
	getSlidesTemplateDetail: vi.fn(),
	getSlidesTemplates: vi.fn(),
}))

const sceneStateStoreMock = vi.hoisted(() => ({
	inputScopeKey: "",
	sendCount: 0,
}))

const useResolvedTemplateColorsMock = vi.hoisted(() =>
	vi.fn(({ colors }: { colors?: string[] }) =>
		colors?.length ? colors : ["#315ECA", "#7AA7FF", "#182A5A"],
	),
)

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false))
const useFinePointerHoverMock = vi.hoisted(() => vi.fn(() => false))
const toastMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: apiMock,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: string }) =>
			key === "playbook.edit.presets.templateCount"
				? `${options?.count} 套`
				: key === "ppt.templateReplacement.title"
					? "选择 PPT 模板"
					: key === "playbook.edit.presets.unselected"
						? "Not selected"
						: key,
		i18n: { language: "en_US" },
	}),
}))

vi.mock("i18next", () => ({
	default: {
		language: "en_US",
		resolvedLanguage: "en_US",
		t: (key: string) => key,
	},
	t: (key: string) => key,
}))

vi.mock("../../../stores", () => ({
	useOptionalSceneStateStore: () => sceneStateStoreMock,
}))

vi.mock("@/pages/superMagic/pages/SlidesTemplates/useResolvedTemplateColors", () => ({
	useResolvedTemplateColors: useResolvedTemplateColorsMock,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: useIsMobileMock,
}))

vi.mock("../../../panels/slides-preset/useFinePointerHover", () => ({
	useFinePointerHover: useFinePointerHoverMock,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: toastMock,
}))

const businessCategory: SlidesTemplateCategoryItem = {
	id: "1",
	code: "PPT-CATE-business",
	name_i18n: {
		zh_CN: "商务",
		en_US: "Business",
	},
	sort: 100,
	template_count: 1,
	is_official: true,
}

const businessTemplate: SlidesTemplateItem = {
	code: "PPT-business",
	source_type: "OFFICIAL",
	category_code: businessCategory.code,
	label: {
		zh_CN: "商务模板",
		en_US: "Business Template",
	},
	description: {
		zh_CN: "商务模板描述",
		en_US: "Business template description",
	},
	thumbnail_url: "https://example.com/business.png",
	sort: 100,
	is_official: true,
}

function createSlidesTemplatePanelContentState(
	overrides: Partial<SlidesTemplatePanelState> = {},
): SlidesTemplatePanelState {
	return {
		groups: [],
		hasAnyTemplate: true,
		hasCheckedAnyTemplate: true,
		hasMore: false,
		isPrimaryFilterLoading: false,
		isTagFilterLoading: false,
		isLoading: false,
		isRefreshing: false,
		isLoadingMore: false,
		isLoadMoreFailed: false,
		keyword: "",
		loadedTemplateCount: 0,
		loadMore: vi.fn(),
		loadTemplateDetail: vi.fn(),
		retryLoadMore: vi.fn(),
		selectedCategoryCode: undefined,
		selectedChildTagCodes: [],
		selectedGroupKey: "all",
		setKeyword: vi.fn(),
		setSelectedChildTagCodes: vi.fn(),
		setSelectedGroupKey: vi.fn(),
		tagGroups: [],
		templateOptions: [],
		total: 0,
		myTemplatesEmptyStatus: null,
		myTemplatesActiveSection: "created",
		setMyTemplatesActiveSection: vi.fn(),
		retryMyTemplates: vi.fn(),
		favoritePendingCodes: new Set(),
		removeTemplate: vi.fn(async () => undefined),
		toggleTemplateFavorite: vi.fn(async () => undefined),
		...overrides,
	}
}

describe("SlidesTemplatePanel", () => {
	beforeAll(() => {
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(() => ({
				disconnect: vi.fn(),
				observe: vi.fn(),
				unobserve: vi.fn(),
			})),
		)
	})

	beforeEach(() => {
		vi.clearAllMocks()
		useIsMobileMock.mockReturnValue(false)
		useFinePointerHoverMock.mockReturnValue(false)
		sceneStateStoreMock.inputScopeKey = ""
		sceneStateStoreMock.sendCount = 0
		vi.mocked(SuperMagicApi.getSlidesTemplateCategories).mockResolvedValue({
			page: 1,
			page_size: 200,
			total: 1,
			list: [businessCategory],
		})
		vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([])
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 20,
			total: 1,
			list: [businessTemplate],
		})
	})

	afterAll(() => {
		vi.unstubAllGlobals()
	})

	it("renders groups, toggles search, and writes preset content after selecting a template", async () => {
		const handlePresetContentChange = vi.fn()

		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				onPresetContentChange={handlePresetContentChange}
			/>,
		)

		await waitFor(() =>
			expect(screen.getByTestId("template-group-selector-option-all")).toBeInTheDocument(),
		)
		expect(screen.queryByTestId("slides-template-search-input")).not.toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-template-search-toggle"))
		const searchInput = await screen.findByTestId("slides-template-search-input")
		expect(searchInput).toBeInTheDocument()
		fireEvent.change(searchInput, { target: { value: "business" } })
		expect(searchInput).toHaveValue("business")
		fireEvent.click(screen.getByTestId("slides-template-search-toggle"))
		expect(screen.queryByTestId("slides-template-search-input")).not.toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-template-search-toggle"))
		expect(await screen.findByTestId("slides-template-search-input")).toHaveValue("")
		await screen.findByText("Business Template")
		await waitFor(() =>
			expect(
				screen.getByTestId(
					`template-group-selector-option-${createSlidesTemplateCategoryGroupKey(
						businessCategory.code,
					)}`,
				),
			).toBeInTheDocument(),
		)

		act(() => {
			fireEvent.click(screen.getByText("Business Template"))
		})

		await waitFor(() => {
			const contentCalls = handlePresetContentChange.mock.calls.filter(([content]) =>
				Boolean(content),
			)
			const lastContent = contentCalls.at(-1)?.[0] as JSONContent | undefined
			expect(getPromptRichTextPlainText(lastContent)).toBe(
				"Use slide template: Business Template (PPT-business), Size: 16:9, Language: auto.",
			)
		})
	})

	it("shows the template count instead of the selected template name", async () => {
		render(<SlidesTemplatePanel config={createSlidesPresetPanelConfig([])} />)

		const count = await screen.findByTestId("slides-template-panel-template-count")
		expect(count).toHaveTextContent("1 套")
		fireEvent.click(await screen.findByText("Business Template"))

		expect(count).toHaveTextContent("1 套")
		expect(screen.queryByTestId("slides-template-panel-template-clear-button")).toBeNull()
	})

	it("sets template defaults and clears page, size, and language with the template", async () => {
		const handlePresetContentChange = vi.fn()
		let handleFilterChange: ((filterId: string, value: string) => void) | null = null
		const selectedTemplate = {
			value: businessTemplate.code,
			label: businessTemplate.label,
			preset_value: {
				zh_CN: `商务模板（${businessTemplate.code}）`,
				en_US: `Business Template (${businessTemplate.code})`,
			},
			thumbnail_url: businessTemplate.thumbnail_url ?? undefined,
		}
		const { rerender } = render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				selectedTemplate={selectedTemplate}
				onFilterChangeRequestChange={(handler) => {
					handleFilterChange = handler
				}}
				onPresetContentChange={handlePresetContentChange}
			/>,
		)

		await waitFor(() => {
			const contentCalls = handlePresetContentChange.mock.calls.filter(([content]) =>
				Boolean(content),
			)
			const lastContent = contentCalls.at(-1)?.[0] as JSONContent | undefined
			expect(getPromptRichTextPlainText(lastContent)).toBe(
				"Use slide template: Business Template (PPT-business), Size: 16:9, Language: auto.",
			)
		})

		act(() => {
			handleFilterChange?.("pages", "6-10")
		})
		await waitFor(() => {
			const lastContent = handlePresetContentChange.mock.calls.at(-1)?.[0] as
				JSONContent | undefined
			expect(getPromptRichTextPlainText(lastContent)).toContain("Pages: 6-10")
		})

		rerender(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				selectedTemplate={null}
				onFilterChangeRequestChange={(handler) => {
					handleFilterChange = handler
				}}
				onPresetContentChange={handlePresetContentChange}
			/>,
		)

		await waitFor(() => {
			const lastContent = handlePresetContentChange.mock.calls.at(-1)?.[0] as
				JSONContent | undefined
			expect(lastContent).toBeUndefined()
		})
	})

	it("shows selected page, size, and language values in the home selection preview", () => {
		render(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "woodland", label: "Woodland Storybook" }}
				filters={[
					{
						data_key: "pages",
						label: "页数",
						current_value: "6-10",
						options: [{ value: "6-10", label: "6-10" }],
					},
					{
						data_key: "size",
						label: "尺寸",
						current_value: "16:9",
						options: [{ value: "16:9", label: "16:9" }],
					},
					{
						data_key: "language",
						label: "语言",
						current_value: "zh",
						options: [{ value: "zh", label: "中文" }],
					},
				]}
				onClear={vi.fn()}
				onFilterChange={vi.fn()}
			/>,
		)

		expect(screen.getByText("页数")).toBeInTheDocument()
		expect(screen.getByText("6-10")).toBeInTheDocument()
		expect(screen.getByText("尺寸")).toBeInTheDocument()
		expect(screen.getByText("16:9")).toBeInTheDocument()
		expect(screen.getByText("语言")).toBeInTheDocument()
		expect(screen.getByText("中文")).toBeInTheDocument()
		expect(
			screen.getByTestId("slides-template-home-replace-selected-template"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("slides-template-home-clear-selected-template"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("slides-template-home-selected-template").children[1],
		).toHaveClass("md:ml-auto")

		fireEvent.click(screen.getByTestId("slides-template-home-preview-selected-template"))
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
	})

	it("resolves selected template colors from its cover when API colors are missing", () => {
		render(
			<SlidesTemplateHomeSelectionPreview
				template={{
					value: "woodland",
					label: "Woodland Storybook",
					thumbnail_url: "https://example.com/woodland.png",
				}}
				filters={[]}
				onFilterChange={vi.fn()}
			/>,
		)

		expect(useResolvedTemplateColorsMock).toHaveBeenLastCalledWith({
			colors: undefined,
			enabled: true,
			imageUrl: "https://example.com/woodland.png",
			priority: "interactive",
		})
		expect(screen.getByTitle("#315ECA")).toHaveStyle({ backgroundColor: "#315ECA" })
		expect(screen.getByTitle("#7AA7FF")).toHaveStyle({ backgroundColor: "#7AA7FF" })
		expect(screen.getByTitle("#182A5A")).toHaveStyle({ backgroundColor: "#182A5A" })
	})

	it("keeps template actions visible on touch-first devices", () => {
		useFinePointerHoverMock.mockReturnValue(false)

		render(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "woodland", label: "Woodland Storybook" }}
				filters={[]}
				onClear={vi.fn()}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={vi.fn()}
			/>,
		)

		const actions = screen.getByTestId("slides-template-home-actions")
		expect(actions).toHaveAttribute("data-interaction-mode", "touch")
		expect(actions).toHaveClass("opacity-100")
		expect(actions).not.toHaveClass("pointer-events-none")
	})

	it("opens preview directly from the thumbnail on the home page", () => {
		render(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "woodland", label: "Woodland Storybook" }}
				filters={[]}
				onClear={vi.fn()}
				onFilterChange={vi.fn()}
				showTemplateActions={false}
			/>,
		)

		expect(screen.queryByTestId("slides-template-home-actions")).toBeNull()
		expect(screen.queryByTestId("slides-template-home-replace-selected-template")).toBeNull()

		fireEvent.click(screen.getByTestId("slides-template-home-preview-selected-template"))
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
	})

	it("shows the AI automatic template placeholder when no template is selected", async () => {
		render(<SlidesTemplateHomeSelectionPreview filters={[]} onFilterChange={vi.fn()} />)

		expect(
			screen.getByText("playbook.edit.presets.form.autoSelectTemplate"),
		).toBeInTheDocument()
		expect(screen.getByText("playbook.edit.presets.form.autoSelectTemplate")).toHaveClass(
			"whitespace-normal",
		)
		expect(screen.getByTestId("slides-template-ai-visual")).toBeInTheDocument()
		expect(screen.queryByTestId("slides-template-home-clear-selected-template")).toBeNull()

		render(
			<SlidesTemplateHomeSelectionPreview
				filters={[]}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={vi.fn()}
				compactLayout
			/>,
		)
		const chooseTemplateButton = screen
			.getAllByTestId("slides-template-home-choose-template")
			.at(-1)
		expect(chooseTemplateButton).toBeDefined()
		expect(chooseTemplateButton).toHaveClass("md:h-11")
		expect(chooseTemplateButton?.querySelector("p")).toHaveClass("md:whitespace-nowrap")
		expect(chooseTemplateButton?.parentElement).toHaveClass("md:flex-none")
		expect(
			chooseTemplateButton?.closest('[data-testid="slides-template-home-selected-template"]'),
		).toHaveClass("md:flex-nowrap")
		expect(
			chooseTemplateButton?.closest('[data-testid="slides-template-home-selected-template"]'),
		).not.toHaveClass("md:justify-center")
		expect(
			chooseTemplateButton?.closest('[data-testid="slides-template-home-selected-template"]')
				?.children[1],
		).toHaveClass("md:ml-auto")
		expect(chooseTemplateButton).toHaveTextContent(
			"playbook.edit.presets.form.selectOrAutoSelectTemplate",
		)
		expect(chooseTemplateButton).toHaveAttribute("aria-haspopup", "dialog")
		fireEvent.click(chooseTemplateButton)
		expect(screen.getByRole("dialog")).toHaveTextContent("选择 PPT 模板")
	})

	it("highlights the template area and requests a random template on drop", () => {
		const handleRandomTemplateRequest = vi.fn()
		render(
			<SlidesTemplateHomeSelectionPreview
				filters={[]}
				onFilterChange={vi.fn()}
				onRandomTemplateRequest={handleRandomTemplateRequest}
			/>,
		)

		const dropTarget = screen.getByTestId("slides-template-home-selected-template")
		const dataTransfer = {
			dropEffect: "none",
			types: [SLIDES_TEMPLATE_RANDOM_DRAG_TYPE],
		}

		act(() => window.dispatchEvent(new Event(SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT)))
		expect(dropTarget).toHaveAttribute("data-random-drag-active", "true")
		expect(screen.getByTestId("slides-template-random-drag-feedback")).toHaveClass(
			"border-dashed",
		)
		fireEvent.dragEnter(dropTarget, { dataTransfer })
		expect(dropTarget).toHaveAttribute("data-random-drop-active", "true")
		expect(screen.getByTestId("slides-template-random-drag-feedback")).toHaveClass(
			"border-violet-500",
		)
		fireEvent.dragOver(dropTarget, { dataTransfer })
		expect(dataTransfer.dropEffect).toBe("copy")
		fireEvent.drop(dropTarget, { dataTransfer })

		expect(handleRandomTemplateRequest).toHaveBeenCalledTimes(1)
		expect(dropTarget).toHaveAttribute("data-random-drag-active", "false")
		expect(dropTarget).toHaveAttribute("data-random-drop-active", "false")
	})

	it("requests a random template from the home action button", () => {
		const handleRandomTemplateRequest = vi.fn()
		render(
			<SlidesTemplateHomeSelectionPreview
				filters={[]}
				onFilterChange={vi.fn()}
				onRandomTemplateRequest={handleRandomTemplateRequest}
			/>,
		)

		const randomButton = screen.getByTestId("slides-template-home-random-template")
		expect(randomButton.previousElementSibling).not.toHaveClass("flex-1")
		fireEvent.click(randomButton)

		expect(handleRandomTemplateRequest).toHaveBeenCalledTimes(1)
	})

	it("selects a random loaded template through the registered request handler", async () => {
		const handleTemplateSelect = vi.fn()
		let requestRandomTemplate: (() => void) | null = null
		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				onRandomTemplateRequestChange={(handler) => {
					requestRandomTemplate = handler
				}}
				onTemplateSelect={handleTemplateSelect}
			/>,
		)

		await screen.findByText("Business Template")
		await waitFor(() => expect(requestRandomTemplate).toBeTypeOf("function"))
		act(() => requestRandomTemplate?.())

		await waitFor(() =>
			expect(handleTemplateSelect).toHaveBeenCalledWith(
				expect.objectContaining({
					value: businessTemplate.code,
				}),
			),
		)
	})

	it("opens the template picker dialog from the selected template hover action", async () => {
		useFinePointerHoverMock.mockReturnValue(true)
		const handleClear = vi.fn()
		const handleTemplatePickerContainerChange = vi.fn()
		const handleTemplatePickerOpenChange = vi.fn()
		const { rerender } = render(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "woodland", label: "Woodland Storybook" }}
				filters={[]}
				onClear={handleClear}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={handleTemplatePickerContainerChange}
				templatePickerOpen={false}
				onTemplatePickerOpenChange={handleTemplatePickerOpenChange}
			/>,
		)

		const replaceButton = screen.getByTestId("slides-template-home-replace-selected-template")
		expect(replaceButton).toHaveAttribute("aria-expanded", "false")
		fireEvent.pointerEnter(screen.getByTestId("slides-template-home-thumbnail"))
		fireEvent.click(replaceButton)

		expect(handleTemplatePickerOpenChange).toHaveBeenCalledWith(true)
		rerender(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "woodland", label: "Woodland Storybook" }}
				filters={[]}
				onClear={handleClear}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={handleTemplatePickerContainerChange}
				templatePickerOpen
				onTemplatePickerOpenChange={handleTemplatePickerOpenChange}
			/>,
		)

		expect(
			screen.getByTestId("slides-template-home-replace-selected-template"),
		).toHaveAttribute("aria-expanded", "true")
		expect(screen.getByRole("dialog")).toHaveTextContent("选择 PPT 模板")
		expect(handleClear).not.toHaveBeenCalled()
		await waitFor(() =>
			expect(handleTemplatePickerContainerChange).toHaveBeenCalledWith(
				expect.any(HTMLDivElement),
			),
		)
		const thumbnail = screen.getByTestId("slides-template-home-thumbnail")

		rerender(
			<SlidesTemplateHomeSelectionPreview
				template={{ value: "business", label: "Business Template" }}
				filters={[]}
				onClear={handleClear}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={handleTemplatePickerContainerChange}
				templatePickerOpen={false}
				onTemplatePickerOpenChange={handleTemplatePickerOpenChange}
			/>,
		)

		await waitFor(() => expect(replaceButton).toHaveAttribute("aria-expanded", "false"))
		expect(screen.getByTestId("slides-template-home-actions")).toHaveClass(
			"pointer-events-none",
			"opacity-0",
		)

		fireEvent.pointerLeave(thumbnail)
		fireEvent.pointerEnter(thumbnail)
		expect(screen.getByTestId("slides-template-home-actions")).not.toHaveClass(
			"pointer-events-none",
		)
	})

	it("hides the topic template selector and portals its live dropdown content", async () => {
		const templatePickerContainer = document.createElement("div")
		document.body.append(templatePickerContainer)
		const { unmount } = render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.TopicPage}
				hideTemplateSelector
				templatePickerContainer={templatePickerContainer}
			/>,
		)

		expect(screen.queryByTestId("slides-template-floating-selector-trigger")).toBeNull()
		expect(await screen.findByTestId("slides-preset-grid")).toHaveClass("2xl:!grid-cols-4")
		unmount()
		templatePickerContainer.remove()
	})

	it("keeps the project template picker open while a nested preview is active", () => {
		const { rerender } = render(
			<SlidesTemplateHomeSelectionPreview
				filters={[]}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={vi.fn()}
				isTemplatePreviewOpen
			/>,
		)

		const pickerTrigger = screen.getByTestId("slides-template-home-choose-template")
		fireEvent.click(pickerTrigger)
		expect(pickerTrigger).toHaveAttribute("aria-expanded", "true")

		fireEvent.keyDown(document, { key: "Escape" })
		expect(pickerTrigger).toHaveAttribute("aria-expanded", "true")

		rerender(
			<SlidesTemplateHomeSelectionPreview
				filters={[]}
				onFilterChange={vi.fn()}
				onTemplatePickerContainerChange={vi.fn()}
				isTemplatePreviewOpen={false}
			/>,
		)
		fireEvent.keyDown(document, { key: "Escape" })
		expect(pickerTrigger).toHaveAttribute("aria-expanded", "false")
	})

	it("shows only the template list in the home panel", async () => {
		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.HomePage}
			/>,
		)

		const toolbar = await screen.findByTestId("slides-template-panel-toolbar")
		expect(toolbar).toHaveClass("sticky", "top-0", "z-50", "bg-background/95", "backdrop-blur")
		const grid = screen.getByTestId("slides-preset-grid")
		expect(grid).toHaveClass("overflow-y-visible", "overscroll-y-auto")
		expect(grid).not.toHaveClass("overflow-y-auto", "overscroll-y-contain")
		expect(screen.queryByTestId("slides-template-panel-template-count")).toBeNull()
	})

	it("opens My templates from the home category selector", async () => {
		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.HomePage}
			/>,
		)

		const myTemplatesTab = await screen.findByTestId(
			"template-group-selector-option-__my_slides_templates__",
		)
		Object.assign(myTemplatesTab, { scrollIntoView: vi.fn() })
		fireEvent.click(myTemplatesTab)

		expect(await screen.findByTestId("my-slides-templates-unavailable")).toBeInTheDocument()
		expect(myTemplatesTab).toHaveAttribute("aria-pressed", "true")
	})

	it("does not render when there are no templates", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 20,
			total: 0,
			list: [],
		})

		const { container } = render(
			<SlidesTemplatePanel config={createSlidesPresetPanelConfig([])} />,
		)

		await waitFor(() => expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalled())
		await waitFor(() => expect(container).toBeEmptyDOMElement())
	})

	it("does not render when the first page list is empty even if total is non-zero", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 20,
			total: 1,
			list: [],
		})

		const { container } = render(
			<SlidesTemplatePanel config={createSlidesPresetPanelConfig([])} />,
		)

		await waitFor(() => expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalled())
		await waitFor(() => expect(container).toBeEmptyDOMElement())
	})

	it("keeps topic page selector compact and opens shared template content in a floating panel", async () => {
		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.TopicPage}
			/>,
		)

		const trigger = await screen.findByTestId("slides-template-floating-selector-trigger")
		expect(trigger).toBeInTheDocument()
		expect(screen.queryByTestId("slides-template-search-input")).not.toBeInTheDocument()

		fireEvent.pointerDown(trigger)
		fireEvent.click(trigger)

		expect(await screen.findByTestId("slides-template-search-toggle")).toBeInTheDocument()
		expect(
			screen.getByTestId("template-group-selector-option-__my_slides_templates__"),
		).toBeInTheDocument()
		expect(screen.queryByTestId("slides-template-search-input")).not.toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-template-search-toggle"))
		expect(await screen.findByTestId("slides-template-search-input")).toBeInTheDocument()
		await screen.findByText("Business Template")
		fireEvent.click(screen.getByText("Business Template"))

		expect(trigger).toHaveTextContent("Business Template")
		expect(trigger).not.toHaveTextContent("101,582 套")
	})

	it("keeps the template picker dialog open while changing a desktop tag filter", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([
			{
				id: "style-group",
				code: "style_group",
				name_i18n: { zh_CN: "视觉风格", en_US: "Style" },
				sort: 100,
				tags: [
					{
						id: "business-style",
						code: "style-business",
						name_i18n: { zh_CN: "商务", en_US: "Business" },
						sort: 100,
						template_count: 1,
						is_official: true,
					},
				],
			},
		])

		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.TopicPage}
			/>,
		)

		const pickerTrigger = await screen.findByTestId("slides-template-floating-selector-trigger")
		act(() => {
			fireEvent.pointerDown(pickerTrigger)
			fireEvent.click(pickerTrigger)
		})

		const tagTrigger = await screen.findByTestId(
			"slides-template-tag-group-trigger-style_group",
		)
		expect(tagTrigger).toHaveAttribute("data-overlay-interaction-scopes")

		act(() => {
			fireEvent.keyDown(tagTrigger, { key: "Enter" })
		})
		const tagOption = await screen.findByTestId("slides-template-tag-option-style-business")
		await act(async () => {
			fireEvent.click(tagOption)
			await Promise.resolve()
		})

		await waitFor(() => {
			expect(screen.getByTestId("slides-template-search-toggle")).toBeInTheDocument()
			expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull()
		})
	})

	it("发送后再次选择模板时不会被旧的发送状态清空", async () => {
		function ControlledTopicTemplatePanel() {
			const [selectedTemplate, setSelectedTemplate] = useState<OptionItem | null>(null)
			const config = useMemo(() => createSlidesPresetPanelConfig([]), [])

			return (
				<SlidesTemplatePanel
					config={config}
					variant={ScenePanelVariant.TopicPage}
					selectedTemplate={selectedTemplate}
					onTemplateSelect={(template) => setSelectedTemplate(template)}
				/>
			)
		}

		const { rerender } = render(<ControlledTopicTemplatePanel />)
		const trigger = await screen.findByTestId("slides-template-floating-selector-trigger")

		// 模拟一次已完成发送，面板应清空当次选择。
		sceneStateStoreMock.sendCount = 1
		rerender(<ControlledTopicTemplatePanel />)

		fireEvent.pointerDown(trigger)
		fireEvent.click(trigger)
		fireEvent.click(await screen.findByText("Business Template"))

		await waitFor(() => expect(trigger).toHaveTextContent("Business Template"))
	})

	it("clears controlled template selection when the input scope changes", async () => {
		function ControlledTopicTemplatePanel() {
			const [selectedTemplate, setSelectedTemplate] = useState<OptionItem | null>({
				value: businessTemplate.code,
				label: businessTemplate.label,
			})
			const config = useMemo(() => createSlidesPresetPanelConfig([]), [])

			return (
				<SlidesTemplatePanel
					config={config}
					variant={ScenePanelVariant.TopicPage}
					selectedTemplate={selectedTemplate}
					onTemplateSelect={setSelectedTemplate}
				/>
			)
		}

		const { rerender } = render(<ControlledTopicTemplatePanel />)
		const trigger = await screen.findByTestId("slides-template-floating-selector-trigger")
		expect(trigger).toHaveTextContent("Business Template")

		sceneStateStoreMock.inputScopeKey = "ppt\u001etopic-b\u001e"
		rerender(<ControlledTopicTemplatePanel />)

		await waitFor(() => expect(trigger).not.toHaveTextContent("Business Template"))
	})

	it("keeps mobile compact selector and filters on the same row", async () => {
		render(
			<SlidesTemplatePanel
				config={createSlidesPresetPanelConfig([])}
				variant={ScenePanelVariant.Mobile}
				compact
			/>,
		)

		const trigger = await screen.findByTestId("slides-template-floating-selector-trigger")
		const scrollItemContainer = trigger.parentElement
		const filterTriggers = await screen.findAllByTestId("mobile-scene-panel-filter-trigger")

		expect(scrollItemContainer).toHaveClass("flex")
		expect(scrollItemContainer).not.toHaveClass("flex-col")
		expect(scrollItemContainer).not.toHaveClass("block")
		expect(filterTriggers).toHaveLength(3)
		filterTriggers.forEach((filterTrigger) => {
			expect(scrollItemContainer).toContainElement(filterTrigger)
		})

		fireEvent.click(trigger)
		const mobilePopup = await screen.findByTestId(
			"slides-template-floating-selector-mobile-popup",
		)
		const mobileCardContainer = (await screen.findByTestId("slides-preset-card")).parentElement
		const popupBody = mobilePopup.parentElement
		const drawerContent = popupBody?.parentElement

		expect(mobileCardContainer).not.toHaveAttribute("style")
		expect(mobilePopup).toHaveClass("min-h-0", "flex-1")
		expect(popupBody).toHaveClass("max-h-none", "min-h-0", "flex-1", "overflow-hidden")
		expect(drawerContent).toHaveClass(
			"h-[min(98dvh,calc(100dvh-var(--safe-area-inset-top)-0.5rem))]",
			"max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)]",
			"data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]",
		)
	})

	it("clears the selected template from the compact mobile trigger without opening the picker", async () => {
		function ControlledMobileTemplatePanel() {
			const [selectedTemplate, setSelectedTemplate] = useState<OptionItem | null>({
				value: businessTemplate.code,
				label: businessTemplate.label,
			})
			const config = useMemo(() => createSlidesPresetPanelConfig([]), [])

			return (
				<SlidesTemplatePanel
					config={config}
					variant={ScenePanelVariant.Mobile}
					compact
					selectedTemplate={selectedTemplate}
					onTemplateSelect={setSelectedTemplate}
				/>
			)
		}

		render(<ControlledMobileTemplatePanel />)

		const trigger = await screen.findByTestId("slides-template-floating-selector-trigger")
		expect(trigger).toHaveTextContent("Business Template")

		fireEvent.click(screen.getByTestId("slides-template-floating-selector-clear-button"))

		await waitFor(() => expect(trigger).not.toHaveTextContent("Business Template"))
		expect(
			screen.queryByTestId("slides-template-floating-selector-mobile-popup"),
		).not.toBeInTheDocument()
	})

	it("expands search input when keyword already exists", () => {
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({ keyword: "business" })}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("slides-template-search-input")).toHaveValue("business")
	})

	it("shows a success toast after favoriting or unfavoriting a template", async () => {
		const toggleTemplateFavorite = vi
			.fn()
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false)
		const favoriteTemplate = { ...businessTemplate, value: businessTemplate.code }
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					templateOptions: [favoriteTemplate],
					toggleTemplateFavorite,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		const favoriteButton = screen.getByTestId("slides-preset-card-favorite-button")
		fireEvent.click(favoriteButton)
		await waitFor(() =>
			expect(toastMock.success).toHaveBeenCalledWith("mySlidesTemplates.favoriteSuccess"),
		)

		fireEvent.click(favoriteButton)
		await waitFor(() =>
			expect(toastMock.success).toHaveBeenCalledWith("mySlidesTemplates.unfavoriteSuccess"),
		)
	})

	it("renders filter skeletons while filter metadata initializes", () => {
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					isPrimaryFilterLoading: true,
					isTagFilterLoading: true,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("slides-template-primary-filters-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("slides-template-tag-filters-skeleton")).toBeInTheDocument()
		expect(screen.queryByTestId("template-group-selector")).toBeNull()
		expect(screen.queryByTestId("slides-template-tag-groups")).toBeNull()
	})

	it("renders the business report category in the template selector", () => {
		const businessReportGroupKey = createSlidesTemplateCategoryGroupKey(
			"PPT-CATE-business-report",
		)
		const setSelectedGroupKey = vi.fn()
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedGroupKey: businessReportGroupKey,
					setSelectedGroupKey,
					groups: [
						{ group_key: "all", group_name: "All", children: [] },
						{ group_key: "tag:featured", group_name: "Featured", children: [] },
						{
							group_key: businessReportGroupKey,
							group_name: "Business Report",
							children: [],
						},
					],
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("template-group-selector-option-all")).toBeInTheDocument()
		expect(
			screen.getByTestId("template-group-selector-option-tag:featured"),
		).toBeInTheDocument()
		const categoryButton = screen.getByTestId(
			`template-group-selector-option-${businessReportGroupKey}`,
		)
		Object.assign(categoryButton, { scrollIntoView: vi.fn() })
		expect(categoryButton).toBeInTheDocument()
		fireEvent.click(categoryButton)
		expect(setSelectedGroupKey).toHaveBeenCalledWith("all")
	})

	it("shows My templates before Featured on the homepage selector", () => {
		const myTemplatesGroupKey = "__my_slides_templates__"
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					groups: [
						{ group_key: "all", group_name: "All", children: [] },
						{
							group_key: myTemplatesGroupKey,
							group_name: "My templates",
							children: [],
						},
						{ group_key: "tag:featured", group_name: "Featured", children: [] },
					],
				})}
				onTemplateClick={vi.fn()}
				showMyTemplates
			/>,
		)

		const myTemplatesTab = screen.getByTestId(
			`template-group-selector-option-${myTemplatesGroupKey}`,
		)
		const featuredTab = screen.getByTestId("template-group-selector-option-tag:featured")
		expect(myTemplatesTab).toContainElement(screen.getByTestId("my-slides-templates-tab-icon"))
		expect(screen.queryByTestId("my-slides-templates-section-tabs")).toBeNull()
		expect(
			myTemplatesTab.compareDocumentPosition(featuredTab) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it("keeps My templates selected when its selected entry is clicked again", () => {
		const myTemplatesGroupKey = "__my_slides_templates__"
		const setSelectedGroupKey = vi.fn()
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedGroupKey: myTemplatesGroupKey,
					setSelectedGroupKey,
					groups: [
						{ group_key: "all", group_name: "All", children: [] },
						{
							group_key: myTemplatesGroupKey,
							group_name: "My templates",
							children: [],
						},
						{ group_key: "tag:featured", group_name: "Featured", children: [] },
					],
				})}
				onTemplateClick={vi.fn()}
				showMyTemplates
			/>,
		)

		fireEvent.click(screen.getByTestId(`template-group-selector-option-${myTemplatesGroupKey}`))

		expect(setSelectedGroupKey).not.toHaveBeenCalled()
	})

	it("hides tag filters when the homepage selects My templates", () => {
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedGroupKey: "__my_slides_templates__",
					tagGroups: [
						{
							id: "style-group",
							code: "style_group",
							name_i18n: { zh_CN: "视觉风格", en_US: "Style" },
							sort: 90,
							tags: [
								{
									id: "business-style",
									code: "style-business",
									name_i18n: { zh_CN: "商务", en_US: "Business" },
									sort: 90,
									template_count: 1,
									is_official: true,
								},
							],
						},
					],
				})}
				onTemplateClick={vi.fn()}
				showMyTemplates
			/>,
		)

		const myTemplatesTab = screen.getByTestId(
			"template-group-selector-option-__my_slides_templates__",
		)
		const createdTab = screen.getByTestId("my-slides-templates-section-created")
		expect(myTemplatesTab).toHaveClass("h-9", "rounded-full")
		expect(createdTab).toHaveClass(
			"h-8",
			"rounded-lg",
			"bg-muted/60",
			"transition-none",
			"active:scale-100",
		)
		expect(screen.getByTestId("my-slides-templates-secondary-tabs")).toBeInTheDocument()
		expect(screen.getByTestId("my-slides-templates-section-favorites")).toBeInTheDocument()
		expect(screen.getByTestId("my-slides-templates-section-used")).toBeInTheDocument()
		expect(screen.queryByTestId("my-slides-templates-section-tabs")).toBeNull()
		expect(screen.queryByTestId("slides-template-category-tag-filters")).toBeNull()
		expect(screen.queryByTestId("slides-template-tag-filters-skeleton")).toBeNull()
	})

	it("confirms before removing a created template", async () => {
		const removeTemplate = vi.fn(async () => undefined)
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedGroupKey: "__my_slides_templates__",
					templateOptions: [{ value: "PPT-created", label: "Created template" }],
					removeTemplate,
				})}
				onTemplateClick={vi.fn()}
				showMyTemplates
				enableMyTemplateRemoval
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-preset-card-remove-button"))
		expect(screen.getByTestId("confirm-dialog-title")).toHaveTextContent(
			"mySlidesTemplates.removeConfirmTitle",
		)
		expect(removeTemplate).not.toHaveBeenCalled()

		fireEvent.click(screen.getByTestId("confirm-dialog-confirm"))
		await waitFor(() => expect(removeTemplate).toHaveBeenCalledWith("PPT-created"))
	})

	it("renders each tag group as a multi-select dropdown", () => {
		const setSelectedChildTagCodes = vi.fn()
		const tagGroups: SlidesTemplateTagGroupItem[] = [
			{
				id: "purpose-group",
				code: "purpose_group",
				name_i18n: { zh_CN: "用途与交付物", en_US: "Purpose" },
				sort: 100,
				tags: [
					{
						id: "annual-report",
						code: "purpose-annual-report",
						name_i18n: { zh_CN: "年度报告", en_US: "Annual Report" },
						sort: 100,
						template_count: 1,
						is_official: true,
					},
					{
						id: "monthly-report",
						code: "purpose-monthly-report",
						name_i18n: { zh_CN: "月度汇报", en_US: "Monthly Report" },
						sort: 90,
						template_count: 1,
						is_official: true,
					},
				],
			},
			{
				id: "style-group",
				code: "style_group",
				name_i18n: { zh_CN: "视觉风格", en_US: "Style" },
				sort: 90,
				tags: [
					{
						id: "business-style",
						code: "style-business",
						name_i18n: { zh_CN: "商务", en_US: "Business" },
						sort: 90,
						template_count: 1,
						is_official: true,
					},
				],
			},
		]

		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedCategoryCode: businessCategory.code,
					selectedChildTagCodes: ["purpose-annual-report"],
					tagGroups,
					setSelectedChildTagCodes,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("slides-template-category-tag-filters")).toBeInTheDocument()
		const purposeTrigger = screen.getByTestId("slides-template-tag-group-trigger-purpose_group")
		expect(purposeTrigger).toHaveTextContent("Purpose：Annual Report")
		expect(purposeTrigger).toHaveClass(
			"h-8",
			"rounded-lg",
			"border-0",
			"bg-transparent",
			"shadow-none",
		)
		expect(purposeTrigger).not.toHaveClass("rounded-full")
		expect(
			screen.getByTestId("slides-template-tag-group-selected-value-purpose-annual-report"),
		).toHaveClass("rounded-full", "bg-primary/10", "text-primary")
		expect(
			screen.getByTestId("slides-template-tag-group-trigger-style_group"),
		).toHaveTextContent("Style")
		expect(
			screen.getByTestId("slides-template-tag-group-trigger-style_group"),
		).not.toHaveTextContent("Not selected")

		const clearSelection = screen.getByTestId("slides-template-tag-clear-selection")
		const tagGroupsLayout = screen.getByTestId("slides-template-tag-groups")
		expect(tagGroupsLayout).toHaveClass("flex-wrap")
		expect(tagGroupsLayout).not.toHaveClass("overflow-x-auto")
		expect(tagGroupsLayout).not.toContainElement(clearSelection)
		expect(tagGroupsLayout.parentElement).toContainElement(clearSelection)
		expect(clearSelection).toBeEnabled()
		fireEvent.click(clearSelection)
		expect(setSelectedChildTagCodes).toHaveBeenCalledWith([])
		setSelectedChildTagCodes.mockClear()

		fireEvent.keyDown(screen.getByTestId("slides-template-tag-group-trigger-style_group"), {
			key: "Enter",
		})
		fireEvent.click(screen.getByTestId("slides-template-tag-option-style-business"))
		expect(setSelectedChildTagCodes).toHaveBeenCalledWith([
			"purpose-annual-report",
			"style-business",
		])
		setSelectedChildTagCodes.mockClear()

		fireEvent.keyDown(screen.getByTestId("slides-template-tag-group-trigger-purpose_group"), {
			key: "Enter",
		})
		fireEvent.click(screen.getByTestId("slides-template-tag-option-purpose-annual-report"))
		expect(setSelectedChildTagCodes).toHaveBeenCalledWith([])
	})

	it("shows up to three selected options and reveals remaining items from the count", async () => {
		const tagGroups: SlidesTemplateTagGroupItem[] = [
			{
				id: "purpose-group",
				code: "purpose_group",
				name_i18n: { zh_CN: "用途与交付物", en_US: "Purpose" },
				sort: 100,
				tags: [
					{
						id: "annual-report",
						code: "purpose-annual-report",
						name_i18n: { zh_CN: "年度报告", en_US: "Annual Report" },
						sort: 100,
						template_count: 1,
						is_official: true,
					},
					{
						id: "monthly-report",
						code: "purpose-monthly-report",
						name_i18n: { zh_CN: "月度汇报", en_US: "Monthly Report" },
						sort: 90,
						template_count: 1,
						is_official: true,
					},
					{
						id: "quarterly-report",
						code: "purpose-quarterly-report",
						name_i18n: { zh_CN: "季度汇报", en_US: "Quarterly Report" },
						sort: 80,
						template_count: 1,
						is_official: true,
					},
					{
						id: "project-report",
						code: "purpose-project-report",
						name_i18n: { zh_CN: "项目汇报", en_US: "Project Report" },
						sort: 70,
						template_count: 1,
						is_official: true,
					},
				],
			},
		]
		const { rerender } = render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedChildTagCodes: ["purpose-annual-report"],
					tagGroups,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(
			screen.getByTestId("slides-template-tag-group-trigger-purpose_group"),
		).toHaveTextContent("Purpose：Annual Report")

		rerender(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedChildTagCodes: ["purpose-annual-report", "purpose-monthly-report"],
					tagGroups,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		const trigger = screen.getByTestId("slides-template-tag-group-trigger-purpose_group")
		expect(trigger).toHaveTextContent("Purpose：Annual ReportMonthly Report")
		expect(
			screen.getByTestId("slides-template-tag-group-selected-value-purpose-annual-report"),
		).toHaveClass("rounded-full", "bg-primary/10", "text-primary")
		expect(
			screen.getByTestId("slides-template-tag-group-selected-value-purpose-monthly-report"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("slides-template-tag-group-selected-overflow-purpose_group"),
		).toBeNull()

		rerender(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedChildTagCodes: [
						"purpose-annual-report",
						"purpose-monthly-report",
						"purpose-quarterly-report",
						"purpose-project-report",
					],
					tagGroups,
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		expect(trigger).toHaveTextContent("Purpose：Annual ReportMonthly ReportQuarterly Report+1")
		expect(trigger).not.toHaveTextContent("Project Report")
		const overflow = screen.getByTestId(
			"slides-template-tag-group-selected-overflow-purpose_group",
		)
		expect(overflow).toHaveTextContent("+1")
		fireEvent.focus(overflow)
		const overflowTooltips = await screen.findAllByTestId(
			"slides-template-tag-group-overflow-tooltip-purpose_group",
		)
		expect(overflowTooltips[0]).toHaveTextContent("Project Report")
	})

	it("uses a confirmable bottom panel for mobile multi-selection", () => {
		useIsMobileMock.mockReturnValue(true)
		const setSelectedChildTagCodes = vi.fn()

		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					selectedChildTagCodes: ["style-business"],
					setSelectedChildTagCodes,
					tagGroups: [
						{
							id: "purpose-group",
							code: "purpose_group",
							name_i18n: { zh_CN: "用途与交付物", en_US: "Purpose" },
							sort: 100,
							tags: [
								{
									id: "annual-report",
									code: "purpose-annual-report",
									name_i18n: {
										zh_CN: "年度报告",
										en_US: "Annual Report",
									},
									sort: 100,
									template_count: 1,
									is_official: true,
								},
							],
						},
						{
							id: "style-group",
							code: "style_group",
							name_i18n: { zh_CN: "视觉风格", en_US: "Style" },
							sort: 90,
							tags: [
								{
									id: "business-style",
									code: "style-business",
									name_i18n: { zh_CN: "商务", en_US: "Business" },
									sort: 90,
									template_count: 1,
									is_official: true,
								},
							],
						},
					],
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-tag-group-trigger-purpose_group"))
		expect(
			screen.getByTestId("slides-template-tag-mobile-panel-purpose_group"),
		).toBeInTheDocument()
		fireEvent.click(
			screen.getByTestId("slides-template-tag-mobile-option-purpose-annual-report"),
		)
		expect(setSelectedChildTagCodes).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole("button", { name: "playbook.edit.presets.form.confirm" }))
		expect(setSelectedChildTagCodes).toHaveBeenCalledWith([
			"style-business",
			"purpose-annual-report",
		])
	})

	it.each(["all", createSlidesTemplateTagGroupKey("featured")])(
		"renders tag filters for the %s group",
		(selectedGroupKey) => {
			const setSelectedChildTagCodes = vi.fn()

			render(
				<SlidesTemplatePanelContent
					slidesState={createSlidesTemplatePanelContentState({
						selectedGroupKey,
						tagGroups: [
							{
								id: "style-group",
								code: "style_group",
								name_i18n: { zh_CN: "视觉风格", en_US: "Style" },
								sort: 90,
								tags: [
									{
										id: "business-style",
										code: "style-business",
										name_i18n: { zh_CN: "商务", en_US: "Business" },
										sort: 90,
										template_count: 1,
										is_official: true,
									},
								],
							},
						],
						setSelectedChildTagCodes,
					})}
					onTemplateClick={vi.fn()}
				/>,
			)

			expect(screen.getByTestId("slides-template-category-tag-filters")).toBeInTheDocument()
			expect(
				screen.getByTestId("slides-template-tag-group-trigger-style_group"),
			).toHaveTextContent("Style")
			expect(
				screen.getByTestId("slides-template-tag-group-trigger-style_group"),
			).not.toHaveTextContent("Not selected")
			expect(screen.queryByTestId("slides-template-tag-clear-selection")).toBeNull()
			fireEvent.keyDown(screen.getByTestId("slides-template-tag-group-trigger-style_group"), {
				key: "Enter",
			})
			fireEvent.click(screen.getByTestId("slides-template-tag-option-style-business"))
			expect(setSelectedChildTagCodes).toHaveBeenCalledWith(["style-business"])
		},
	)

	it("keeps the toolbar visible while preview is open", async () => {
		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({
					templateOptions: [
						{
							value: "business",
							label: "Business Template",
							thumbnail_url: "https://example.com/business.png",
							preview_image_urls: [
								"https://example.com/business-page-1.png",
								"https://example.com/business-page-2.png",
							],
							preview_title: "Business Preview",
						},
					],
				})}
				onTemplateClick={vi.fn()}
			/>,
		)

		const toolbar = screen.getByTestId("slides-template-panel-toolbar")
		expect(toolbar).toHaveClass("translate-y-0")
		expect(toolbar).toHaveClass("opacity-100")
		expect(toolbar).not.toHaveClass("transition-[opacity,transform]")
		expect(toolbar).not.toHaveClass("duration-300")

		fireEvent.click(screen.getByTestId("slides-preset-card-touch-preview-button"))

		await waitFor(() => {
			expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
			expect(toolbar).toHaveClass("translate-y-0", "opacity-100")
			expect(toolbar).not.toHaveClass(
				"pointer-events-none",
				"translate-y-[calc(100%_+_24px)]",
				"opacity-0",
			)
			expect(toolbar).not.toHaveAttribute("aria-hidden", "true")
		})

		fireEvent.click(screen.getByTestId("on-open-change"))

		await waitFor(() => {
			expect(toolbar).toHaveClass("translate-y-0")
			expect(toolbar).toHaveClass("opacity-100")
		})
	})

	it("does not update keyword while composing Chinese input", () => {
		const setKeyword = vi.fn()

		render(
			<SlidesTemplatePanelContent
				slidesState={createSlidesTemplatePanelContentState({ setKeyword })}
				onTemplateClick={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-search-toggle"))
		const input = screen.getByTestId("slides-template-search-input")

		fireEvent.compositionStart(input)
		fireEvent.change(input, { target: { value: "zhong" } })

		expect(input).toHaveValue("zhong")
		expect(setKeyword).not.toHaveBeenCalled()

		fireEvent.compositionEnd(input)

		expect(setKeyword).toHaveBeenCalledWith("zhong")
	})
})
