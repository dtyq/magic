import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LayoutConstraintHintCard } from "../LayoutConstraintHint"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const hint = {
	kind: "distributed-alignment" as const,
	justifyContent: "space-between",
	fix: { justifyContent: "flex-start" as const },
}

function createDeferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	const promise = new Promise<T>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

function createEditorRef(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
	return {
		current: {
			beginBatchOperation: vi.fn().mockResolvedValue(undefined),
			applyStylesTemporary: vi.fn().mockResolvedValue(undefined),
			endBatchOperation: vi.fn().mockResolvedValue(undefined),
			cancelBatchOperation: vi.fn().mockResolvedValue(undefined),
			refreshSelectedElement: vi.fn().mockResolvedValue(undefined),
			...overrides,
		},
	}
}

describe("LayoutConstraintHintCard", () => {
	it("commits the preview batch on click and does not apply twice", async () => {
		const onApply = vi.fn()
		const editorRef = createEditorRef()

		render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
				onApply={onApply}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.beginBatchOperation).toHaveBeenCalledTimes(1)
		})
		fireEvent.click(applyButton)
		await waitFor(() => {
			expect(editorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
		})

		expect(editorRef.current.endBatchOperation).toHaveBeenCalledWith(".layout", hint.fix)
		expect(onApply).not.toHaveBeenCalled()
	})

	it("falls back to onApply when click happens without a preview session", async () => {
		const onApply = vi.fn()

		render(<LayoutConstraintHintCard hint={hint} selector=".layout" onApply={onApply} />)

		await fireEvent.click(
			screen.getByTestId("layout-constraint-hint-apply-distributed-alignment"),
		)

		expect(onApply).toHaveBeenCalledWith(hint.fix)
	})

	it("cancels preview when mouse leaves before the preview batch finishes", async () => {
		const beginBatch = createDeferred<void>()
		const editorRef = createEditorRef({
			beginBatchOperation: vi.fn(() => beginBatch.promise),
		})

		render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		fireEvent.mouseLeave(applyButton)

		beginBatch.resolve()
		await waitFor(() => {
			expect(editorRef.current.cancelBatchOperation).toHaveBeenCalledTimes(1)
		})
		expect(editorRef.current.applyStylesTemporary).not.toHaveBeenCalled()
		expect(editorRef.current.refreshSelectedElement).toHaveBeenCalledWith(".layout")
	})

	it("cancels preview when mouse leaves before temporary styles are applied", async () => {
		const applyTemporary = createDeferred<void>()
		const editorRef = createEditorRef({
			applyStylesTemporary: vi.fn(() => applyTemporary.promise),
		})

		render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.beginBatchOperation).toHaveBeenCalledTimes(1)
		})

		fireEvent.mouseLeave(applyButton)
		applyTemporary.resolve()

		await waitFor(() => {
			expect(editorRef.current.cancelBatchOperation).toHaveBeenCalledTimes(1)
		})
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()
	})

	it("waits for in-flight preview and commits once when clicked early", async () => {
		const onApply = vi.fn()
		const applyTemporary = createDeferred<void>()
		const editorRef = createEditorRef({
			applyStylesTemporary: vi.fn(() => applyTemporary.promise),
		})

		render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
				onApply={onApply}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.beginBatchOperation).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(applyButton)
		applyTemporary.resolve()

		await waitFor(() => {
			expect(editorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
		})
		expect(onApply).not.toHaveBeenCalled()
		expect(editorRef.current.cancelBatchOperation).not.toHaveBeenCalled()
	})

	it("cancels the batch when temporary styles fail during preview", async () => {
		const editorRef = createEditorRef({
			applyStylesTemporary: vi.fn().mockRejectedValue(new Error("apply failed")),
		})

		render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.cancelBatchOperation).toHaveBeenCalledTimes(1)
		})
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()
	})

	it("cancels the batch when the component unmounts mid-preview", async () => {
		const applyTemporary = createDeferred<void>()
		const editorRef = createEditorRef({
			applyStylesTemporary: vi.fn(() => applyTemporary.promise),
		})

		const { unmount } = render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.beginBatchOperation).toHaveBeenCalledTimes(1)
		})

		unmount()
		applyTemporary.resolve()

		await waitFor(() => {
			expect(editorRef.current.cancelBatchOperation).toHaveBeenCalledTimes(1)
		})
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()
	})

	it("keeps the preview batch active when the parent re-renders", async () => {
		const editorRef = createEditorRef()

		const { rerender } = render(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		const applyButton = screen.getByTestId("layout-constraint-hint-apply-distributed-alignment")
		fireEvent.mouseEnter(applyButton)
		await waitFor(() => {
			expect(editorRef.current.applyStylesTemporary).toHaveBeenCalledTimes(1)
		})

		rerender(
			<LayoutConstraintHintCard
				hint={hint}
				selector=".layout"
				editorRef={editorRef as never}
			/>,
		)

		expect(editorRef.current.cancelBatchOperation).not.toHaveBeenCalled()
	})
})
