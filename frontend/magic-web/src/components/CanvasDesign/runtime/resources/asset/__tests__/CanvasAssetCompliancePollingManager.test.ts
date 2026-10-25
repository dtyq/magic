import { afterEach, describe, expect, it, vi } from "vitest"
import { CanvasAssetCompliancePollingManager } from "../CanvasAssetCompliancePollingManager"

function createManager(getAssetComplianceStatus: ReturnType<typeof vi.fn>) {
	const canvas = {
		magicConfigManager: {
			config: {
				methods: { getAssetComplianceStatus },
			},
		},
	}
	return new CanvasAssetCompliancePollingManager(canvas as never)
}

function createBatchManager(
	getAssetComplianceStatus: ReturnType<typeof vi.fn>,
	getAssetComplianceStatuses: ReturnType<typeof vi.fn>,
) {
	const canvas = {
		magicConfigManager: {
			config: {
				methods: { getAssetComplianceStatus, getAssetComplianceStatuses },
			},
		},
	}
	return new CanvasAssetCompliancePollingManager(canvas as never)
}

afterEach(() => {
	vi.useRealTimers()
})

describe("CanvasAssetCompliancePollingManager", () => {
	it("requests immediately, polls PROCESSING, and settles on PASS", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "100",
				status: "PROCESSING",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "100",
				status: "PASS",
				failedReason: null,
			})
		const onUpdate = vi.fn()
		const onSettled = vi.fn()
		const manager = createManager(getAssetComplianceStatus)

		manager.start("100", { onUpdate, onSettled })
		await vi.advanceTimersByTimeAsync(0)

		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)
		expect(onUpdate).toHaveBeenLastCalledWith({
			assetId: "100",
			status: "PROCESSING",
			failedReason: null,
		})

		await vi.advanceTimersByTimeAsync(2499)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(1)

		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(2)
		expect(onSettled).toHaveBeenCalledWith({
			assetId: "100",
			status: "PASS",
			failedReason: null,
		})
		expect(manager.getState("100")).toMatchObject({ status: "PASS" })
	})

	it("batches initial status reads for multiple assets", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi.fn()
		const getAssetComplianceStatuses = vi.fn().mockResolvedValue([
			{ assetId: "101", status: "PROCESSING", failedReason: null },
			{ assetId: "102", status: "PROCESSING", failedReason: null },
		])
		const manager = createBatchManager(getAssetComplianceStatus, getAssetComplianceStatuses)

		manager.start("101")
		manager.start("102")
		await vi.advanceTimersByTimeAsync(0)

		expect(getAssetComplianceStatuses).toHaveBeenCalledTimes(1)
		expect(getAssetComplianceStatuses).toHaveBeenCalledWith(["101", "102"])
		expect(getAssetComplianceStatus).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("deduplicates network polling while notifying every listener", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "200",
			status: "FAILED",
			failedReason: "包含不允许的内容",
		})
		const onSettledA = vi.fn()
		const onSettledB = vi.fn()
		const manager = createManager(getAssetComplianceStatus)

		manager.start("200", { onSettled: onSettledA })
		manager.start("200", { onSettled: onSettledB })
		await vi.advanceTimersByTimeAsync(0)

		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)
		expect(onSettledA).toHaveBeenCalledWith({
			assetId: "200",
			status: "FAILED",
			failedReason: "包含不允许的内容",
		})
		expect(onSettledB).toHaveBeenCalledWith({
			assetId: "200",
			status: "FAILED",
			failedReason: "包含不允许的内容",
		})
		await vi.advanceTimersByTimeAsync(2500)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)
	})

	it("retries temporary failures on the next interval", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi
			.fn()
			.mockRejectedValueOnce(new Error("temporary failure"))
			.mockResolvedValueOnce({
				assetId: "300",
				status: "UNVERIFIED",
				failedReason: null,
			})
		const onError = vi.fn()
		const manager = createManager(getAssetComplianceStatus)

		manager.start("300", { onError })
		await vi.advanceTimersByTimeAsync(0)
		expect(onError).toHaveBeenCalledTimes(1)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(2500)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(2)
		expect(manager.getState("300")).toMatchObject({ status: "UNVERIFIED" })
	})

	it("does not let a stopped request update a new polling generation", async () => {
		let resolveFirstRequest!: (value: {
			assetId: string
			status: "PASS"
			failedReason: null
		}) => void
		const firstRequest = new Promise<{
			assetId: string
			status: "PASS"
			failedReason: null
		}>((resolve) => {
			resolveFirstRequest = resolve
		})
		const getAssetComplianceStatus = vi
			.fn()
			.mockReturnValueOnce(firstRequest)
			.mockResolvedValueOnce({
				assetId: "400",
				status: "PASS",
				failedReason: null,
			})
		const onUpdate = vi.fn()
		const manager = createManager(getAssetComplianceStatus)

		manager.start("400", { onUpdate })
		await Promise.resolve()
		await Promise.resolve()
		manager.stop("400")
		manager.start("400", { onUpdate })
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()

		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(2)
		expect(onUpdate).toHaveBeenCalledTimes(1)
		expect(manager.getState("400")).toMatchObject({ status: "PASS" })

		resolveFirstRequest({ assetId: "400", status: "PASS", failedReason: null })
		await Promise.resolve()
		manager.destroy()
	})

	it("clears scheduled polling on stopAll and destroy", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "500",
			status: "PROCESSING",
			failedReason: null,
		})
		const manager = createManager(getAssetComplianceStatus)

		manager.start("500")
		await vi.advanceTimersByTimeAsync(0)
		manager.stopAll()
		await vi.advanceTimersByTimeAsync(2500)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(1)

		manager.start("500")
		await vi.advanceTimersByTimeAsync(0)
		manager.destroy()
		await vi.advanceTimersByTimeAsync(2500)
		expect(getAssetComplianceStatus).toHaveBeenCalledTimes(2)
	})

	it("settles the local watcher when polling reaches its timeout", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "600",
			status: "PROCESSING",
			failedReason: null,
		})
		const onSettled = vi.fn()
		const onError = vi.fn()
		const manager = createManager(getAssetComplianceStatus)

		manager.start("600", { maxDurationMs: 1, onSettled, onError })
		await vi.advanceTimersByTimeAsync(0)
		await vi.advanceTimersByTimeAsync(2500)

		expect(onError).toHaveBeenCalledWith(expect.any(Error))
		expect(onSettled).toHaveBeenCalledWith({
			assetId: "600",
			status: "PROCESSING",
			failedReason: null,
		})
		expect(manager.getState("600")).toMatchObject({ status: "PROCESSING" })
	})
})
