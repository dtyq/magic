import { act, render, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EditorMessageType } from "../../iframe-bridge/types/messages"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useHTMLEditorV2 } from "../useHTMLEditorV2"

const bridgeState = vi.hoisted(() => ({
	instances: [] as Array<{
		request: ReturnType<typeof vi.fn>
		on: ReturnType<typeof vi.fn>
		isActive: ReturnType<typeof vi.fn>
		destroy: ReturnType<typeof vi.fn>
		emit: (type: string, payload?: unknown) => void
	}>,
	requests: [] as string[],
}))

vi.mock("@/utils/env", () => ({
	env: vi.fn(() => ""),
}))

vi.mock("../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		reset: vi.fn(),
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
			postMessage: vi.fn(),
		},
		configurable: true,
	})
	return { current: iframe }
}

interface TestHarnessProps {
	isEditMode: boolean
	contentInjected?: boolean
	renderSiteUrl?: string
}

function TestHarness({ isEditMode, contentInjected = true, renderSiteUrl }: TestHarnessProps) {
	const iframeRef = useRef(createIframeRef().current)
	const editorRef = useRef<HTMLEditorV2Ref>(null)

	useHTMLEditorV2({
		iframeRef,
		editorRef,
		isEditMode,
		sandboxType: "iframe",
		iframeLoaded: true,
		contentInjected,
		renderSiteUrl,
		targetOrigin: "*",
		filePathMapping: new Map(),
	})

	return null
}

describe("useHTMLEditorV2 edit lifecycle", () => {
	beforeEach(() => {
		bridgeState.instances.length = 0
		bridgeState.requests.length = 0
	})

	it("re-enters edit and selection mode after cancelling edit without waiting for a second runtime ready event", async () => {
		const { rerender } = render(<TestHarness isEditMode />)

		await waitFor(() => expect(bridgeState.instances).toHaveLength(1))
		act(() => {
			bridgeState.instances[0].emit("EDITOR_READY")
		})

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})

		rerender(<TestHarness isEditMode={false} />)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
			])
		})

		rerender(<TestHarness isEditMode />)

		await waitFor(() => {
			expect(bridgeState.requests).toEqual([
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
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
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
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
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
				EditorMessageType.EXIT_EDIT_MODE,
				EditorMessageType.EXIT_SELECTION_MODE,
				EditorMessageType.ENTER_EDIT_MODE,
				EditorMessageType.ENTER_SELECTION_MODE,
			])
		})
	})
})
