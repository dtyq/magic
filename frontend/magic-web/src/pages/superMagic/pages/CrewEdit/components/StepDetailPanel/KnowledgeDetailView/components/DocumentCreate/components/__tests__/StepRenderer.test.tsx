import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DOCUMENT_TYPES } from "../../constants"
import { DocumentCreateStore } from "../../store"

// Define mock component first
const MockCustomStep1Component = () => <div>Custom Step 1</div>

// Mock step registry
vi.mock("../../config/step-registry", () => ({
	STEP_COMPONENT_REGISTRY: {
		custom: {
			1: {
				component: MockCustomStep1Component,
				storeKey: "customContentStore",
			},
		},
	},
}))

// Import after mocking
const { StepRenderer } = await import("../StepRenderer")

describe("StepRenderer", () => {
	let store: DocumentCreateStore
	let onNext: ReturnType<typeof vi.fn>
	let onPrevious: ReturnType<typeof vi.fn>

	beforeEach(() => {
		store = new DocumentCreateStore("test-knowledge")
		store.setDocumentType(DOCUMENT_TYPES.CUSTOM)
		onNext = vi.fn()
		onPrevious = vi.fn()
	})

	it("should render step component when config exists", () => {
		render(
			<StepRenderer
				documentType={DOCUMENT_TYPES.CUSTOM}
				currentStep={1}
				store={store}
				onNext={onNext}
				onPrevious={onPrevious}
			/>,
		)

		expect(screen.getByText("Custom Step 1")).toBeInTheDocument()
	})

	it("should return null and log warning for non-existing step", () => {
		const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		const { container } = render(
			<StepRenderer
				documentType={DOCUMENT_TYPES.CUSTOM}
				currentStep={99}
				store={store}
				onNext={onNext}
				onPrevious={onPrevious}
			/>,
		)

		expect(container.firstChild).toBeNull()
		expect(consoleSpy).toHaveBeenCalledWith("No component found for custom step 99")

		consoleSpy.mockRestore()
	})
})
