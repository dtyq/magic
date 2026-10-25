import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MicroAppMobileModeBar from "../MicroAppMobileModeBar"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("MicroAppMobileModeBar", () => {
	it("shows the active mode and changes mode from the compact secondary bar", () => {
		const onChange = vi.fn()

		render(<MicroAppMobileModeBar value="development" onChange={onChange} />)

		expect(screen.getByTestId("micro-app-mobile-mode-bar")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-mobile-mode-development")).toHaveAttribute(
			"aria-selected",
			"true",
		)

		fireEvent.click(screen.getByTestId("micro-app-mobile-mode-preview"))
		expect(onChange).toHaveBeenCalledWith("preview")
	})
})
