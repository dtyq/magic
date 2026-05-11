import { describe, expect, it, beforeEach } from "vitest"
import {
	registerWaitForNextAttachmentsRefreshForProject,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	waitForNextAttachmentsRefreshForProject,
	withAttachmentsRefreshWaitersResolved,
} from "../attachmentsTopicSync"

describe("attachmentsTopicSync", () => {
	beforeEach(() => {
		releaseAttachmentsRefreshWaitersWithoutFetch()
	})

	it("resolveAttachmentsRefreshWaitersForProject resolves matching waiters", async () => {
		const p = waitForNextAttachmentsRefreshForProject("proj-a", { timeoutMs: 5000 })
		resolveAttachmentsRefreshWaitersForProject("proj-a")
		await expect(p).resolves.toBeUndefined()
	})

	it("registerWaitForNextAttachmentsRefreshForProject resolves when project fetch completes", async () => {
		const p = registerWaitForNextAttachmentsRefreshForProject("proj-b", { timeoutMs: 5000 })
		resolveAttachmentsRefreshWaitersForProject("proj-b")
		await expect(p).resolves.toBeUndefined()
	})

	it("releaseAttachmentsRefreshWaitersWithoutFetch resolves all pending", async () => {
		const p1 = waitForNextAttachmentsRefreshForProject("p1", { timeoutMs: 5000 })
		const p2 = waitForNextAttachmentsRefreshForProject("p2", { timeoutMs: 5000 })
		releaseAttachmentsRefreshWaitersWithoutFetch()
		await expect(Promise.all([p1, p2])).resolves.toEqual([undefined, undefined])
	})

	it("waitForNextAttachmentsRefreshForProject with no projectId resolves immediately", async () => {
		await expect(waitForNextAttachmentsRefreshForProject(undefined)).resolves.toBeUndefined()
	})

	it("times out when never resolved", async () => {
		const p = waitForNextAttachmentsRefreshForProject("orphan", { timeoutMs: 20 })
		await expect(p).rejects.toThrow(/timeout/)
	})

	it("withAttachmentsRefreshWaitersResolved resolves after full chain settles", async () => {
		let didThen = false
		const waiter = waitForNextAttachmentsRefreshForProject("chain-a", { timeoutMs: 5000 })
		await withAttachmentsRefreshWaitersResolved(
			"chain-a",
			Promise.resolve(1).then(() => {
				didThen = true
			}),
		)
		expect(didThen).toBe(true)
		await expect(waiter).resolves.toBeUndefined()
	})

	it("withAttachmentsRefreshWaitersResolved resolves waiters when inner chain rejects", async () => {
		const waiter = waitForNextAttachmentsRefreshForProject("chain-b", { timeoutMs: 5000 })
		await expect(
			withAttachmentsRefreshWaitersResolved(
				"chain-b",
				Promise.reject(new Error("fail")).catch(() => undefined),
			),
		).resolves.toBeUndefined()
		await expect(waiter).resolves.toBeUndefined()
	})
})
