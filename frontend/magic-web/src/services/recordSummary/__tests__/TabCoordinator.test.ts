/**
 * TabCoordinator unit tests
 *
 * Focus areas:
 * 1. Priority-based lock preemption (core bug fix)
 * 2. Promise always settles — no infinite hangs
 * 3. Lock timeout watchdog (B4 fix)
 * 4. Cleanup cancels pending requests
 * 5. LockAcquireIntent getter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import MagicModal from "@/components/base/MagicModal"
import { TabCoordinator, LOCK_PRIORITY_BACKGROUND, LOCK_PRIORITY_USER } from "../TabCoordinator"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: vi.fn(() => ({ destroy: vi.fn() })) },
}))

vi.mock("@/components/business/RecordingSummary/components/RecordSummaryAlertCard", () => ({
	RecordSummaryActionButton: vi.fn(),
}))

vi.mock("@/models/user", () => ({
	userStore: { user: { organizationCode: "test-org" } },
}))

vi.mock("i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("i18next")>()
	return {
		...actual,
		t: (key: string) => key,
		default: { ...actual.default, t: (key: string) => key },
	}
})

vi.mock("../recordingRestoreRouteGuard", () => ({
	shouldSkipRecordingSessionRestoreOnCurrentRoute: vi.fn(() => false),
}))

// Stub BroadcastChannel so tests don't depend on the browser API
class MockBroadcastChannel {
	name: string
	private static channels = new Map<string, Set<MockBroadcastChannel>>()

	onmessage: ((e: MessageEvent) => void) | null = null
	private listeners = new Set<(e: MessageEvent) => void>()

	constructor(name: string) {
		this.name = name
		if (!MockBroadcastChannel.channels.has(name)) {
			MockBroadcastChannel.channels.set(name, new Set())
		}
		MockBroadcastChannel.channels.get(name)!.add(this)
	}

	postMessage(data: unknown) {
		const peers = MockBroadcastChannel.channels.get(this.name)
		peers?.forEach((ch) => {
			if (ch !== this) {
				const event = { data } as MessageEvent
				ch.listeners.forEach((l) => l(event))
			}
		})
	}

	addEventListener(_type: string, listener: (e: MessageEvent) => void) {
		this.listeners.add(listener)
	}

	removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
		this.listeners.delete(listener)
	}

	close() {
		MockBroadcastChannel.channels.get(this.name)?.delete(this)
		this.listeners.clear()
	}

	static reset() {
		this.channels.clear()
	}
}

// @ts-expect-error override global
globalThis.BroadcastChannel = MockBroadcastChannel

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCoordinator(callbacks = {}) {
	return new TabCoordinator(callbacks)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TabCoordinator — priority lock preemption", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		MockBroadcastChannel.reset()
	})

	afterEach(() => {
		vi.useRealTimers()
		MockBroadcastChannel.reset()
	})

	it("resolves true immediately when already active", async () => {
		const coordinator = makeCoordinator()
		// Force the coordinator to active state
		coordinator.acquireLock()

		const result = await coordinator.requestLock()
		expect(result).toBe(true)

		coordinator.cleanup()
	})

	it("background request is preempted by user request (core bug fix)", async () => {
		const coordinator = makeCoordinator()

		// Start a background-priority request — it will hang for 2 s waiting for a response
		const bgPromise = coordinator.requestLock(undefined, LOCK_PRIORITY_BACKGROUND)

		// Before the 2 s timeout fires, a user-priority request comes in
		const userPromise = coordinator.requestLock(undefined, LOCK_PRIORITY_USER)

		// Advance past the 2 s lock-request timeout so the user request acquires the lock
		await vi.advanceTimersByTimeAsync(2100)

		const [bgResult, userResult] = await Promise.all([bgPromise, userPromise])

		// The background request is cancelled (resolves false)
		expect(bgResult).toBe(false)
		// The user request wins the lock
		expect(userResult).toBe(true)
		expect(coordinator.hasRecordingPermission()).toBe(true)

		coordinator.cleanup()
	})

	it("equal-or-lower priority request yields to existing pending request", async () => {
		const coordinator = makeCoordinator()

		// First background request is pending
		const first = coordinator.requestLock(undefined, LOCK_PRIORITY_BACKGROUND)

		// Second background request should yield immediately
		const second = coordinator.requestLock(undefined, LOCK_PRIORITY_BACKGROUND)

		expect(await second).toBe(false)

		// Let the first one complete
		await vi.advanceTimersByTimeAsync(2100)
		expect(await first).toBe(true)

		coordinator.cleanup()
	})

	it("promise always settles — no hanging — when no other tab responds", async () => {
		const coordinator = makeCoordinator()

		// Single coordinator in an empty channel: no other tab will respond.
		// After 2 s it should self-acquire and resolve true (not hang).
		const promise = coordinator.requestLock(undefined, LOCK_PRIORITY_USER)
		await vi.advanceTimersByTimeAsync(2100)

		const result = await promise
		// Resolves one way or the other, never hangs indefinitely
		expect(typeof result).toBe("boolean")

		coordinator.cleanup()
	})

	it("cleanup cancels a pending lock request", async () => {
		const coordinator = makeCoordinator()

		const promise = coordinator.requestLock(undefined, LOCK_PRIORITY_USER)

		// Clean up before timeout fires
		coordinator.cleanup()

		const result = await promise
		expect(result).toBe(false)
	})

	it("does not show the restore modal for server-cancelled sessions", () => {
		localStorage.setItem(
			"recordSummary_currentSession",
			JSON.stringify({
				status: "server_cancelled",
				startTime: Date.now(),
				totalDuration: 1000,
			}),
		)
		const coordinator = makeCoordinator()
		// @ts-expect-error private method access
		coordinator.setCurrentLockHolder("other-tab-id")
		// @ts-expect-error private method access
		coordinator.handleLockReleased({
			tabId: "other-tab-id",
			type: "RECORDING_LOCK_RELEASED",
			timestamp: Date.now(),
			data: { type: "closeTab", organizationCode: "test-org" },
		})

		expect(MagicModal.confirm).not.toHaveBeenCalled()
		localStorage.removeItem("recordSummary_currentSession")
		coordinator.cleanup()
	})
})

describe("TabCoordinator — lock timeout watchdog (B4 fix)", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		MockBroadcastChannel.reset()
	})

	afterEach(() => {
		vi.useRealTimers()
		MockBroadcastChannel.reset()
	})

	it("clears currentLockHolder after LOCK_TIMEOUT if no heartbeat", async () => {
		const coordinator = makeCoordinator()

		// Simulate receiving a LOCK_ACQUIRED from another tab via setCurrentLockHolder
		// @ts-expect-error private method access
		coordinator.setCurrentLockHolder("other-tab-id")

		expect(coordinator.getCurrentLockHolder()).toBe("other-tab-id")

		// Advance past the 15 s lock timeout
		await vi.advanceTimersByTimeAsync(16000)

		// Should have been cleared
		expect(coordinator.getCurrentLockHolder()).toBe(null)

		coordinator.cleanup()
	})

	it("does NOT clear currentLockHolder before LOCK_TIMEOUT", async () => {
		const coordinator = makeCoordinator()

		// @ts-expect-error private method access
		coordinator.setCurrentLockHolder("other-tab-id")

		// Only 10 s passed — still within timeout
		await vi.advanceTimersByTimeAsync(10000)

		expect(coordinator.getCurrentLockHolder()).toBe("other-tab-id")

		coordinator.cleanup()
	})
})

describe("TabCoordinator — LockAcquireIntent", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		MockBroadcastChannel.reset()
	})

	afterEach(() => {
		vi.useRealTimers()
		MockBroadcastChannel.reset()
	})

	it("defaults to 'restore'", () => {
		const coordinator = makeCoordinator()
		expect(coordinator.getLockAcquireIntent()).toBe("restore")
		coordinator.cleanup()
	})

	it("acquireLock fires onLockAcquired callback", async () => {
		const onLockAcquired = vi.fn()
		const coordinator = makeCoordinator({ onLockAcquired })

		coordinator.acquireLock()

		expect(onLockAcquired).toHaveBeenCalledTimes(1)
		coordinator.cleanup()
	})
})

describe("TabCoordinator — recording override", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		MockBroadcastChannel.reset()
	})

	afterEach(() => {
		vi.useRealTimers()
		MockBroadcastChannel.reset()
	})

	it("asks the active tab to stop before taking over", async () => {
		const onForceOverrideRequest = vi.fn(() => true)
		const activeTab = makeCoordinator({ onForceOverrideRequest })
		const requestingTab = makeCoordinator()

		activeTab.acquireLock()
		const resultPromise = requestingTab.requestRecordingOverride("session-1")
		const result = await resultPromise

		expect(result).toBe(true)
		expect(onForceOverrideRequest).toHaveBeenCalledWith({
			requestId: expect.any(String),
			sessionId: "session-1",
			targetTabId: activeTab.getTabId(),
		})

		activeTab.cleanup()
		requestingTab.cleanup()
	})

	it("forceAcquireLock steals the lock so a later requestLock succeeds", async () => {
		const onLockAcquired = vi.fn()
		const activeTab = makeCoordinator()
		const requestingTab = makeCoordinator({ onLockAcquired })
		activeTab.acquireLock()

		expect(requestingTab.hasRecordingPermission()).toBe(false)
		expect(requestingTab.isAnyTabRecording()).toBe(true)

		requestingTab.forceAcquireLock()

		expect(requestingTab.hasRecordingPermission()).toBe(true)
		expect(activeTab.hasRecordingPermission()).toBe(false)
		expect(await requestingTab.requestLock()).toBe(true)
		expect(onLockAcquired).not.toHaveBeenCalled()

		activeTab.cleanup()
		requestingTab.cleanup()
	})

	it("ignores idle-tab rejections until the lock holder responds", async () => {
		let resolveOverride: ((value: boolean) => void) | undefined
		const onForceOverrideRequest = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveOverride = resolve
				}),
		)
		const idleOverride = vi.fn(() => false)
		const idleTab = makeCoordinator({ onForceOverrideRequest: idleOverride })
		const activeTab = makeCoordinator({ onForceOverrideRequest })
		const requestingTab = makeCoordinator()

		activeTab.acquireLock()
		const resultPromise = requestingTab.requestRecordingOverride("session-1")

		expect(onForceOverrideRequest).toHaveBeenCalledTimes(1)
		expect(idleOverride).not.toHaveBeenCalled()
		expect(idleTab.hasRecordingPermission()).toBe(false)
		expect(requestingTab.getCurrentLockHolder()).toBe(activeTab.getTabId())

		resolveOverride?.(true)
		await expect(resultPromise).resolves.toBe(true)

		idleTab.cleanup()
		activeTab.cleanup()
		requestingTab.cleanup()
	})

	it("fails closed when the active tab does not respond", async () => {
		const activeTab = makeCoordinator({
			onForceOverrideRequest: () => new Promise<boolean>(() => undefined),
		})
		const requestingTab = makeCoordinator()
		activeTab.acquireLock()

		const resultPromise = requestingTab.requestRecordingOverride(undefined, 1000)
		await vi.advanceTimersByTimeAsync(1000)

		expect(await resultPromise).toBe(false)
		activeTab.cleanup()
		requestingTab.cleanup()
	})
})

describe("TabCoordinator — LOCK_PRIORITY constants", () => {
	it("LOCK_PRIORITY_USER > LOCK_PRIORITY_BACKGROUND", () => {
		expect(LOCK_PRIORITY_USER).toBeGreaterThan(LOCK_PRIORITY_BACKGROUND)
	})
})
