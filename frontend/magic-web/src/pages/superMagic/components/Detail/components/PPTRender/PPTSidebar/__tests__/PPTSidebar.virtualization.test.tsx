import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { HTMLAttributes, ReactNode, Ref } from "react"
import type { Range, VirtualItem } from "@tanstack/react-virtual"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PPTSidebar from "../index"
import type { SlideItem, SortableSlideItemProps } from "../types"

interface ScrollAreaMockProps extends HTMLAttributes<HTMLDivElement> {
	children?: ReactNode
	viewportClassName?: string
	viewportId?: string
	viewportRef?: Ref<HTMLDivElement>
	scrollbarOrientation?: "horizontal" | "vertical"
}

interface CapturedVirtualizerOptions {
	count: number
	estimateSize: () => number
	getItemKey: (index: number) => string | number | bigint
	getScrollElement: () => HTMLDivElement | null
	overscan?: number
	horizontal?: boolean
	rangeExtractor?: (range: Range) => number[]
}

const mockState = vi.hoisted(() => {
	const values = {
		virtualItems: [] as VirtualItem[],
		totalSize: 0,
	}

	return {
		previewOverscan: 10,
		store: {
			slides: [] as SlideItem[],
			activeIndex: 0,
			ensureSlideScreenshot: vi.fn(),
			updateVisibleSlidePreviews: vi.fn(),
			getFileIdByPath: vi.fn((path: string) => `file-${path}`),
			getFullRelativePath: vi.fn((path: string) => `/ppt/${path}`),
		},
		values,
		options: null as CapturedVirtualizerOptions | null,
		virtualizer: {
			getVirtualItems: vi.fn(() => values.virtualItems),
			getTotalSize: vi.fn(() => values.totalSize),
			range: { startIndex: 0, endIndex: 9 },
			measureElement: vi.fn(),
			measure: vi.fn(),
			scrollToIndex: vi.fn(),
		},
	}
})

vi.mock("@tanstack/react-virtual", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-virtual")>()
	return {
		...actual,
		useVirtualizer: (options: CapturedVirtualizerOptions) => {
			mockState.options = options
			return mockState.virtualizer
		},
	}
})

vi.mock("../SortableSlideItem", () => ({
	default: ({
		item,
		className,
		allowEdit,
		isMobile,
		onSlideDragStart,
		slideDimensions,
	}: SortableSlideItemProps) => (
		<div
			data-testid={`ppt-sidebar-slide-item-${item.id}`}
			data-slide-aspect-ratio={
				slideDimensions ? `${slideDimensions.width}/${slideDimensions.height}` : undefined
			}
			className={className}
			draggable={allowEdit && !isMobile}
			onDragStart={(event) => onSlideDragStart?.(event, item.id)}
		/>
	),
}))

vi.mock("../utils/devicePerformance", () => ({
	getPPTPreviewOverscan: () => mockState.previewOverscan,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("@/components/shadcn-ui/tooltip", () => ({
	TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
	Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
	TooltipContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
	TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/scroll-area", async () => {
	const { forwardRef } = await vi.importActual<typeof import("react")>("react")

	return {
		ScrollArea: forwardRef<HTMLDivElement, ScrollAreaMockProps>(
			(
				{
					children,
					viewportClassName,
					viewportId,
					viewportRef,
					scrollbarOrientation,
					...rootProps
				},
				rootRef,
			) => (
				<div ref={rootRef} data-scrollbar-orientation={scrollbarOrientation} {...rootProps}>
					<div
						ref={viewportRef}
						id={viewportId}
						data-slot="scroll-area-viewport"
						className={viewportClassName}
					>
						<div>{children}</div>
					</div>
				</div>
			),
		),
	}
})

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Locate_File_In_Tree: "Locate_File_In_Tree",
	},
}))

vi.mock("../../hooks", () => ({
	usePPTStore: () => mockState.store,
}))

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
	},
}))

function makeVirtualItem(index: number, start = 8, size = 128): VirtualItem {
	return {
		key: `slide-${index + 1}`,
		index,
		start: start + index * size,
		end: start + (index + 1) * size,
		size,
		lane: 0,
	}
}

function makeSlides(count: number): SlideItem[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `slide-${index + 1}`,
		index,
		path: `slide-${index + 1}.html`,
		title: `Slide ${index + 1}`,
	}))
}

describe("PPTSidebar virtualization", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockState.store.slides = makeSlides(500)
		mockState.store.activeIndex = 0
		mockState.previewOverscan = 10
		mockState.values.virtualItems = Array.from({ length: 10 }, (_, index) =>
			makeVirtualItem(index),
		)
		mockState.values.totalSize = 64_016
		mockState.options = null
	})

	it("mounts only the virtual range for a 500-slide deck", async () => {
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} />)

		expect(screen.getAllByTestId(/^ppt-sidebar-slide-item-/)).toHaveLength(10)
		expect(screen.queryByTestId("ppt-sidebar-slide-item-slide-11")).not.toBeInTheDocument()
		expect(screen.getByTestId("ppt-sidebar-virtual-content")).toHaveStyle({
			height: "64016px",
		})

		const options = mockState.options
		if (!options) throw new Error("useVirtualizer options were not captured")
		expect(options.count).toBe(500)
		expect(options.overscan).toBe(10)
		expect(options.horizontal).toBe(false)
		expect(options.estimateSize()).toBe(128)
		expect(options.getItemKey(499)).toBe("slide-500")
		expect(options.getScrollElement()).toBe(
			screen
				.getByTestId("ppt-sidebar-slides-list")
				.querySelector('[data-slot="scroll-area-viewport"]'),
		)

		await waitFor(() =>
			expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenCalledWith([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			]),
		)
		expect(mockState.store.ensureSlideScreenshot).not.toHaveBeenCalled()
	})

	it("uses the adaptive overscan selected at mount time", () => {
		mockState.previewOverscan = 15
		const onSlideClick = vi.fn()
		const { rerender, unmount } = render(<PPTSidebar onSlideClick={onSlideClick} />)

		expect(mockState.options?.overscan).toBe(15)

		mockState.previewOverscan = 5
		rerender(<PPTSidebar isMobile onSlideClick={onSlideClick} />)
		expect(mockState.options?.overscan).toBe(15)

		unmount()
		render(<PPTSidebar onSlideClick={vi.fn()} />)

		expect(mockState.options?.overscan).toBe(5)
	})

	it("clears queued preview demand when the sidebar unmounts", async () => {
		const { unmount } = render(<PPTSidebar onSlideClick={vi.fn()} />)

		await waitFor(() =>
			expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenCalledWith([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			]),
		)
		unmount()

		expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenLastCalledWith([])
	})

	it("pauses preview demand while the sidebar is hidden and resumes it when shown", async () => {
		const { rerender } = render(<PPTSidebar isPreviewLoadingEnabled onSlideClick={vi.fn()} />)

		await waitFor(() =>
			expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenCalledWith([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			]),
		)

		rerender(<PPTSidebar isPreviewLoadingEnabled={false} onSlideClick={vi.fn()} />)
		expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenLastCalledWith([])

		mockState.store.updateVisibleSlidePreviews.mockClear()
		rerender(<PPTSidebar isPreviewLoadingEnabled onSlideClick={vi.fn()} />)

		await waitFor(() =>
			expect(mockState.store.updateVisibleSlidePreviews).toHaveBeenCalledWith([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			]),
		)
	})

	it("uses horizontal virtualization and a horizontal Radix scrollbar on mobile", () => {
		render(<PPTSidebar isMobile allowEdit onSlideClick={vi.fn()} />)

		const options = mockState.options
		if (!options) throw new Error("useVirtualizer options were not captured")

		expect(options.horizontal).toBe(true)
		expect(options.estimateSize()).toBe(140)
		expect(screen.getByTestId("ppt-sidebar-slides-list")).toHaveAttribute(
			"data-scrollbar-orientation",
			"horizontal",
		)
		expect(screen.getByTestId("ppt-sidebar-virtual-content")).toHaveStyle({
			width: "64016px",
			height: "100%",
		})
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveProperty(
			"draggable",
			false,
		)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveAttribute(
			"data-slide-aspect-ratio",
			"16/9",
		)
	})

	it("estimates desktop rows from the live sidebar width", () => {
		render(<PPTSidebar sidebarWidth={400} onSlideClick={vi.fn()} />)

		const options = mockState.options
		if (!options) throw new Error("useVirtualizer options were not captured")
		expect(options.estimateSize()).toBe(238)
	})

	it("keeps a fixed 16:9 thumbnail row after square slide content loads", () => {
		mockState.store.slides = makeSlides(2)
		mockState.values.virtualItems = [makeVirtualItem(0), makeVirtualItem(1)]
		mockState.values.totalSize = 272

		const { rerender } = render(<PPTSidebar sidebarWidth={200} onSlideClick={vi.fn()} />)

		expect(mockState.options?.estimateSize()).toBe(128)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveAttribute(
			"data-slide-aspect-ratio",
			"16/9",
		)

		mockState.store.slides = mockState.store.slides.map((slide, index) =>
			index === 0
				? {
						...slide,
						content:
							'<main class="slide-container" data-width="1000" data-height="1000"></main>',
					}
				: slide,
		)
		rerender(<PPTSidebar sidebarWidth={200} onSlideClick={vi.fn()} />)

		expect(mockState.options?.estimateSize()).toBe(128)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveAttribute(
			"data-slide-aspect-ratio",
			"16/9",
		)

		const virtualContent = screen.getByTestId("ppt-sidebar-virtual-content")
		expect(virtualContent).not.toHaveClass("px-2")
		const rows = virtualContent.querySelectorAll<HTMLElement>("[data-index]")
		expect(rows).toHaveLength(2)
		rows.forEach((row) => {
			expect(row).toHaveClass("left-2", "right-2", "py-1")
			expect(row).not.toHaveClass("w-full")
		})
		expect(mockState.virtualizer.measureElement).not.toHaveBeenCalled()
	})

	it("keeps the native drag source in the extracted range after it scrolls offscreen", async () => {
		const { rerender } = render(<PPTSidebar allowEdit onSlideClick={vi.fn()} />)
		const draggedSlide = screen.getByTestId("ppt-sidebar-slide-item-slide-1")
		const initialGetItemKey = mockState.options?.getItemKey

		fireEvent.dragStart(draggedSlide, {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})

		await waitFor(() => {
			const options = mockState.options
			if (!options?.rangeExtractor) throw new Error("rangeExtractor was not captured")
			expect(options.getItemKey).toBe(initialGetItemKey)
			const indexes = options.rangeExtractor({
				startIndex: 100,
				endIndex: 105,
				overscan: 6,
				count: 500,
			})
			expect(indexes).toContain(0)
			expect(indexes).toContain(100)
		})

		mockState.values.virtualItems = [
			makeVirtualItem(0),
			...Array.from({ length: 6 }, (_, offset) => makeVirtualItem(100 + offset)),
		]
		rerender(<PPTSidebar allowEdit onSlideClick={vi.fn()} />)

		expect(screen.getAllByTestId(/^ppt-sidebar-slide-item-/)).toHaveLength(7)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveClass("opacity-50")
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-101")).toBeInTheDocument()
	})

	it("replays the latest active slide scroll after dragging ends", async () => {
		const { rerender } = render(<PPTSidebar allowEdit onSlideClick={vi.fn()} />)

		await waitFor(() =>
			expect(mockState.virtualizer.scrollToIndex).toHaveBeenCalledWith(0, {
				align: "auto",
			}),
		)
		mockState.virtualizer.scrollToIndex.mockClear()

		const draggedSlide = screen.getByTestId("ppt-sidebar-slide-item-slide-1")
		fireEvent.dragStart(draggedSlide, {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})

		mockState.store.activeIndex = 42
		rerender(<PPTSidebar allowEdit onSlideClick={vi.fn()} />)
		expect(mockState.virtualizer.scrollToIndex).not.toHaveBeenCalledWith(42, {
			align: "auto",
		})

		fireEvent.dragEnd(draggedSlide)

		await waitFor(() =>
			expect(mockState.virtualizer.scrollToIndex).toHaveBeenCalledWith(42, {
				align: "auto",
			}),
		)
	})
})
