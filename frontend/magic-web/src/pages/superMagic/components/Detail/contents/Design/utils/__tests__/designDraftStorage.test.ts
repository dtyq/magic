import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DesignData } from "../../types"
import {
	buildDesignDraftKey,
	deleteDesignDraft,
	deleteDesignDraftIfMatches,
	readDesignDraft,
	writeDesignDraft,
	type DesignDraftIdentity,
	type DesignDraftReason,
} from "../designDraftStorage"

const identity: Required<DesignDraftIdentity> = {
	projectId: "project-1",
	designProjectId: "design-1",
	magicProjectJsFileId: "magic-file-1",
}

function designData(name: string): DesignData {
	return {
		type: "design",
		name,
		version: "2.0.0",
		canvas: { elements: [] },
	}
}

function draftInput(
	name: string,
	localUpdatedAt: number,
	reason: DesignDraftReason = "local-edit",
) {
	return {
		...identity,
		designProjectBasePath: "folder/design",
		baseRemoteVersion: 1,
		baseRemoteFingerprint: "remote-fp",
		localFingerprint: `local-fp-${name}`,
		localUpdatedAt,
		reason,
		designData: designData(name),
	}
}

describe("designDraftStorage fallback", () => {
	beforeEach(async () => {
		vi.unstubAllGlobals()
		localStorage.clear()
		await deleteDesignDraft(identity)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("falls back to localStorage when IndexedDB is unavailable", async () => {
		vi.stubGlobal("indexedDB", undefined)

		const result = await writeDesignDraft(draftInput("local-storage", 100))
		const restored = await readDesignDraft(identity)

		expect(result).toEqual({ target: "localStorage", durable: true })
		expect(restored?.designData.name).toBe("local-storage")
	})

	it("writes an emergency pagehide draft to localStorage synchronously", async () => {
		vi.stubGlobal("indexedDB", undefined)

		const writePromise = writeDesignDraft(draftInput("pagehide", 200, "pagehide"), {
			emergency: true,
		})
		const stored = localStorage.getItem(
			`MAGIC:supermagic-design:draft:${buildDesignDraftKey(identity)}`,
		)

		expect(stored).toContain('"name":"pagehide"')
		expect(await writePromise).toEqual({ target: "localStorage", durable: true })
	})

	it("does not retain an emergency heap copy after localStorage succeeds", async () => {
		vi.stubGlobal("indexedDB", undefined)

		await writeDesignDraft(draftInput("pagehide-durable", 225, "pagehide"), {
			emergency: true,
		})
		localStorage.removeItem(`MAGIC:supermagic-design:draft:${buildDesignDraftKey(identity)}`)

		expect(await readDesignDraft(identity)).toBeNull()
	})

	it("keeps the in-memory emergency fallback when durable storage is unavailable", async () => {
		vi.stubGlobal("indexedDB", undefined)
		const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("quota exceeded")
		})

		const result = await writeDesignDraft(draftInput("pagehide-memory", 230, "pagehide"), {
			emergency: true,
		})
		setItemSpy.mockRestore()

		expect(result).toEqual({ target: "memory", durable: false })
		expect((await readDesignDraft(identity))?.designData.name).toBe("pagehide-memory")
	})

	it("strips base remote data when emergency localStorage draft is too large", async () => {
		vi.stubGlobal("indexedDB", undefined)
		const originalSetItem = Storage.prototype.setItem
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItemFallback(
			this: Storage,
			key,
			value,
		) {
			if (value.includes("baseRemoteData")) {
				throw new Error("quota exceeded")
			}
			return originalSetItem.call(this, key, value)
		})

		const result = await writeDesignDraft(
			{
				...draftInput("pagehide-light", 250, "pagehide"),
				baseRemoteData: designData("base-remote"),
			},
			{ emergency: true },
		)
		const stored = localStorage.getItem(
			`MAGIC:supermagic-design:draft:${buildDesignDraftKey(identity)}`,
		)

		expect(result).toEqual({ target: "localStorage", durable: true })
		expect(stored).toContain('"name":"pagehide-light"')
		expect(stored).not.toContain("baseRemoteData")
	})

	it("restores the newest draft across storage layers", async () => {
		await writeDesignDraft(draftInput("indexeddb-old", 100))
		vi.stubGlobal("indexedDB", undefined)
		await writeDesignDraft(draftInput("local-storage-new", 300))
		vi.unstubAllGlobals()

		const restored = await readDesignDraft(identity)

		expect(restored?.designData.name).toBe("local-storage-new")
	})

	it("does not throw when the draft cannot be serialized", async () => {
		const circularDesignData = designData("circular") as DesignData & {
			self?: unknown
		}
		circularDesignData.self = circularDesignData

		const result = await writeDesignDraft({
			...draftInput("circular", 400),
			designData: circularDesignData,
		})

		expect(result).toEqual({ target: "none", durable: false })
	})

	it("keeps a newer draft when an older save response is acknowledged", async () => {
		await writeDesignDraft(draftInput("saved", 500))
		await writeDesignDraft(draftInput("newer", 600))

		await deleteDesignDraftIfMatches(identity, "local-fp-saved")

		expect((await readDesignDraft(identity))?.designData.name).toBe("newer")
	})

	it("clears the acknowledged draft when no newer revision exists", async () => {
		await writeDesignDraft(draftInput("saved", 500))

		await deleteDesignDraftIfMatches(identity, "local-fp-saved")

		expect(await readDesignDraft(identity)).toBeNull()
	})
})
