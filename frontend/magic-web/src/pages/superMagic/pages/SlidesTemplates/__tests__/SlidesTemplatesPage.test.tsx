import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	waitForElementToBeRemoved,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { forwardRef, useImperativeHandle, type ReactNode } from "react"
import type {
	OptionGroup,
	OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { RouteName } from "@/routes/constants"
import type { MySlidesTemplateAdapter } from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import SlidesTemplatesPage from "../index"
import { MY_SLIDES_TEMPLATES_GROUP_KEY } from "../useMySlidesTemplates"

const {
	catalogStateMock,
	catalogOptionsHistory,
	businessTemplate,
	canvasTemplatesHistory,
	clearTemplateColorExtractionBackgroundQueueMock,
	findSimilarCallbackHistory,
	focusRandomTemplateMock,
	getExtractedTemplateColorsMock,
	navigateMock,
	openPreviewMock,
	relatedTemplate,
	sameFamilyTemplate,
	requestTemplateColorExtractionMock,
	secondaryMatchTemplate,
	subscribeTemplateColorExtractionSettledMock,
	templateColorExtractionVersionState,
	unrelatedTemplate,
} = vi.hoisted(() => {
	const template: OptionItem = {
		value: "PPT-business",
		label: {
			zh_CN: "商务模板",
			en_US: "Business Template",
		},
		thumbnail_url: "https://example.com/business-cover.png",
		colors: ["#315ECA", "#7AA7FF", "#182A5A"],
	}
	const related: OptionItem = {
		value: "PPT-related",
		label: "Related Template",
		colors: ["#365FC2", "#83AEFF", "#26396A"],
	}
	const unrelated: OptionItem = {
		value: "PPT-unrelated",
		label: "Unrelated Template",
		colors: ["#D97706", "#FACC15", "#7C2D12"],
	}
	const secondaryMatch: OptionItem = {
		value: "PPT-secondary-match",
		label: "Secondary Match",
		colors: ["#D97706", "#7AA7FF", "#182A5A"],
	}
	const sameFamily: OptionItem = {
		value: "PPT-light-blue",
		label: "Light Blue Template",
		colors: ["#BFDBFE"],
	}
	const groups: OptionGroup[] = [
		{
			group_key: "all",
			group_name: "All",
			children: [template, related, unrelated],
		},
		{
			group_key: "tag:featured",
			group_name: "Featured",
			children: [template],
		},
		{
			group_key: "business",
			group_name: "Business",
			children: [template, related, unrelated],
		},
	]

	return {
		businessTemplate: template,
		canvasTemplatesHistory: [] as OptionItem[][],
		catalogOptionsHistory: [] as Array<{ pageSize?: number } | undefined>,
		clearTemplateColorExtractionBackgroundQueueMock: vi.fn(),
		findSimilarCallbackHistory: [] as Array<((template: OptionItem) => void) | undefined>,
		focusRandomTemplateMock: vi.fn(),
		getExtractedTemplateColorsMock: vi.fn(() => [] as string[]),
		navigateMock: vi.fn(),
		openPreviewMock: vi.fn(),
		relatedTemplate: related,
		sameFamilyTemplate: sameFamily,
		requestTemplateColorExtractionMock: vi.fn(),
		secondaryMatchTemplate: secondaryMatch,
		subscribeTemplateColorExtractionSettledMock: vi.fn(() => vi.fn()),
		templateColorExtractionVersionState: { value: 0 },
		unrelatedTemplate: unrelated,
		catalogStateMock: {
			groups,
			hasAnyTemplate: true,
			hasCheckedAnyTemplate: true,
			hasMore: false,
			isLoading: false,
			isRefreshing: false,
			isLoadingMore: false,
			isLoadMoreFailed: false,
			isRefreshFailed: false,
			keyword: "",
			debouncedKeyword: "",
			loadedTemplateCount: 3,
			loadMore: vi.fn(),
			loadTemplateDetail: vi.fn().mockResolvedValue(null),
			retryRefresh: vi.fn(),
			selectedGroupKey: "all",
			selectedChildTagCodes: [] as string[],
			setKeyword: vi.fn(),
			setSelectedGroupKey: vi.fn(),
			templateOptions: [template, related, unrelated],
			templateViewRevision: 1,
			total: 3,
		},
	}
})

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("../templateColorExtractionStore", () => ({
	clearTemplateColorExtractionBackgroundQueue: clearTemplateColorExtractionBackgroundQueueMock,
	getExtractedTemplateColors: getExtractedTemplateColorsMock,
	requestTemplateColorExtraction: requestTemplateColorExtractionMock,
	subscribeTemplateColorExtractionSettled: subscribeTemplateColorExtractionSettledMock,
}))

vi.mock("../useResolvedTemplateColors", () => ({
	useTemplateColorExtractionVersion: () => templateColorExtractionVersionState.value,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: (key: string, options?: { name?: string }) => options?.name ?? key,
	}),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

/**
 * The page hosts the onboarding tour, which reaches into the account store and the real i18n
 * instance. This suite is about the page's own layout, so the tour is stubbed out; what it does
 * with the AI-PPT steps is covered by the tour's own suite.
 */
vi.mock("@/pages/superMagic/components/LazyGuideTour", () => ({
	default: () => null,
}))

vi.mock(
	"@/pages/superMagic/components/MainInputContainer/scenes/Slides/useSlidesTemplateCatalogState",
	() => ({
		useSlidesTemplateCatalogState: (options?: { pageSize?: number }) => {
			catalogOptionsHistory.push(options)
			return catalogStateMock
		},
	}),
)

vi.mock("../SlidesTemplateCanvas", () => ({
	__esModule: true,
	default: forwardRef(
		(
			{
				enableInfiniteLoop,
				hasMore,
				initialAlignment,
				isLoading,
				onLoadMore,
				onFindSimilarColors,
				onPreviewOpenChange,
				onTemplateSelect,
				resetKey,
				templates,
			}: {
				enableInfiniteLoop?: boolean
				hasMore: boolean
				initialAlignment?: "center" | "top"
				isLoading: boolean
				onLoadMore: () => void
				onFindSimilarColors?: (template: OptionItem) => void
				onPreviewOpenChange?: (isOpen: boolean) => void
				onTemplateSelect: (template: OptionItem) => void
				resetKey: string
				templates: OptionItem[]
			},
			ref,
		) => {
			canvasTemplatesHistory.push(templates)
			findSimilarCallbackHistory.push(onFindSimilarColors)
			useImperativeHandle(ref, () => ({
				focusRandomTemplate: focusRandomTemplateMock,
				openPreview: openPreviewMock,
			}))
			return (
				<>
					<button
						type="button"
						data-testid="mock-slides-template-canvas"
						onClick={() => onTemplateSelect(businessTemplate)}
					>
						canvas
					</button>
					<div
						data-testid="mock-slides-template-canvas-options"
						data-has-more={String(hasMore)}
						data-initial-alignment={initialAlignment}
						data-is-loading={String(isLoading)}
						data-loop-enabled={String(enableInfiniteLoop)}
						data-reset-key={resetKey}
					>
						{templates.map((template) => String(template.value)).join(",")}
					</div>
					<button
						type="button"
						data-testid="mock-slides-template-canvas-load-more"
						onClick={onLoadMore}
					>
						load more
					</button>
					<button
						type="button"
						data-testid="mock-slides-template-find-similar-colors"
						onClick={() => onFindSimilarColors?.(businessTemplate)}
					>
						find similar colors
					</button>
					<button
						type="button"
						data-testid="mock-slides-template-preview-open"
						onClick={() => onPreviewOpenChange?.(true)}
					>
						open preview
					</button>
					<button
						type="button"
						data-testid="mock-slides-template-preview-close"
						onClick={() => onPreviewOpenChange?.(false)}
					>
						close preview
					</button>
				</>
			)
		},
	),
}))

vi.mock("../SlidesTemplatePromptDock", () => ({
	__esModule: true,
	default: ({
		onClearSelectedTemplate,
		onPreviewSelectedTemplate,
		selectedTemplate,
	}: {
		onClearSelectedTemplate: () => void
		onPreviewSelectedTemplate: () => void
		selectedTemplate?: OptionItem | null
	}) => (
		<div data-testid="mock-slides-template-prompt-dock">
			{selectedTemplate ? String(selectedTemplate.value) : null}
			<button
				type="button"
				data-testid="slides-templates-page-clear-selected-template"
				onClick={onClearSelectedTemplate}
			>
				clear
			</button>
			<div data-testid="slides-templates-page-selected-template">Business Template</div>
			<button
				type="button"
				data-testid="slides-templates-page-preview-selected-template"
				onClick={onPreviewSelectedTemplate}
			>
				preview
			</button>
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/panels/TemplateGroupSelector", () => ({
	__esModule: true,
	TemplateGroupSelectorOption: forwardRef<
		HTMLButtonElement,
		{
			icon?: ReactNode
			isSelected: boolean
			label: ReactNode
			suffix?: ReactNode
			"data-testid"?: string
		}
	>(function MockTemplateGroupSelectorOption({ icon, isSelected, label, suffix, ...props }, ref) {
		return (
			<button ref={ref} type="button" aria-pressed={isSelected} {...props}>
				{icon}
				{label}
				{suffix}
			</button>
		)
	}),
	default: ({
		groups,
		onGroupChange,
		renderGroupIcon,
		renderGroupOption,
		selectedGroupKey,
	}: {
		groups: OptionGroup[]
		onGroupChange: (groupKey: string) => void
		renderGroupIcon?: (group: OptionGroup) => ReactNode
		renderGroupOption?: (
			group: OptionGroup,
			props: {
				icon?: ReactNode
				isSelected: boolean
				label: ReactNode
				"data-testid": string
			},
		) => ReactNode
		selectedGroupKey: string
	}) => {
		return (
			<div data-testid="slides-templates-page-group-selector">
				{groups.map((group) => {
					const optionProps = {
						icon: renderGroupIcon?.(group),
						isSelected: group.group_key === selectedGroupKey,
						label: String(group.group_name),
						"data-testid": `slides-templates-page-group-${group.group_key}`,
					}
					const customOption = renderGroupOption?.(group, optionProps)
					return customOption ? (
						<div key={group.group_key}>{customOption}</div>
					) : (
						<button
							type="button"
							key={group.group_key}
							aria-pressed={optionProps.isSelected}
							data-testid={optionProps["data-testid"]}
							onClick={() => onGroupChange(group.group_key)}
						>
							{optionProps.icon}
							{optionProps.label}
						</button>
					)
				})}
			</div>
		)
	},
}))

async function selectMyTemplatesSection(section: "created" | "favorites" | "used" = "created") {
	fireEvent.click(
		screen.getByTestId(`slides-templates-page-group-${MY_SLIDES_TEMPLATES_GROUP_KEY}`),
	)
	fireEvent.click(await screen.findByTestId(`my-slides-templates-section-${section}`))
}

function createMyTemplatesAdapter(
	listMine: MySlidesTemplateAdapter["listMine"],
	enabled = true,
): MySlidesTemplateAdapter {
	const listEmpty: MySlidesTemplateAdapter["listFavorites"] = vi.fn(
		async ({ page, pageSize }) => ({
			items: [],
			page,
			pageSize,
			hasMore: false,
		}),
	)
	return {
		enabled,
		saveEnabled: false,
		listMine: vi.fn(listMine),
		listFavorites: listEmpty,
		listUsed: listEmpty,
		checkByCode: vi.fn(async () => ({ status: "UNUSED" })),
		loadDetail: vi.fn(async (code) => ({
			code,
			label: { zh_CN: code, en_US: code },
			description: { zh_CN: "", en_US: "" },
			is_official: false,
		})),
		favorite: vi.fn(async () => undefined),
		unfavorite: vi.fn(async () => undefined),
		remove: vi.fn(async () => undefined),
		saveFromFolder: vi.fn(async () => ({
			code: "saved",
			label: { zh_CN: "Saved", en_US: "Saved" },
			description: { zh_CN: "", en_US: "" },
			is_official: false,
		})),
	}
}

describe("SlidesTemplatesPage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		catalogStateMock.hasMore = false
		catalogStateMock.isLoading = false
		catalogStateMock.isLoadingMore = false
		catalogStateMock.isLoadMoreFailed = false
		catalogStateMock.isRefreshFailed = false
		catalogStateMock.isRefreshing = false
		catalogStateMock.loadedTemplateCount = 3
		catalogStateMock.selectedChildTagCodes = []
		catalogStateMock.selectedGroupKey = "all"
		catalogStateMock.templateOptions = [businessTemplate, relatedTemplate, unrelatedTemplate]
		catalogOptionsHistory.length = 0
		canvasTemplatesHistory.length = 0
		findSimilarCallbackHistory.length = 0
		getExtractedTemplateColorsMock.mockReturnValue([])
		templateColorExtractionVersionState.value = 0
	})

	it("loads templates in backend-sized batches", () => {
		render(<SlidesTemplatesPage />)

		expect(catalogOptionsHistory.at(-1)).toEqual({ pageSize: 200 })
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"true",
		)
	})

	it("places My templates before Featured and renders a distinct icon", () => {
		render(<SlidesTemplatesPage />)

		const myTemplatesTab = screen.getByTestId(
			`slides-templates-page-group-${MY_SLIDES_TEMPLATES_GROUP_KEY}`,
		)
		const featuredTab = screen.getByTestId("slides-templates-page-group-tag:featured")

		expect(myTemplatesTab).toContainElement(screen.getByTestId("my-slides-templates-tab-icon"))
		expect(
			myTemplatesTab.compareDocumentPosition(featuredTab) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it("reveals personal sections and keeps My templates selected on repeated clicks", async () => {
		const adapter = createMyTemplatesAdapter(async () => ({
			items: [],
			page: 1,
			pageSize: 40,
			hasMore: false,
		}))
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		const trigger = screen.getByTestId(
			`slides-templates-page-group-${MY_SLIDES_TEMPLATES_GROUP_KEY}`,
		)
		const shell = screen.getByTestId("my-slides-templates-group-tabs-shell")
		const tabsRegion = screen.getByTestId("my-slides-templates-section-tabs-region")
		expect(adapter.listMine).not.toHaveBeenCalled()
		expect(trigger).toHaveAttribute("data-selected", "false")
		expect(tabsRegion).toHaveAttribute("data-expanded", "false")

		fireEvent.mouseEnter(shell)

		expect(tabsRegion).toHaveAttribute("data-expanded", "true")
		expect(screen.getByTestId("my-slides-templates-section-created")).toHaveAttribute(
			"aria-selected",
			"false",
		)
		expect(adapter.listMine).not.toHaveBeenCalled()

		fireEvent.mouseLeave(shell)
		expect(tabsRegion).toHaveAttribute("data-expanded", "false")

		fireEvent.click(trigger)

		expect(tabsRegion).toHaveAttribute("data-expanded", "true")
		await waitFor(() => expect(adapter.listMine).toHaveBeenCalled())
		expect(screen.getByTestId("my-slides-templates-section-created")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		const createdTab = screen.getByTestId("my-slides-templates-section-created")
		fireEvent.focus(createdTab)
		fireEvent.keyDown(createdTab, { key: "ArrowRight" })

		await waitFor(() => expect(adapter.listFavorites).toHaveBeenCalled())
		expect(trigger).toHaveAttribute("data-selected", "false")
		expect(screen.getByTestId("my-slides-templates-section-favorites")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(tabsRegion).toHaveAttribute("data-expanded", "true")

		fireEvent.click(trigger)
		fireEvent.blur(screen.getByTestId("my-slides-templates-section-favorites"), {
			relatedTarget: document.body,
		})
		fireEvent.mouseLeave(shell)
		await waitFor(() => expect(tabsRegion).toHaveAttribute("data-expanded", "true"))
		expect(screen.getByTestId("slides-templates-page-group-all")).toHaveAttribute(
			"aria-pressed",
			"false",
		)
	})

	it("shows the compact guide when the personal template adapter is unavailable", async () => {
		const adapter = createMyTemplatesAdapter(
			async () => ({
				items: [],
				page: 1,
				pageSize: 40,
				hasMore: false,
			}),
			false,
		)
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		await selectMyTemplatesSection()

		expect(screen.getByTestId("my-slides-templates-unavailable")).toBeInTheDocument()
		expect(screen.getByText("mySlidesTemplates.guide.chat")).toBeInTheDocument()
		expect(screen.getByText("mySlidesTemplates.guide.project")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-slides-template-canvas")).not.toBeInTheDocument()
		expect(catalogStateMock.setSelectedGroupKey).not.toHaveBeenCalled()
	})

	it("returns to the homepage from the conversation guide", async () => {
		const adapter = createMyTemplatesAdapter(
			async () => ({
				items: [],
				page: 1,
				pageSize: 40,
				hasMore: false,
			}),
			false,
		)
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		await selectMyTemplatesSection()
		fireEvent.click(screen.getByTestId("my-slides-templates-go-home"))

		expect(navigateMock).toHaveBeenCalledWith({ name: RouteName.Super })
	})

	it("shows the compact guide when My templates is empty", async () => {
		const adapter = createMyTemplatesAdapter(async () => ({
			items: [],
			page: 1,
			pageSize: 40,
			hasMore: false,
		}))
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		await selectMyTemplatesSection()

		expect(await screen.findByTestId("my-slides-templates-empty")).toBeInTheDocument()
		expect(adapter.listMine).toHaveBeenCalledWith({
			page: 1,
			pageSize: 40,
			keyword: undefined,
		})
	})

	it("renders personal templates in the existing canvas", async () => {
		const adapter = createMyTemplatesAdapter(async () => ({
			items: [
				{
					code: "PPT-mine",
					label: { zh_CN: "我的模板", en_US: "My Template" },
					description: { zh_CN: "", en_US: "" },
					thumbnail_url: "https://example.com/my-template.png",
					is_official: false,
				},
			],
			page: 1,
			pageSize: 40,
			hasMore: false,
		}))
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		await selectMyTemplatesSection()

		expect(await screen.findByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			"PPT-mine",
		)
		expect(screen.getByTestId("my-slides-templates-section-created")).toHaveAttribute(
			"aria-selected",
			"true",
		)
	})

	it("keeps official categories visible and restores public templates when one is selected", async () => {
		const adapter = createMyTemplatesAdapter(async () => ({
			items: [],
			page: 1,
			pageSize: 40,
			hasMore: false,
		}))
		render(<SlidesTemplatesPage myTemplatesAdapter={adapter} />)

		await selectMyTemplatesSection()
		expect(screen.getByTestId("slides-templates-page-group-business")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-templates-page-group-business"))

		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			String(businessTemplate.value),
		)
		expect(catalogStateMock.setSelectedGroupKey).toHaveBeenCalledWith("business")
	})

	it("prefetches a second backend-sized batch for the unfiltered home canvas", async () => {
		catalogStateMock.hasMore = true
		catalogStateMock.loadedTemplateCount = 200
		catalogStateMock.templateOptions = Array.from({ length: 200 }, (_, index): OptionItem => ({
			value: `PPT-initial-${index}`,
			label: `Initial Template ${index}`,
		}))

		render(<SlidesTemplatesPage />)

		await waitFor(() => expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(1))
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-is-loading",
			"true",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"false",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toBeEmptyDOMElement()
	})

	it("disables the infinite loop while searching and restores it after clearing", () => {
		render(<SlidesTemplatesPage />)

		fireEvent.change(screen.getByTestId("slides-templates-page-search-input"), {
			target: { value: "business" },
		})
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"false",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-initial-alignment",
			"center",
		)

		fireEvent.click(screen.getByTestId("slides-templates-page-search-clear"))
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"true",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-initial-alignment",
			"center",
		)
	})

	it("keeps canvas callbacks stable when loading more state changes", () => {
		const { rerender } = render(<SlidesTemplatesPage />)
		const initialCallback = findSimilarCallbackHistory[findSimilarCallbackHistory.length - 1]

		catalogStateMock.isLoadingMore = true
		rerender(<SlidesTemplatesPage />)

		expect(findSimilarCallbackHistory[findSimilarCallbackHistory.length - 1]).toBe(
			initialCallback,
		)
	})

	it("keeps search and filters at the bottom while the prompt is hidden before selection", () => {
		render(<SlidesTemplatesPage />)

		expect(screen.getByTestId("slides-templates-page-bottom-tools")).toBeInTheDocument()
		expect(screen.getByTestId("slides-templates-page-search-input")).toBeInTheDocument()
		expect(
			screen.getByTestId("slides-templates-page-search-input").parentElement
				?.nextElementSibling,
		).toBe(screen.getByTestId("slides-templates-page-random-template"))
		expect(screen.getByTestId("slides-templates-page-group-selector")).toBeInTheDocument()
		expect(screen.getByTestId("slides-templates-page-bottom-tools")).not.toHaveTextContent(
			"common:routes.slidesTemplates",
		)
		// The toolbar band — search, inspiration and the category tabs — is what the panel ends on.
		const toolbar = screen.getByTestId("slides-templates-page-toolbar")
		expect(screen.getByTestId("slides-templates-page-bottom-tools").lastElementChild).toBe(
			toolbar,
		)
		expect(toolbar).toContainElement(screen.getByTestId("slides-templates-page-group-selector"))
		expect(screen.getByTestId("slides-templates-page-prompt-panel")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
		expect(screen.getByTestId("mock-slides-template-prompt-dock")).toBeInTheDocument()
	})

	it("shows the selected template prompt above the search tools", () => {
		render(<SlidesTemplatesPage />)
		const promptPanel = screen.getByTestId("slides-templates-page-prompt-panel")
		const bottomTools = screen.getByTestId("slides-templates-page-bottom-tools")

		fireEvent.click(screen.getByTestId("mock-slides-template-canvas"))

		expect(bottomTools).toHaveClass("max-w-3xl")
		expect(bottomTools).not.toHaveClass("max-w-4xl")
		expect(screen.getByTestId("slides-templates-page-prompt-panel")).toBe(promptPanel)
		expect(promptPanel).toHaveAttribute("aria-hidden", "false")
		expect(screen.getByTestId("slides-templates-page-bottom-tools")).toContainElement(
			screen.getByTestId("slides-templates-page-prompt-panel"),
		)
		expect(screen.getByTestId("slides-templates-page-bottom-tools").lastElementChild).toBe(
			screen.getByTestId("slides-templates-page-toolbar"),
		)
		expect(screen.getByTestId("mock-slides-template-prompt-dock")).toHaveTextContent(
			"PPT-business",
		)
		expect(screen.getByTestId("slides-templates-page-selected-template")).toHaveTextContent(
			"Business Template",
		)
		expect(
			screen
				.getByTestId("slides-templates-page-prompt-panel")
				.compareDocumentPosition(screen.getByTestId("slides-templates-page-search-input")) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it("opens the selected template preview again from the prompt", () => {
		render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-canvas"))
		fireEvent.click(screen.getByTestId("slides-templates-page-preview-selected-template"))

		expect(openPreviewMock).toHaveBeenCalledWith(businessTemplate)
	})

	it("asks the canvas to focus a random template from the current result set", () => {
		render(<SlidesTemplatesPage />)

		expect(screen.getByTestId("slides-template-glow-border")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("slides-templates-page-random-template"))

		expect(focusRandomTemplateMock).toHaveBeenCalledTimes(1)
	})

	it("creates a new primary-color layout and restores the all-template layout", () => {
		render(<SlidesTemplatesPage />)
		const allTemplates = canvasTemplatesHistory.at(-1)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-reset-key",
			"1:all-colors",
		)

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))

		expect(
			screen.getByTestId("slides-templates-page-similar-colors-filter"),
		).toBeInTheDocument()
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"false",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-initial-alignment",
			"top",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-reset-key",
			"1:PPT-business",
		)
		expect(canvasTemplatesHistory.at(-1)).not.toBe(allTemplates)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			`${businessTemplate.value},${relatedTemplate.value}`,
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).not.toHaveTextContent(
			String(unrelatedTemplate.value),
		)

		fireEvent.click(screen.getByTestId("slides-templates-page-clear-similar-colors"))

		expect(
			screen.queryByTestId("slides-templates-page-similar-colors-filter"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			String(unrelatedTemplate.value),
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-loop-enabled",
			"true",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-initial-alignment",
			"center",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-reset-key",
			"1:all-colors",
		)
	})

	it("matches only templates whose primary color belongs to the same family", () => {
		catalogStateMock.templateOptions = [
			businessTemplate,
			relatedTemplate,
			sameFamilyTemplate,
			secondaryMatchTemplate,
		]
		render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			`${businessTemplate.value},${relatedTemplate.value},${sameFamilyTemplate.value}`,
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).not.toHaveTextContent(
			String(secondaryMatchTemplate.value),
		)
	})

	it("appends asynchronously matched templates without moving existing items", () => {
		const missingColorTemplate: OptionItem = {
			value: "PPT-worker-related",
			label: "Worker Related",
			thumbnail_url: "/worker-related-cover.png",
		}
		catalogStateMock.templateOptions = [businessTemplate, relatedTemplate]
		const { rerender } = render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))
		const initialSimilarTemplates = canvasTemplatesHistory.at(-1)
		const initialSimilarResetKey = screen
			.getByTestId("mock-slides-template-canvas-options")
			.getAttribute("data-reset-key")
		catalogStateMock.templateOptions = [businessTemplate, relatedTemplate, missingColorTemplate]
		rerender(<SlidesTemplatesPage />)
		expect(canvasTemplatesHistory.at(-1)).toBe(initialSimilarTemplates)

		expect(requestTemplateColorExtractionMock).toHaveBeenCalledWith(
			expect.stringContaining("worker-related-cover.png"),
			"background",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).not.toHaveTextContent(
			String(missingColorTemplate.value),
		)

		getExtractedTemplateColorsMock.mockImplementation((imageUrl?: string) =>
			imageUrl?.includes("worker-related-cover.png") ? ["#315ECA"] : [],
		)
		templateColorExtractionVersionState.value += 1
		rerender(<SlidesTemplatesPage />)

		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			`${businessTemplate.value},${relatedTemplate.value},${missingColorTemplate.value}`,
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-reset-key",
			initialSimilarResetKey,
		)

		const clearCallCount = clearTemplateColorExtractionBackgroundQueueMock.mock.calls.length
		fireEvent.click(screen.getByTestId("slides-templates-page-clear-similar-colors"))
		expect(clearTemplateColorExtractionBackgroundQueueMock.mock.calls.length).toBeGreaterThan(
			clearCallCount,
		)
	})

	it("extends similar-color results with newly loaded templates and stops at the last page", async () => {
		catalogStateMock.hasMore = true
		catalogStateMock.loadedTemplateCount = 200
		const { rerender } = render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))
		await waitFor(() => expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(1))

		catalogStateMock.templateOptions = [
			businessTemplate,
			relatedTemplate,
			unrelatedTemplate,
			{ value: "PPT-new-related", colors: ["#315ECA", "#7AA7FF"] },
		]
		catalogStateMock.loadedTemplateCount = 400
		catalogStateMock.hasMore = false
		rerender(<SlidesTemplatesPage />)

		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			"PPT-new-related",
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveAttribute(
			"data-has-more",
			"false",
		)
		expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByTestId("slides-templates-page-clear-similar-colors"))
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			String(unrelatedTemplate.value),
		)
		expect(screen.getByTestId("mock-slides-template-canvas-options")).toHaveTextContent(
			"PPT-new-related",
		)
	})

	it("stops automatic pagination after collecting 200 primary-color matches", () => {
		catalogStateMock.hasMore = true
		catalogStateMock.loadedTemplateCount = 200
		catalogStateMock.templateOptions = [
			businessTemplate,
			...Array.from({ length: 199 }, (_, index): OptionItem => ({
				value: `PPT-blue-${index}`,
				label: `Blue Template ${index}`,
				colors: ["#60A5FA"],
			})),
		]
		render(<SlidesTemplatesPage />)
		vi.clearAllMocks()

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))

		expect(catalogStateMock.loadMore).not.toHaveBeenCalled()
	})

	it("limits automatic similar-color pagination frequency", () => {
		vi.useFakeTimers()
		catalogStateMock.hasMore = true
		catalogStateMock.loadedTemplateCount = 200
		const { rerender } = render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-find-similar-colors"))
		act(() => vi.runOnlyPendingTimers())
		expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(1)

		catalogStateMock.isLoadingMore = true
		rerender(<SlidesTemplatesPage />)
		catalogStateMock.isLoadingMore = false
		catalogStateMock.loadedTemplateCount = 400
		rerender(<SlidesTemplatesPage />)

		act(() => vi.advanceTimersByTime(599))
		expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(1)
		act(() => vi.advanceTimersByTime(1))
		expect(catalogStateMock.loadMore).toHaveBeenCalledTimes(2)

		vi.useRealTimers()
	})

	it("hides bottom tools while the inline preview is open and restores them after close", async () => {
		render(<SlidesTemplatesPage />)

		const bottomTools = screen.getByTestId("slides-templates-page-bottom-tools")
		fireEvent.click(screen.getByTestId("mock-slides-template-preview-open"))

		await waitForElementToBeRemoved(bottomTools)
		expect(screen.queryByTestId("slides-templates-page-search-input")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mock-slides-template-preview-close"))

		expect(await screen.findByTestId("slides-templates-page-bottom-tools")).toBeInTheDocument()
		expect(screen.getByTestId("slides-templates-page-search-input")).toBeInTheDocument()
	})

	it("clears the selected template and hides the prompt immediately", () => {
		render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-canvas"))
		fireEvent.click(screen.getByTestId("slides-templates-page-clear-selected-template"))

		expect(screen.getByTestId("slides-templates-page-prompt-panel")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
		expect(screen.getByTestId("mock-slides-template-prompt-dock")).toBeInTheDocument()
		expect(screen.getByTestId("slides-templates-page-prompt-region")).toHaveClass(
			"grid-rows-[0fr]",
			"transition-none",
		)
	})

	it("keeps search and group actions wired from the bottom tools", () => {
		render(<SlidesTemplatesPage />)

		fireEvent.change(screen.getByTestId("slides-templates-page-search-input"), {
			target: { value: "business" },
		})
		fireEvent.click(screen.getByTestId("slides-templates-page-group-business"))

		expect(catalogStateMock.setKeyword).toHaveBeenCalledWith("business")
		expect(catalogStateMock.setSelectedGroupKey).toHaveBeenCalledWith("business")
	})

	it("clears the selected template when switching groups", () => {
		render(<SlidesTemplatesPage />)

		fireEvent.click(screen.getByTestId("mock-slides-template-canvas"))
		expect(screen.getByTestId("slides-templates-page-prompt-panel")).toHaveAttribute(
			"aria-hidden",
			"false",
		)

		fireEvent.click(screen.getByTestId("slides-templates-page-group-business"))

		expect(screen.getByTestId("slides-templates-page-prompt-panel")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
	})
})
