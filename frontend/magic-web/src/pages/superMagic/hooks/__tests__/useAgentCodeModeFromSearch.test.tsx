import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import useAgentCodeModeFromSearch from "../useAgentCodeModeFromSearch"

const locationState = vi.hoisted(() => ({
	search: "?agentCode=SMA-test-agent",
}))
const resolveAgentAccessMock = vi.hoisted(() => vi.fn())
const fetchModeListMock = vi.hoisted(() => vi.fn())

vi.mock("react-router", () => ({
	useLocation: () => ({
		pathname: "/global/super",
		search: locationState.search,
		hash: "",
	}),
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: { resolveAgentAccess: resolveAgentAccessMock },
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: { fetchModeList: fetchModeListMock },
}))

function createMode(identifier: string) {
	return { mode: { identifier } }
}

describe("useAgentCodeModeFromSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		locationState.search = "?agentCode=SMA-test-agent"
		window.history.replaceState({}, "", "/global/super?agentCode=SMA-test-agent")
		fetchModeListMock.mockResolvedValue([createMode("SMA-test-agent")])
	})

	it("auto-hires an authorized deep-link agent before selecting it", async () => {
		resolveAgentAccessMock.mockResolvedValue({
			status: "ready",
			code: "SMA-test-agent",
			hired: true,
		})
		const onModeResolved = vi.fn()

		renderHook(() =>
			useAgentCodeModeFromSearch({
				onModeResolved,
			}),
		)

		await waitFor(() => expect(onModeResolved).toHaveBeenCalledWith("SMA-test-agent"))
		expect(resolveAgentAccessMock).toHaveBeenCalledWith("SMA-test-agent", {
			autoHire: true,
		})
		expect(fetchModeListMock).toHaveBeenCalledWith({ force: true })
	})

	it("silently clears invalid links even when success clearing is disabled", async () => {
		resolveAgentAccessMock.mockResolvedValue({
			status: "invalid",
			code: "SMA-missing-agent",
			hired: false,
		})
		const onModeResolved = vi.fn()
		const onAgentCodeCleared = vi.fn()

		renderHook(() =>
			useAgentCodeModeFromSearch({
				onModeResolved,
				onAgentCodeCleared,
				clearAgentCodeFromUrl: false,
			}),
		)

		await waitFor(() => expect(onAgentCodeCleared).toHaveBeenCalledTimes(1))
		expect(onModeResolved).not.toHaveBeenCalled()
		expect(window.location.search).toBe("")
	})
})
