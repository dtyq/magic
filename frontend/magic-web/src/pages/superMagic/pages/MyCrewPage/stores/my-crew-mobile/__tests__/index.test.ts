import { beforeEach, describe, expect, it, vi } from "vitest"
import { crewService } from "@/services/crew/CrewService"
import { MyCrewMobileStore } from ".."

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		getUnifiedAgents: vi.fn(),
		deleteAgent: vi.fn(),
	},
}))

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

describe("MyCrewMobileStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("shows initial skeleton only before the first fetch completes", async () => {
		const store = new MyCrewMobileStore()
		const deferred = createDeferred<{
			list: []
			page: number
			pageSize: number
			total: number
		}>()

		vi.mocked(crewService.getUnifiedAgents).mockReturnValueOnce(deferred.promise)

		const fetchPromise = store.fetchAgents()
		expect(store.showInitialSkeleton).toBe(true)

		deferred.resolve({ list: [], page: 1, pageSize: 20, total: 0 })
		await fetchPromise

		expect(store.hasLoadedOnce).toBe(true)
		expect(store.showInitialSkeleton).toBe(false)
	})

	it("keeps list rows during refresh after the first load", async () => {
		const store = new MyCrewMobileStore()
		const existingRow = {
			id: "crew-1",
			agentCode: "agent-1",
			name: "Agent",
			role: "",
			description: "",
			icon: null,
			scope: "market_installed" as const,
			allowDelete: true,
			updatedAt: "2026-03-21 10:00:00",
		}

		vi.mocked(crewService.getUnifiedAgents).mockResolvedValueOnce({
			list: [existingRow],
			page: 1,
			pageSize: 20,
			total: 1,
		})
		await store.fetchAgents()

		const deferred = createDeferred<{
			list: typeof store.list
			page: number
			pageSize: number
			total: number
		}>()
		vi.mocked(crewService.getUnifiedAgents).mockReturnValueOnce(deferred.promise)

		const refreshPromise = store.refresh()
		expect(store.list).toHaveLength(1)
		expect(store.showInitialSkeleton).toBe(false)

		deferred.resolve({ list: [], page: 1, pageSize: 20, total: 0 })
		await refreshPromise

		expect(store.list).toHaveLength(0)
	})
})
