import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { getLatestAppVersion } from "../utils"
import * as worker from "../worker"

// 模拟 utils 模块
vi.mock("../utils", () => ({
	generateUUID: vi.fn().mockReturnValue("test-uuid"),
	getLatestAppVersion: vi.fn().mockResolvedValue("1.0.0"),
}))

// 定义 MessagePort 类型
type MockMessagePort = {
	id: string
	postMessage: ReturnType<typeof vi.fn>
	onmessage: ((event: { data: any }) => void) | null
}

describe("version-check worker", () => {
	// 模拟 port 对象
	const createMockPort = (): MockMessagePort => ({
		id: "",
		postMessage: vi.fn(),
		onmessage: null,
	})

	// 模拟定时器
	beforeEach(() => {
		vi.useFakeTimers()
		// @ts-ignore
		global.self = { location: { origin: "https://example.com" } }
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.clearAllTimers()
		vi.useRealTimers()
		// 重置 worker 状态
		worker.portList.length = 0
		worker.visiblePorts.length = 0
		if (worker.state.intervalId) {
			clearInterval(worker.state.intervalId)
			worker.state.intervalId = null
		}
	})

	describe("port connection", () => {
		it("should handle new port connection", () => {
			const mockPort = createMockPort()
			const event = { ports: [mockPort] }

			// 触发连接事件
			worker.onconnect(event)

			// 验证端口是否被正确初始化
			expect(mockPort.id).toBe("test-uuid")
			expect(mockPort.onmessage).toBeDefined()
		})
	})

	describe("message handling", () => {
		it("should handle 'start' message and start polling", async () => {
			const mockPort = createMockPort()
			const event = { ports: [mockPort] }
			worker.onconnect(event)

			// 模拟 start 消息
			await mockPort.onmessage?.({ data: { type: "start" } })

			// 验证初始版本检查
			expect(getLatestAppVersion).toHaveBeenCalled()
			expect(mockPort.postMessage).toHaveBeenCalledWith({
				type: "reflectGetLatestVersion",
				data: "1.0.0",
			})

			// 验证定时器是否被设置
			await vi.advanceTimersByTimeAsync(30000)
			expect(getLatestAppVersion).toHaveBeenCalledTimes(2)
		})

		it("should handle 'stop' message and stop polling when all ports are invisible", async () => {
			const mockPort = createMockPort()
			const event = { ports: [mockPort] }
			worker.onconnect(event)

			// 先发送 start 消息
			await mockPort.onmessage?.({ data: { type: "start" } })

			// 然后发送 stop 消息
			await mockPort.onmessage?.({ data: { type: "stop" } })

			// 验证定时器是否被清除
			await vi.advanceTimersByTimeAsync(30000)
			expect(getLatestAppVersion).toHaveBeenCalledTimes(1)
		})

		it("should handle 'close' message and remove port", () => {
			const mockPort = createMockPort()
			const event = { ports: [mockPort] }
			worker.onconnect(event)

			// 发送 close 消息
			mockPort.onmessage?.({ data: { type: "close" } })

			// 验证端口是否被移除
			expect(worker.portList).toHaveLength(0)
		})

		it("should handle 'refresh' message and notify other ports", async () => {
			const mockPort1 = createMockPort()
			const mockPort2 = createMockPort()

			// 连接两个端口
			worker.onconnect({ ports: [mockPort1] })
			worker.onconnect({ ports: [mockPort2] })

			// 等待异步操作完成
			await Promise.resolve()
			await vi.advanceTimersByTimeAsync(0)

			// 验证端口是否被正确添加
			expect(worker.portList).toHaveLength(2)
			expect(worker.portList[0].id).toBe("test-uuid")
			expect(worker.portList[1].id).toBe("test-uuid")

			// 手动设置不同的 ID
			worker.portList[0].id = "port1"
			worker.portList[1].id = "port2"

			// 发送 refresh 消息
			await mockPort1.onmessage?.({ data: { type: "refresh" } })
			await Promise.resolve()
			await vi.advanceTimersByTimeAsync(0)

			// 验证其他端口是否收到通知
			expect(mockPort2.postMessage).toHaveBeenCalledWith({
				type: "reflectRefresh",
			})
			expect(mockPort1.postMessage).not.toHaveBeenCalled()
		})

		it("should handle unknown message type", () => {
			const mockPort = createMockPort()
			const event = { ports: [mockPort] }
			worker.onconnect(event)

			// 发送未知类型的消息
			mockPort.onmessage?.({ data: { type: "unknown" } })

			// 验证错误消息是否被广播
			expect(mockPort.postMessage).toHaveBeenCalledWith({
				type: "error",
				message: "Unknown message type",
			})
		})
	})

	describe("multiple ports handling", () => {
		it("should broadcast version updates to all ports", async () => {
			const mockPort1 = createMockPort()
			const mockPort2 = createMockPort()

			// 连接两个端口
			worker.onconnect({ ports: [mockPort1] })
			worker.onconnect({ ports: [mockPort2] })

			// 等待异步操作完成
			await Promise.resolve()

			// 发送 start 消息到第一个端口
			await mockPort1.onmessage?.({ data: { type: "start" } })

			// 验证所有端口是否都收到版本更新
			expect(mockPort1.postMessage).toHaveBeenCalledWith({
				type: "reflectGetLatestVersion",
				data: "1.0.0",
			})
			expect(mockPort2.postMessage).toHaveBeenCalledWith({
				type: "reflectGetLatestVersion",
				data: "1.0.0",
			})
		})

		it("should maintain polling when some ports are still visible", async () => {
			const mockPort1 = createMockPort()
			const mockPort2 = createMockPort()

			// 连接两个端口
			worker.onconnect({ ports: [mockPort1] })
			worker.onconnect({ ports: [mockPort2] })

			// 等待异步操作完成
			await Promise.resolve()

			// 两个端口都发送 start 消息
			await mockPort1.onmessage?.({ data: { type: "start" } })
			await mockPort2.onmessage?.({ data: { type: "start" } })

			// 第一个端口发送 stop 消息
			await mockPort1.onmessage?.({ data: { type: "stop" } })

			// 验证定时器是否仍在运行
			await vi.advanceTimersByTimeAsync(30000)
			expect(getLatestAppVersion).toHaveBeenCalledTimes(2)
		})
	})

	describe("error handling", () => {
		it("should handle getLatestAppVersion failure", async () => {
			const mockPort = createMockPort()
			const error = new Error("Failed to fetch version")
			vi.mocked(getLatestAppVersion).mockRejectedValueOnce(error)

			const event = { ports: [mockPort] }
			worker.onconnect(event)

			// 等待异步操作完成
			await Promise.resolve()
			await vi.advanceTimersByTimeAsync(0)

			// 发送 start 消息
			await mockPort.onmessage?.({ data: { type: "start" } })
			await Promise.resolve()
			await vi.advanceTimersByTimeAsync(0)

			// 验证错误是否被正确处理
			expect(mockPort.postMessage).toHaveBeenCalledWith({
				type: "reflectGetLatestVersion",
				data: undefined,
				message: error.message,
			})
		})
	})
})
