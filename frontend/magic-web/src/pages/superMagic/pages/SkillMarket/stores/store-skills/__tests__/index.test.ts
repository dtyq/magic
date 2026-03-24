import { beforeEach, describe, expect, it, vi } from "vitest"
import { skillsService } from "@/services/skills/SkillsService"
import { StoreSkillsStore } from ".."

vi.mock("@/services/skills/SkillsService", () => ({
	skillsService: {
		getStoreSkills: vi.fn(),
		getUserSkillIdMapByCodes: vi.fn(),
		addSkillFromStore: vi.fn(),
		deleteSkill: vi.fn(),
		upgradeSkill: vi.fn(),
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

describe("StoreSkillsStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(skillsService.getUserSkillIdMapByCodes).mockResolvedValue(new Map())
	})

	it("clears keyword when search input is emptied", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getStoreSkills).mockResolvedValueOnce({
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
		})

		await store.fetchSkills({ keyword: "   ", page: 1 })

		expect(skillsService.getStoreSkills).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
			publisher_type: undefined,
		})
		expect(store.keyword).toBe("")
	})

	it("keeps the latest search result when a previous request resolves later", async () => {
		const store = new StoreSkillsStore()
		const firstRequest = createDeferred<{
			list: Array<{
				id: string
				storeSkillId: string
				skillCode: string
				name: string
				description: string
				status: "added" | "not-added"
				authorType: "official" | "user"
				needUpgrade: boolean
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

		vi.mocked(skillsService.getStoreSkills)
			.mockReturnValueOnce(firstRequest.promise)
			.mockReturnValueOnce(secondRequest.promise)

		const firstFetch = store.fetchSkills({ keyword: "alpha", page: 1 })
		const secondFetch = store.fetchSkills({ keyword: "", page: 1 })

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
					id: "stale-skill-1",
					storeSkillId: "store-skill-1",
					skillCode: "skill.alpha",
					name: "Alpha Skill",
					description: "stale result",
					status: "not-added",
					authorType: "user",
					needUpgrade: false,
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
