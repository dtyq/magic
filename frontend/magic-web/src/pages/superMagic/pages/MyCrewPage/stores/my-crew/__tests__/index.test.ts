import { beforeEach, describe, expect, it, vi } from "vitest"
import { crewService } from "@/services/crew/CrewService"
import { MyCrewStore } from ".."

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		getCreatedAgents: vi.fn(),
		getExternalAgents: vi.fn(),
		deleteAgent: vi.fn(),
		offlineAgent: vi.fn(),
		upgradeAgent: vi.fn(),
	},
}))

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

describe("MyCrewStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("loads created agents from the created endpoint", async () => {
		vi.mocked(crewService.getCreatedAgents).mockResolvedValue({
			list: [
				{
					id: "1",
					agentCode: "agent-created",
					name: "Created Agent",
					role: "",
					description: "",
					icon: null,
					playbooks: [],
					sourceType: "LOCAL_CREATE",
					enabled: true,
					isStoreOffline: null,
					needUpgrade: false,
					allowDelete: true,
					latestVersionCode: null,
					latestPublishedAt: null,
					pinnedAt: null,
					updatedAt: "2026-03-21 10:00:00",
				},
			],
			page: 1,
			pageSize: 20,
			total: 1,
		})

		const store = new MyCrewStore()
		await store.fetchAgents({ listVariant: "created" })

		expect(crewService.getCreatedAgents).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
		})
		expect(crewService.getExternalAgents).not.toHaveBeenCalled()
		expect(store.listVariant).toBe("created")
		expect(store.list[0]?.agentCode).toBe("agent-created")
	})

	it("loads hired agents from the external endpoint", async () => {
		vi.mocked(crewService.getExternalAgents).mockResolvedValue({
			list: [
				{
					id: "2",
					agentCode: "agent-external",
					name: "External Agent",
					role: "",
					description: "",
					icon: null,
					playbooks: [],
					sourceType: "MARKET",
					enabled: true,
					isStoreOffline: false,
					needUpgrade: false,
					allowDelete: false,
					latestVersionCode: "1.2.0",
					latestPublishedAt: null,
					pinnedAt: null,
					updatedAt: "2026-03-21 10:00:00",
				},
			],
			page: 1,
			pageSize: 20,
			total: 1,
		})

		const store = new MyCrewStore()
		await store.fetchAgents({ listVariant: "hired" })

		expect(crewService.getExternalAgents).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
		})
		expect(crewService.getCreatedAgents).not.toHaveBeenCalled()
		expect(store.listVariant).toBe("hired")
		expect(store.list[0]?.allowDelete).toBe(false)
	})

	it("clears keyword when search input is emptied", async () => {
		vi.mocked(crewService.getCreatedAgents).mockResolvedValue({
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
		})

		const store = new MyCrewStore()
		await store.fetchAgents({ listVariant: "created", keyword: "   " })

		expect(crewService.getCreatedAgents).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
		})
		expect(store.keyword).toBe("")
	})

	it("marks an agent disabled after offline succeeds", async () => {
		vi.mocked(crewService.offlineAgent).mockResolvedValue([] as never)

		const store = new MyCrewStore()
		store.list = [
			{
				id: "2",
				agentCode: "agent-external",
				name: "External Agent",
				role: "",
				description: "",
				icon: null,
				playbooks: [],
				sourceType: "LOCAL_CREATE",
				publisherType: null,
				publisherName: null,
				enabled: true,
				isStoreOffline: false,
				needUpgrade: false,
				allowDelete: false,
				latestVersionCode: "1.2.0",
				latestPublishedAt: null,
				pinnedAt: null,
				updatedAt: "2026-03-21 10:00:00",
			},
		]

		await store.offlineAgent("agent-external")

		expect(crewService.offlineAgent).toHaveBeenCalledWith("agent-external")
		expect(store.list[0]?.enabled).toBe(false)
	})

	it("keeps the latest result when a previous request resolves later", async () => {
		const firstRequest = createDeferred<{
			list: Array<{
				id: string
				agentCode: string
				name: string
				role: string
				description: string
				icon: null
				playbooks: []
				sourceType: "LOCAL_CREATE" | "MARKET"
				enabled: boolean
				isStoreOffline: boolean | null
				needUpgrade: boolean
				allowDelete: boolean
				latestVersionCode: string | null
				latestPublishedAt: string | null
				pinnedAt: string | null
				updatedAt: string
			}>
			page: number
			pageSize: number
			total: number
		}>()
		const secondRequest = createDeferred<{
			list: []
			page: number
			pageSize: number
			total: number
		}>()

		vi.mocked(crewService.getCreatedAgents)
			.mockReturnValueOnce(firstRequest.promise)
			.mockReturnValueOnce(secondRequest.promise)

		const store = new MyCrewStore()
		const firstFetch = store.fetchAgents({ listVariant: "created", keyword: "alpha" })
		const secondFetch = store.fetchAgents({ listVariant: "created", keyword: "" })

		secondRequest.resolve({
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
		})
		await secondFetch

		firstRequest.resolve({
			list: [
				{
					id: "stale-crew-1",
					agentCode: "stale-crew",
					name: "Stale Crew",
					role: "",
					description: "",
					icon: null,
					playbooks: [],
					sourceType: "LOCAL_CREATE",
					enabled: true,
					isStoreOffline: null,
					needUpgrade: false,
					allowDelete: true,
					latestVersionCode: null,
					latestPublishedAt: null,
					pinnedAt: null,
					updatedAt: "2026-03-21 10:00:00",
				},
			],
			page: 1,
			pageSize: 20,
			total: 1,
		})
		await firstFetch

		expect(store.keyword).toBe("")
		expect(store.list).toEqual([])
	})
})
