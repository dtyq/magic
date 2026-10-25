import { beforeEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "../../../../types"
import { MentionPanelMicroAppsStore, createMicroAppMentionItem } from "../micro-apps"

const mocks = vi.hoisted(() => ({
	getMentionMicroApps: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMentionMicroApps: mocks.getMentionMicroApps,
	},
}))

describe("MentionPanelMicroAppsStore", () => {
	beforeEach(() => {
		mocks.getMentionMicroApps.mockReset()
	})

	it("creates a selectable mention item for the current app", () => {
		expect(createMicroAppMentionItem({ appId: "app-1", appName: "Todo App" })).toEqual({
			id: "app-1",
			type: MentionItemType.MICRO_APP,
			name: "Todo App",
			icon: "",
			hasChildren: false,
			isFolder: false,
			data: { app_id: "app-1", app_name: "Todo App" },
		})
	})

	it("loads accessible mention apps from the dedicated endpoint", async () => {
		mocks.getMentionMicroApps.mockResolvedValue({
			list: [
				{
					app_id: "owned-1",
					app_name: "Owned App",
					cover_url: "https://cdn.example.com/owned.png",
					publish_status: "published",
				},
				{
					app_id: "draft-1",
					app_name: "Draft App",
					cover_url: "",
					publish_status: "unpublished",
				},
				{
					app_id: "shared-1",
					app_name: "Org Shared App",
					cover_url: "",
					publish_status: "published",
				},
			],
		})

		const store = new MentionPanelMicroAppsStore()
		const items = await store.getItems()

		expect(mocks.getMentionMicroApps).toHaveBeenCalledTimes(1)
		expect(mocks.getMentionMicroApps).toHaveBeenCalledWith({
			page: 1,
			page_size: 100,
		})
		expect(items).toEqual([
			{
				id: "owned-1",
				type: MentionItemType.MICRO_APP,
				name: "Owned App",
				icon: "https://cdn.example.com/owned.png",
				hasChildren: false,
				isFolder: false,
				data: { app_id: "owned-1", app_name: "Owned App" },
			},
			{
				id: "draft-1",
				type: MentionItemType.MICRO_APP,
				name: "Draft App",
				icon: "",
				hasChildren: false,
				isFolder: false,
				data: { app_id: "draft-1", app_name: "Draft App" },
			},
			{
				id: "shared-1",
				type: MentionItemType.MICRO_APP,
				name: "Org Shared App",
				icon: "",
				hasChildren: false,
				isFolder: false,
				data: { app_id: "shared-1", app_name: "Org Shared App" },
			},
		])
	})

	it("retries catalog load after a failed request", async () => {
		mocks.getMentionMicroApps.mockRejectedValueOnce(new Error("unavailable"))

		const store = new MentionPanelMicroAppsStore()
		await expect(store.getItems()).resolves.toEqual([])

		mocks.getMentionMicroApps.mockResolvedValue({
			list: [
				{
					app_id: "owned-1",
					app_name: "Owned App",
					cover_url: "",
					publish_status: "published",
				},
			],
		})

		await expect(store.getItems()).resolves.toEqual([
			expect.objectContaining({ id: "owned-1", name: "Owned App" }),
		])
		expect(mocks.getMentionMicroApps).toHaveBeenCalledTimes(2)
	})

	it("refetches mention apps when the catalog is opened again", async () => {
		mocks.getMentionMicroApps
			.mockResolvedValueOnce({
				list: [
					{
						app_id: "owned-1",
						app_name: "Owned App",
						cover_url: "",
						publish_status: "published",
					},
				],
			})
			.mockResolvedValueOnce({
				list: [
					{
						app_id: "owned-2",
						app_name: "New App",
						cover_url: "",
						publish_status: "published",
					},
				],
			})

		const store = new MentionPanelMicroAppsStore()
		await expect(store.getItems()).resolves.toEqual([
			expect.objectContaining({ id: "owned-1", name: "Owned App" }),
		])
		await expect(store.getItems()).resolves.toEqual([
			expect.objectContaining({ id: "owned-2", name: "New App" }),
		])
		expect(mocks.getMentionMicroApps).toHaveBeenCalledTimes(2)
	})

	it("keeps the last catalog when a later request fails", async () => {
		mocks.getMentionMicroApps
			.mockResolvedValueOnce({
				list: [
					{
						app_id: "owned-1",
						app_name: "Owned App",
						cover_url: "",
						publish_status: "published",
					},
				],
			})
			.mockRejectedValueOnce(new Error("unavailable"))

		const store = new MentionPanelMicroAppsStore()
		await store.getItems()

		await expect(store.getItems()).resolves.toEqual([
			expect.objectContaining({ id: "owned-1", name: "Owned App" }),
		])
		expect(mocks.getMentionMicroApps).toHaveBeenCalledTimes(2)
	})

	it("searches mention apps with a server keyword", async () => {
		mocks.getMentionMicroApps.mockResolvedValue({
			list: [
				{
					app_id: "shared-1",
					app_name: "Org Shared App",
					cover_url: "",
					publish_status: "published",
				},
			],
		})

		const store = new MentionPanelMicroAppsStore()
		const items = await store.searchItems("org", (target, query) =>
			target.toLowerCase().includes(query.toLowerCase()),
		)

		expect(mocks.getMentionMicroApps).toHaveBeenCalledWith({
			page: 1,
			page_size: 100,
			keyword: "org",
		})
		expect(items).toEqual([expect.objectContaining({ id: "shared-1", name: "Org Shared App" })])
	})

	it("falls back to the catalog cache when search fails", async () => {
		mocks.getMentionMicroApps
			.mockResolvedValueOnce({
				list: [
					{
						app_id: "owned-1",
						app_name: "Owned App",
						cover_url: "",
						publish_status: "published",
					},
				],
			})
			.mockRejectedValueOnce(new Error("unavailable"))

		const store = new MentionPanelMicroAppsStore()
		await store.getItems()

		await expect(
			store.searchItems("owned", (target, query) =>
				target.toLowerCase().includes(query.toLowerCase()),
			),
		).resolves.toEqual([expect.objectContaining({ id: "owned-1", name: "Owned App" })])
	})
	it.each([false, true])("loads and deduplicates all pages (search=%s)", async (search) => {
		const app = (id: number) => ({
			app_id: String(id),
			app_name: `App ${id}`,
			publish_status: "published",
		})
		mocks.getMentionMicroApps
			.mockResolvedValueOnce({
				list: Array.from({ length: 100 }, (_, i) => app(i)),
				total: 202,
				page_size: 100,
			})
			.mockResolvedValueOnce({
				list: Array.from({ length: 100 }, (_, i) => app(i + 99)),
				total: 202,
				page_size: 100,
			})
			.mockResolvedValueOnce({ list: [app(199), app(200)], total: 202, page_size: 100 })
		const store = new MentionPanelMicroAppsStore()
		const items = search
			? await store.searchItems("App", (name, query) => name.includes(query))
			: await store.getItems()
		expect(items).toHaveLength(201)
		expect(items.at(-1)?.id).toBe("200")
		expect(mocks.getMentionMicroApps.mock.calls.map(([params]) => params)).toEqual(
			[1, 2, 3].map((page) => ({
				page,
				page_size: 100,
				...(search ? { keyword: "App" } : {}),
			})),
		)
	})

	it("uses server page size and stops on an empty page", async () => {
		mocks.getMentionMicroApps
			.mockResolvedValueOnce({
				list: [{ app_id: "1", app_name: "App", publish_status: "published" }],
				total: 5,
				page_size: 1,
			})
			.mockResolvedValueOnce({ list: [], total: 5, page_size: 1 })
		const items = await new MentionPanelMicroAppsStore().getItems()
		expect(items).toHaveLength(1)
		expect(mocks.getMentionMicroApps).toHaveBeenCalledTimes(2)
	})
})
