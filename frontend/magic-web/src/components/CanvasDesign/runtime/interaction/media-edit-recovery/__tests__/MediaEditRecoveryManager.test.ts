import { describe, expect, it } from "vitest"
import {
	areMediaEditSnapshotsEqual,
	MediaEditRecoveryManager,
	type MediaEditRecoveryKey,
} from "../MediaEditRecoveryManager"

const baseKey: MediaEditRecoveryKey = {
	elementId: "element-1",
	contentId: "content-1",
	intent: "quick-edit",
}

describe("MediaEditRecoveryManager", () => {
	it("isolates element, content version, and editing intent", () => {
		const manager = new MediaEditRecoveryManager()
		manager.set(baseKey, "source-1", { value: "quick" }, { value: "draft" })
		manager.set({ ...baseKey, intent: "re-edit" }, "source-1", { value: "re-edit" })
		manager.set({ ...baseKey, contentId: "content-2" }, "source-2", { value: "other" })

		expect(manager.get(baseKey, "source-1")?.draft).toEqual({ value: "draft" })
		expect(manager.get({ ...baseKey, intent: "re-edit" }, "source-1")?.baseline).toEqual({
			value: "re-edit",
		})
		expect(manager.get({ ...baseKey, contentId: "content-2" }, "source-2")?.baseline).toEqual({
			value: "other",
		})
		expect(manager.get({ ...baseKey, contentId: "content-2" }, "source-1")).toBeNull()
	})

	it("updates drafts, resets to baseline, and compares snapshots", () => {
		const manager = new MediaEditRecoveryManager()
		manager.set(baseKey, "source-1", { prompt: "initial" })

		manager.updateDraft(baseKey, "source-1", { prompt: "changed" })
		expect(manager.get(baseKey, "source-1")?.draft).toEqual({ prompt: "changed" })
		expect(
			areMediaEditSnapshotsEqual(
				manager.get(baseKey, "source-1")?.baseline,
				manager.get(baseKey, "source-1")?.draft,
			),
		).toBe(false)

		expect(manager.reset(baseKey, "source-1")).toEqual({ prompt: "initial" })
		expect(manager.get(baseKey, "source-1")?.draft).toEqual({ prompt: "initial" })
	})

	it("invalidates stale sources and supports generation draft fallback", () => {
		const manager = new MediaEditRecoveryManager()
		manager.set(baseKey, "source-1", { value: 1 })
		expect(manager.get(baseKey, "source-2")).toBeNull()
		expect(manager.get(baseKey, "source-1")).toBeNull()

		const generateKey = { ...baseKey, intent: "generate" as const }
		manager.saveDraft(generateKey, "source-3", { prompt: "retry" })
		expect(manager.get(generateKey, "source-3")).toMatchObject({
			baseline: { prompt: "retry" },
			draft: { prompt: "retry" },
		})
	})

	it("clears by intent, element, and Canvas lifecycle", () => {
		const manager = new MediaEditRecoveryManager()
		const reEditKey = { ...baseKey, intent: "re-edit" as const }
		const otherElementKey = { ...baseKey, elementId: "element-2" }
		manager.set(baseKey, "source-1", { value: 1 })
		manager.set(reEditKey, "source-1", { value: 2 })
		manager.set(otherElementKey, "source-2", { value: 3 })

		manager.clear(baseKey)
		expect(manager.get(baseKey, "source-1")).toBeNull()
		expect(manager.get(reEditKey, "source-1")).not.toBeNull()

		manager.clearContent("element-1", "content-1")
		expect(manager.get(reEditKey, "source-1")).toBeNull()
		manager.set(reEditKey, "source-1", { value: 2 })

		manager.clearElement("element-1")
		expect(manager.get(reEditKey, "source-1")).toBeNull()
		expect(manager.get(otherElementKey, "source-2")).not.toBeNull()

		manager.clearAll()
		expect(manager.get(otherElementKey, "source-2")).toBeNull()
	})
})
