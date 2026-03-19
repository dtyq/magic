/**
 * EditorBridge tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EditorBridge } from "../EditorBridge"
import { MESSAGE_PROTOCOL_VERSION, MessageCategory } from "../types"
import type { RequestMessage, CommandMessage } from "../types"

describe("EditorBridge", () => {
	let bridge: EditorBridge
	let postMessageSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		bridge = new EditorBridge()
		// Mock window.parent.postMessage
		postMessageSpy = vi.spyOn(window.parent, "postMessage")
	})

	afterEach(() => {
		bridge.destroy()
		postMessageSpy.mockRestore()
	})

	describe("constructor", () => {
		it("should initialize bridge", () => {
			expect(bridge.isActive()).toBe(true)
		})
	})

	describe("onRequest", () => {
		it("should register request handler", () => {
			const handler = vi.fn(() => ({ result: "success" }))
			bridge.onRequest("TEST_REQUEST", handler)

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "TEST_REQUEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			// Wait for async handler
			setTimeout(() => {
				expect(handler).toHaveBeenCalled()
			}, 0)
		})

		it("should handle sync request handler", async () => {
			const handler = vi.fn(() => ({ result: "sync" }))
			bridge.onRequest("SYNC_REQUEST", handler)

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "SYNC_REQUEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			// Wait for message processing
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(handler).toHaveBeenCalled()
		})

		it("should handle async request handler", async () => {
			const handler = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return { result: "async" }
			})
			bridge.onRequest("ASYNC_REQUEST", handler)

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ASYNC_REQUEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 50))
			expect(handler).toHaveBeenCalled()
		})

		it("should send error response for unknown request", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "UNKNOWN_REQUEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.objectContaining({
						code: "REQUEST_FAILED",
						message: expect.stringContaining("Unknown request type"),
					}),
				}),
				"*",
			)
		})

		it("should send error response when handler throws", async () => {
			const handler = vi.fn(() => {
				throw new Error("Handler error")
			})
			bridge.onRequest("ERROR_REQUEST", handler)

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ERROR_REQUEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.objectContaining({
						message: "Handler error",
					}),
				}),
				"*",
			)
		})
	})

	describe("onCommand", () => {
		it("should register command handler", () => {
			const handler = vi.fn(() => ({ result: "success" }))
			bridge.onCommand("TEST_COMMAND", handler)

			const command: CommandMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.COMMAND,
				commandType: "TEST_COMMAND",
				type: "TEST_COMMAND",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: command,
					source: window.parent,
				}),
			)

			setTimeout(() => {
				expect(handler).toHaveBeenCalled()
			}, 0)
		})

		it("should handle wrapped command in request", async () => {
			const handler = vi.fn(() => ({ result: "success" }))
			bridge.onCommand("WRAPPED_COMMAND", handler)

			const command: CommandMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.COMMAND,
				commandType: "WRAPPED_COMMAND",
				type: "WRAPPED_COMMAND",
				timestamp: Date.now(),
				source: "parent",
			}

			const request: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "EXECUTE_COMMAND",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
				payload: command,
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: request,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(handler).toHaveBeenCalled()
		})

		it("should send error response for unknown command", async () => {
			const command: CommandMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.COMMAND,
				commandType: "UNKNOWN_COMMAND",
				type: "UNKNOWN_COMMAND",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: command,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.objectContaining({
						code: "COMMAND_FAILED",
					}),
				}),
				"*",
			)
		})
	})

	describe("sendEvent", () => {
		it("should send event to parent", () => {
			bridge.sendEvent("TEST_EVENT", { data: "test" })

			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: "TEST_EVENT",
					payload: { data: "test" },
					source: "iframe",
				}),
				"*",
			)
		})

		it("should send event without payload", () => {
			bridge.sendEvent("TEST_EVENT")

			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "TEST_EVENT",
					payload: undefined,
				}),
				"*",
			)
		})

		it("should not send event when destroyed", () => {
			bridge.destroy()
			bridge.sendEvent("TEST_EVENT")

			expect(postMessageSpy).not.toHaveBeenCalled()
		})
	})

	describe("message filtering", () => {
		it("should ignore messages from non-parent sources", async () => {
			const handler = vi.fn()
			bridge.onRequest("TEST", handler)

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "TEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "other",
			}

			// Create a new window reference that's not window.parent
			const fakeWindow = {} as Window

			// Message from different source
			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: fakeWindow,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).not.toHaveBeenCalled()
		})

		it("should ignore messages with wrong protocol version", () => {
			const handler = vi.fn()
			bridge.onRequest("TEST", handler)

			const message = {
				version: "0.0.0",
				category: MessageCategory.REQUEST,
				type: "TEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			expect(handler).not.toHaveBeenCalled()
		})

		it("should ignore invalid messages", () => {
			const handler = vi.fn()
			bridge.onRequest("TEST", handler)

			window.dispatchEvent(
				new MessageEvent("message", {
					data: null,
					source: window.parent,
				}),
			)

			window.dispatchEvent(
				new MessageEvent("message", {
					data: "invalid",
					source: window.parent,
				}),
			)

			expect(handler).not.toHaveBeenCalled()
		})
	})

	describe("destroy", () => {
		it("should mark bridge as inactive", () => {
			bridge.destroy()
			expect(bridge.isActive()).toBe(false)
		})

		it("should clear handlers", () => {
			const handler = vi.fn()
			bridge.onRequest("TEST", handler)
			bridge.destroy()

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "TEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			expect(handler).not.toHaveBeenCalled()
		})

		it("should prevent sending events", () => {
			bridge.destroy()
			bridge.sendEvent("TEST_EVENT")
			expect(postMessageSpy).not.toHaveBeenCalled()
		})
	})

	describe("edge cases", () => {
		it("should handle multiple handlers for same request type", () => {
			const handler1 = vi.fn(() => "result1")
			const handler2 = vi.fn(() => "result2")

			bridge.onRequest("TEST", handler1)
			bridge.onRequest("TEST", handler2) // Overwrites handler1

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "TEST",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: message,
					source: window.parent,
				}),
			)

			setTimeout(() => {
				expect(handler1).not.toHaveBeenCalled()
				expect(handler2).toHaveBeenCalled()
			}, 0)
		})

		it("should handle postMessage errors gracefully", () => {
			postMessageSpy.mockImplementation(() => {
				throw new Error("postMessage failed")
			})

			// Should not throw
			expect(() => {
				bridge.sendEvent("TEST_EVENT")
			}).not.toThrow()
		})
	})
})
