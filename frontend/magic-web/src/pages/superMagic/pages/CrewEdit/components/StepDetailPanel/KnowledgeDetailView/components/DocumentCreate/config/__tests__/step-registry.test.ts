import { describe, it, expect } from "vitest"
import { STEP_COMPONENT_REGISTRY, getStepComponentConfig, hasStepComponent } from "../step-registry"
import { DOCUMENT_TYPES } from "../../constants"

describe("StepRegistry", () => {
	describe("STEP_COMPONENT_REGISTRY", () => {
		it("should define components for all document types", () => {
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.LOCAL]).toBeDefined()
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.CUSTOM]).toBeDefined()
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.PROJECT]).toBeDefined()
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.WIKI]).toBeDefined()
		})

		it("should define all 3 steps for CUSTOM type", () => {
			const customSteps = STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.CUSTOM]
			expect(customSteps[1]).toBeDefined()
			expect(customSteps[2]).toBeDefined()
			expect(customSteps[3]).toBeDefined()
		})

		it("should define all 3 steps for PROJECT type", () => {
			const projectSteps = STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.PROJECT]
			expect(projectSteps[1]).toBeDefined()
			expect(projectSteps[2]).toBeDefined()
			expect(projectSteps[3]).toBeDefined()
		})

		it("should define all 3 steps for WIKI type", () => {
			const wikiSteps = STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.WIKI]
			expect(wikiSteps[1]).toBeDefined()
			expect(wikiSteps[2]).toBeDefined()
			expect(wikiSteps[3]).toBeDefined()
		})

		it("should define all 4 steps for LOCAL type", () => {
			const localSteps = STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.LOCAL]
			expect(localSteps[1]).toBeDefined()
			expect(localSteps[2]).toBeDefined()
			expect(localSteps[3]).toBeDefined()
			expect(localSteps[4]).toBeDefined()
			expect(localSteps[5]).toBeUndefined()
		})

		it("should have correct storeKey for each document type", () => {
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.LOCAL][1].storeKey).toBe(
				"localDocumentStore",
			)
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.CUSTOM][1].storeKey).toBe(
				"customContentStore",
			)
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.PROJECT][1].storeKey).toBe(
				"projectDocumentStore",
			)
			expect(STEP_COMPONENT_REGISTRY[DOCUMENT_TYPES.WIKI][1].storeKey).toBe(
				"wikiDocumentStore",
			)
		})
	})

	describe("getStepComponentConfig", () => {
		it("should return correct config for valid document type and step", () => {
			const config = getStepComponentConfig(DOCUMENT_TYPES.CUSTOM, 1)
			expect(config).toBeDefined()
			expect(config?.storeKey).toBe("customContentStore")
		})

		it("should return null for invalid document type", () => {
			const config = getStepComponentConfig("INVALID_TYPE", 1)
			expect(config).toBeNull()
		})

		it("should return null for invalid step number", () => {
			const config = getStepComponentConfig(DOCUMENT_TYPES.CUSTOM, 99)
			expect(config).toBeNull()
		})

		it("should handle all steps for multi-step types", () => {
			const step1 = getStepComponentConfig(DOCUMENT_TYPES.PROJECT, 1)
			const step2 = getStepComponentConfig(DOCUMENT_TYPES.PROJECT, 2)
			const step3 = getStepComponentConfig(DOCUMENT_TYPES.PROJECT, 3)

			expect(step1).toBeDefined()
			expect(step2).toBeDefined()
			expect(step3).toBeDefined()
		})
	})

	describe("hasStepComponent", () => {
		it("should return true for existing step", () => {
			expect(hasStepComponent(DOCUMENT_TYPES.CUSTOM, 1)).toBe(true)
			expect(hasStepComponent(DOCUMENT_TYPES.PROJECT, 2)).toBe(true)
			expect(hasStepComponent(DOCUMENT_TYPES.WIKI, 3)).toBe(true)
		})

		it("should return false for non-existing step", () => {
			expect(hasStepComponent(DOCUMENT_TYPES.LOCAL, 5)).toBe(false)
			expect(hasStepComponent(DOCUMENT_TYPES.CUSTOM, 4)).toBe(false)
		})

		it("should return false for invalid document type", () => {
			expect(hasStepComponent("INVALID_TYPE", 1)).toBe(false)
		})
	})
})
