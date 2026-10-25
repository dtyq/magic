import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { SlidesTemplateTagFiltersSkeleton } from "../SlidesTemplateFilterSkeleton"
import SlidesTemplateMobileTagFilters from "../SlidesTemplateMobileTagFilters"
import type { SlidesTemplateTagGroupItem } from "../slidesTemplateState"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en_US" },
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

const tagGroups: SlidesTemplateTagGroupItem[] = [
	{
		id: "purpose-group",
		code: "purpose_group",
		name: "Purpose",
		sort: 100,
		tags: [
			{
				id: "annual-report",
				code: "purpose-annual-report",
				name: "Annual Report",
				sort: 100,
				template_count: 1,
				is_official: true,
			},
			{
				id: "long-purpose",
				code: "purpose-long",
				name: "Industry Solution",
				sort: 90,
				template_count: 1,
				is_official: true,
			},
		],
	},
	{
		id: "style-group",
		code: "style_group",
		name: "Style",
		sort: 90,
		tags: [
			{
				id: "business-style",
				code: "style-business",
				name: "Business",
				sort: 90,
				template_count: 1,
				is_official: true,
			},
		],
	},
]

function renderFilters(selectedTagCodes: string[] = [], onSelectedTagCodesChange = vi.fn()) {
	render(
		<SlidesTemplateMobileTagFilters
			tagGroups={tagGroups}
			selectedTagCodes={selectedTagCodes}
			onSelectedTagCodesChange={onSelectedTagCodesChange}
		/>,
	)

	return { onSelectedTagCodesChange }
}

function ControlledFilters() {
	const [selectedTagCodes, setSelectedTagCodes] = useState<string[]>([])

	return (
		<SlidesTemplateMobileTagFilters
			tagGroups={tagGroups}
			selectedTagCodes={selectedTagCodes}
			onSelectedTagCodesChange={setSelectedTagCodes}
		/>
	)
}

function expectSystemPopupHeader(title: string) {
	const closeButton = screen.getByRole("button", {
		name: "shadcn-ui:actionDrawer.close",
	})
	const visibleTitle = screen
		.getAllByText(title)
		.find((element) => element.classList.contains("text-[18px]"))

	expect(closeButton).toHaveClass("size-12", "rounded-full")
	expect(visibleTitle).toHaveClass("font-medium", "text-foreground")
}

describe("SlidesTemplateMobileTagFilters", () => {
	beforeAll(() => {
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(() => ({
				disconnect: vi.fn(),
				observe: vi.fn(),
				unobserve: vi.fn(),
			})),
		)
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("keeps tag groups in a single horizontal row with a fixed all-filters button", () => {
		renderFilters(["style-business"])

		const row = screen.getByTestId("slides-template-mobile-tag-filters")
		const scrollRoot = screen.getByTestId("slides-template-mobile-tag-filter-scroll")
		const scrollContainer = scrollRoot.firstElementChild
		const allFiltersTrigger = screen.getByTestId("slides-template-mobile-all-filters-trigger")

		expect(row).toHaveClass("flex", "items-center")
		expect(scrollContainer).toHaveClass(
			"flex",
			"touch-pan-x",
			"overflow-x-auto",
			"overflow-y-hidden",
		)
		expect(scrollContainer).not.toHaveClass("flex-wrap")
		expect(scrollContainer).toContainElement(
			screen.getByTestId("slides-template-tag-group-trigger-purpose_group"),
		)
		expect(scrollContainer).toContainElement(
			screen.getByTestId("slides-template-tag-group-trigger-style_group"),
		)
		expect(scrollRoot).not.toContainElement(allFiltersTrigger)
		expect(row).toContainElement(allFiltersTrigger)
		expect(screen.getByTestId("slides-template-mobile-all-filters-count")).toHaveTextContent(
			"1",
		)
	})

	it("matches the split-sheet layout and applies all-filter edits immediately", () => {
		const onSelectedTagCodesChange = vi.fn()
		renderFilters(["style-business"], onSelectedTagCodesChange)

		fireEvent.click(screen.getByTestId("slides-template-mobile-all-filters-trigger"))
		const panel = screen.getByTestId("slides-template-mobile-all-filters-panel")
		expect(panel).toBeInTheDocument()
		expect(panel).toHaveClass("flex", "h-full", "rounded-lg", "bg-card")
		const groupsViewport = screen.getByTestId("slides-template-mobile-all-filters-groups")
		expect(groupsViewport.closest('[data-slot="scroll-area"]')).toHaveClass(
			"w-[86px]",
			"border-r",
			"bg-card",
		)
		expect(groupsViewport).toHaveClass("py-1")
		expect(groupsViewport).toHaveStyle({ overflowY: "scroll" })
		expect(screen.getByTestId("slides-template-mobile-all-filters-values")).toHaveClass(
			"px-3",
			"py-3",
		)
		expect(screen.getByTestId("slides-template-mobile-all-filters-values")).toHaveStyle({
			overflowY: "scroll",
		})
		expect(screen.getByRole("dialog")).toHaveClass(
			"h-[648px]",
			"max-h-[90vh]",
			"supports-[height:100dvh]:max-h-[90dvh]",
			"max-w-[375px]",
			"rounded-t-[14px]",
			"border",
		)
		expectSystemPopupHeader("playbook.edit.presets.form.moreFilters")
		const purposeGroup = screen.getByTestId(
			"slides-template-mobile-all-filters-group-purpose_group",
		)
		expect(purposeGroup).toHaveClass("min-h-14", "w-full", "px-3")
		expect(purposeGroup.lastElementChild).toHaveClass("line-clamp-2")
		expect(
			screen.getByTestId("slides-template-mobile-all-filters-group-style_group"),
		).toHaveAttribute("aria-current", "page")
		const styleOption = screen.getByTestId(
			"slides-template-mobile-all-filters-option-style-business",
		)
		expect(screen.getByTestId("slides-template-mobile-all-filters-values")).toContainElement(
			styleOption,
		)
		expect(styleOption.parentElement).toHaveClass("grid", "grid-cols-2")
		expect(styleOption).toHaveClass(
			"min-h-11",
			"rounded-lg",
			"border-primary",
			"bg-primary/10",
			"text-[14px]",
		)
		expect(
			screen.getByRole("heading", {
				name: "Style",
			}),
		).toHaveClass("mb-3", "text-muted-foreground")
		expect(
			screen.queryByRole("button", {
				name: "playbook.edit.presets.form.confirm",
			}),
		).not.toBeInTheDocument()

		fireEvent.click(
			screen.getByTestId("slides-template-mobile-all-filters-group-purpose_group"),
		)
		fireEvent.click(
			screen.getByTestId("slides-template-mobile-all-filters-option-purpose-annual-report"),
		)
		expect(onSelectedTagCodesChange).toHaveBeenCalledTimes(1)
		expect(onSelectedTagCodesChange).toHaveBeenCalledWith([
			"style-business",
			"purpose-annual-report",
		])
	})

	it("shows reset after selecting a filter and hides it after reset", () => {
		render(<ControlledFilters />)

		fireEvent.click(screen.getByTestId("slides-template-mobile-all-filters-trigger"))
		expect(
			screen.queryByRole("button", {
				name: "shadcn-ui:actionDrawer.reset",
			}),
		).not.toBeInTheDocument()

		fireEvent.click(
			screen.getByTestId("slides-template-mobile-all-filters-option-purpose-annual-report"),
		)
		const resetButton = screen.getByRole("button", {
			name: "shadcn-ui:actionDrawer.reset",
		})
		expect(resetButton).toHaveClass("size-12", "rounded-full")
		expect(resetButton.querySelector("svg")).toHaveClass("size-[22px]", "!size-5")

		fireEvent.click(resetButton)
		expect(
			screen.queryByRole("button", {
				name: "shadcn-ui:actionDrawer.reset",
			}),
		).not.toBeInTheDocument()
		expect(
			screen.getByTestId("slides-template-mobile-all-filters-option-purpose-annual-report"),
		).toHaveAttribute("aria-pressed", "false")
	})

	it("keeps immediate selections after closing and reopening", () => {
		const onSelectedTagCodesChange = vi.fn()
		const { rerender } = render(
			<SlidesTemplateMobileTagFilters
				tagGroups={tagGroups}
				selectedTagCodes={[]}
				onSelectedTagCodesChange={onSelectedTagCodesChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-mobile-all-filters-trigger"))
		fireEvent.click(
			screen.getByTestId("slides-template-mobile-all-filters-option-purpose-annual-report"),
		)
		expect(onSelectedTagCodesChange).toHaveBeenCalledWith(["purpose-annual-report"])

		rerender(
			<SlidesTemplateMobileTagFilters
				tagGroups={tagGroups}
				selectedTagCodes={["purpose-annual-report"]}
				onSelectedTagCodesChange={onSelectedTagCodesChange}
			/>,
		)
		fireEvent.click(
			screen.getByRole("button", {
				name: "shadcn-ui:actionDrawer.close",
			}),
		)

		fireEvent.click(screen.getByTestId("slides-template-mobile-all-filters-trigger"))
		expect(
			screen.getByTestId("slides-template-mobile-all-filters-option-purpose-annual-report"),
		).toHaveAttribute("aria-pressed", "true")
	})

	it("keeps the existing confirmable single-group selector", () => {
		const onSelectedTagCodesChange = vi.fn()
		renderFilters(["style-business"], onSelectedTagCodesChange)

		fireEvent.click(screen.getByTestId("slides-template-tag-group-trigger-purpose_group"))
		expectSystemPopupHeader("Purpose")
		expect(screen.getByRole("dialog")).toHaveClass(
			"max-h-[85vh]",
			"supports-[height:100dvh]:max-h-[85dvh]",
			"rounded-t-[14px]",
		)
		const option = screen.getByTestId("slides-template-tag-mobile-option-purpose-annual-report")
		expect(option.parentElement).toHaveClass("grid", "grid-cols-3")
		expect(option).toHaveClass("h-auto", "min-h-12", "min-w-0", "justify-center", "text-center")
		expect(option.querySelector("svg")).toBeNull()
		expect(option.querySelector("span")).toHaveClass("truncate", "whitespace-nowrap")
		fireEvent.click(option)
		expect(onSelectedTagCodesChange).not.toHaveBeenCalled()

		fireEvent.click(
			screen.getByRole("button", {
				name: "playbook.edit.presets.form.confirm",
			}),
		)
		expect(onSelectedTagCodesChange).toHaveBeenCalledWith([
			"style-business",
			"purpose-annual-report",
		])
	})
})

describe("SlidesTemplateTagFiltersSkeleton", () => {
	it("uses a single mobile row with a fixed button placeholder", () => {
		render(<SlidesTemplateTagFiltersSkeleton isMobile />)

		const skeleton = screen.getByTestId("slides-template-tag-filters-skeleton")
		const buttonSkeleton = screen.getByTestId("slides-template-tag-filter-button-skeleton")

		expect(skeleton).toHaveClass("flex", "items-center")
		expect(skeleton).not.toHaveClass("grid")
		expect(skeleton).toContainElement(buttonSkeleton)
		expect(buttonSkeleton).toHaveClass("size-8", "shrink-0", "rounded-full")
	})
})
