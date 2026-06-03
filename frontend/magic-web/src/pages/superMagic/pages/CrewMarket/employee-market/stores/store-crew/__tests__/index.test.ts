import { beforeEach, describe, expect, it, vi } from "vitest"
import { crewService } from "@/services/crew/CrewService"
import { StoreCrewStore } from ".."

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		getStoreCategories: vi.fn(),
		getStoreAgents: vi.fn(),
		hireAgent: vi.fn(),
		deleteAgent: vi.fn(),
	},
}))

function createStore() {
	const store = new StoreCrewStore()
	store.list = [
		{
			id: "market-1",
			agentCode: "agent-market-1",
			userCode: null,
			isFeatured: false,
			latestVersionCode: "2.0.0",
			name: "Market Agent",
			role: "",
			description: "",
			icon: null,
			playbooks: [],
			publisherType: "USER",
			publisherName: "Test User",
			categoryId: "1",
			isAdded: false,
			allowDelete: false,
			updatedAt: "2026-03-21 10:00:00",
		},
	]
	return store
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

describe("StoreCrewStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("marks a market agent as removable after hire", async () => {
		const store = createStore()

		await store.hireAgent("market-1")

		expect(crewService.hireAgent).toHaveBeenCalledWith("agent-market-1")
		expect(store.list[0]).toMatchObject({
			isAdded: true,
			allowDelete: true,
		})
	})

	it("ignores dismiss when allowDelete is false", async () => {
		const store = createStore()

		await store.dismissAgent("market-1")

		expect(crewService.deleteAgent).not.toHaveBeenCalled()
		expect(store.list[0]).toMatchObject({
			isAdded: false,
			allowDelete: false,
		})
	})

	it("clears removable state after dismiss", async () => {
		const store = createStore()
		store.list[0] = {
			...store.list[0],
			userCode: "agent-local-1",
			isAdded: true,
			allowDelete: true,
		}

		await store.dismissAgent("market-1")

		expect(crewService.deleteAgent).toHaveBeenCalledWith("agent-local-1")
		expect(store.list[0]).toMatchObject({
			isAdded: false,
			allowDelete: false,
		})
	})

	it("hides category filter when fetchCategories returns an empty list", async () => {
		const store = createStore()
		vi.mocked(crewService.getStoreCategories).mockResolvedValueOnce([])

		await store.fetchCategories()

		expect(store.shouldShowCategoryFilter).toBe(false)
	})

	it("shows category filter when fetchCategories returns categories", async () => {
		const store = createStore()
		vi.mocked(crewService.getStoreCategories).mockResolvedValueOnce([
			{ id: "cat-1", name: "Analytics", logo: null },
		])

		await store.fetchCategories()

		expect(store.shouldShowCategoryFilter).toBe(true)
	})

	it("clears keyword when search input is emptied", async () => {
		const store = createStore()
		vi.mocked(crewService.getStoreAgents).mockResolvedValueOnce({
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
		})

		await store.fetchAgents({ keyword: "   ", page: 1 })

		expect(crewService.getStoreAgents).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
			category_id: undefined,
		})
		expect(store.keyword).toBe("")
	})

	it("keeps the latest search result when a previous request resolves later", async () => {
		const store = createStore()
		const firstRequest = createDeferred<{
			list: typeof store.list
			page: number
			pageSize: number
			total: number
		}>()
		const secondRequest = createDeferred<{
			list: typeof store.list
			page: number
			pageSize: number
			total: number
		}>()

		vi.mocked(crewService.getStoreAgents)
			.mockReturnValueOnce(firstRequest.promise)
			.mockReturnValueOnce(secondRequest.promise)

		const firstFetch = store.fetchAgents({ keyword: "alpha", page: 1 })
		const secondFetch = store.fetchAgents({ keyword: "", page: 1 })

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
					id: "stale-market-1",
					agentCode: "stale-agent-1",
					userCode: null,
					isFeatured: false,
					latestVersionCode: "1.0.0",
					name: "Stale Agent",
					role: "",
					description: "",
					icon: null,
					playbooks: [],
					publisherType: "USER",
					publisherName: "Stale User",
					categoryId: "1",
					isAdded: false,
					allowDelete: false,
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

	it("shows initial skeleton only before the first page-1 fetch completes", async () => {
		const store = createStore()
		const deferred = createDeferred<{
			list: typeof store.list
			page: number
			pageSize: number
			total: number
		}>()

		vi.mocked(crewService.getStoreAgents).mockReturnValueOnce(deferred.promise)

		const fetchPromise = store.fetchAgents({ page: 1 })
		expect(store.showInitialSkeleton).toBe(true)

		deferred.resolve({ list: [], page: 1, pageSize: 20, total: 0 })
		await fetchPromise

		expect(store.hasLoadedOnce).toBe(true)
		expect(store.showInitialSkeleton).toBe(false)
	})

	it("keeps list rows when reloading page 1 after the first load", async () => {
		const store = createStore()
		vi.mocked(crewService.getStoreAgents).mockResolvedValueOnce({
			list: store.list,
			page: 1,
			pageSize: 20,
			total: 1,
		})
		await store.fetchAgents({ page: 1 })

		const deferred = createDeferred<{
			list: []
			page: number
			pageSize: number
			total: number
		}>()
		vi.mocked(crewService.getStoreAgents).mockReturnValueOnce(deferred.promise)

		const reloadPromise = store.fetchAgents({ keyword: "beta", page: 1 })
		expect(store.list).toHaveLength(1)
		expect(store.showInitialSkeleton).toBe(false)

		deferred.resolve({ list: [], page: 1, pageSize: 20, total: 0 })
		await reloadPromise

		expect(store.list).toHaveLength(0)
	})
})
