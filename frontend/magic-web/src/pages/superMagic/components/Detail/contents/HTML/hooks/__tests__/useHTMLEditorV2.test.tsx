import { act, render, waitFor } from "@testing-library/react"
import { useRef } from "react"
import type { RefObject } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EditorMessageType } from "../../iframe-bridge/types/messages"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useHTMLEditorV2 } from "../useHTMLEditorV2"

const toastInfo = vi.hoisted(() => vi.fn())

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { info: toastInfo },
}))

const bridgeState = vi.hoisted(() => ({
	instances: [] as Array<{
		request: ReturnType<typeof vi.fn>
		sendCommand: ReturnType<typeof vi.fn>
		on: ReturnType<typeof vi.fn>
		isActive: ReturnType<typeof vi.fn>
		destroy: ReturnType<typeof vi.fn>
		emit: (type: string, payload?: unknown) => void
	}>,
	requests: [] as string[],
	activationMessages: [] as unknown[],
}))

vi.mock("@/utils/env", () => ({
	env: vi.fn(() => ""),
}))

vi.mock("../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		reset: vi.fn(),
		clearSelectedElements: vi.fn(),
		selectElement: vi.fn(),
		setSelectionMode: vi.fn(),
		updateHistoryState: vi.fn(),
		selectedElement: null,
		selectedElements: [],
		textSelection: null,
	}),
}))

vi.mock("../../iframe-bridge/bridge/MessageBridge", () => ({
	MessageBridge: vi.fn().mockImplementation(() => {
		const handlers = new Map<string, Array<(message: { payload?: unknown }) => void>>()
		const instance = {
			request: vi.fn(async (type: string) => {
				bridgeState.requests.push(type)
				return {}
			}),
			sendCommand: vi.fn(async () => undefined),
			on: vi.fn((type: string, handler: (message: { payload?: unknown }) => void) => {
				const nextHandlers = handlers.get(type) ?? []
				nextHandlers.push(handler)
				handlers.set(type, nextHandlers)
			}),
			isActive: vi.fn(() => true),
			destroy: vi.fn(),
			emit: (type: string, payload?: unknown) => {
				for (const handler of handlers.get(type) ?? []) {
					handler({ payload })
				}
			},
		}
		bridgeState.instances.push(instance)
		return instance
	}),
}))

function createIframeRef() {
	const iframe = document.createElement("iframe")
	Object.defineProperty(iframe, "contentWindow", {
		value: {
			postMessage: vi.fn((message: unknown) => {
				bridgeState.activationMessages.push(message)
			}),
		},
		configurable: true,
	})
	return { current: iframe }
}

interface TestHarnessProps {
	isEditMode: boolean
	isPPTBuildMode?: boolean
	iframeLoaded?: boolean
	contentInjected?: boolean
	renderSiteUrl?: string
	editorRef?: RefObject<HTMLEditorV2Ref>
	saveEditContent?: Parameters<typeof useHTMLEditorV2>[0]["saveEditContent"]
	prepareSaveContent?: (content: string) => string
}

function TestHarness({
	isEditMode,
	isPPTBuildMode,
	iframeLoaded = true,
	contentInjected = true,
	renderSiteUrl,
	editorRef,
	saveEditContent,
	prepareSaveContent,
}: TestHarnessProps) {
	const iframeRef = useRef(createIframeRef().current)
	const localEditorRef = useRef<HTMLEditorV2Ref>(null)

	const { isEditorReady } = useHTMLEditorV2({
		iframeRef,
		editorRef: editorRef ?? localEditorRef,
		isEditMode,
		isPPTBuildMode,
		sandboxType: "iframe",
		iframeLoaded,
		contentInjected,
		renderSiteUrl,
		targetOrigin: "*",
		filePathMapping: new Map(),
		fileId: "slide-1",
		saveEditContent,
		prepareSaveContent,
	})

	return <span data-testid="editor-ready">{String(isEditorReady)}</span>
}

describe("useHTMLEditorV2 edit lifecycle", () => {
	it("activates animation selection without enabling full editing and cleans up on close", async () => {
		const editorRef = { current: null } as RefObject<HTMLEditorV2Ref>
		const view = render(<TestHarness isEditMode={false} isPPTBuildMode editorRef={editorRef} />)
		const bridge = bridgeState.instances[0]
		act(() => bridge.emit("EDITOR_READY"))
		await waitFor(() => expect(view.getByTestId("editor-ready")).toHaveTextContent("true"))
		expect(bridge.request).toHaveBeenCalledWith(EditorMessageType.SET_PPT_BUILD_MODE, {
			enabled: true,
		})
		expect(bridge.request).not.toHaveBeenCalledWith(EditorMessageType.ENTER_EDIT_MODE)
		await editorRef.current!.updatePPTBuilds([])
		expect(bridge.sendCommand).toHaveBeenCalledWith(
			EditorMessageType.UPDATE_PPT_BUILDS,
			expect.anything(),
			expect.anything(),
		)
		view.rerender(
			<TestHarness isEditMode={false} isPPTBuildMode={false} editorRef={editorRef} />,
		)
		await waitFor(() =>
			expect(bridge.request).toHaveBeenCalledWith(EditorMessageType.EXIT_SELECTION_MODE),
		)
		expect(bridge.request).toHaveBeenLastCalledWith(EditorMessageType.EXIT_SELECTION_MODE)
		expect(view.getByTestId("editor-ready")).toHaveTextContent("false")
	})
	beforeEach(() => {
		toastInfo.mockClear()
		bridgeState.instances.length = 0
		bridgeState.requests.length = 0
		bridgeState.activationMessages.length = 0
	})

	it("exposes build APIs only after editor activation and resets readiness on document replacement", async () => {
		const editorRef = { current: null } as RefObject<HTMLEditorV2Ref>
		const view = render(<TestHarness isEditMode editorRef={editorRef} />)
		const bridge = bridgeState.instances[0]
		let finishSelection: (() => void) | undefined
		bridge.request.mockImplementation(async (type: string) => {
			bridgeState.requests.push(type)
			if (type === EditorMessageType.ENTER_SELECTION_MODE)
				await new Promise<void>((resolve) => {
					finishSelection = resolve
				})
			if (type === EditorMessageType.GET_PPT_BUILDS) return []
			return {}
		})
		await expect(editorRef.current!.setPPTBuildMarkers(true)).rejects.toThrow(
			"PPT_BUILD_EDITOR_NOT_READY",
		)
		act(() => bridge.emit("EDITOR_READY"))
		await waitFor(() => expect(finishSelection).toBeDefined())
		expect(view.getByTestId("editor-ready").textContent).toBe("false")
		await act(async () => finishSelection?.())
		expect(view.getByTestId("editor-ready").textContent).toBe("true")
		await expect(editorRef.current!.getPPTBuilds()).resolves.toEqual([])
		await editorRef.current!.updatePPTBuilds([])
		expect(bridge.sendCommand).toHaveBeenCalledWith(
			EditorMessageType.UPDATE_PPT_BUILDS,
			{ updates: [] },
			expect.objectContaining({ canUndo: true }),
		)
		view.rerender(<TestHarness isEditMode editorRef={editorRef} contentInjected={false} />)
		expect(view.getByTestId("editor-ready").textContent).toBe("false")
	})

	it("explains why a JavaScript-created element cannot be edited", async () => {
		render(<TestHarness isEditMode />)
		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		act(() => bridgeState.instances[0].emit(EditorMessageType.DYNAMIC_ELEMENT_CLICKED))
		expect(toastInfo).toHaveBeenCalledOnce()
	})

	it("uses metadata updated during GET_CONTENT and returns the exact submitted snapshot", async () => {
		const editorRef = { current: null } as RefObject<HTMLEditorV2Ref>
		let resolveContent!: (result: { cleanHtml: string }) => void
		let finishSave!: () => void
		const saveEditContent = vi.fn<(content: string) => Promise<void>>().mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishSave = resolve
				}),
		)
		const oldMetadata = vi.fn((html: string) => `${html}Old metadata`)
		const latestMetadata = vi.fn((html: string) => `${html}Latest metadata`)
		const futureMetadata = vi.fn((html: string) => `${html}Future metadata`)
		const props = { isEditMode: true, editorRef, saveEditContent }
		const view = render(<TestHarness {...props} prepareSaveContent={oldMetadata} />)
		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		bridgeState.instances[0].request.mockImplementation((type: string) => {
			return type === EditorMessageType.GET_CONTENT
				? new Promise<{ cleanHtml: string }>((resolve) => {
						resolveContent = resolve
					})
				: Promise.resolve({})
		})
		const save = editorRef.current?.save
		if (!save) throw new Error("Editor save handle is missing")
		const result = save()
		view.rerender(<TestHarness {...props} prepareSaveContent={latestMetadata} />)
		await act(async () => {
			resolveContent({
				cleanHtml:
					'<main>Edited body</main><script data-injected="true">editorRuntime()</script>',
			})
		})
		expect(oldMetadata).not.toHaveBeenCalled()
		expect(latestMetadata).toHaveBeenCalledTimes(1)
		expect(latestMetadata.mock.calls[0][0]).not.toContain("editorRuntime")
		expect(saveEditContent).toHaveBeenCalledWith(
			expect.stringContaining("<main>Edited body</main>"),
			"slide-1",
			true,
			undefined,
			undefined,
		)
		expect(saveEditContent.mock.calls[0][0]).toBe(latestMetadata.mock.results[0].value)
		view.rerender(<TestHarness {...props} prepareSaveContent={futureMetadata} />)
		finishSave()
		expect(await result).toEqual(
			expect.objectContaining({
				success: true,
				cleanContent: saveEditContent.mock.calls[0][0],
			}),
		)
		expect(futureMetadata).not.toHaveBeenCalled()
	})

	it("does not prepare or persist source metadata when the iframe has no save content", async () => {
		const editorRef = { current: null } as RefObject<HTMLEditorV2Ref>
		const saveEditContent = vi.fn(async () => true)
		const prepareSaveContent = vi.fn((html: string) => html)
		render(
			<TestHarness
				isEditMode
				editorRef={editorRef}
				saveEditContent={saveEditContent}
				prepareSaveContent={prepareSaveContent}
			/>,
		)
		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		const save = editorRef.current?.save
		if (!save) throw new Error("Editor save handle is missing")
		expect(await save()).toEqual(expect.objectContaining({ success: false, cleanContent: "" }))
		expect(prepareSaveContent).not.toHaveBeenCalled()
		expect(saveEditContent).not.toHaveBeenCalled()
	})

	it("retries runtime activation until the iframe confirms readiness", async () => {
		vi.useFakeTimers()
		try {
			render(<TestHarness isEditMode />)

			await act(async () => {
				await Promise.resolve()
			})
			expect(bridgeState.activationMessages).toHaveLength(1)

			act(() => {
				vi.advanceTimersByTime(350)
			})
			expect(bridgeState.activationMessages).toHaveLength(2)

			act(() => {
				bridgeState.instances[0].emit("EDITOR_READY")
				vi.advanceTimersByTime(2_000)
			})
			expect(bridgeState.activationMessages).toHaveLength(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it("re-enters edit and selection mode after cancelling edit without waiting for a second runtime ready event", async () => {
		const { rerender } = render(<TestHarness isEditMode />)

		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		act(() => {
			bridgeState.instances[0].emit("EDITOR_READY")
		})

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})

		rerender(<TestHarness isEditMode={false} />)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
			])
		})

		rerender(<TestHarness isEditMode />)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})
	})

	it("keeps runtime ready when cross-domain ready arrives before content reinjection completes", async () => {
		const { rerender } = render(<TestHarness isEditMode renderSiteUrl="https://render.test" />)

		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		act(() => {
			bridgeState.instances[0].emit("EDITOR_READY")
		})

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})

		rerender(
			<TestHarness
				isEditMode={false}
				contentInjected={false}
				renderSiteUrl="https://render.test"
			/>,
		)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
			])
		})

		act(() => {
			bridgeState.instances[0].emit("EDITOR_READY")
		})

		rerender(<TestHarness isEditMode={false} renderSiteUrl="https://render.test" />)
		rerender(<TestHarness isEditMode renderSiteUrl="https://render.test" />)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
				EditorMessageType.SET_PPT_BUILD_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})
	})

	it("rejects batch preview commands after the editor bridge is destroyed", async () => {
		const editorRef = { current: null } as unknown as RefObject<HTMLEditorV2Ref>
		const { rerender } = render(<TestHarness isEditMode editorRef={editorRef} />)
		await waitFor(() => expect(editorRef.current?.beginBatchOperation).toBeTypeOf("function"))
		const editor = editorRef.current
		if (!editor) throw new Error("Editor ref was not initialized")

		rerender(<TestHarness isEditMode iframeLoaded={false} editorRef={editorRef} />)

		await expect(editor.beginBatchOperation(".slide", { padding: "16px" })).rejects.toThrow(
			"HTML editor bridge is unavailable",
		)
		await expect(editor.applyStylesTemporary(".slide", { padding: "16px" })).rejects.toThrow(
			"HTML editor bridge is unavailable",
		)
	})

	it("returns the iframe layout from applyStylesTemporary", async () => {
		const editorRef = { current: null } as unknown as RefObject<HTMLEditorV2Ref>
		const layout = {
			rect: { top: 80, left: 0, width: 220, height: 216 },
			childRects: [
				{ top: 80, left: 10, width: 80, height: 80 },
				{ top: 196, left: 10, width: 80, height: 80 },
			],
		}
		render(<TestHarness isEditMode editorRef={editorRef} />)
		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		bridgeState.instances[0].sendCommand.mockResolvedValue(layout)

		await waitFor(() => expect(editorRef.current?.applyStylesTemporary).toBeTypeOf("function"))
		const editor = editorRef.current
		if (!editor) throw new Error("Editor ref was not initialized")
		await expect(
			editor.applyStylesTemporary("div.meta-grid", { rowGap: "36px" }),
		).resolves.toEqual(layout)
	})
})
