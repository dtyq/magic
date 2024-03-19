import { describe, it, expect, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { useTransformWorker } from "../useTransformWorker"

// Mock worker for testing
class MockWorker {
	onmessage: ((event: MessageEvent) => void) | null = null
	onerror: ((error: ErrorEvent) => void) | null = null

	postMessage(message: any) {
		// Simulate worker response
		setTimeout(() => {
			if (this.onmessage) {
				const responseMessage = {
					data: {
						type: "TRANSFORM_RESPONSE",
						payload: {
							id: message.payload.id,
							result: {
								id: "test-workbook",
								name: message.payload.fileName,
								type: message.payload.fileType,
							},
						},
					},
				}
				this.onmessage(responseMessage as MessageEvent)
			}
		}, 100)
	}

	terminate() {
		// Cleanup
	}
}

// Mock Worker constructor
global.Worker = MockWorker as any

describe("Transform Data Worker", () => {
	let transformWorker: ReturnType<typeof useTransformWorker>

	beforeEach(() => {
		transformWorker = useTransformWorker({
			timeout: 5000,
			maxConcurrentTasks: 2,
		})
	})

	afterEach(() => {
		transformWorker.terminateWorker()
	})

	it("should initialize worker successfully", () => {
		expect(transformWorker).toBeDefined()
		expect(transformWorker.transformData).toBeInstanceOf(Function)
		expect(transformWorker.isWorkerAvailable).toBeInstanceOf(Function)
		expect(transformWorker.getPendingTasksCount).toBeInstanceOf(Function)
		expect(transformWorker.terminateWorker).toBeInstanceOf(Function)
	})

	it("should transform data using worker", async () => {
		const testData = [
			["Header 1", "Header 2"],
			["Data 1", "Data 2"],
		]
		const result = await transformWorker.transformData(testData, "sheet", "test.xlsx")

		expect(result).toBeDefined()
		expect(result.id).toBe("test-workbook")
		expect(result.name).toBe("test.xlsx")
		expect(result.type).toBe("sheet")
	})

	it("should handle multiple concurrent tasks", async () => {
		const testData1 = [
			["A", "B"],
			["1", "2"],
		]
		const testData2 = [
			["C", "D"],
			["3", "4"],
		]

		const promise1 = transformWorker.transformData(testData1, "sheet", "test1.xlsx")
		const promise2 = transformWorker.transformData(testData2, "sheet", "test2.xlsx")

		expect(transformWorker.getPendingTasksCount()).toBe(2)

		const [result1, result2] = await Promise.all([promise1, promise2])

		expect(result1.name).toBe("test1.xlsx")
		expect(result2.name).toBe("test2.xlsx")
		expect(transformWorker.getPendingTasksCount()).toBe(0)
	})

	it("should respect concurrent task limit", async () => {
		const tasks = []

		// Create more tasks than the limit (2)
		for (let i = 0; i < 5; i++) {
			try {
				const promise = transformWorker.transformData([["data"]], "sheet", `test${i}.xlsx`)
				tasks.push(promise)
			} catch (error) {
				// Should throw error when limit is exceeded
				expect(error).toBeInstanceOf(Error)
				expect((error as Error).message).toContain("最大并发任务数限制")
			}
		}

		// Wait for all successful tasks to complete
		const results = await Promise.allSettled(tasks.filter(Boolean))
		expect(results.length).toBeLessThanOrEqual(2)
	})

	it("should terminate worker properly", () => {
		expect(transformWorker.getPendingTasksCount()).toBe(0)
		transformWorker.terminateWorker()
		// Worker should be cleaned up
	})
})
