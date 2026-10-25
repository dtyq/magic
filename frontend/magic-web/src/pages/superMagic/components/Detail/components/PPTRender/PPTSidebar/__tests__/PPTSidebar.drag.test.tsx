import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { HTMLAttributes, ReactNode, Ref } from "react"
import type { VirtualItem } from "@tanstack/react-virtual"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PPTSidebar from "../index"
import type { SlideItem } from "../types"
import type { PPTDeckTools } from "../../hooks/usePPTDeckTools"

vi.mock("../PPTDeckToolbar", () => ({ default: () => null }))

interface ScrollAreaMockProps extends HTMLAttributes<HTMLDivElement> {
	children?: ReactNode
	viewportClassName?: string
	viewportId?: string
	viewportRef?: Ref<HTMLDivElement>
	scrollbarOrientation?: "horizontal" | "vertical"
}

const mockState = vi.hoisted(() => {
	const values = {
		virtualItems: [] as VirtualItem[],
		totalSize: 0,
	}

	return {
		store: {
			slides: [] as SlideItem[],
			activeIndex: 0,
			ensureSlideScreenshot: vi.fn(),
			updateVisibleSlidePreviews: vi.fn(),
			getFileIdByPath: vi.fn((path: string) => `file-${path}`),
			getFullRelativePath: vi.fn((path: string) => `/ppt/${path}`),
		},
		values,
		virtualizer: {
			getVirtualItems: vi.fn(() => values.virtualItems),
			getTotalSize: vi.fn(() => values.totalSize),
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
		useVirtualizer: () => mockState.virtualizer,
	}
})

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

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
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

vi.mock("@/pages/superMagic/components/MessageEditor/utils/drag", () => ({
	handlePPTSlideDragStart: vi.fn(),
}))

vi.mock("../hooks/useScreenshotRetry", () => ({
	useScreenshotRetry: () => ({
		canRetry: false,
		manualRetry: vi.fn(),
	}),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/context-menu", () => ({
	ContextMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
	ContextMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
	ContextMenuContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
	ContextMenuItem: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
		<button {...props}>{children}</button>
	),
	ContextMenuSeparator: () => null,
}))

vi.mock("@/components/shadcn-ui/dialog", () => ({
	Dialog: ({ children }: { children?: ReactNode }) => <>{children}</>,
	DialogContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
	DialogDescription: ({ children }: { children?: ReactNode }) => <>{children}</>,
	DialogFooter: ({ children }: { children?: ReactNode }) => <>{children}</>,
	DialogHeader: ({ children }: { children?: ReactNode }) => <>{children}</>,
	DialogTitle: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: Record<string, unknown>) => <input {...props} />,
}))

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
	},
}))

function makeVirtualItem(index: number, start: number, size = 120): VirtualItem {
	return {
		key: `slide-${index + 1}`,
		index,
		start,
		end: start + size,
		size,
		lane: 0,
	}
}

function makeDomRect(top: number, height: number, left = 0, width = 240): DOMRect {
	return {
		x: left,
		y: top,
		top,
		bottom: top + height,
		left,
		right: left + width,
		width,
		height,
		toJSON: () => ({}),
	}
}

function getViewport() {
	const viewport = screen
		.getByTestId("ppt-sidebar-slides-list")
		.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]')

	if (!viewport) throw new Error("PPT sidebar viewport was not rendered")
	return viewport
}

function installViewportMetrics(
	viewport: HTMLDivElement,
	{
		top = 0,
		clientHeight = 500,
		scrollHeight = 500,
		initialScrollTop = 0,
	}: {
		top?: number
		clientHeight?: number
		scrollHeight?: number
		initialScrollTop?: number
	} = {},
) {
	let scrollTop = initialScrollTop
	const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

	Object.defineProperties(viewport, {
		clientHeight: { configurable: true, value: clientHeight },
		scrollHeight: { configurable: true, value: scrollHeight },
		scrollTop: {
			configurable: true,
			get: () => scrollTop,
			set: (value: number) => {
				scrollTop = Math.max(0, Math.min(Number(value), maxScrollTop))
			},
		},
	})
	vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(makeDomRect(top, clientHeight))

	return {
		getScrollTop: () => scrollTop,
	}
}

function createNativeDragEvent(type: "dragover" | "drop", clientY: number) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.defineProperties(event, {
		clientX: { configurable: true, value: 100 },
		clientY: { configurable: true, value: clientY },
		dataTransfer: {
			configurable: true,
			value: { dropEffect: "move" },
		},
	})
	return event
}

function installRafController() {
	const callbacks = new Map<number, FrameRequestCallback>()
	let nextId = 1
	const request = vi.fn((callback: FrameRequestCallback) => {
		const id = nextId++
		callbacks.set(id, callback)
		return id
	})
	const cancel = vi.fn((id: number) => {
		callbacks.delete(id)
	})

	vi.stubGlobal("requestAnimationFrame", request)
	vi.stubGlobal("cancelAnimationFrame", cancel)

	return {
		request,
		cancel,
		flushNext() {
			const entry = callbacks.entries().next().value as
				[number, FrameRequestCallback] | undefined
			if (!entry) return false
			const [id, callback] = entry
			callbacks.delete(id)
			callback(16)
			return true
		},
		get pendingCount() {
			return callbacks.size
		},
	}
}

function makeTools(overrides: Partial<PPTDeckTools> = {}): PPTDeckTools {
	return {
		selected: new Set<string>(),
		selecting: false,
		busy: false,
		select: vi.fn(),
		selectAll: vi.fn(),
		clearSelection: vi.fn(),
		reorder: vi.fn().mockResolvedValue(undefined),
		...overrides,
	} as unknown as PPTDeckTools
}

describe("PPTSidebar drag sorting", () => {
	let rafController: ReturnType<typeof installRafController>

	beforeEach(() => {
		vi.clearAllMocks()
		mockState.store.slides = [
			{ id: "slide-1", index: 0, path: "slide-1.html", title: "Slide 1" },
			{ id: "slide-2", index: 1, path: "slide-2.html", title: "Slide 2" },
			{ id: "slide-3", index: 2, path: "slide-3.html", title: "Slide 3" },
		]
		mockState.store.activeIndex = 0
		mockState.values.virtualItems = [
			makeVirtualItem(0, 0),
			makeVirtualItem(1, 140),
			makeVirtualItem(2, 280),
		]
		mockState.values.totalSize = 400
		rafController = installRafController()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it("uses file identities for modifier selection and keeps plain clicks as navigation", () => {
		const tools = makeTools()
		const onSlideClick = vi.fn()
		render(<PPTSidebar allowEdit tools={tools} onSlideClick={onSlideClick} />)
		fireEvent.click(screen.getByTestId("ppt-sidebar-slide-item-slide-1"))
		expect(onSlideClick).toHaveBeenCalledExactlyOnceWith(0)
		fireEvent.click(screen.getByTestId("ppt-sidebar-slide-item-slide-2"), { ctrlKey: true })
		fireEvent.click(screen.getByTestId("ppt-sidebar-slide-item-slide-3"), { shiftKey: true })
		expect(tools.select).toHaveBeenNthCalledWith(1, "file-slide-2.html", false)
		expect(tools.select).toHaveBeenNthCalledWith(2, "file-slide-3.html", true)
		expect(onSlideClick).toHaveBeenCalledTimes(1)
	})

	it("shows selection separately from the active slide and scopes keyboard shortcuts to the sidebar", () => {
		const tools = makeTools({ selecting: true, selected: new Set(["file-slide-2.html"]) })
		const onSlideClick = vi.fn()
		render(
			<PPTSidebar
				allowEdit
				tools={tools}
				hiddenPaths={new Set(["slide-2.html"])}
				onSlideClick={onSlideClick}
			/>,
		)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-2")).toHaveAttribute(
			"data-selected",
			"true",
		)
		expect(screen.getByText("ppt.batch.hidden")).toBeInTheDocument()
		fireEvent.click(screen.getAllByRole("checkbox")[0])
		expect(tools.select).toHaveBeenCalledWith("file-slide-1.html", false)
		expect(onSlideClick).not.toHaveBeenCalled()
		const sidebar = screen.getByTestId("ppt-sidebar")
		fireEvent.keyDown(sidebar, { key: "a", metaKey: true })
		expect(tools.selectAll).toHaveBeenCalledTimes(1)
		fireEvent.keyDown(sidebar, { key: "Escape" })
		expect(tools.clearSelection).toHaveBeenCalledTimes(1)
		const input = document.createElement("input")
		sidebar.append(input)
		fireEvent.keyDown(input, { key: "a", ctrlKey: true })
		expect(tools.selectAll).toHaveBeenCalledTimes(1)
	})

	it("moves the selected group in original order and waits for confirmed store changes", async () => {
		const tools = makeTools({ selected: new Set(["file-slide-1.html", "file-slide-2.html"]) })
		const onSortChange = vi.fn()
		render(
			<PPTSidebar
				allowEdit
				tools={tools}
				onSlideClick={vi.fn()}
				onSortChange={onSortChange}
			/>,
		)
		installViewportMetrics(getViewport())
		const list = screen.getByTestId("ppt-sidebar-slides-list")
		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
		})
		fireEvent.drop(list)
		expect(tools.reorder).toHaveBeenCalledExactlyOnceWith([
			"slide-3.html",
			"slide-1.html",
			"slide-2.html",
		])
		expect(onSortChange).not.toHaveBeenCalled()
		expect(
			screen
				.getAllByTestId(/^ppt-sidebar-slide-item-/)
				.map((element) => element.dataset.slideId),
		).toEqual(["slide-1", "slide-2", "slide-3"])
	})

	it("prevents drag writes while a batch is busy", () => {
		const tools = makeTools({ busy: true })
		render(<PPTSidebar allowEdit tools={tools} onSlideClick={vi.fn()} />)
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).toHaveAttribute(
			"draggable",
			"false",
		)
		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		fireEvent.drop(screen.getByTestId("ppt-sidebar-slides-list"))
		expect(tools.reorder).not.toHaveBeenCalled()
	})

	it("cancels a drop if a path resolves to a different file after drag start", () => {
		const tools = makeTools({ selected: new Set(["file-slide-1.html", "file-slide-2.html"]) })
		render(<PPTSidebar allowEdit tools={tools} onSlideClick={vi.fn()} />)
		installViewportMetrics(getViewport())
		const list = screen.getByTestId("ppt-sidebar-slides-list")
		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
		})
		mockState.store.getFileIdByPath.mockReturnValueOnce("replaced-file")
		fireEvent.drop(list)
		expect(tools.reorder).not.toHaveBeenCalled()
	})

	it("sorts into whitespace between two virtual rows", async () => {
		const onSortChange = vi.fn()
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)
		const viewport = getViewport()
		installViewportMetrics(viewport)
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-3"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 130))
		})

		expect(screen.getByTestId("ppt-sidebar-drop-indicator")).toHaveAttribute(
			"data-drop-target",
			"1",
		)
		fireEvent.drop(list)

		await waitFor(() => expect(onSortChange).toHaveBeenCalledTimes(1))
		expect(onSortChange.mock.calls[0][0].map((item: SlideItem) => item.id)).toEqual([
			"slide-1",
			"slide-3",
			"slide-2",
		])
	})

	it("exposes duplicate page in the editable context menu", async () => {
		const onDuplicateSlide = vi.fn()
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onDuplicateSlide={onDuplicateSlide} />)

		await act(async () => fireEvent.click(screen.getAllByText("fileViewer.duplicateSlide")[0]))

		expect(onDuplicateSlide).toHaveBeenCalledWith(0)
	})

	it.each([
		["onDuplicateSlide", "fileViewer.duplicateSlide"],
		["onInsertSlide", "fileViewer.insertAbove"],
		["onRefreshSlide", "fileViewer.refreshSlide"],
	] as const)("tracks the full %s promise and prevents repeated actions", async (prop, label) => {
		let finish!: () => void
		const action = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		)
		const callbacks = { [prop]: action }
		const { rerender } = render(<PPTSidebar allowEdit onSlideClick={vi.fn()} {...callbacks} />)
		const slide = within(screen.getByTestId("ppt-sidebar-slide-item-slide-1"))
		fireEvent.click(screen.getAllByRole("button", { name: label })[0])
		expect(slide.getByRole("status")).toHaveTextContent(label)
		expect(slide.getByRole("status").querySelector(".animate-spin")).not.toBeNull()
		fireEvent.click(screen.getAllByRole("button", { name: label })[0])
		expect(action).toHaveBeenCalledOnce()
		// A deck write disables edit entry points; its existing progress must remain visible.
		rerender(<PPTSidebar allowEdit={false} onSlideClick={vi.fn()} {...callbacks} />)
		expect(screen.getByRole("status")).toHaveTextContent(label)
		await act(async () => finish())
		expect(screen.queryByRole("status")).not.toBeInTheDocument()
	})

	it.each([true, false])("keeps rename input until its result is %s", async (success) => {
		let finish!: (result: boolean) => void
		const onRenameSlide = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve
				}),
		)
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onRenameSlide={onRenameSlide} />)
		fireEvent.click(screen.getAllByRole("button", { name: "fileViewer.renameSlide" })[0])
		fireEvent.change(screen.getAllByTestId("ppt-sidebar-rename-dialog-input")[0], {
			target: { value: "renamed" },
		})
		const confirm = screen.getAllByTestId("ppt-sidebar-rename-dialog-confirm")[0]
		fireEvent.click(confirm)
		expect(confirm).toBeDisabled()
		expect(confirm).toHaveAttribute("aria-busy", "true")
		fireEvent.click(confirm)
		expect(onRenameSlide).toHaveBeenCalledOnce()
		await act(async () => finish(success))
		expect(confirm).toHaveAttribute("aria-busy", "false")
		expect(screen.getAllByTestId("ppt-sidebar-rename-dialog-input")[0]).toHaveValue(
			success ? "" : "renamed",
		)
	})

	it("sorts into whitespace below the final virtual row", async () => {
		const onSortChange = vi.fn()
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)
		const viewport = getViewport()
		installViewportMetrics(viewport)
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
		})

		expect(screen.getByTestId("ppt-sidebar-drop-indicator")).toHaveAttribute(
			"data-drop-target",
			"3",
		)
		fireEvent.drop(list)

		await waitFor(() => expect(onSortChange).toHaveBeenCalledTimes(1))
		expect(onSortChange.mock.calls[0][0].map((item: SlideItem) => item.id)).toEqual([
			"slide-2",
			"slide-3",
			"slide-1",
		])
	})

	it("sorts the first slide to the final gap in a 500-slide scrolled deck", async () => {
		const onSortChange = vi.fn()
		mockState.store.slides = Array.from({ length: 500 }, (_, index) => ({
			id: `slide-${index + 1}`,
			index,
			path: `slide-${index + 1}.html`,
			title: `Slide ${index + 1}`,
		}))
		mockState.values.virtualItems = [
			makeVirtualItem(0, 0),
			makeVirtualItem(497, 69_580),
			makeVirtualItem(498, 69_720),
			makeVirtualItem(499, 69_860),
		]
		mockState.values.totalSize = 70_000

		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)
		const viewport = getViewport()
		installViewportMetrics(viewport, {
			clientHeight: 500,
			scrollHeight: 70_000,
			initialScrollTop: 69_500,
		})
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 490))
		})

		expect(screen.getByTestId("ppt-sidebar-drop-indicator")).toHaveAttribute(
			"data-drop-target",
			"500",
		)
		fireEvent.drop(list)

		await waitFor(() => expect(onSortChange).toHaveBeenCalledTimes(1))
		const sortedSlides = onSortChange.mock.calls[0][0] as SlideItem[]
		expect(sortedSlides).toHaveLength(500)
		expect(sortedSlides.at(-1)?.id).toBe("slide-1")
	})

	it("commits the latest gap when dragover and drop happen in one React batch", async () => {
		const onSortChange = vi.fn()
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)
		const viewport = getViewport()
		installViewportMetrics(viewport)
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 130))
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
			list.dispatchEvent(createNativeDragEvent("drop", 480))
		})

		await waitFor(() => expect(onSortChange).toHaveBeenCalledTimes(1))
		expect(onSortChange.mock.calls[0][0].map((item: SlideItem) => item.id)).toEqual([
			"slide-2",
			"slide-3",
			"slide-1",
		])
	})

	it("cancels the edge auto-scroll frame when the native drag ends", () => {
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={vi.fn()} />)
		const viewport = getViewport()
		const metrics = installViewportMetrics(viewport, {
			top: 100,
			clientHeight: 400,
			scrollHeight: 4_000,
			initialScrollTop: 100,
		})
		const list = screen.getByTestId("ppt-sidebar-slides-list")
		const draggedSlide = screen.getByTestId("ppt-sidebar-slide-item-slide-1")

		fireEvent.dragStart(draggedSlide, {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 495))
		})

		expect(rafController.request).toHaveBeenCalledTimes(1)
		expect(rafController.pendingCount).toBe(1)
		act(() => {
			rafController.flushNext()
		})
		const scrolledTop = metrics.getScrollTop()
		expect(scrolledTop).toBeGreaterThan(100)
		expect(rafController.pendingCount).toBe(1)

		fireEvent.dragEnd(draggedSlide)

		expect(rafController.cancel).toHaveBeenCalledTimes(1)
		expect(rafController.pendingCount).toBe(0)
		act(() => {
			rafController.flushNext()
		})
		expect(metrics.getScrollTop()).toBe(scrolledTop)
	})

	it("stops the edge auto-scroll loop at the physical scroll boundary", () => {
		render(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={vi.fn()} />)
		const viewport = getViewport()
		const metrics = installViewportMetrics(viewport, {
			clientHeight: 400,
			scrollHeight: 4_000,
			initialScrollTop: 3_600,
		})
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 399))
			rafController.flushNext()
		})

		expect(metrics.getScrollTop()).toBe(3_600)
		expect(rafController.pendingCount).toBe(0)
	})

	it("cancels the sort when the store structure changes during a drag", async () => {
		const onSortChange = vi.fn()
		const { rerender } = render(
			<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />,
		)
		const viewport = getViewport()
		installViewportMetrics(viewport, { scrollHeight: 600 })
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		mockState.store.slides = [
			...mockState.store.slides,
			{ id: "slide-4", index: 3, path: "slide-4.html", title: "Slide 4" },
		]
		mockState.values.virtualItems = [...mockState.values.virtualItems, makeVirtualItem(3, 420)]
		mockState.values.totalSize = 540
		rerender(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)

		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
		})
		fireEvent.drop(list)

		expect(onSortChange).not.toHaveBeenCalled()
		await waitFor(() =>
			expect(screen.getByTestId("ppt-sidebar-slide-item-slide-4")).toBeInTheDocument(),
		)
	})

	it("cancels the sort when the store replaces an unchanged ID order", async () => {
		const onSortChange = vi.fn()
		const { rerender } = render(
			<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />,
		)
		const viewport = getViewport()
		installViewportMetrics(viewport)
		const list = screen.getByTestId("ppt-sidebar-slides-list")

		fireEvent.dragStart(screen.getByTestId("ppt-sidebar-slide-item-slide-1"), {
			dataTransfer: { effectAllowed: "", setData: vi.fn() },
		})
		mockState.store.slides = mockState.store.slides.map((slide) => ({
			...slide,
			title: `Updated ${slide.id}`,
		}))
		rerender(<PPTSidebar allowEdit onSlideClick={vi.fn()} onSortChange={onSortChange} />)

		act(() => {
			list.dispatchEvent(createNativeDragEvent("dragover", 480))
		})
		fireEvent.drop(list)

		expect(onSortChange).not.toHaveBeenCalled()
		await waitFor(() => expect(screen.getByText("Updated slide-1")).toBeInTheDocument())
		expect(
			screen
				.getAllByTestId(/^ppt-sidebar-slide-item-/)
				.map((element) => element.dataset.slideId),
		).toEqual(["slide-1", "slide-2", "slide-3"])
		expect(screen.queryByTestId("ppt-sidebar-drop-indicator")).not.toBeInTheDocument()
		expect(screen.getByTestId("ppt-sidebar-slide-item-slide-1")).not.toHaveClass("opacity-50")
	})
})
