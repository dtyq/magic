import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IndexedDbFileSavePersistence } from "../persistence"

describe("IndexedDbFileSavePersistence", () => {
	beforeEach(() => {
		vi.stubGlobal("indexedDB", new IDBFactory())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("round-trips a draft by fileId and baseline version", async () => {
		const setItem = vi.spyOn(Storage.prototype, "setItem")
		try {
			const persistence = new IndexedDbFileSavePersistence()
			await persistence.put({
				fileId: "slide-1",
				content: "<main>Draft</main>",
				enableShadow: true,
				baselineVersion: "3",
				updatedAt: 42,
			})
			expect(await persistence.get("slide-1")).toEqual({
				fileId: "slide-1",
				content: "<main>Draft</main>",
				enableShadow: true,
				baselineVersion: "3",
				updatedAt: 42,
			})
			expect(await persistence.getAll()).toHaveLength(1)
			await persistence.remove("slide-1")
			expect(await persistence.get("slide-1")).toBeUndefined()
			expect(setItem).not.toHaveBeenCalled()
			expect(window.localStorage.length).toBe(0)
		} finally {
			setItem.mockRestore()
		}
	})
})
