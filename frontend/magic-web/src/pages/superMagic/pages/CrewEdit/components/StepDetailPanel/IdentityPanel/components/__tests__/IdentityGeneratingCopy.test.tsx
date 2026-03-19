import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { IdentityGeneratingCopy } from "../IdentityGeneratingCopy"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"card.generating.title": "Creating...",
				"card.generating.subtitle": "Matching core skill plugins from Skills Library...",
			}

			return translations[key] || key
		},
	}),
}))

describe("IdentityGeneratingCopy", () => {
	it("renders generating title, subtitle, and loader", () => {
		render(<IdentityGeneratingCopy />)

		expect(screen.getByTestId("crew-identity-generating-status")).toBeInTheDocument()
		expect(screen.getByText("Creating...")).toBeInTheDocument()
		expect(
			screen.getByText("Matching core skill plugins from Skills Library..."),
		).toBeInTheDocument()
		expect(screen.getByTestId("crew-identity-generating-loader")).toBeInTheDocument()
	})
})
