import { describe, it, expect, vi, beforeEach } from "vitest"
import { DraftManager } from "../draftService"

// Mock user store for utils
vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				organization_code: "test-org",
				user_id: "test-user",
			},
		},
	},
}))

// Mock logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

interface MemoryDraftData {
	workspaceId: string
	projectId: string
	topicId: string
	value?: unknown
	mentionItems: unknown[]
	createdAt: number
	updatedAt: number
}

function createMemoryStorage() {
	const store = new Map<string, MemoryDraftData>()
	const versionMap = new Map<string, number>() // Track versions for tombstone behavior
	const calls = {
		saveDraftVersion: vi.fn(),
		loadDraft: vi.fn(),
		deleteDraft: vi.fn(),
		deleteDraftVersions: vi.fn(),
		clearAllDrafts: vi.fn(),
		close: vi.fn(),
		loadLatestDraftVersion: vi.fn(),
		loadDraftVersions: vi.fn(),
		loadDraftByVersion: vi.fn(),
		deleteDraftVersion: vi.fn(),
		cleanupExpiredVersions: vi.fn(),
	}

	function key(workspaceId: string, projectId: string, topicId: string) {
		return `${workspaceId || "global"}:${projectId}:${topicId || "default"}`
	}

	const storage = {
		async saveDraftVersion(
			k: { workspaceId: string; projectId: string; topicId: string },
			data: Omit<MemoryDraftData, "createdAt" | "updatedAt">,
		): Promise<void> {
			calls.saveDraftVersion(k, data)
			const compositeKey = key(k.workspaceId, k.projectId, k.topicId)

			// Check if there's a newer version (clear operation happened)
			const currentVersion = versionMap.get(compositeKey) || 0
			if (currentVersion > 0) {
				// If clear was called, don't save (version was incremented)
				return
			}

			const now = Date.now()
			const existing = store.get(compositeKey)
			store.set(compositeKey, {
				...data,
				workspaceId: k.workspaceId,
				projectId: k.projectId,
				topicId: k.topicId,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			})
		},
		async loadDraft(k: { workspaceId: string; projectId: string; topicId: string }) {
			calls.loadDraft(k)
			return store.get(key(k.workspaceId, k.projectId, k.topicId)) || null
		},
		async deleteDraft(k: { workspaceId: string; projectId: string; topicId: string }) {
			calls.deleteDraft(k)
			store.delete(key(k.workspaceId, k.projectId, k.topicId))
		},
		async deleteDraftVersions(k: { workspaceId: string; projectId: string; topicId: string }) {
			calls.deleteDraftVersions(k)
			const compositeKey = key(k.workspaceId, k.projectId, k.topicId)

			// Increment version to prevent old saves from resurrecting
			const currentVersion = versionMap.get(compositeKey) || 0
			versionMap.set(compositeKey, currentVersion + 1)

			// Delete the actual data
			store.delete(compositeKey)
		},
		async saveDraft(
			k: { workspaceId: string; projectId: string; topicId: string },
			data: Omit<MemoryDraftData, "createdAt" | "updatedAt">,
		): Promise<void> {
			calls.saveDraftVersion(k, data) // Reuse the same tracking
			const compositeKey = key(k.workspaceId, k.projectId, k.topicId)

			// Check if there's a newer version (clear operation happened)
			const currentVersion = versionMap.get(compositeKey) || 0
			if (currentVersion > 0) {
				// If clear was called, don't save (version was incremented)
				return
			}

			const now = Date.now()
			const existing = store.get(compositeKey)
			store.set(compositeKey, {
				...data,
				workspaceId: k.workspaceId,
				projectId: k.projectId,
				topicId: k.topicId,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			})
		},
		async clearAllDrafts() {
			calls.clearAllDrafts()
			store.clear()
		},
		close() {
			calls.close()
		},
		loadLatestDraftVersion: calls.loadLatestDraftVersion,
		loadDraftVersions: calls.loadDraftVersions,
		loadDraftByVersion: calls.loadDraftByVersion,
		deleteDraftVersion: calls.deleteDraftVersion,
		cleanupExpiredVersions: calls.cleanupExpiredVersions,
		__store: store,
		__calls: calls,
	}

	return storage
}

describe("DraftManager", () => {
	let storage: ReturnType<typeof createMemoryStorage>
	let manager: DraftManager

	beforeEach(() => {
		storage = createMemoryStorage()
		manager = new DraftManager(storage as any)
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it("coalesces multiple rapid saves and persists the latest content", async () => {
		const workspaceId = "w1"
		const projectId = "p1"
		const topicId = "t1"

		// Simulate slow underlying storage to allow pending to accumulate
		const originalSave = storage.saveDraftVersion
		storage.saveDraftVersion = vi.fn(async (k, data) => {
			// small delay
			await new Promise((r) => setTimeout(r, 5))
			return originalSave(k, data as any)
		}) as any

		await Promise.all([
			manager.saveDraft({
				workspaceId,
				projectId,
				topicId,
				value: { content: [{ type: "paragraph", content: [{ text: "A" }] }] } as any,
				mentionItems: [],
			}),
			manager.saveDraft({
				workspaceId,
				projectId,
				topicId,
				value: { content: [{ type: "paragraph", content: [{ text: "B" }] }] } as any,
				mentionItems: [],
			}),
		])

		const saved = await storage.loadDraft({ workspaceId, projectId, topicId })
		expect(saved?.value).toBeDefined()
		const text = JSON.stringify(saved?.value)
		expect(text).toContain("B")
		// Ensure at least one save happened and last call used latest value
		expect(storage.__calls.saveDraftVersion).toHaveBeenCalled()
		const lastCallArgs = storage.__calls.saveDraftVersion.mock.calls.at(-1)
		expect(JSON.stringify(lastCallArgs?.[1]?.value)).toContain("B")
	})

	it("does not resurrect draft after clearDraft (tombstone versioning)", async () => {
		const workspaceId = "w2"
		const projectId = "p2"
		const topicId = "t2"

		const originalSave = storage.saveDraftVersion
		let resolveSave: (() => void) | null = null
		storage.saveDraftVersion = vi.fn(async (k, data) => {
			// Hold save until after clearDraft
			await new Promise<void>((r) => {
				resolveSave = r
			})
			return originalSave(k, data as any)
		}) as any

		const savePromise = manager.saveDraft({
			workspaceId,
			projectId,
			topicId,
			value: { content: [{ type: "paragraph", content: [{ text: "X" }] }] } as any,
			mentionItems: [],
		})
		// Clear while save is in-flight
		await manager.clearVersions({ workspaceId, projectId, topicId })
		// Release save
		if (resolveSave) resolveSave()
		await savePromise

		// Final state should be cleared
		const saved = await storage.loadDraft({ workspaceId, projectId, topicId })
		expect(saved).toBeNull()
	})

	it("saves even meaningless data (behavior changed)", async () => {
		const workspaceId = "w3"
		const projectId = "p3"
		const topicId = "t3"

		await manager.saveDraft({
			workspaceId,
			projectId,
			topicId,
			value: undefined,
			mentionItems: [],
		})

		// The implementation now saves all drafts, including meaningless data
		expect(storage.__calls.saveDraftVersion).toHaveBeenCalled()
		expect(storage.__calls.saveDraftVersion).toHaveBeenCalledWith(
			{
				workspaceId,
				projectId,
				topicId,
			},
			expect.objectContaining({
				value: undefined,
				mentionItems: [],
				workspaceId: "w3",
				projectId: "p3",
				topicId: "t3",
			}),
		)
	})

	it("coalesces many rapid saves and persists only the last one", async () => {
		const workspaceId = "w5"
		const projectId = "p5"
		const topicId = "t5"

		// Slow down storage to allow queue to build up
		const originalSave = storage.saveDraftVersion
		storage.saveDraftVersion = vi.fn(async (k, data) => {
			await new Promise((r) => setTimeout(r, 3))
			return originalSave(k, data as any)
		}) as any

		const manager = new DraftManager(storage as any)

		const values = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
		await Promise.all(
			values.map((txt) =>
				manager.saveDraft({
					workspaceId,
					projectId,
					topicId,
					value: { content: [{ type: "paragraph", content: [{ text: txt }] }] } as any,
					mentionItems: [],
				}),
			),
		)

		const saved = await storage.loadDraft({ workspaceId, projectId, topicId })
		expect(JSON.stringify(saved?.value)).toContain("J")
	})

	it("isolates saves across different keys", async () => {
		const manager = new DraftManager(storage as any)

		await Promise.all([
			manager.saveDraft({
				workspaceId: "wA",
				projectId: "pA",
				topicId: "tA",
				value: { content: [{ type: "paragraph", content: [{ text: "A1" }] }] } as any,
				mentionItems: [],
			}),
			manager.saveDraft({
				workspaceId: "wB",
				projectId: "pB",
				topicId: "tB",
				value: { content: [{ type: "paragraph", content: [{ text: "B1" }] }] } as any,
				mentionItems: [],
			}),
		])

		const savedA = await storage.loadDraft({
			workspaceId: "wA",
			projectId: "pA",
			topicId: "tA",
		})
		const savedB = await storage.loadDraft({
			workspaceId: "wB",
			projectId: "pB",
			topicId: "tB",
		})
		expect(JSON.stringify(savedA?.value)).toContain("A1")
		expect(JSON.stringify(savedB?.value)).toContain("B1")
	})

	it("saves when mentions exist even if content is empty", async () => {
		const manager = new DraftManager(storage as any)
		await manager.saveDraft({
			workspaceId: "w8",
			projectId: "p8",
			topicId: "t8",
			value: { type: "doc", content: [{ type: "paragraph" }] } as any,
			mentionItems: [{ type: "mention", attrs: { type: "text", data: {} } } as any],
		})
		const saved = await storage.loadDraft({ workspaceId: "w8", projectId: "p8", topicId: "t8" })
		expect(saved).not.toBeNull()
	})
})
