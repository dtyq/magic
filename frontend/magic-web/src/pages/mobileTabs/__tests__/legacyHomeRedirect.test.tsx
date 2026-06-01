import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"

const replaceMock = vi.fn()

vi.mock("@/routes/history", () => ({
	history: {
		replace: replaceMock,
	},
}))

const { LegacyMobileHomeRedirect } = await import("../legacyHomeRedirect")

describe("LegacyMobileHomeRedirect", () => {
	beforeEach(() => {
		replaceMock.mockReset()
	})

	it("replaces legacy mobile-tabs home with MobileHome and no query", async () => {
		render(<LegacyMobileHomeRedirect />)

		await waitFor(() => {
			expect(replaceMock).toHaveBeenCalledWith({ name: RouteName.MobileHome })
		})
	})
})
