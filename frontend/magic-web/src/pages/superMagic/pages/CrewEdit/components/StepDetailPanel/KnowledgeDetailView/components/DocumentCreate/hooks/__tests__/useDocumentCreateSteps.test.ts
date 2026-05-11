import { renderHook } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useDocumentCreateSteps } from "../useDocumentCreateSteps"
import { DocumentCreateStore } from "../../store"
import { DOCUMENT_TYPES } from "../../constants"

describe("useDocumentCreateSteps", () => {
	it("should return steps array with correct structure", () => {
		const store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)

		const { result } = renderHook(() => useDocumentCreateSteps({ store }))

		expect(result.current.steps).toHaveLength(3)
		expect(result.current.steps[0]).toHaveProperty("number")
		expect(result.current.steps[0]).toHaveProperty("i18nKey")
		expect(result.current.steps[0]).toHaveProperty("status")
	})

	it("should calculate currentStepIndex correctly", () => {
		const store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)
		store.currentStep = 1

		const { result } = renderHook(() => useDocumentCreateSteps({ store }))

		expect(result.current.currentStepIndex).toBe(0)
	})

	it("should update currentStepIndex when store.currentStep changes", () => {
		const store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)
		store.currentStep = 1

		const { result, rerender } = renderHook(() => useDocumentCreateSteps({ store }))

		expect(result.current.currentStepIndex).toBe(0)

		store.currentStep = 2
		rerender()

		expect(result.current.currentStepIndex).toBe(1)
	})

	it("should calculate step status correctly", () => {
		const store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)
		store.currentStep = 2

		const { result } = renderHook(() => useDocumentCreateSteps({ store }))

		expect(result.current.steps[0].status).toBe("completed")
		expect(result.current.steps[1].status).toBe("current")
		expect(result.current.steps[2].status).toBe("pending")
	})

	it("should use step configs from store", () => {
		const store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.PROJECT)

		const { result } = renderHook(() => useDocumentCreateSteps({ store }))

		const configs = store.getAllStepConfigs()
		expect(result.current.steps).toHaveLength(configs.length)
		expect(result.current.steps[0].number).toBe(configs[0].number)
		expect(result.current.steps[0].i18nKey).toBe(configs[0].i18nKey)
	})
})
