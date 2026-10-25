import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecordingSummaryStatus, RecordingStatusReporter } from "../RecordingStatusReporter"

const { reportRecordingSummaryStatus } = vi.hoisted(() => ({
	reportRecordingSummaryStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		reportRecordingSummaryStatus,
	},
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		isRecording: true,
		businessData: { model: { model_id: "model-test" } },
		note: undefined,
		message: [],
	},
}))

vi.mock("@/infrastructure/logger", () => {
	const logger = {
		log: vi.fn(),
		error: vi.fn(),
		createLogger: vi.fn(() => logger),
	}
	return { logger }
})

describe("RecordingStatusReporter", () => {
	it("retains the failed request identity after another session starts", async () => {
		let rejectReport!: (error: Error) => void
		reportRecordingSummaryStatus.mockImplementationOnce(
			() =>
				new Promise((_, reject) => {
					rejectReport = reject
				}),
		)
		const onReportError = vi.fn()
		const reporter = new RecordingStatusReporter({ onReportError })
		const pending = reporter.reportStatus({
			task_key: "old-session",
			status: RecordingSummaryStatus.Recording,
			model_id: "model-1",
		})
		reporter.startPeriodicReport("new-session")
		const error = Object.assign(new Error("project missing"), { code: "51200" })
		rejectReport(error)
		await pending
		expect(onReportError).toHaveBeenCalledExactlyOnceWith(error, "old-session")
		reporter.stopPeriodicReport()
	})
	beforeEach(() => {
		reportRecordingSummaryStatus.mockClear()
	})

	it("includes the current shard count in an immediate status report", async () => {
		const reporter = new RecordingStatusReporter()

		await reporter.reportStatus({
			task_key: "task-test",
			status: RecordingSummaryStatus.Stopped,
			model_id: "model-test",
			file_shard_count: 3,
		})

		expect(reportRecordingSummaryStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				file_shard_count: 3,
			}),
		)
	})

	it("resolves the latest shard count for periodic status reports", async () => {
		vi.useFakeTimers()
		let shardCount = 1
		const reporter = new RecordingStatusReporter({
			getFileShardCount: () => shardCount,
		})
		shardCount = 4
		reporter.startPeriodicReport("task-test", 100)
		await vi.advanceTimersByTimeAsync(100)

		expect(reportRecordingSummaryStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				file_shard_count: 4,
			}),
		)
		reporter.stopPeriodicReport()
		vi.useRealTimers()
	})
})
