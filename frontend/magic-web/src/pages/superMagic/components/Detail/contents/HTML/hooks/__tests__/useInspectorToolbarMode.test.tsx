import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
	InspectedElementInfo,
	useElementInspector,
} from "@/components/business/ElementInspector"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useInspectorToolbarMode } from "../useInspectorToolbarMode"

const { modalConfirm } = vi.hoisted(() => ({ modalConfirm: vi.fn() }))

vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: modalConfirm },
}))

function createInfo(): InspectedElementInfo {
	return {
		selector: "#hero",
		tagName: "section",
		id: "hero",
		classList: ["hero"],
		rect: { top: 10, left: 20, width: 300, height: 120 },
		margin: { top: 0, right: 0, bottom: 0, left: 0 },
		padding: { top: 8, right: 8, bottom: 8, left: 8 },
		border: { top: 0, right: 0, bottom: 0, left: 0 },
		computedStyles: {},
		attributes: {},
		textContent: "Hero content",
	}
}

function createInspector(): ReturnType<typeof useElementInspector> {
	return {
		active: false,
		toggle: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
		hoveredElement: null,
		selectedElement: null,
		clearSelection: vi.fn(),
		setTrackedSelectors: vi.fn(),
		trackedRects: {},
	} as unknown as ReturnType<typeof useElementInspector>
}

const defaultFileInfo = {
	fileId: "file-1",
	fileName: "index.html",
	filePath: "index.html",
}

const ELEMENT_CAPTURE_ID_PATTERN =
	/^element:#hero:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe("useInspectorToolbarMode", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps typed instructions when the inspector object changes identity", () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key

		const { result, rerender } = renderHook(
			({ currentInspector }) =>
				useInspectorToolbarMode(currentInspector, translate, fileInfo),
			{ initialProps: { currentInspector: inspector } },
		)

		act(() => {
			result.current.startInAppendMode()
		})
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender({ currentInspector: { ...inspector } })
		expect(result.current.activeTarget?.info.selector).toBe(selectedElement.selector)
		act(() =>
			result.current.attachElementScreenshot(selectedElement.selector, {
				dataUrl: "data:image/png;base64,shot",
				rect: selectedElement.rect,
			}),
		)
		expect(result.current.activeTarget?.screenshot?.dataUrl).toBe("data:image/png;base64,shot")

		act(() => {
			result.current.setDraftInstruction("Move this section lower")
		})
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = {
			...selectedElement,
			rect: { ...selectedElement.rect, top: 240 },
		}
		rerender({ currentInspector: { ...inspector } })

		expect(result.current.draftInstruction).toBe("Move this section lower")
		expect(result.current.activeTarget?.info.rect.top).toBe(10)
	})

	it("keeps the selected element until the draft is confirmed", () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const translate = (key: string) => key
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		vi.mocked(inspector.start).mockImplementation(() => {
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = null
		})

		const { result, rerender } = renderHook(
			({ currentInspector, fileInfo }) =>
				useInspectorToolbarMode(currentInspector, translate, fileInfo),
			{
				initialProps: {
					currentInspector: inspector,
					fileInfo,
				},
			},
		)

		act(() => {
			result.current.startInAppendMode()
		})
		expect(result.current.isAppendPicking).toBe(true)
		expect(inspector.start).toHaveBeenCalledTimes(1)
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender({ currentInspector: inspector, fileInfo })

		expect(result.current.activeTarget?.kind).toBe("element")
		expect(inspector.clearSelection).not.toHaveBeenCalled()

		act(() => {
			result.current.setDraftInstruction("Make the heading larger")
		})
		act(() => {
			result.current.confirmTarget()
		})

		expect(inspector.clearSelection).toHaveBeenCalledTimes(1)
		expect(result.current.activeTarget).toBeNull()
		expect(result.current.pendingTargets).toHaveLength(1)
	})

	it("inserts the selected element before its screenshot is prepared", async () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result, rerender } = renderHook(() =>
			useInspectorToolbarMode(inspector, translate, fileInfo),
		)
		const prepareScreenshot = vi.fn()
		const appendContent = vi.fn()
		const updateScreenshot = vi.fn()
		pubsub.subscribe(PubSubEvents.Prepare_Html_Screenshot, prepareScreenshot)
		pubsub.subscribe(PubSubEvents.Append_Content_To_Editor, appendContent)
		pubsub.subscribe(PubSubEvents.Update_Html_Inspector_Screenshot, updateScreenshot)

		try {
			act(() => result.current.startInQuickSelectionMode())
			expect(result.current.isQuickSelecting).toBe(true)
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
				selectedElement
			rerender()
			rerender()

			const screenshot = {
				dataUrl: "data:image/png;base64,shot",
				rect: selectedElement.rect,
			}
			act(() => result.current.attachElementScreenshot(selectedElement.selector, screenshot))

			expect(appendContent).toHaveBeenCalledOnce()
			const content = appendContent.mock.calls[0]?.[0]
			expect(content.content[0].content[0].attrs.selector).toBe("#hero")
			expect(content.content[0].content[0].attrs.captureId).toEqual(
				expect.stringMatching(ELEMENT_CAPTURE_ID_PATTERN),
			)
			expect(content.content[0].content[0].attrs.screenshotMention).toBeUndefined()
			expect(prepareScreenshot).toHaveBeenCalledWith(
				expect.objectContaining({
					captureId: expect.stringMatching(ELEMENT_CAPTURE_ID_PATTERN),
					dataUrl: screenshot.dataUrl,
					releaseAfterSuccess: true,
				}),
			)
			const request = prepareScreenshot.mock.calls[0]?.[0]
			const screenshotMention = {
				type: "project_file",
				data: { file_id: "shot-1", file_name: "hero.png", file_path: ".tmp/hero.png" },
			}
			await act(async () => request.onSuccess(screenshotMention))

			expect(updateScreenshot).toHaveBeenCalledWith({
				captureId: expect.stringMatching(ELEMENT_CAPTURE_ID_PATTERN),
				screenshotMention,
			})
			expect(appendContent).toHaveBeenCalledOnce()
			expect(result.current.isQuickSelecting).toBe(false)
			expect(result.current.pendingTargets).toHaveLength(0)
			expect(result.current.inspectorModeRef.current).toBe("devConsole")
		} finally {
			pubsub.unsubscribe(PubSubEvents.Prepare_Html_Screenshot, prepareScreenshot)
			pubsub.unsubscribe(PubSubEvents.Append_Content_To_Editor, appendContent)
			pubsub.unsubscribe(PubSubEvents.Update_Html_Inspector_Screenshot, updateScreenshot)
		}
	})

	it("cancels immediate selection before a screenshot completes", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result } = renderHook(() => useInspectorToolbarMode(inspector, translate, fileInfo))

		act(() => result.current.startInQuickSelectionMode())
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		})

		expect(result.current.inspectorModeRef.current).toBe("devConsole")
		expect(inspector.clearSelection).toHaveBeenCalledOnce()
		expect(inspector.stop).toHaveBeenCalled()
	})

	it("clears a previous element selection before entering screenshot mode", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: createInfo(),
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result } = renderHook(() => useInspectorToolbarMode(inspector, translate, fileInfo))

		act(() => result.current.startInAppendMode())
		act(() => result.current.updateSelectionMode("screenshot"))

		expect(inspector.clearSelection).toHaveBeenCalled()
	})

	it("restores the previous instruction when selecting a confirmed element again", () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const translate = (key: string) => key
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		vi.mocked(inspector.start).mockImplementation(() => {
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = null
		})

		const { result, rerender } = renderHook(() =>
			useInspectorToolbarMode(inspector, translate, fileInfo),
		)

		act(() => result.current.startInAppendMode())
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender()
		act(() => result.current.setDraftInstruction("Make the heading larger"))
		act(() => result.current.confirmTarget())
		rerender()

		expect(result.current.pendingTargets[0]?.instruction).toBe("Make the heading larger")
		expect(result.current.activeTarget).toBeNull()
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender()

		expect(result.current.activeTarget?.info.selector).toBe(selectedElement.selector)
		expect(result.current.draftInstruction).toBe("Make the heading larger")
	})

	it("scrolls a screenshot target into view before editing it", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const scrollToPosition = vi.fn()
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
			scrollToSelector: vi.fn(),
			scrollToPosition,
		} as unknown as ReturnType<typeof useElementInspector>
		const target = {
			id: "screenshot:1",
			kind: "screenshot" as const,
			screenshot: {
				dataUrl: "data:image/png;base64,shot",
				rect: { left: 40, top: 80, width: 240, height: 120 },
				documentRect: { left: 40, top: 780, width: 240, height: 120 },
			},
			instruction: "Keep this area",
		}
		const translate = (key: string) => key
		const { result } = renderHook(() => useInspectorToolbarMode(inspector, translate, fileInfo))

		act(() => result.current.editPendingTarget(target))

		expect(scrollToPosition).toHaveBeenCalledWith({ left: 40, top: 700 })
	})

	it("does not scroll a target in PPT preview mode", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const scrollToSelector = vi.fn()
		const scrollToPosition = vi.fn()
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
			scrollToSelector,
			scrollToPosition,
		} as unknown as ReturnType<typeof useElementInspector>
		const target = {
			id: "element:1",
			kind: "element" as const,
			info: createInfo(),
			instruction: "Keep this area",
		}
		const screenshotTarget = {
			id: "screenshot:1",
			kind: "screenshot" as const,
			screenshot: {
				dataUrl: "data:image/png;base64,shot",
				rect: { left: 40, top: 80, width: 240, height: 120 },
				documentRect: { left: 40, top: 780, width: 240, height: 120 },
			},
			instruction: "Keep this area",
		}
		const translate = (key: string) => key
		const { result } = renderHook(() =>
			useInspectorToolbarMode(inspector, translate, fileInfo, {
				disableTargetScroll: true,
			}),
		)

		act(() => result.current.editPendingTarget(target))

		expect(scrollToSelector).not.toHaveBeenCalled()
		expect(scrollToPosition).not.toHaveBeenCalled()

		act(() => result.current.editPendingTarget(screenshotTarget))

		expect(scrollToSelector).not.toHaveBeenCalled()
		expect(scrollToPosition).not.toHaveBeenCalled()
	})

	it("keeps the collection bar open when cancelling the current target", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result } = renderHook(() => useInspectorToolbarMode(inspector, translate, fileInfo))
		const target = {
			id: "element:1",
			kind: "element" as const,
			info: createInfo(),
			instruction: "Keep this area",
		}

		act(() => result.current.startInAppendMode())
		act(() => result.current.editPendingTarget(target))
		act(() => result.current.cancelTarget())

		expect(result.current.inspectorModeRef.current).toBe("multiSelection")
		expect(result.current.isAppendPicking).toBe(true)
		expect(result.current.activeTarget).toBeNull()
		expect(inspector.start).toHaveBeenCalledTimes(2)
	})

	it("exits AI selection mode when Escape is pressed", () => {
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result } = renderHook(() => useInspectorToolbarMode(inspector, translate, fileInfo))

		act(() => {
			result.current.startInAppendMode()
		})
		expect(result.current.isAppendPicking).toBe(true)

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		})

		expect(result.current.isAppendPicking).toBe(false)
		expect(result.current.pendingTargets).toHaveLength(0)
		expect(inspector.stop).toHaveBeenCalled()
	})

	it("clears the selected element when Escape exits AI selection", () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		const translate = (key: string) => key
		const { result, rerender } = renderHook(() =>
			useInspectorToolbarMode(inspector, translate, fileInfo),
		)

		act(() => result.current.startInAppendMode())
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender()

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		})

		expect(result.current.isAppendPicking).toBe(false)
		expect(inspector.clearSelection).toHaveBeenCalledOnce()
	})

	it("asks for confirmation before clearing pending targets on Escape", () => {
		modalConfirm.mockReset()
		modalConfirm.mockReturnValue({ destroy: vi.fn() })
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		vi.mocked(inspector.start).mockImplementation(() => {
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = null
		})
		const translate = (key: string) => key
		const { result, rerender } = renderHook(() =>
			useInspectorToolbarMode(inspector, translate, fileInfo),
		)

		act(() => result.current.startInAppendMode())
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender()
		act(() => result.current.setDraftInstruction("Update the section"))
		act(() => result.current.confirmTarget())
		rerender()

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		})

		expect(modalConfirm).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "stylePanel.inspector.exitConfirmTitle",
				content: "stylePanel.inspector.exitConfirmContent",
			}),
		)
		expect(result.current.isAppendPicking).toBe(true)
		expect(result.current.pendingTargets).toHaveLength(1)

		const modalConfig = modalConfirm.mock.calls[0]?.[0]
		act(() => modalConfig.onOk())
		expect(result.current.isAppendPicking).toBe(false)
		expect(result.current.pendingTargets).toHaveLength(0)
	})

	it("clears the selection flow after a successful submission", async () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const translate = (key: string) => key
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		vi.mocked(inspector.start).mockImplementation(() => {
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = null
		})

		const { result, rerender } = renderHook(
			({ currentInspector, fileInfo: currentFileInfo }) =>
				useInspectorToolbarMode(currentInspector, translate, currentFileInfo),
			{
				initialProps: {
					currentInspector: inspector,
					fileInfo,
				},
			},
		)

		act(() => {
			result.current.startInAppendMode()
		})
		;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		rerender({ currentInspector: inspector, fileInfo })
		act(() => {
			result.current.setDraftInstruction("Make the heading larger")
		})
		act(() => {
			result.current.confirmTarget()
		})
		rerender({ currentInspector: inspector, fileInfo })

		let submittedRequest: { onSuccess?: () => void } | undefined
		const submitListener = vi.fn((request: { onSuccess?: () => void }) => {
			submittedRequest = request
		})
		pubsub.subscribe(PubSubEvents.Submit_Html_Multi_Selection, submitListener)
		try {
			await act(async () => {
				await result.current.submitPendingTargets()
			})

			expect(submitListener).toHaveBeenCalledOnce()
			expect(result.current.activeTarget).toBeNull()
			expect(result.current.pendingTargets).toHaveLength(1)
			expect(result.current.isAppendPicking).toBe(false)
			expect(result.current.submitState).toBe("submitting")
			expect(inspector.stop).toHaveBeenCalled()

			act(() => {
				submittedRequest?.onSuccess?.()
			})
			expect(result.current.pendingTargets).toHaveLength(0)
			expect(result.current.submitState).toBe("idle")
		} finally {
			pubsub.unsubscribe(PubSubEvents.Submit_Html_Multi_Selection, submitListener)
		}
	})

	it("confirms an element screenshot under a unique capture id", () => {
		const selectedElement = createInfo()
		const fileInfo = {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
		}
		const inspector = {
			active: false,
			toggle: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hoveredElement: null,
			selectedElement: null,
			clearSelection: vi.fn(),
			setTrackedSelectors: vi.fn(),
			trackedRects: {},
		} as unknown as ReturnType<typeof useElementInspector>
		vi.mocked(inspector.start).mockImplementation(() => {
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement = null
		})
		const prepareScreenshot = vi.fn()
		pubsub.subscribe(PubSubEvents.Prepare_Html_Screenshot, prepareScreenshot)
		const { result, rerender } = renderHook(() =>
			useInspectorToolbarMode(inspector, (key) => key, fileInfo),
		)

		try {
			act(() => result.current.startInAppendMode())
			;(inspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
				selectedElement
			rerender()
			act(() =>
				result.current.attachElementScreenshot(selectedElement.selector, {
					dataUrl: "data:image/png;base64,new-shot",
					rect: selectedElement.rect,
				}),
			)
			act(() => result.current.setDraftInstruction("重新换个背景"))
			act(() => result.current.confirmTarget())

			expect(result.current.pendingTargets[0]?.id).toMatch(ELEMENT_CAPTURE_ID_PATTERN)
			expect(result.current.pendingTargets[0]?.id).not.toBe(selectedElement.selector)
			expect(prepareScreenshot).toHaveBeenCalledWith(
				expect.objectContaining({
					captureId: result.current.pendingTargets[0]?.id,
					dataUrl: "data:image/png;base64,new-shot",
					stageUpload: false,
				}),
			)
		} finally {
			pubsub.unsubscribe(PubSubEvents.Prepare_Html_Screenshot, prepareScreenshot)
		}
	})

	it("keeps unique capture ids for quick selection and append selection at the same time", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_725_000_000_000)
		const selectedElement = createInfo()
		const screenshot = {
			dataUrl: "data:image/png;base64,shot",
			rect: selectedElement.rect,
		}
		const quickInspector = createInspector()
		const appendInspector = createInspector()
		const appendContent = vi.fn()
		pubsub.subscribe(PubSubEvents.Append_Content_To_Editor, appendContent)

		const quick = renderHook(() =>
			useInspectorToolbarMode(quickInspector, (key) => key, defaultFileInfo),
		)
		const append = renderHook(() =>
			useInspectorToolbarMode(appendInspector, (key) => key, defaultFileInfo),
		)

		try {
			act(() => quick.result.current.startInQuickSelectionMode())
			;(quickInspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
				selectedElement
			quick.rerender()

			act(() => append.result.current.startInAppendMode())
			;(appendInspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
				selectedElement
			append.rerender()
			act(() =>
				append.result.current.attachElementScreenshot(selectedElement.selector, screenshot),
			)

			const quickCaptureId =
				appendContent.mock.calls[0]?.[0].content[0].content[0].attrs.captureId
			const appendCaptureId = append.result.current.activeTarget?.id

			expect(quickCaptureId).toMatch(/^element:#hero:/)
			expect(appendCaptureId).toMatch(/^element:#hero:/)
			expect(quickCaptureId).not.toBe(appendCaptureId)
		} finally {
			pubsub.unsubscribe(PubSubEvents.Append_Content_To_Editor, appendContent)
		}
	})

	it("keeps unique capture ids across two hook instances", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_725_000_000_000)
		const selectedElement = createInfo()
		const screenshot = {
			dataUrl: "data:image/png;base64,shot",
			rect: selectedElement.rect,
		}
		const firstInspector = createInspector()
		const secondInspector = createInspector()
		const first = renderHook(() =>
			useInspectorToolbarMode(firstInspector, (key) => key, defaultFileInfo),
		)
		const second = renderHook(() =>
			useInspectorToolbarMode(secondInspector, (key) => key, defaultFileInfo),
		)

		act(() => first.result.current.startInAppendMode())
		;(firstInspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		first.rerender()
		act(() =>
			first.result.current.attachElementScreenshot(selectedElement.selector, screenshot),
		)

		act(() => second.result.current.startInAppendMode())
		;(secondInspector as { selectedElement: InspectedElementInfo | null }).selectedElement =
			selectedElement
		second.rerender()
		act(() =>
			second.result.current.attachElementScreenshot(selectedElement.selector, screenshot),
		)

		expect(first.result.current.activeTarget?.id).toMatch(/^element:#hero:/)
		expect(second.result.current.activeTarget?.id).toMatch(/^element:#hero:/)
		expect(first.result.current.activeTarget?.id).not.toBe(
			second.result.current.activeTarget?.id,
		)
	})
})
