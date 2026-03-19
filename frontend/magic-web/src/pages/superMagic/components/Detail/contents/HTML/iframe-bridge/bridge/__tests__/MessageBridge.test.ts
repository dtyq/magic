/**
 * MessageBridge 通讯测试
 * 验证父窗口和 iframe 之间的双向通讯
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MessageBridge } from "../MessageBridge"
import { EditorMessageType, MessageCategory, MESSAGE_PROTOCOL_VERSION } from "../../types/messages"

describe("MessageBridge 通讯测试", () => {
	let iframe: HTMLIFrameElement
	let bridge: MessageBridge
	let mockContentWindow: any

	beforeEach(() => {
		// 创建模拟的 iframe
		iframe = document.createElement("iframe")

		// 模拟 contentWindow
		mockContentWindow = {
			postMessage: vi.fn(),
		}

		Object.defineProperty(iframe, "contentWindow", {
			value: mockContentWindow,
			writable: true,
		})

		// 创建 MessageBridge
		bridge = new MessageBridge(iframe)
	})

	afterEach(() => {
		if (bridge) {
			bridge.destroy()
		}
	})

	describe("初始化", () => {
		it("应该正确初始化 MessageBridge", () => {
			expect(bridge).toBeDefined()
			expect(bridge.isActive()).toBe(true)
		})

		it("应该有零个待处理请求", () => {
			expect(bridge.getPendingRequestCount()).toBe(0)
		})
	})

	describe("发送请求", () => {
		it("应该能发送请求消息", () => {
			bridge.request(EditorMessageType.GET_CONTENT)

			// 验证 postMessage 被调用
			expect(mockContentWindow.postMessage).toHaveBeenCalled()

			const callArgs = mockContentWindow.postMessage.mock.calls[0]
			const message = callArgs[0]

			// 验证消息格式
			expect(message.version).toBe(MESSAGE_PROTOCOL_VERSION)
			expect(message.category).toBe(MessageCategory.REQUEST)
			expect(message.type).toBe(EditorMessageType.GET_CONTENT)
			expect(message.requestId).toBeDefined()
			expect(message.source).toBe("parent")
		})

		it("应该能发送带 payload 的请求", () => {
			const payload = { selector: ".test" }
			bridge.request(EditorMessageType.GET_COMPUTED_STYLES, payload)

			const callArgs = mockContentWindow.postMessage.mock.calls[0]
			const message = callArgs[0]

			expect(message.payload).toEqual(payload)
		})

		it("应该在发送请求后增加待处理请求数", () => {
			bridge.request(EditorMessageType.GET_CONTENT)
			expect(bridge.getPendingRequestCount()).toBe(1)
		})

		it("应该在请求超时后拒绝", async () => {
			const timeout = 100
			const requestPromise = bridge.request(EditorMessageType.GET_CONTENT, undefined, timeout)

			await expect(requestPromise).rejects.toThrow("请求超时")
		}, 200)
	})

	describe("接收响应", () => {
		it("应该正确处理成功响应", async () => {
			// 发送请求
			const requestPromise = bridge.request(EditorMessageType.GET_CONTENT)

			// 获取请求 ID
			const callArgs = mockContentWindow.postMessage.mock.calls[0]
			const requestMessage = callArgs[0]
			const requestId = requestMessage.requestId

			// 模拟 iframe 发送响应
			const responseEvent = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.RESPONSE,
					type: EditorMessageType.GET_CONTENT,
					requestId,
					success: true,
					payload: {
						html: "<div>test</div>",
						cleanHtml: "<div>test</div>",
						hasChanges: false,
					},
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(responseEvent)

			// 验证 promise 解析
			const result = await requestPromise
			expect(result).toEqual({
				html: "<div>test</div>",
				cleanHtml: "<div>test</div>",
				hasChanges: false,
			})

			// 验证待处理请求已清除
			expect(bridge.getPendingRequestCount()).toBe(0)
		})

		it("应该正确处理错误响应", async () => {
			// 发送请求
			const requestPromise = bridge.request(EditorMessageType.GET_CONTENT)

			// 获取请求 ID
			const callArgs = mockContentWindow.postMessage.mock.calls[0]
			const requestMessage = callArgs[0]
			const requestId = requestMessage.requestId

			// 模拟 iframe 发送错误响应
			const responseEvent = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.RESPONSE,
					type: EditorMessageType.GET_CONTENT,
					requestId,
					success: false,
					error: {
						code: "RUNTIME_ERROR",
						message: "Test error",
					},
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(responseEvent)

			// 验证 promise 拒绝
			await expect(requestPromise).rejects.toThrow("Test error")
		})
	})

	describe("事件监听", () => {
		it("应该能注册事件监听器", () => {
			const handler = vi.fn()
			bridge.on(EditorMessageType.IFRAME_READY, handler)

			// 模拟 iframe 发送事件
			const event = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: EditorMessageType.IFRAME_READY,
					payload: { timestamp: Date.now() },
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(event)

			// 验证处理器被调用
			expect(handler).toHaveBeenCalled()
		})

		it("应该能取消事件监听器", () => {
			const handler = vi.fn()
			bridge.on(EditorMessageType.IFRAME_READY, handler)
			bridge.off(EditorMessageType.IFRAME_READY, handler)

			// 模拟 iframe 发送事件
			const event = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: EditorMessageType.IFRAME_READY,
					payload: { timestamp: Date.now() },
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(event)

			// 验证处理器未被调用
			expect(handler).not.toHaveBeenCalled()
		})

		it("应该能取消所有事件监听器", () => {
			const handler1 = vi.fn()
			const handler2 = vi.fn()
			bridge.on(EditorMessageType.IFRAME_READY, handler1)
			bridge.on(EditorMessageType.IFRAME_READY, handler2)
			bridge.off(EditorMessageType.IFRAME_READY)

			// 模拟 iframe 发送事件
			const event = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: EditorMessageType.IFRAME_READY,
					payload: { timestamp: Date.now() },
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(event)

			// 验证所有处理器都未被调用
			expect(handler1).not.toHaveBeenCalled()
			expect(handler2).not.toHaveBeenCalled()
		})
	})

	describe("命令发送", () => {
		it("应该能发送命令消息", async () => {
			const payload = { selector: ".test", color: "#ff0000" }
			const metadata = { description: "设置背景色", canUndo: true }

			bridge.sendCommand(EditorMessageType.SET_BACKGROUND_COLOR, payload, metadata)

			// 验证 postMessage 被调用
			expect(mockContentWindow.postMessage).toHaveBeenCalled()

			const callArgs = mockContentWindow.postMessage.mock.calls[0]
			const message = callArgs[0]

			// 验证消息格式
			expect(message.version).toBe(MESSAGE_PROTOCOL_VERSION)
			expect(message.category).toBe(MessageCategory.REQUEST)
			expect(message.type).toBe("EXECUTE_COMMAND")
		})
	})

	describe("安全检查", () => {
		it("应该忽略非 iframe 来源的消息", () => {
			const handler = vi.fn()
			bridge.on(EditorMessageType.IFRAME_READY, handler)

			// 模拟来自其他来源的消息
			const event = new MessageEvent("message", {
				source: window as any, // 错误的来源
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: EditorMessageType.IFRAME_READY,
					payload: {},
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(event)

			// 验证处理器未被调用
			expect(handler).not.toHaveBeenCalled()
		})

		it("应该忽略协议版本不匹配的消息", () => {
			const handler = vi.fn()
			bridge.on(EditorMessageType.IFRAME_READY, handler)

			// 模拟协议版本不匹配的消息
			const event = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: "0.0.1", // 错误的版本
					category: MessageCategory.EVENT,
					type: EditorMessageType.IFRAME_READY,
					payload: {},
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(event)

			// 验证处理器未被调用
			expect(handler).not.toHaveBeenCalled()
		})
	})

	describe("销毁", () => {
		it("应该能正确销毁", () => {
			bridge.destroy()

			expect(bridge.isActive()).toBe(false)
			expect(bridge.getPendingRequestCount()).toBe(0)
		})

		it("销毁后不应该发送消息", async () => {
			bridge.destroy()

			await expect(bridge.request(EditorMessageType.GET_CONTENT)).rejects.toThrow(
				"MessageBridge已销毁",
			)
		})

		it("销毁时应该清理所有待处理的请求", async () => {
			const requestPromise = bridge.request(EditorMessageType.GET_CONTENT)

			// 确认有待处理的请求
			expect(bridge.getPendingRequestCount()).toBe(1)

			bridge.destroy()

			// 销毁后待处理请求应该被清理
			expect(bridge.getPendingRequestCount()).toBe(0)

			// 请求不会被拒绝，只是被静默清理
			// 注意：这个 promise 永远不会 resolve 或 reject
		})
	})
})

describe("IFRAME_READY 事件流程", () => {
	it("应该模拟完整的 IFRAME_READY 事件流程", () => {
		// 这个测试模拟实际的通讯流程
		const mockIframe = document.createElement("iframe")
		const mockContentWindow = {
			postMessage: vi.fn(),
		}

		Object.defineProperty(mockIframe, "contentWindow", {
			value: mockContentWindow,
			writable: true,
		})

		const bridge = new MessageBridge(mockIframe)
		const readyHandler = vi.fn()

		// 1. 父窗口注册 IFRAME_READY 事件监听器
		bridge.on(EditorMessageType.IFRAME_READY, readyHandler)

		// 2. 模拟 iframe 发送 IFRAME_READY 事件
		const readyEvent = new MessageEvent("message", {
			source: mockContentWindow as any,
			data: {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.EVENT,
				type: EditorMessageType.IFRAME_READY,
				payload: {
					timestamp: Date.now(),
					userAgent: navigator.userAgent,
				},
				timestamp: Date.now(),
				source: "iframe",
			},
		})

		window.dispatchEvent(readyEvent)

		// 3. 验证处理器被调用
		expect(readyHandler).toHaveBeenCalled()
		const eventMessage = readyHandler.mock.calls[0][0]
		expect(eventMessage.type).toBe(EditorMessageType.IFRAME_READY)
		expect(eventMessage.payload.userAgent).toBeDefined()

		bridge.destroy()
	})
})

describe("请求/响应完整流程", () => {
	it("应该模拟完整的请求/响应流程", async () => {
		const mockIframe = document.createElement("iframe")
		const mockContentWindow = {
			postMessage: vi.fn(),
		}

		Object.defineProperty(mockIframe, "contentWindow", {
			value: mockContentWindow,
			writable: true,
		})

		const bridge = new MessageBridge(mockIframe)

		// 1. 父窗口发送 GET_CONTENT 请求
		const requestPromise = bridge.request(EditorMessageType.GET_CONTENT)

		// 2. 验证 postMessage 被调用
		expect(mockContentWindow.postMessage).toHaveBeenCalled()
		const requestMessage = mockContentWindow.postMessage.mock.calls[0][0]

		// 3. 模拟 iframe 处理请求并发送响应
		setTimeout(() => {
			const responseEvent = new MessageEvent("message", {
				source: mockContentWindow as any,
				data: {
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.RESPONSE,
					type: EditorMessageType.GET_CONTENT,
					requestId: requestMessage.requestId,
					success: true,
					payload: {
						html: "<html><body>test</body></html>",
						cleanHtml: "<html><body>test</body></html>",
						hasChanges: false,
					},
					timestamp: Date.now(),
					source: "iframe",
				},
			})

			window.dispatchEvent(responseEvent)
		}, 10)

		// 4. 验证响应
		const result = await requestPromise
		expect(result.html).toBe("<html><body>test</body></html>")
		expect(result.hasChanges).toBe(false)

		bridge.destroy()
	})
})
