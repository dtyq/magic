import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CodeSourceEditor from "."
import { formatLongCurlDataRawForPreview } from "./preview-content"

const monacoEditorProps = vi.hoisted(() => vi.fn())

vi.mock("@/infrastructure/editors/monaco", () => ({
	MonacoEditor: (props: Record<string, unknown>) => {
		monacoEditorProps(props)
		return <div data-testid="monaco-editor" />
	},
}))

vi.mock("@/models/config/hooks", () => ({
	useTheme: () => ({ prefersColorScheme: "light" }),
}))

vi.mock("ahooks", () => ({
	useUnmount: () => undefined,
}))

describe("CodeSourceEditor", () => {
	beforeEach(() => {
		monacoEditorProps.mockClear()
	})

	it("does not truncate a long --data-raw source line", () => {
		const content = `curl --data-raw '${"x".repeat(10_001)}'`

		render(<CodeSourceEditor language="markdown" content={content} />)

		expect(screen.getByTestId("monaco-editor")).toBeInTheDocument()
		expect(monacoEditorProps).toHaveBeenCalledWith(
			expect.objectContaining({
				value: content,
				options: expect.objectContaining({
					stopRenderingLineAfter: 50_000,
					wordWrap: "off",
					wrappingStrategy: "simple",
				}),
			}),
		)
	})

	it("keeps word wrapping available while editing", () => {
		render(<CodeSourceEditor language="markdown" content="--data-raw '{}'" isEditMode />)

		expect(monacoEditorProps).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					wordWrap: "on",
				}),
			}),
		)
	})

	it("disables expensive Monaco decorations for large files", () => {
		render(
			<CodeSourceEditor
				language="markdown"
				content="# Large document"
				isLargeFile
				isEditMode
			/>,
		)

		expect(monacoEditorProps).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					largeFileOptimizations: true,
					folding: false,
					colorDecorators: false,
					links: false,
					bracketPairColorization: { enabled: false },
				}),
			}),
		)
	})

	it("formats a long curl payload before Monaco inserts a paste", () => {
		const payload = JSON.stringify({ events: Array.from({ length: 200 }, (_, id) => ({ id })) })
		const pastedText = `curl https://example.com --data-raw '${payload}'`
		const domNode = document.createElement("div")
		const executeEdits = vi.fn()
		const onDidPaste = vi.fn(() => ({ dispose: vi.fn() }))

		render(<CodeSourceEditor language="markdown" content="" isEditMode />)

		const mountedEditor = {
			getDomNode: () => domNode,
			getModel: () => ({ getFullModelRange: () => ({}) }),
			getValue: () => "",
			getSelection: () => ({
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: 1,
				endColumn: 1,
			}),
			onDidPaste,
			executeEdits,
		}
		const props = monacoEditorProps.mock.calls[0]?.[0] as {
			onMount?: (editor: typeof mountedEditor) => void
		}

		act(() => {
			props.onMount?.(mountedEditor)
		})

		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true })
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: { getData: () => pastedText },
		})

		act(() => {
			domNode.dispatchEvent(pasteEvent)
		})

		expect(pasteEvent.defaultPrevented).toBe(true)
		expect(executeEdits).toHaveBeenCalledWith("format-long-curl-data-raw-paste", [
			expect.objectContaining({
				text: formatLongCurlDataRawForPreview(pastedText),
			}),
		])
	})

	it("does not install a whole-document normalizer for ordinary input", () => {
		const onDidChangeModelContent = vi.fn()
		const onDidPaste = vi.fn(() => ({ dispose: vi.fn() }))
		render(<CodeSourceEditor language="markdown" content="" isEditMode />)

		const mountedEditor = {
			getDomNode: () => document.createElement("div"),
			getModel: () => ({ getFullModelRange: () => ({}) }),
			getValue: () => "",
			onDidChangeModelContent,
			onDidPaste,
		}
		const props = monacoEditorProps.mock.calls[0]?.[0] as {
			onMount?: (editor: typeof mountedEditor) => void
		}

		act(() => {
			props.onMount?.(mountedEditor)
		})

		expect(onDidChangeModelContent).not.toHaveBeenCalled()
		expect(onDidPaste).toHaveBeenCalledTimes(1)
	})

	it("formats existing long curl source once when entering edit mode", () => {
		const payload = JSON.stringify({ events: Array.from({ length: 200 }, (_, id) => ({ id })) })
		const source = `curl https://example.com --data-raw '${payload}'`
		const executeEdits = vi.fn()
		const onDidPaste = vi.fn(() => ({ dispose: vi.fn() }))

		render(<CodeSourceEditor language="markdown" content={source} isEditMode />)

		const mountedEditor = {
			getDomNode: () => document.createElement("div"),
			getModel: () => ({ getFullModelRange: () => ({}) }),
			getValue: () => source,
			onDidPaste,
			executeEdits,
		}
		const props = monacoEditorProps.mock.calls[0]?.[0] as {
			onMount?: (editor: typeof mountedEditor) => void
		}

		act(() => {
			props.onMount?.(mountedEditor)
		})

		expect(executeEdits).toHaveBeenCalledWith("format-long-curl-data-raw-on-mount", [
			expect.objectContaining({
				text: formatLongCurlDataRawForPreview(source),
			}),
		])
	})

	it("normalizes a long curl payload after Monaco reports a paste", () => {
		const payload = JSON.stringify({ events: Array.from({ length: 200 }, (_, id) => ({ id })) })
		const source = `curl https://example.com --data-raw '${payload}'`
		const executeEdits = vi.fn()
		const getValue = vi.fn().mockReturnValueOnce("").mockReturnValue(source)
		let handlePaste: (() => void) | undefined

		render(<CodeSourceEditor language="markdown" content="" isEditMode />)

		const mountedEditor = {
			getDomNode: () => document.createElement("div"),
			getModel: () => ({ getFullModelRange: () => ({}) }),
			getValue,
			onDidPaste: (listener: () => void) => {
				handlePaste = listener
				return { dispose: vi.fn() }
			},
			executeEdits,
		}
		const props = monacoEditorProps.mock.calls[0]?.[0] as {
			onMount?: (editor: typeof mountedEditor) => void
		}

		act(() => {
			props.onMount?.(mountedEditor)
			handlePaste?.()
		})

		expect(executeEdits).toHaveBeenCalledWith("format-long-curl-data-raw-after-paste", [
			expect.objectContaining({
				text: formatLongCurlDataRawForPreview(source),
			}),
		])
	})
})
