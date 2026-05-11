import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useDocumentCreateNavigation } from "../useDocumentCreateNavigation"
import { DocumentCreateStore } from "../../store"
import { DOCUMENT_TYPES } from "../../constants"

describe("useDocumentCreateNavigation", () => {
	let store: DocumentCreateStore
	let onComplete: ReturnType<typeof vi.fn>
	let onCancel: ReturnType<typeof vi.fn>

	beforeEach(() => {
		store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)
		onComplete = vi.fn()
		onCancel = vi.fn()
	})

	it("should provide all navigation callbacks", () => {
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		expect(result.current.handleNext).toBeDefined()
		expect(result.current.handlePrevious).toBeDefined()
		expect(result.current.handleBack).toBeDefined()
		expect(result.current.handleClose).toBeDefined()
		expect(result.current.handleComplete).toBeDefined()
	})

	it("should call handleNext callback", () => {
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		act(() => {
			result.current.handleNext()
		})

		// handleNext should be callable without error
		expect(result.current.handleNext).toBeDefined()
	})

	it("should go back step when handlePrevious is called", () => {
		store.currentStep = 2
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)
		const initialStep = store.currentStep

		act(() => {
			result.current.handlePrevious()
		})

		expect(store.currentStep).toBe(initialStep - 1)
	})

	it("should call previousStep when handleBack is called and currentStep > 1", () => {
		store.currentStep = 2
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)
		const initialStep = store.currentStep

		act(() => {
			result.current.handleBack()
		})

		expect(store.currentStep).toBe(initialStep - 1)
		expect(onCancel).not.toHaveBeenCalled()
	})

	it("should call onCancel when handleBack is called and currentStep === 1", () => {
		store.currentStep = 1
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		act(() => {
			result.current.handleBack()
		})

		expect(store.currentStep).toBe(1)
		expect(onCancel).toHaveBeenCalledOnce()
	})

	it("should call onCancel when handleClose is called", () => {
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		act(() => {
			result.current.handleClose()
		})

		expect(onCancel).toHaveBeenCalledOnce()
	})

	it("should call onComplete when handleComplete is called", () => {
		const { result } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		act(() => {
			result.current.handleComplete()
		})

		expect(onComplete).toHaveBeenCalledOnce()
	})

	it("should maintain stable references with useMemoizedFn", () => {
		const { result, rerender } = renderHook(() =>
			useDocumentCreateNavigation({ store, onComplete, onCancel }),
		)

		const firstNext = result.current.handleNext
		const firstPrevious = result.current.handlePrevious

		rerender()

		expect(result.current.handleNext).toBe(firstNext)
		expect(result.current.handlePrevious).toBe(firstPrevious)
	})
})
