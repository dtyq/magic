import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import MySlidesTemplatesEmptyState from "../MySlidesTemplatesEmptyState"

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

describe("MySlidesTemplatesEmptyState", () => {
	it("hides the home button in the inline home-page variant", () => {
		render(<MySlidesTemplatesEmptyState status="unavailable" variant="inline" />)

		expect(screen.queryByTestId("my-slides-templates-go-home")).not.toBeInTheDocument()
	})

	it("keeps the home button on the standalone templates page", () => {
		render(<MySlidesTemplatesEmptyState status="unavailable" />)

		fireEvent.click(screen.getByTestId("my-slides-templates-go-home"))
		expect(navigateMock).toHaveBeenCalledWith({ name: RouteName.Super })
	})
})
