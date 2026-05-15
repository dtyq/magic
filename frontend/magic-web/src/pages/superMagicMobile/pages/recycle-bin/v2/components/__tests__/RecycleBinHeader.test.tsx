import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import RecycleBinHeader from "../RecycleBinHeader"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("RecycleBinHeader", () => {
	it("applies top safe-area spacing after global safe area is disabled", () => {
		render(<RecycleBinHeader onMenuClick={vi.fn()} onFilterClick={vi.fn()} />)

		expect(screen.getByTestId("mobile-recycle-bin-header").className).toContain(
			"h-[calc(56px+var(--safe-area-inset-top))]",
		)
		expect(screen.getByTestId("mobile-recycle-bin-header").className).toContain(
			"pt-[calc(var(--safe-area-inset-top)+8px)]",
		)
	})
})
