import { describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import { getRoutePath } from "@/routes/history/helpers"
import { clipboard } from "@/utils/clipboard-helpers"
import { buildCrewUsageLink, copyCrewUsageLink } from "../crewUsageLink"

vi.mock("@/routes/history/helpers", () => ({
	getRoutePath: vi.fn(),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: { writeText: vi.fn() },
}))

describe("crew usage links", () => {
	it("builds an absolute URL from the Super route and agent code", () => {
		vi.mocked(getRoutePath).mockReturnValue("/global/super?agentCode=SMA-test-agent")

		expect(buildCrewUsageLink("SMA-test-agent", "https://example.test")).toBe(
			"https://example.test/global/super?agentCode=SMA-test-agent",
		)
		expect(getRoutePath).toHaveBeenCalledWith({
			name: RouteName.Super,
			query: { agentCode: "SMA-test-agent" },
		})
	})

	it("copies the generated link and returns it", async () => {
		vi.mocked(getRoutePath).mockReturnValue("/global/super?agentCode=SMA-test-agent")
		vi.mocked(clipboard.writeText).mockResolvedValue(undefined)

		await expect(copyCrewUsageLink("SMA-test-agent")).resolves.toContain(
			"/global/super?agentCode=SMA-test-agent",
		)
		expect(clipboard.writeText).toHaveBeenCalledTimes(1)
	})
})
