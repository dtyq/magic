import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureFileSavesSynced } from "../ensureFileSavesSynced"
import { FileSaveQueue, resetFileSaveQueueForTests } from "../FileSaveQueue"
import { createMemoryFileSavePersistence } from "../persistence"
import { FileSavePermanentError } from "../types"

const mocks = vi.hoisted(() => ({ warning: vi.fn() }))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { warning: mocks.warning },
}))

vi.mock("i18next", () => ({
	default: { t: (key: string) => key },
}))

describe("ensureFileSavesSynced", () => {
	let queue: FileSaveQueue

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {})
		mocks.warning.mockReset()
		queue = new FileSaveQueue({ persistence: createMemoryFileSavePersistence() })
		resetFileSaveQueueForTests(queue)
	})

	afterEach(() => {
		resetFileSaveQueueForTests()
		vi.restoreAllMocks()
	})

	it("passes silently when nothing is pending", async () => {
		await expect(ensureFileSavesSynced(["file-1"])).resolves.toBe(true)
		expect(mocks.warning).not.toHaveBeenCalled()
	})

	it("explains the block and reveals the failure recovery actions", async () => {
		queue.enqueue({
			fileId: "file-1",
			content: "<p>Draft</p>",
			enableShadow: false,
			persist: vi.fn().mockRejectedValue(new FileSavePermanentError("denied")),
		})
		await queue.flush("file-1")

		await expect(ensureFileSavesSynced(["file-1"])).resolves.toBe(false)

		expect(mocks.warning).toHaveBeenCalledWith(
			expect.objectContaining({ content: "detail.fileSave.blocked" }),
		)
		expect(queue.getFailureRevealToken("file-1")).toBe(1)
	})
})
