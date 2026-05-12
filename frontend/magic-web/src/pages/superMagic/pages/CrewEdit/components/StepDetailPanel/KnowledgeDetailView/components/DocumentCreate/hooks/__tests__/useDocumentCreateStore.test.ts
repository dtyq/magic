import { renderHook } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useDocumentCreateStore } from "../useDocumentCreateStore"
import { DOCUMENT_TYPES } from "../../constants"

describe("useDocumentCreateStore", () => {
	const knowledgeCode = "test-knowledge"
	const documentType = DOCUMENT_TYPES.CUSTOM

	it("should create and return a DocumentCreateStore instance", () => {
		const { result } = renderHook(() => useDocumentCreateStore(knowledgeCode, documentType))

		expect(result.current).toBeDefined()
		expect(result.current.knowledgeCode).toBe(knowledgeCode)
		expect(result.current.documentType).toBe(documentType)
	})

	it("should return the same store instance across re-renders", () => {
		const { result, rerender } = renderHook(() =>
			useDocumentCreateStore(knowledgeCode, documentType),
		)

		const firstInstance = result.current
		rerender()
		const secondInstance = result.current

		expect(firstInstance).toBe(secondInstance)
	})

	it("should initialize store with correct initial state", () => {
		const { result } = renderHook(() => useDocumentCreateStore(knowledgeCode, documentType))

		expect(result.current.currentStep).toBe(1)
		expect(result.current.documentType).toBe(documentType)
		expect(result.current.knowledgeCode).toBe(knowledgeCode)
	})

	it("should create different store instances for different hook calls", () => {
		const { result: result1 } = renderHook(() =>
			useDocumentCreateStore("knowledge1", DOCUMENT_TYPES.CUSTOM),
		)
		const { result: result2 } = renderHook(() =>
			useDocumentCreateStore("knowledge2", DOCUMENT_TYPES.PROJECT),
		)

		expect(result1.current).not.toBe(result2.current)
		expect(result1.current.knowledgeCode).toBe("knowledge1")
		expect(result1.current.documentType).toBe(DOCUMENT_TYPES.CUSTOM)
		expect(result2.current.knowledgeCode).toBe("knowledge2")
		expect(result2.current.documentType).toBe(DOCUMENT_TYPES.PROJECT)
	})
})
