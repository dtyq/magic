import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { createFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { AICardStore } from "../AICardStore"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

const mockFetch = vi.fn()

function createAttachmentTree(overrides?: {
	latestUpdatedAt?: string
	configUpdatedAt?: string
	assetUpdatedAt?: string
	withHistory?: boolean
}) {
	return [
		{
			file_id: "folder",
			file_name: "Daily Card",
			is_directory: true,
			children: [
				{
					file_id: "config",
					file_name: "magic.project.js",
					is_directory: false,
					updated_at: overrides?.configUpdatedAt ?? "2026-06-20T01:00:00Z",
				},
				{
					file_id: "latest",
					file_name: "latest",
					is_directory: true,
					children: [
						{
							file_id: "latest-html",
							file_name: "index.html",
							is_directory: false,
							updated_at: overrides?.latestUpdatedAt ?? "2026-06-20T02:00:00Z",
						},
						{
							file_id: "asset",
							file_name: "chart.png",
							is_directory: false,
							updated_at: overrides?.assetUpdatedAt ?? "2026-06-20T03:00:00Z",
						},
					],
				},
				...(overrides?.withHistory
					? [
							{
								file_id: "history",
								file_name: "history",
								is_directory: true,
								children: [
									{
										file_id: "history-old-folder",
										file_name: "2026-06-18_09-00",
										is_directory: true,
										children: [
											{
												file_id: "history-old-html",
												file_name: "index.html",
												is_directory: false,
											},
										],
									},
									{
										file_id: "history-new-folder",
										file_name: "2026-06-19_09-00",
										is_directory: true,
										children: [
											{
												file_id: "history-new-html",
												file_name: "index.html",
												is_directory: false,
											},
										],
									},
								],
							},
						]
					: []),
			],
		},
	]
}

describe("AICardStore", () => {
	beforeEach(() => {
		vi.mocked(getTemporaryDownloadUrl).mockReset()
		mockFetch.mockReset()
		vi.stubGlobal("fetch", mockFetch)

		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ url: "https://example.com/config.js" },
		])
		mockFetch.mockResolvedValue({
			ok: true,
			text: async () => `
				window.magicProjectConfig = {
					type: "ai-card",
					name: "Daily Card",
					description: "Daily metrics",
					cards: []
				}
			`,
		})
	})

	it("ignores unrelated attachment updates when syncing an existing AI card folder", async () => {
		const store = new AICardStore()

		await store.sync("folder", createAttachmentTree())
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		await store.sync("folder", createAttachmentTree({ assetUpdatedAt: "2026-06-20T04:00:00Z" }))

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(store.cards[0]?.latestHtmlFileId).toBe("latest-html")
	})

	it("fetches magic.project.js through the injected access-bound fileApi", async () => {
		const shareAccess = createShareFileAccess({
			token: "share-token",
			projectId: "share-project",
		})
		const store = new AICardStore(createFileApi(shareAccess))

		await store.sync("folder", createAttachmentTree())

		// The share identity must reach the leaf; without it the read fails closed.
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["config"],
			access: shareAccess,
		})
		expect(store.projectConfig?.name).toBe("Daily Card")
	})

	it("parses magic.project.js with multiline template literal fields", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			text: async () => `
				window.magicProjectConfig = {
					type: "ai-card",
					name: "Daily Card",
					prompt: \`line one
line two\`,
					schedule_id: "schedule-1",
					cards: [{ file: "latest/index.html", label: "Latest" }],
				}
			`,
		})

		const store = new AICardStore()

		await store.sync("folder", createAttachmentTree())

		expect(store.projectConfig?.schedule_id).toBe("schedule-1")
		expect(store.projectConfig?.prompt).toBe("line one\nline two")
		expect(store.hasConfig).toBe(true)
	})

	it("switches detail versions from latest to older history and back", async () => {
		const store = new AICardStore()

		await store.sync("folder", createAttachmentTree({ withHistory: true }))
		store.openCardDetail("folder")

		expect(store.detailFileId).toBe("latest-html")
		expect(store.canOpenPreviousDetailVersion).toBe(false)
		expect(store.canOpenNextDetailVersion).toBe(true)

		store.openNextDetailVersion()
		expect(store.detailFileId).toBe("history-new-html")
		expect(store.canOpenPreviousDetailVersion).toBe(true)
		expect(store.canOpenNextDetailVersion).toBe(true)

		store.openNextDetailVersion()
		expect(store.detailFileId).toBe("history-old-html")
		expect(store.canOpenNextDetailVersion).toBe(false)

		store.openPreviousDetailVersion()
		expect(store.detailFileId).toBe("history-new-html")
	})
})
