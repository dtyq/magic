import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { OptionItem } from "../../types"
import SlidesPresetGrid from "../SlidesPresetGrid"

const { mockUseIsMobile } = vi.hoisted(() => ({ mockUseIsMobile: vi.fn() }))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: mockUseIsMobile,
}))

const intersectionObserverInstances: Array<{
	callback: IntersectionObserverCallback
	observedElements: Set<Element>
	disconnect: ReturnType<typeof vi.fn>
	observe: ReturnType<typeof vi.fn>
	unobserve: ReturnType<typeof vi.fn>
}> = []

function mockPointerDevice({
	canHover,
	maxTouchPoints,
}: {
	canHover: boolean
	maxTouchPoints: number
}) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: canHover && query === "(hover: hover) and (pointer: fine)",
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	})

	Object.defineProperty(window.navigator, "maxTouchPoints", {
		configurable: true,
		value: maxTouchPoints,
	})
}

function notifyIntersection(target: Element, isIntersecting = true) {
	for (const instance of intersectionObserverInstances) {
		if (!instance.observedElements.has(target)) continue

		instance.callback(
			[
				{
					isIntersecting,
					target,
				} as IntersectionObserverEntry,
			],
			instance as unknown as IntersectionObserver,
		)
	}
}

describe("SlidesPresetGrid", () => {
	beforeAll(() => {
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: IntersectionObserverCallback) => {
				const observedElements = new Set<Element>()
				const instance = {
					callback,
					observedElements,
					disconnect: vi.fn(() => observedElements.clear()),
					observe: vi.fn((element: Element) => observedElements.add(element)),
					unobserve: vi.fn((element: Element) => observedElements.delete(element)),
				}

				intersectionObserverInstances.push(instance)

				return instance
			}),
		)
	})

	beforeEach(() => {
		intersectionObserverInstances.length = 0
		mockPointerDevice({ canHover: true, maxTouchPoints: 0 })
		mockUseIsMobile.mockReturnValue(false)
	})

	afterAll(() => {
		vi.unstubAllGlobals()
	})

	const mockTemplates: OptionItem[] = [
		{
			value: "academic-research",
			label: "Academic Research",
			thumbnail_url: "https://example.com/academic.png",
			preview_image_urls: [
				"https://example.com/academic-page-1.png",
				"https://example.com/academic-page-2.png",
			],
			preview_url: "https://example.com/academic-preview",
			preview_title: "Academic Preview",
			description: "Academic research template",
			usage_count: 23,
			tags: [
				{
					id: "tag-featured",
					code: "featured",
					name_i18n: {
						zh_CN: "精选",
						en_US: "Featured",
					},
					sort: 100,
				},
			],
		},
		{
			value: "tech-dark",
			label: "Tech Dark",
			thumbnail_url: "https://example.com/tech-dark.png",
			preview_url: "https://example.com/tech-dark-preview",
			preview_title: "Tech Dark Preview",
		},
	]

	it("renders slide preset cards", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		const grid = screen.getByTestId("slides-preset-grid")
		expect(grid).toBeInTheDocument()
		expect(grid).toHaveClass(
			"touch-pan-y",
			"overscroll-y-contain",
			"grid-cols-2",
			"md:grid-cols-3",
			"xl:grid-cols-4",
			"2xl:grid-cols-5",
		)
		expect(screen.getByText("Academic Research")).toBeInTheDocument()
		expect(screen.getByText("Tech Dark")).toBeInTheDocument()
	})

	it("does not apply the card entry animation when it is disabled", () => {
		render(<SlidesPresetGrid templates={mockTemplates} disableEntryAnimation />)

		const firstCardContainer = screen.getAllByTestId("slides-preset-card")[0].parentElement
		expect(firstCardContainer).not.toHaveAttribute("style")
	})

	it("keeps content visibility optimization by default", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		const firstCardContainer = screen.getAllByTestId("slides-preset-card")[0].parentElement
		expect(firstCardContainer).toHaveClass("[content-visibility:auto]")
		expect(firstCardContainer).toHaveClass("[contain-intrinsic-size:260px]")
	})

	it("disables content visibility optimization for mobile drawers", () => {
		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				disableEntryAnimation
				disableContentVisibility
			/>,
		)

		const firstCardContainer = screen.getAllByTestId("slides-preset-card")[0].parentElement
		expect(firstCardContainer).not.toHaveClass("[content-visibility:auto]")
		expect(firstCardContainer).not.toHaveClass("[contain-intrinsic-size:260px]")
	})

	it("disables content visibility optimization for touch-first tablets", () => {
		mockPointerDevice({ canHover: true, maxTouchPoints: 5 })
		render(<SlidesPresetGrid templates={mockTemplates} />)

		const firstCardContainer = screen.getAllByTestId("slides-preset-card")[0].parentElement
		expect(firstCardContainer).not.toHaveClass("[content-visibility:auto]")
		expect(firstCardContainer).not.toHaveClass("[contain-intrinsic-size:260px]")
	})

	it("shows the featured icon before the title and usage in the card corner", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		const featuredBadge = screen.getByTestId("slides-preset-card-featured-badge")
		const usageCount = screen.getByTestId("slides-preset-card-usage-count")

		expect(featuredBadge).not.toHaveTextContent("精选")
		expect(featuredBadge).toHaveClass(
			"size-5",
			"rounded-full",
			"bg-amber-300",
			"text-amber-950",
		)
		expect(featuredBadge.querySelector("svg")).not.toBeNull()
		expect(usageCount).toHaveAttribute("data-usage-count", "23")
		expect(usageCount).toHaveClass(
			"bottom-2",
			"right-2",
			"inline-flex",
			"items-center",
			"text-white",
			"group-hover:opacity-0",
		)
		expect(usageCount).not.toHaveClass("bg-background/92", "rounded-full")
		expect(usageCount.querySelector("svg")).not.toBeNull()
		expect(screen.getByTestId("slides-preset-card-usage-backdrop")).toHaveClass(
			"bg-gradient-to-t",
			"from-black/[0.58]",
		)
	})

	it("selects a template when card is clicked", () => {
		const handleTemplateClick = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} onTemplateClick={handleTemplateClick} />)

		fireEvent.click(screen.getByText("Academic Research"))

		expect(handleTemplateClick).toHaveBeenCalledWith(mockTemplates[0])
	})

	it("toggles favorite without selecting the template", () => {
		const handleTemplateClick = vi.fn()
		const handleFavoriteToggle = vi.fn()
		const { rerender } = render(
			<SlidesPresetGrid
				templates={mockTemplates}
				onTemplateClick={handleTemplateClick}
				onFavoriteToggle={handleFavoriteToggle}
			/>,
		)

		fireEvent.click(screen.getAllByTestId("slides-preset-card-favorite-button")[0])

		const favoriteButton = screen.getAllByTestId("slides-preset-card-favorite-button")[0]
		expect(handleFavoriteToggle).toHaveBeenCalledWith(mockTemplates[0])
		expect(handleTemplateClick).not.toHaveBeenCalled()
		expect(favoriteButton).toHaveClass("active:scale-[0.96]")
		expect(favoriteButton.querySelector("[data-favorite-state]")).toHaveAttribute(
			"data-favorite-state",
			"unfavorite",
		)

		fireEvent.keyDown(favoriteButton, {
			key: "Enter",
		})
		expect(handleTemplateClick).not.toHaveBeenCalled()

		rerender(
			<SlidesPresetGrid
				templates={[{ ...mockTemplates[0], is_favorite: true }, mockTemplates[1]]}
				onTemplateClick={handleTemplateClick}
				onFavoriteToggle={handleFavoriteToggle}
			/>,
		)
		expect(
			screen
				.getAllByTestId("slides-preset-card-favorite-button")[0]
				.querySelector("[data-favorite-state]"),
		).toHaveAttribute("data-favorite-state", "favorite")
	})

	it("opens the source project without selecting the template", () => {
		const template = {
			...mockTemplates[0],
			project: { id: "project-1", directory_id: "directory-1" },
		}
		const handleTemplateClick = vi.fn()
		const handleOpenProject = vi.fn()

		render(
			<SlidesPresetGrid
				templates={[template]}
				onTemplateClick={handleTemplateClick}
				onOpenProject={handleOpenProject}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-preset-card-open-project-button"))

		expect(handleOpenProject).toHaveBeenCalledWith(template)
		expect(handleTemplateClick).not.toHaveBeenCalled()
	})

	it("removes a template without selecting it", () => {
		const handleTemplateClick = vi.fn()
		const handleRemove = vi.fn()

		render(
			<SlidesPresetGrid
				templates={[mockTemplates[0]]}
				onTemplateClick={handleTemplateClick}
				onRemove={handleRemove}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-preset-card-remove-button"))

		expect(handleRemove).toHaveBeenCalledWith(mockTemplates[0])
		expect(handleTemplateClick).not.toHaveBeenCalled()
	})

	it("restores the selection button and shows selected state", () => {
		const handleTemplateClick = vi.fn()
		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				selectedTemplate={mockTemplates[0]}
				onTemplateClick={handleTemplateClick}
			/>,
		)

		const useButtons = screen.getAllByTestId("slides-preset-card-use-button")
		const actionGroups = screen.getAllByTestId("slides-preset-card-action-group")
		expect(useButtons[0]).toHaveTextContent("playbook.edit.presets.form.selected")
		expect(useButtons[0]).toHaveAttribute("aria-pressed", "true")
		expect(actionGroups[0]).toHaveClass("translate-y-0", "opacity-100")

		fireEvent.click(useButtons[1])
		expect(handleTemplateClick).toHaveBeenCalledWith(mockTemplates[1])
	})

	it("shows a lightweight refreshing indicator without hiding existing cards", () => {
		render(<SlidesPresetGrid templates={mockTemplates} isRefreshing />)

		expect(screen.getByTestId("slides-preset-grid-refreshing")).toBeInTheDocument()
		expect(screen.getByText("Academic Research")).toBeInTheDocument()
	})

	it("opens preview without selecting the template", () => {
		const handleTemplateClick = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} onTemplateClick={handleTemplateClick} />)

		const previewButtons = screen.getAllByTestId("slides-preset-card-preview-button")
		fireEvent.click(previewButtons[0])

		expect(handleTemplateClick).not.toHaveBeenCalled()
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
		expect(screen.getByTestId("slides-preset-preview-dialog-pages")).toBeInTheDocument()
		expect(screen.getByRole("img", { name: "Academic Preview 1" })).toHaveAttribute(
			"src",
			"https://example.com/academic-page-1.png",
		)
		expect(screen.getByRole("img", { name: "Academic Preview 1" })).toHaveAttribute(
			"crossorigin",
			"anonymous",
		)
		const previewStage = screen.getByTestId("slides-preset-preview-dialog-pages")
		const pageIndex = screen.getByTestId("slides-preset-preview-dialog-page-index")

		expect(pageIndex).toHaveTextContent("1 / 2")
		expect(pageIndex).toHaveClass("absolute", "bottom-0", "right-0")
		expect(previewStage).not.toContainElement(pageIndex)
		expect(
			screen.queryByTestId("slides-preset-preview-dialog-previous-button"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("slides-preset-preview-dialog-next-button"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("slides-preset-preview-dialog-thumbnail-strip")).toHaveClass(
			"overflow-hidden",
			"p-2",
		)

		const secondPageButton = screen.getByRole("button", { name: "Academic Preview 2" })
		expect(secondPageButton).toHaveClass("w-[156px]", "sm:w-[220px]", "xl:w-[264px]")
		expect(secondPageButton).toHaveTextContent("2")
		expect(secondPageButton).not.toHaveTextContent("#2")

		fireEvent.click(secondPageButton)

		expect(screen.getByRole("img", { name: "Academic Preview 2" })).toHaveAttribute(
			"src",
			"https://example.com/academic-page-2.png",
		)
	})

	it("notifies the parent before mounting the preview dialog", () => {
		const handlePreviewOpenChange = vi.fn((open: boolean) => {
			if (open) {
				expect(
					screen.queryByTestId("slides-preset-preview-dialog-content"),
				).not.toBeInTheDocument()
			}
		})

		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				onPreviewOpenChange={handlePreviewOpenChange}
			/>,
		)
		fireEvent.click(screen.getAllByTestId("slides-preset-card-preview-button")[0])

		expect(handlePreviewOpenChange).toHaveBeenCalledWith(true)
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
	})

	it("shows persistent preview buttons on touch devices", () => {
		mockPointerDevice({ canHover: false, maxTouchPoints: 5 })
		mockUseIsMobile.mockReturnValue(true)
		render(<SlidesPresetGrid templates={mockTemplates} />)

		const previewButtons = screen.getAllByTestId("slides-preset-card-touch-preview-button")
		expect(previewButtons).toHaveLength(mockTemplates.length)
		expect(screen.queryByTestId("slides-preset-card-preview-button")).not.toBeInTheDocument()

		fireEvent.click(previewButtons[0])
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
		expect(screen.getByTestId("on-open-change")).toHaveClass("left-[10px]")
		expect(screen.getByTestId("on-open-change")).not.toHaveClass("right-[10px]")
	})

	it("shows the selected status in the top-right corner on touch devices", () => {
		mockPointerDevice({ canHover: false, maxTouchPoints: 5 })
		render(<SlidesPresetGrid templates={mockTemplates} selectedTemplate={mockTemplates[0]} />)

		const selectedActionGroup = screen.getAllByTestId("slides-preset-card-action-group")[0]
		expect(selectedActionGroup).toHaveClass("absolute", "right-2", "top-2", "opacity-100")
		expect(screen.getAllByTestId("slides-preset-card-use-button")[0]).toHaveTextContent(
			"playbook.edit.presets.form.selected",
		)
	})

	it("loads template detail when opening a preview", async () => {
		const onPreviewDetailLoad = vi.fn().mockResolvedValue(mockTemplates[0])
		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				onPreviewDetailLoad={onPreviewDetailLoad}
			/>,
		)

		fireEvent.click(screen.getAllByTestId("slides-preset-card-preview-button")[0])

		await waitFor(() => expect(onPreviewDetailLoad).toHaveBeenCalledWith(mockTemplates[0]))
	})

	it("opens the preview in a managed bottom drawer on mobile", () => {
		mockUseIsMobile.mockReturnValue(true)
		mockPointerDevice({ canHover: false, maxTouchPoints: 5 })
		render(<SlidesPresetGrid templates={mockTemplates} />)

		fireEvent.click(screen.getAllByTestId("slides-preset-card-touch-preview-button")[0])

		const drawerContent = document.querySelector('[data-slot="drawer-content"]')
		expect(drawerContent).toHaveClass("z-popup")
		expect(drawerContent).toHaveAttribute("data-vaul-drawer-direction", "bottom")
		expect(drawerContent).not.toHaveClass(
			"h-[min(90dvh,calc(100dvh-var(--safe-area-inset-top)-0.5rem))]",
		)
		expect(screen.getByTestId("slides-preset-preview-dialog-content")).toBeInTheDocument()
	})

	it("uses the same wheel and keyboard page navigation in the preview dialog", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		fireEvent.click(screen.getAllByTestId("slides-preset-card-preview-button")[0])

		fireEvent.wheel(screen.getByTestId("slides-preset-preview-dialog-pages"), {
			deltaY: 100,
		})
		expect(screen.getByRole("img", { name: "Academic Preview 2" })).toHaveAttribute(
			"src",
			"https://example.com/academic-page-2.png",
		)

		fireEvent.keyDown(document, { key: "ArrowRight" })
		expect(screen.getByRole("img", { name: "Academic Preview 1" })).toHaveAttribute(
			"src",
			"https://example.com/academic-page-1.png",
		)

		fireEvent.keyDown(document, { key: "ArrowLeft" })
		expect(screen.getByRole("img", { name: "Academic Preview 2" })).toHaveAttribute(
			"src",
			"https://example.com/academic-page-2.png",
		)
	})

	it("closes the preview dialog with Escape", () => {
		render(<SlidesPresetGrid templates={mockTemplates} />)

		// 第二个模板只有 iframe 预览，用来覆盖没有多页导航时仍可按 Esc 退出的场景。
		fireEvent.click(screen.getAllByTestId("slides-preset-card-preview-button")[1])
		fireEvent.keyDown(document, { key: "Escape" })

		expect(screen.queryByTestId("slides-preset-preview-dialog-content")).not.toBeInTheDocument()
	})

	it("notifies preview open state changes", async () => {
		const handlePreviewOpenChange = vi.fn()

		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				onPreviewOpenChange={handlePreviewOpenChange}
			/>,
		)

		await waitFor(() => expect(handlePreviewOpenChange).toHaveBeenLastCalledWith(false))

		fireEvent.click(screen.getAllByTestId("slides-preset-card-preview-button")[0])

		await waitFor(() => expect(handlePreviewOpenChange).toHaveBeenLastCalledWith(true))

		fireEvent.click(screen.getByTestId("on-open-change"))

		await waitFor(() => expect(handlePreviewOpenChange).toHaveBeenLastCalledWith(false))
	})

	it("preloads preview iframe after hovering a card for 300ms", async () => {
		const onPreviewDetailLoad = vi.fn().mockResolvedValue(mockTemplates[0])
		vi.useFakeTimers()

		try {
			render(
				<SlidesPresetGrid
					templates={mockTemplates}
					onPreviewDetailLoad={onPreviewDetailLoad}
				/>,
			)

			fireEvent.mouseEnter(screen.getAllByTestId("slides-preset-card")[0])

			act(() => {
				vi.advanceTimersByTime(299)
			})

			expect(
				screen.queryByTestId("slides-preset-preview-preload-iframe"),
			).not.toBeInTheDocument()

			await act(async () => {
				vi.advanceTimersByTime(1)
				await Promise.resolve()
			})

			expect(onPreviewDetailLoad).toHaveBeenCalledWith(mockTemplates[0])
			expect(screen.getByTestId("slides-preset-preview-preload-iframe")).toHaveAttribute(
				"src",
				"https://example.com/academic-preview",
			)
		} finally {
			vi.useRealTimers()
		}
	})

	it("shows the hover card after 1 second with the collage returned by template detail", async () => {
		const detailTemplate = {
			...mockTemplates[0],
			collage_url: "https://example.com/academic-collage.png",
		}
		const onPreviewDetailLoad = vi.fn().mockResolvedValue(detailTemplate)
		vi.useFakeTimers()

		try {
			render(
				<SlidesPresetGrid
					templates={mockTemplates}
					onPreviewDetailLoad={onPreviewDetailLoad}
				/>,
			)

			const firstCard = screen.getAllByTestId("slides-preset-card")[0]
			fireEvent.pointerEnter(firstCard)
			fireEvent.mouseEnter(firstCard)

			await act(async () => {
				vi.advanceTimersByTime(300)
				await Promise.resolve()
			})

			expect(onPreviewDetailLoad).toHaveBeenCalledWith(mockTemplates[0])
			expect(
				screen.queryByAltText("Academic Research collage preview"),
			).not.toBeInTheDocument()

			act(() => {
				vi.advanceTimersByTime(699)
			})

			expect(
				screen.queryByAltText("Academic Research collage preview"),
			).not.toBeInTheDocument()

			act(() => {
				vi.advanceTimersByTime(1)
			})

			expect(screen.getByAltText("Academic Research collage preview")).toHaveAttribute(
				"src",
				"https://example.com/academic-collage.png",
			)
		} finally {
			vi.useRealTimers()
		}
	})

	it("keeps the current favorite state when hover detail is stale", async () => {
		const favoriteTemplate = {
			...mockTemplates[0],
			is_favorite: true,
			project: { id: "project-1", directory_id: "directory-1" },
		}
		const staleDetailTemplate = { ...mockTemplates[0], is_favorite: false }
		const onPreviewDetailLoad = vi.fn().mockResolvedValue(staleDetailTemplate)
		const onFavoriteToggle = vi.fn()
		const onOpenProject = vi.fn()
		vi.useFakeTimers()

		try {
			render(
				<SlidesPresetGrid
					templates={[favoriteTemplate, mockTemplates[1]]}
					onPreviewDetailLoad={onPreviewDetailLoad}
					onFavoriteToggle={onFavoriteToggle}
					onOpenProject={onOpenProject}
				/>,
			)

			const firstCard = screen.getAllByTestId("slides-preset-card")[0]
			fireEvent.mouseEnter(firstCard)

			await act(async () => {
				vi.advanceTimersByTime(300)
				await Promise.resolve()
			})

			const favoriteButton = screen.getAllByTestId("slides-preset-card-favorite-button")[0]
			expect(favoriteButton).toHaveAttribute("aria-pressed", "true")
			expect(favoriteButton).toHaveAttribute("aria-label", "mySlidesTemplates.unfavorite")
			expect(
				screen.getAllByTestId("slides-preset-card-open-project-button")[0],
			).toBeInTheDocument()
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not preload preview iframe on touch devices", () => {
		mockPointerDevice({ canHover: true, maxTouchPoints: 5 })
		vi.useFakeTimers()

		try {
			render(<SlidesPresetGrid templates={mockTemplates} />)

			fireEvent.mouseEnter(screen.getAllByTestId("slides-preset-card")[0])

			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(
				screen.queryByTestId("slides-preset-preview-preload-iframe"),
			).not.toBeInTheDocument()
		} finally {
			vi.useRealTimers()
		}
	})

	it("loads more when the grid scrolls near the bottom", () => {
		const handleLoadMore = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} hasMore onLoadMore={handleLoadMore} />)

		const grid = screen.getByTestId("slides-preset-grid")
		Object.defineProperty(grid, "scrollHeight", { value: 1000, configurable: true })
		Object.defineProperty(grid, "clientHeight", { value: 300, configurable: true })
		Object.defineProperty(grid, "scrollTop", { value: 620, configurable: true })

		fireEvent.scroll(grid)

		expect(handleLoadMore).toHaveBeenCalledTimes(1)
	})

	it("loads more when the bottom sentinel enters the viewport", () => {
		const handleLoadMore = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} hasMore onLoadMore={handleLoadMore} />)

		notifyIntersection(screen.getByTestId("slides-preset-grid-load-more-sentinel"))

		expect(handleLoadMore).toHaveBeenCalledTimes(1)
	})

	it("deduplicates repeated near-bottom scroll events before loading state updates", () => {
		const handleLoadMore = vi.fn()

		render(<SlidesPresetGrid templates={mockTemplates} hasMore onLoadMore={handleLoadMore} />)

		const grid = screen.getByTestId("slides-preset-grid")
		Object.defineProperty(grid, "scrollHeight", { value: 1000, configurable: true })
		Object.defineProperty(grid, "clientHeight", { value: 300, configurable: true })
		Object.defineProperty(grid, "scrollTop", { value: 620, configurable: true })

		fireEvent.scroll(grid)
		fireEvent.scroll(grid)

		expect(handleLoadMore).toHaveBeenCalledTimes(1)
	})

	it("does not load more while a load-more request is active", () => {
		const handleLoadMore = vi.fn()

		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				hasMore
				isLoadingMore
				onLoadMore={handleLoadMore}
			/>,
		)

		const grid = screen.getByTestId("slides-preset-grid")
		Object.defineProperty(grid, "scrollHeight", { value: 1000, configurable: true })
		Object.defineProperty(grid, "clientHeight", { value: 300, configurable: true })
		Object.defineProperty(grid, "scrollTop", { value: 620, configurable: true })

		fireEvent.scroll(grid)

		expect(handleLoadMore).not.toHaveBeenCalled()
	})

	it("pauses observer loading after a failed append and exposes a manual retry", () => {
		const handleLoadMore = vi.fn()
		const handleRetryLoadMore = vi.fn()

		render(
			<SlidesPresetGrid
				templates={mockTemplates}
				hasMore
				isLoadMoreFailed
				onLoadMore={handleLoadMore}
				onRetryLoadMore={handleRetryLoadMore}
			/>,
		)

		notifyIntersection(screen.getByTestId("slides-preset-grid-load-more-sentinel"))
		expect(handleLoadMore).not.toHaveBeenCalled()

		fireEvent.click(screen.getByTestId("slides-preset-grid-load-more-retry"))
		expect(handleRetryLoadMore).toHaveBeenCalledTimes(1)
	})
})
