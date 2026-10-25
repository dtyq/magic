import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ElementInspectorOverlay } from "../ElementInspectorOverlay"
import type { HtmlSelectionTarget, InspectedElementInfo } from "../types"

const captureAcquire = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const captureRelease = vi.hoisted(() => vi.fn())
const captureIframeRegion = vi.hoisted(() =>
	vi.fn().mockResolvedValue("data:image/png;base64,shot"),
)
const suppressCaptureCursor = vi.hoisted(() => vi.fn(() => vi.fn()))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../screenshot", async (importOriginal) => ({
	...(await importOriginal<typeof import("../screenshot")>()),
	captureIframeRegion,
	createCurrentTabCaptureSession: vi.fn(() => ({
		acquire: captureAcquire,
		release: captureRelease,
		hasLiveStream: () => false,
	})),
	suppressCaptureCursor,
	supportsCurrentTabCapture: vi.fn(() => true),
}))

function createInfo(): InspectedElementInfo {
	return {
		selector: ".row-item.ai",
		tagName: "div",
		id: "",
		classList: ["row-item", "ai"],
		rect: { top: 40, left: 20, width: 320, height: 44 },
		margin: { top: 0, right: 0, bottom: 0, left: 0 },
		padding: { top: 4, right: 8, bottom: 4, left: 8 },
		border: { top: 0, right: 0, bottom: 0, left: 0 },
		computedStyles: {},
		attributes: {},
		textContent: "AI response",
	}
}

describe("ElementInspectorOverlay", () => {
	it("renders the pending panel in the stable viewport container", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			const panelContainerRef = createRef<HTMLDivElement>()
			render(
				<div data-testid="canvas-viewport" ref={panelContainerRef}>
					<div data-testid="scaled-content-wrapper">
						<iframe ref={iframeRef} />
					</div>
					<ElementInspectorOverlay
						active
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						panelContainerRef={panelContainerRef}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
					/>
				</div>,
			)
			expect(panelContainerRef.current).toBe(screen.getByTestId("canvas-viewport"))

			await waitFor(() => {
				const panel = screen.getByTestId("element-inspector-pending-panel")
				expect(screen.getByTestId("element-inspector-overlay")).toBeInTheDocument()
				expect(screen.getByTestId("element-inspector-panel-portal")).toBe(
					panel.parentElement,
				)
				expect(panel.parentElement?.parentElement).toBe(
					screen.getByTestId("canvas-viewport"),
				)
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("keeps the pending panel mounted while a multi-selection target resolves", () => {
		const onEditPendingTarget = vi.fn()
		const onRemovePendingTarget = vi.fn()
		const onSubmitPendingTargets = vi.fn()
		const { rerender } = render(
			<ElementInspectorOverlay
				active
				multiSelectionActive
				iframeRef={{ current: null }}
				hoveredElement={null}
				selectedElement={null}
				onClearSelection={vi.fn()}
				onEditPendingTarget={onEditPendingTarget}
				onRemovePendingTarget={onRemovePendingTarget}
				onSubmitPendingTargets={onSubmitPendingTargets}
			/>,
		)
		const panel = screen.getByTestId("element-inspector-pending-panel")

		rerender(
			<ElementInspectorOverlay
				active={false}
				multiSelectionActive
				iframeRef={{ current: null }}
				hoveredElement={null}
				selectedElement={null}
				onClearSelection={vi.fn()}
				onEditPendingTarget={onEditPendingTarget}
				onRemovePendingTarget={onRemovePendingTarget}
				onSubmitPendingTargets={onSubmitPendingTargets}
			/>,
		)

		expect(screen.getByTestId("element-inspector-pending-panel")).toBe(panel)
	})

	it("exposes stable actions on the single-element info card", () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			const onClearSelection = vi.fn()
			const onInsertToConsole = vi.fn()
			const onSendToAgent = vi.fn()
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={onClearSelection}
						onInsertToConsole={onInsertToConsole}
						onSendToAgent={onSendToAgent}
					/>
				</div>,
			)

			expect(screen.getByTestId("element-inspector-info-card")).toBeInTheDocument()
			expect(screen.getByTestId("element-inspector-copy-selector-button")).toBeInTheDocument()
			fireEvent.click(screen.getByTestId("element-inspector-info-close-button"))
			fireEvent.click(screen.getByTestId("element-inspector-insert-console-button"))
			fireEvent.click(screen.getByTestId("inspector-send-to-agent-button"))

			expect(onClearSelection).toHaveBeenCalledOnce()
			expect(onInsertToConsole).toHaveBeenCalledWith("document.querySelector('.row-item.ai')")
			expect(onSendToAgent).toHaveBeenCalledOnce()
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("replaces the selected element label with a collapsible comment marker", () => {
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect

		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={vi.fn()}
						hideInfoCard
					/>
				</div>,
			)

			expect(
				screen.queryByTestId("element-inspector-selection-label"),
			).not.toBeInTheDocument()
			const marker = screen.getByTestId("element-inspector-comment-marker")
			const commentButton = screen.getByTestId("element-inspector-comment-button")
			expect(commentButton).toHaveClass("inspector-comment-marker-button")
			expect(marker).toHaveClass("overflow-visible")
			expect(marker).not.toHaveClass("overflow-hidden")
			const commentContent = screen.getByTestId("element-inspector-comment-content")
			expect(commentContent).toHaveClass("max-w-0")
			fireEvent.mouseEnter(marker)
			expect(commentContent).toHaveClass("max-w-[184px]")
			expect(commentContent).toHaveTextContent("stylePanel.inspector.emptyDescription")
			fireEvent.click(commentButton)
			fireEvent.mouseLeave(marker)
			expect(commentContent).toHaveClass("max-w-[184px]")
			fireEvent.click(commentButton)
			expect(commentContent).toHaveClass("max-w-0")
			const highlight = document.querySelector(".border-primary")
			expect(highlight).toBeInTheDocument()
			expect(highlight).toHaveStyle({ transition: "" })
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("moves the hover highlight without a transition", () => {
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect

		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active
						iframeRef={iframeRef}
						hoveredElement={createInfo()}
						selectedElement={null}
						onClearSelection={vi.fn()}
						hideInfoCard
					/>
				</div>,
			)

			expect(document.querySelector(".border-primary")).toHaveStyle({
				transition: "",
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("captures a preview for the selected element", async () => {
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect
		const onCaptureElementScreenshot = vi.fn()

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={vi.fn()}
						hideInfoCard
						onCaptureElementScreenshot={onCaptureElementScreenshot}
					/>
				</div>,
			)

			await waitFor(() => {
				expect(onCaptureElementScreenshot).toHaveBeenCalledWith(
					".row-item.ai",
					expect.objectContaining({ dataUrl: "data:image/png;base64,shot" }),
				)
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("shows loading while the selected element preview is being captured", async () => {
		let resolveCapture!: (dataUrl: string) => void
		captureIframeRegion.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveCapture = resolve
				}),
		)
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect
		const onCaptureElementScreenshot = vi.fn()

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={vi.fn()}
						hideInfoCard
						onCaptureElementScreenshot={onCaptureElementScreenshot}
					/>
				</div>,
			)

			await waitFor(() => {
				const loading = screen.getByTestId("element-inspector-screenshot-loading")
				expect(loading).toBeInTheDocument()
				expect(loading).toHaveClass("left-4", "top-4")
				expect(loading).not.toHaveClass("right-4")
				expect(
					document.querySelector('[data-element-inspector-overlay="true"]'),
				).not.toHaveStyle({ visibility: "hidden" })
			})

			await waitFor(() => expect(resolveCapture).toBeTypeOf("function"))
			await act(async () => {
				resolveCapture("data:image/png;base64,shot")
			})
			await waitFor(() => {
				expect(onCaptureElementScreenshot).toHaveBeenCalledOnce()
				expect(
					screen.queryByTestId("element-inspector-screenshot-loading"),
				).not.toBeInTheDocument()
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("does not hide the cursor before automatic preview capture starts", async () => {
		suppressCaptureCursor.mockClear()
		captureIframeRegion.mockClear()
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={vi.fn()}
						hideInfoCard
						onCaptureElementScreenshot={vi.fn()}
					/>
				</div>,
			)

			await waitFor(() => expect(captureIframeRegion).toHaveBeenCalledOnce())
			expect(captureIframeRegion).toHaveBeenCalledWith(
				expect.objectContaining({ selector: ".row-item.ai" }),
			)
			expect(suppressCaptureCursor).not.toHaveBeenCalled()
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("keeps the capture session while an element preview is pending", async () => {
		captureRelease.mockClear()
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect
		const onCaptureElementScreenshot = vi.fn()

		try {
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={createInfo()}
						onClearSelection={vi.fn()}
						hideInfoCard
						onCaptureElementScreenshot={onCaptureElementScreenshot}
					/>
				</div>,
			)

			await waitFor(() => expect(onCaptureElementScreenshot).toHaveBeenCalledOnce())
			expect(captureRelease).not.toHaveBeenCalled()
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("does not prewarm current-tab capture before a screenshot is confirmed", async () => {
		captureAcquire.mockClear()
		const iframeRef = { current: null as HTMLIFrameElement | null }
		let prewarm: (() => Promise<boolean>) | null = null
		render(
			<div>
				<iframe ref={iframeRef} />
				<ElementInspectorOverlay
					active={false}
					iframeRef={iframeRef}
					hoveredElement={null}
					selectedElement={null}
					onClearSelection={vi.fn()}
					onCaptureElementScreenshot={vi.fn()}
					onCapturePrewarmReady={(callback) => {
						prewarm = callback
					}}
				/>
			</div>,
		)

		await waitFor(() => {
			expect(prewarm).toEqual(expect.any(Function))
		})
		await expect(prewarm?.()).resolves.toBe(true)
		expect(captureAcquire).not.toHaveBeenCalled()
	})

	it("does not force tab capture when preparing a cross-origin iframe", async () => {
		captureAcquire.mockClear()
		const iframeRef = { current: null as HTMLIFrameElement | null }
		let prewarm: (() => Promise<boolean>) | null = null
		render(
			<div>
				<iframe ref={iframeRef} />
				<ElementInspectorOverlay
					active={false}
					iframeRef={iframeRef}
					hoveredElement={null}
					selectedElement={null}
					onClearSelection={vi.fn()}
					multiSelectionActive
					onCaptureElementScreenshot={vi.fn()}
					onCapturePrewarmReady={(callback) => {
						prewarm = callback
					}}
				/>
			</div>,
		)

		await waitFor(() => {
			expect(iframeRef.current).not.toBeNull()
			expect(prewarm).toEqual(expect.any(Function))
		})
		Object.defineProperty(iframeRef.current as HTMLIFrameElement, "contentDocument", {
			configurable: true,
			get() {
				throw new DOMException("Blocked a frame", "SecurityError")
			},
		})
		await expect(prewarm?.()).resolves.toBe(true)
		expect(captureAcquire).not.toHaveBeenCalled()
		expect(
			screen.queryByTestId("ai-editing-capture-authorization-dialog"),
		).not.toBeInTheDocument()
	})

	it("does not capture selected elements when screenshot capture is unsupported", async () => {
		const iframeRef = { current: null as HTMLIFrameElement | null }
		const onCaptureElementScreenshot = vi.fn()
		render(
			<div>
				<iframe ref={iframeRef} />
				<ElementInspectorOverlay
					active={false}
					iframeRef={iframeRef}
					hoveredElement={null}
					selectedElement={createInfo()}
					onClearSelection={vi.fn()}
					onCaptureElementScreenshot={onCaptureElementScreenshot}
					screenshotSupported={false}
				/>
			</div>,
		)

		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(onCaptureElementScreenshot).not.toHaveBeenCalled()
	})

	it("hides screenshot mode when the browser lacks capture support", () => {
		const iframeRef = { current: null as HTMLIFrameElement | null }
		render(
			<div>
				<iframe ref={iframeRef} />
				<ElementInspectorOverlay
					active
					iframeRef={iframeRef}
					hoveredElement={null}
					selectedElement={null}
					onClearSelection={vi.fn()}
					screenshotSupported={false}
					onEditPendingTarget={vi.fn()}
					onRemovePendingTarget={vi.fn()}
					onSubmitPendingTargets={vi.fn()}
					selectionMode="screenshot"
					onSelectionModeChange={vi.fn()}
				/>
			</div>,
		)

		expect(
			screen.queryByRole("button", { name: "stylePanel.inspector.screenshotMode" }),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("html-screenshot-selection-overlay")).not.toBeInTheDocument()
	})

	it("keeps confirmed targets highlighted while selecting another target", () => {
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect

		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect

		try {
			const info = createInfo()
			const iframeRef = { current: null as HTMLIFrameElement | null }
			render(
				<div>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						pendingTargets={[
							{ id: info.selector, kind: "element", info, instruction: "Move it" },
						]}
						activeTarget={null}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
					/>
				</div>,
			)

			expect(
				screen.queryByTestId("element-inspector-selection-label"),
			).not.toBeInTheDocument()
			const marker = screen.getByTestId("element-inspector-comment-marker")
			expect(marker).toHaveAttribute("data-target-id", info.selector)
			expect(screen.getByTestId("element-inspector-comment-button")).toHaveAttribute(
				"data-target-id",
				info.selector,
			)
			fireEvent.mouseEnter(marker)
			expect(screen.getByTestId("element-inspector-comment-content")).toHaveTextContent(
				"Move it",
			)
			expect(document.querySelector(".border-primary")).toBeInTheDocument()
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("opens the existing target editor when its highlighted area is clicked", () => {
		const rect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect

		const originalGetBoundingClientRect = HTMLIFrameElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => rect

		try {
			const info = createInfo()
			const iframeRef = { current: null as HTMLIFrameElement | null }
			const Harness = () => {
				const [activeTarget, setActiveTarget] = useState<HtmlSelectionTarget | null>(null)
				const [instruction, setInstruction] = useState("")
				const target: HtmlSelectionTarget = {
					id: info.selector,
					kind: "element",
					info,
					instruction: "Move it",
				}
				return (
					<div>
						<iframe ref={iframeRef} />
						<ElementInspectorOverlay
							active
							iframeRef={iframeRef}
							hoveredElement={null}
							selectedElement={null}
							onClearSelection={vi.fn()}
							pendingTargets={[target]}
							activeTarget={activeTarget}
							draftInstruction={instruction}
							onDraftInstructionChange={setInstruction}
							onConfirmTarget={vi.fn()}
							onCancelTarget={vi.fn()}
							onEditPendingTarget={(nextTarget) => {
								setActiveTarget(nextTarget)
								setInstruction(nextTarget.instruction)
							}}
							onRemovePendingTarget={vi.fn()}
							onSubmitPendingTargets={vi.fn()}
						/>
					</div>
				)
			}
			render(<Harness />)

			const pendingTarget = screen.getByTestId("element-inspector-pending-target")
			expect(pendingTarget).toHaveAttribute("data-target-id", info.selector)
			fireEvent.click(pendingTarget)
			expect(screen.getByTestId("element-inspector-edit-popover")).toHaveAttribute(
				"data-target-id",
				info.selector,
			)
			expect(screen.getByTestId("element-inspector-instruction-input")).toHaveValue("Move it")
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
		}
	})

	it("keeps the element editor attached to the current selection box while scrolling", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const panelRect = {
			...iframeRect,
			width: 900,
			right: 900,
		} as DOMRect
		const originalIframeRect = HTMLIFrameElement.prototype.getBoundingClientRect
		const originalElementRect = HTMLElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (this.dataset.testid === "inspector-panel") return panelRect
			if (this.querySelector?.("iframe")) return iframeRect
			return originalElementRect.call(this)
		}

		const info = createInfo()
		const target: HtmlSelectionTarget = {
			id: info.selector,
			kind: "element",
			info,
			instruction: "Move it",
		}
		const iframeRef = { current: null as HTMLIFrameElement | null }
		const panelContainerRef = createRef<HTMLDivElement>()

		try {
			const { rerender } = render(
				<div
					data-testid="inspector-panel"
					ref={panelContainerRef}
					style={{ width: 900, height: 360 }}
				>
					<div style={{ width: 640, height: 360 }}>
						<iframe ref={iframeRef} />
						<ElementInspectorOverlay
							active={false}
							iframeRef={iframeRef}
							hoveredElement={null}
							selectedElement={null}
							onClearSelection={vi.fn()}
							activeTarget={target}
							draftInstruction={target.instruction}
							onDraftInstructionChange={vi.fn()}
							onConfirmTarget={vi.fn()}
							onCancelTarget={vi.fn()}
							pendingTargets={[target]}
							onEditPendingTarget={vi.fn()}
							onRemovePendingTarget={vi.fn()}
							onSubmitPendingTargets={vi.fn()}
							panelContainerRef={panelContainerRef}
							trackedRects={{ [info.selector]: { ...info.rect, top: 40 } }}
						/>
					</div>
				</div>,
			)

			let initialPopoverTop = ""
			await waitFor(() => {
				initialPopoverTop = screen.getByTestId("element-inspector-edit-popover").style.top
				expect(initialPopoverTop).not.toBe("")
			})

			rerender(
				<div
					data-testid="inspector-panel"
					ref={panelContainerRef}
					style={{ width: 900, height: 360 }}
				>
					<div style={{ width: 640, height: 360 }}>
						<iframe ref={iframeRef} />
						<ElementInspectorOverlay
							active={false}
							iframeRef={iframeRef}
							hoveredElement={null}
							selectedElement={null}
							onClearSelection={vi.fn()}
							activeTarget={target}
							draftInstruction={target.instruction}
							onDraftInstructionChange={vi.fn()}
							onConfirmTarget={vi.fn()}
							onCancelTarget={vi.fn()}
							pendingTargets={[target]}
							onEditPendingTarget={vi.fn()}
							onRemovePendingTarget={vi.fn()}
							onSubmitPendingTargets={vi.fn()}
							panelContainerRef={panelContainerRef}
							trackedRects={{ [info.selector]: { ...info.rect, top: 140 } }}
						/>
					</div>
				</div>,
			)

			await waitFor(() => {
				const popover = screen.getByTestId("element-inspector-edit-popover")
				expect(popover.style.top).not.toBe(initialPopoverTop)
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalIframeRect
			HTMLElement.prototype.getBoundingClientRect = originalElementRect
		}
	})

	it("hides the element editor after the selected box leaves the viewport", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const panelRect = { ...iframeRect, width: 900, right: 900 } as DOMRect
		const originalIframeRect = HTMLIFrameElement.prototype.getBoundingClientRect
		const originalElementRect = HTMLElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (this.dataset.testid === "inspector-panel") return panelRect
			if (this.querySelector?.("iframe")) return iframeRect
			return originalElementRect.call(this)
		}

		const info = createInfo()
		const target: HtmlSelectionTarget = {
			id: info.selector,
			kind: "element",
			info,
			instruction: "Move it",
		}
		const iframeRef = { current: null as HTMLIFrameElement | null }
		const panelContainerRef = createRef<HTMLDivElement>()

		try {
			const { rerender } = render(
				<div
					data-testid="inspector-panel"
					ref={panelContainerRef}
					style={{ width: 900, height: 360 }}
				>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						activeTarget={target}
						draftInstruction={target.instruction}
						onDraftInstructionChange={vi.fn()}
						onConfirmTarget={vi.fn()}
						onCancelTarget={vi.fn()}
						pendingTargets={[target]}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
						panelContainerRef={panelContainerRef}
						trackedRects={{ [info.selector]: { ...info.rect, top: -100 } }}
					/>
				</div>,
			)

			await waitFor(() => {
				expect(
					screen.queryByTestId("element-inspector-edit-popover"),
				).not.toBeInTheDocument()
			})

			rerender(
				<div
					data-testid="inspector-panel"
					ref={panelContainerRef}
					style={{ width: 900, height: 360 }}
				>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						activeTarget={target}
						draftInstruction={target.instruction}
						onDraftInstructionChange={vi.fn()}
						onConfirmTarget={vi.fn()}
						onCancelTarget={vi.fn()}
						pendingTargets={[target]}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
						panelContainerRef={panelContainerRef}
						trackedRects={{ [info.selector]: { ...info.rect, top: 120 } }}
					/>
				</div>,
			)

			await waitFor(() => {
				expect(screen.getByTestId("element-inspector-edit-popover")).toBeInTheDocument()
			})
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalIframeRect
			HTMLElement.prototype.getBoundingClientRect = originalElementRect
		}
	})

	it("opens the screenshot comment popover after a drag", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const parentRect = iframeRect
		const originalIframeRect = HTMLIFrameElement.prototype.getBoundingClientRect
		const originalElementRect = HTMLElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect
		const panelContainerRef = createRef<HTMLDivElement>()
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (this === panelContainerRef.current) {
				return {
					top: 0,
					left: 0,
					width: 900,
					height: 360,
					bottom: 360,
					right: 900,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				} as DOMRect
			}
			if (this.querySelector?.("iframe")) return parentRect
			return originalElementRect.call(this)
		}

		const onCaptureScreenshot = vi.fn()
		const onConfirmTarget = vi.fn()
		const iframeRef = { current: null as HTMLIFrameElement | null }
		function Harness() {
			const [instruction, setInstruction] = useState("")
			const [activeTarget, setActiveTarget] = useState<null | {
				kind: "screenshot"
				id: string
				screenshot: {
					dataUrl: string
					rect: { left: number; top: number; width: number; height: number }
				}
				instruction: string
			}>(null)
			return (
				<div ref={panelContainerRef} style={{ width: 900, height: 360 }}>
					<div style={{ width: 640, height: 360 }}>
						<iframe ref={iframeRef} />
						<ElementInspectorOverlay
							active={!activeTarget}
							iframeRef={iframeRef}
							hoveredElement={null}
							selectedElement={null}
							onClearSelection={vi.fn()}
							activeTarget={activeTarget}
							draftInstruction={instruction}
							onDraftInstructionChange={setInstruction}
							onConfirmTarget={onConfirmTarget}
							onCancelTarget={vi.fn()}
							onEditPendingTarget={vi.fn()}
							onRemovePendingTarget={vi.fn()}
							onSubmitPendingTargets={vi.fn()}
							selectionMode="screenshot"
							panelContainerRef={panelContainerRef}
							onCaptureScreenshot={(dataUrl, rect) => {
								onCaptureScreenshot(dataUrl, rect)
								setActiveTarget({
									id: "screenshot:1",
									kind: "screenshot",
									screenshot: { dataUrl, rect },
									instruction,
								})
							}}
						/>
					</div>
				</div>
			)
		}

		try {
			render(<Harness />)
			const overlay = screen.getByTestId("html-screenshot-selection-overlay")
			vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(iframeRect)
			const firePointer = (type: string, clientX: number, clientY: number) => {
				fireEvent(overlay, new MouseEvent(type, { bubbles: true, clientX, clientY }))
			}
			firePointer("pointerdown", 20, 30)
			firePointer("pointermove", 220, 150)
			firePointer("pointerup", 220, 150)

			await waitFor(() => {
				expect(onCaptureScreenshot).toHaveBeenCalledWith("data:image/png;base64,shot", {
					left: 20,
					top: 30,
					width: 200,
					height: 120,
				})
				expect(screen.getByTestId("element-inspector-edit-popover")).toBeInTheDocument()
			})
			expect(
				screen.queryByTestId("element-inspector-selection-label"),
			).not.toBeInTheDocument()
			const commentMarker = screen.getByTestId("element-inspector-comment-marker")
			fireEvent.mouseEnter(commentMarker)
			expect(screen.getByTestId("element-inspector-comment-content")).toHaveTextContent(
				"stylePanel.inspector.emptyDescription",
			)
			const popover = screen.getByTestId("element-inspector-edit-popover")
			expect(popover.parentElement).toHaveAttribute("data-element-inspector-panel-portal")
			expect(popover.parentElement?.parentElement).toBe(panelContainerRef.current)
			const textarea = screen.getByRole("textbox")
			fireEvent.change(textarea, { target: { value: "Move this section lower" } })
			expect(textarea).toHaveValue("Move this section lower")
			fireEvent.click(screen.getByRole("button", { name: "stylePanel.inspector.confirm" }))
			await waitFor(() => expect(onConfirmTarget).toHaveBeenCalledOnce(), { timeout: 1000 })
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalIframeRect
			HTMLElement.prototype.getBoundingClientRect = originalElementRect
		}
	})

	it("moves a confirmed screenshot highlight with iframe scrolling", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalIframeRect = HTMLIFrameElement.prototype.getBoundingClientRect
		const originalElementRect = HTMLElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (this.querySelector?.("iframe")) return iframeRect
			return originalElementRect.call(this)
		}

		const iframeRef = { current: null as HTMLIFrameElement | null }
		const target: HtmlSelectionTarget = {
			id: "screenshot:scroll",
			kind: "screenshot",
			screenshot: {
				dataUrl: "data:image/png;base64,shot",
				rect: { left: 20, top: 80, width: 200, height: 120 },
				documentRect: { left: 20, top: 780, width: 200, height: 120 },
			},
			instruction: "Keep this area",
		}

		try {
			render(
				<div style={{ width: 640, height: 360 }}>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						pendingTargets={[target]}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
					/>
				</div>,
			)

			const iframe = iframeRef.current
			if (!iframe?.contentWindow || !iframe.contentDocument) {
				throw new Error("Screenshot scroll fixture was not created")
			}
			Object.defineProperty(iframe.contentWindow, "scrollY", {
				configurable: true,
				value: 0,
			})
			const highlight = document.querySelector(".border-primary")
			expect(highlight).toHaveStyle({ top: "780px" })

			Object.defineProperty(iframe.contentWindow, "scrollY", {
				configurable: true,
				value: 700,
			})
			fireEvent.scroll(iframe.contentDocument)
			await waitFor(() => expect(highlight).toHaveStyle({ top: "80px" }))
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalIframeRect
			HTMLElement.prototype.getBoundingClientRect = originalElementRect
		}
	})

	it("uses the runtime scroll offset when the iframe is cross-origin", async () => {
		const iframeRect = {
			top: 0,
			left: 0,
			width: 640,
			height: 360,
			bottom: 360,
			right: 640,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect
		const originalIframeRect = HTMLIFrameElement.prototype.getBoundingClientRect
		const originalElementRect = HTMLElement.prototype.getBoundingClientRect
		HTMLIFrameElement.prototype.getBoundingClientRect = () => iframeRect
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (this.querySelector?.("iframe")) return iframeRect
			return originalElementRect.call(this)
		}

		const iframeRef = { current: null as HTMLIFrameElement | null }
		const target: HtmlSelectionTarget = {
			id: "screenshot:cross-origin-scroll",
			kind: "screenshot",
			screenshot: {
				dataUrl: "data:image/png;base64,shot",
				rect: { left: 20, top: 80, width: 200, height: 120 },
				documentRect: { left: 20, top: 780, width: 200, height: 120 },
			},
			instruction: "Keep this area",
		}

		try {
			const { rerender } = render(
				<div style={{ width: 640, height: 360 }}>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						pendingTargets={[target]}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
						iframeScrollOffset={{ left: 0, top: 0 }}
					/>
				</div>,
			)

			const highlight = document.querySelector(".border-primary")
			expect(highlight).toHaveStyle({ top: "780px" })

			rerender(
				<div style={{ width: 640, height: 360 }}>
					<iframe ref={iframeRef} />
					<ElementInspectorOverlay
						active={false}
						iframeRef={iframeRef}
						hoveredElement={null}
						selectedElement={null}
						onClearSelection={vi.fn()}
						pendingTargets={[target]}
						onEditPendingTarget={vi.fn()}
						onRemovePendingTarget={vi.fn()}
						onSubmitPendingTargets={vi.fn()}
						iframeScrollOffset={{ left: 0, top: 700 }}
					/>
				</div>,
			)

			await waitFor(() => expect(highlight).toHaveStyle({ top: "80px" }))
		} finally {
			HTMLIFrameElement.prototype.getBoundingClientRect = originalIframeRect
			HTMLElement.prototype.getBoundingClientRect = originalElementRect
		}
	})

	it("does not fail when a bound iframe window becomes cross-origin", () => {
		let isCrossOrigin = false
		const securityError = () =>
			new DOMException("Blocked a cross-origin frame", "SecurityError")
		const iframeWindow = {} as Window
		Object.defineProperties(iframeWindow, {
			scrollX: {
				get: () => {
					if (isCrossOrigin) throw securityError()
					return 0
				},
			},
			scrollY: {
				get: () => {
					if (isCrossOrigin) throw securityError()
					return 0
				},
			},
			addEventListener: {
				get: () => {
					if (isCrossOrigin) throw securityError()
					return vi.fn()
				},
			},
			removeEventListener: {
				get: () => {
					if (isCrossOrigin) throw securityError()
					return vi.fn()
				},
			},
		})
		const iframe = document.createElement("iframe")
		Object.defineProperty(iframe, "contentDocument", {
			configurable: true,
			value: document,
		})
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: iframeWindow,
		})

		render(
			<ElementInspectorOverlay
				active={false}
				iframeRef={{ current: iframe }}
				hoveredElement={null}
				selectedElement={null}
				onClearSelection={vi.fn()}
			/>,
		)

		isCrossOrigin = true
		iframe.dispatchEvent(new Event("load"))
	})
})
