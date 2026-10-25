import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LazySimpleEditor } from "./lazy-simple-editor"

vi.mock("./simple-editor", () => {
	throw new Error("Failed to fetch dynamically imported module")
})

describe("LazySimpleEditor chunk failure", () => {
	it("keeps the original text visible in a retryable error state", async () => {
		render(<LazySimpleEditor content="fallback content" />)

		await waitFor(() => expect(screen.getByTestId("simple-editor-error")).toBeInTheDocument())
		expect(screen.getByTestId("simple-editor-preserved-content")).toHaveTextContent(
			"fallback content",
		)
		expect(screen.getByTestId("simple-editor-retry")).toBeInTheDocument()
	})
})
