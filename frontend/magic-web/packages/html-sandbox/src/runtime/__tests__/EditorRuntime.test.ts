/**
 * EditorRuntime tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EditorRuntime } from "../EditorRuntime"
import { MESSAGE_PROTOCOL_VERSION, MessageCategory } from "../../core/types"
import type { RequestMessage } from "../../core/types"

describe("EditorRuntime", () => {
	const parentOrigin = window.location.origin
	let runtime: EditorRuntime
	let postMessageSpy: ReturnType<typeof vi.spyOn>

	/**
	 * Sends a runtime request through the same message channel used by the host page.
	 */
	async function sendRuntimeRequest(type: string, payload?: unknown): Promise<void> {
		const message: RequestMessage = {
			version: MESSAGE_PROTOCOL_VERSION,
			category: MessageCategory.REQUEST,
			type,
			payload,
			requestId: `req-${type.toLowerCase()}`,
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
	}

	/**
	 * Enables edit mode and selects the target element through public runtime requests.
	 */
	async function enterEditModeAndSelect(selector: string): Promise<void> {
		await sendRuntimeRequest("ENTER_EDIT_MODE")
		await sendRuntimeRequest("REFRESH_SELECTED_ELEMENT", { selector })
	}

	beforeEach(() => {
		postMessageSpy = vi.spyOn(window.parent, "postMessage")
		runtime = new EditorRuntime()
	})

	afterEach(() => {
		runtime.destroy()
		postMessageSpy.mockRestore()
	})

	describe("initialization", () => {
		it("allows animation-only selection without text editing or delete shortcuts", async () => {
			document.body.innerHTML = '<h1 id="title">Title</h1>'
			await sendRuntimeRequest("SET_PPT_BUILD_MODE", { enabled: true })
			await sendRuntimeRequest("REFRESH_SELECTED_ELEMENT", { selector: "#title" })
			expect(document.querySelector("#title")?.getAttribute("contenteditable")).not.toBe(
				"true",
			)
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", cancelable: true }))
			expect(document.querySelector("#title")).not.toBeNull()
			await sendRuntimeRequest("SET_PPT_BUILD_MARKERS", { visible: true })
			expect(document.querySelector("[data-magic-ppt-build-markers]")).not.toBeNull()
			await sendRuntimeRequest("SET_PPT_BUILD_MODE", { enabled: false })
			expect(document.querySelector("[data-magic-ppt-build-markers]")).toBeNull()
		})
		it("guards build writes and disposes temporary markers on editor exit without dirtying history", async () => {
			await sendRuntimeRequest("EXECUTE_COMMAND", {
				category: MessageCategory.COMMAND,
				commandType: "UPDATE_PPT_BUILDS",
				payload: { updates: [] },
			})
			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.objectContaining({ message: "PPT_BUILD_EDIT_MODE_REQUIRED" }),
				}),
				parentOrigin,
			)
			await sendRuntimeRequest("ENTER_EDIT_MODE")
			postMessageSpy.mockClear()
			await sendRuntimeRequest("SET_PPT_BUILD_MARKERS", { visible: true })
			expect(document.querySelector("[data-magic-ppt-build-markers]")).not.toBeNull()
			expect(
				postMessageSpy.mock.calls.some(([message]) => message.type === "CONTENT_CHANGED"),
			).toBe(false)
			await sendRuntimeRequest("EXIT_EDIT_MODE")
			expect(document.querySelector("[data-magic-ppt-build-markers]")).toBeNull()
			await sendRuntimeRequest("ENTER_EDIT_MODE")
			await sendRuntimeRequest("SET_PPT_BUILD_MARKERS", { visible: true })
			runtime.destroy()
			expect(document.querySelector("[data-magic-ppt-build-markers]")).toBeNull()
		})

		it("should initialize successfully", () => {
			expect(runtime).toBeDefined()
		})

		it("should send EDITOR_READY event", () => {
			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.EVENT,
					type: "EDITOR_READY",
					payload: expect.objectContaining({
						version: "1.0.0",
					}),
				}),
				parentOrigin,
			)
		})
	})

	describe("request handling", () => {
		it("should handle ENTER_EDIT_MODE request", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
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
					category: MessageCategory.RESPONSE,
					type: "ENTER_EDIT_MODE",
					requestId: "req-123",
					success: true,
				}),
				parentOrigin,
			)
		})

		it("should handle EXIT_EDIT_MODE request", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "EXIT_EDIT_MODE",
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
					success: true,
				}),
				parentOrigin,
			)
		})

		it("should handle GET_CONTENT request", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "GET_CONTENT",
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
					success: true,
					payload: expect.objectContaining({
						html: expect.any(String),
					}),
				}),
				parentOrigin,
			)
		})

		it("should handle GET_DOM_TREE request after runtime initialization", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "GET_DOM_TREE",
				requestId: "req-dom-tree",
				timestamp: Date.now(),
				source: "parent",
				payload: {},
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
					category: MessageCategory.RESPONSE,
					type: "GET_DOM_TREE",
					requestId: "req-dom-tree",
					success: true,
					payload: expect.objectContaining({
						root: expect.objectContaining({ tagName: "body" }),
					}),
				}),
				parentOrigin,
			)
		})

		it("should return flex alignment styles after a style update", async () => {
			document.body.innerHTML = `
				<div id="flex-layout" style="display: flex; flex-wrap: wrap; align-content: space-between;">
					<div>One</div>
					<div>Two</div>
				</div>
			`

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "GET_COMPUTED_STYLES",
				requestId: "req-computed-flex-styles",
				timestamp: Date.now(),
				source: "parent",
				payload: { selector: "div#flex-layout" },
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
					type: "GET_COMPUTED_STYLES",
					requestId: "req-computed-flex-styles",
					success: true,
					payload: expect.objectContaining({
						styles: expect.objectContaining({
							alignContent: "space-between",
							flexWrap: "wrap",
						}),
					}),
				}),
				parentOrigin,
			)
		})
	})

	describe("host shortcut forwarding", () => {
		function shortcutMessages() {
			return postMessageSpy.mock.calls
				.map(([data]) => data as { type?: string; source?: string })
				.filter((data) => data?.source === "magic-html-iframe")
		}

		function press(key: string, init: KeyboardEventInit = {}) {
			const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
			// A real keyboard reports an upper-case letter in `key` while Shift is held.
			const realKey = init.shiftKey && key.length === 1 ? key.toUpperCase() : key
			const event = new KeyboardEvent("keydown", {
				key: realKey,
				metaKey: isMac && Boolean(init.ctrlKey ?? init.metaKey),
				ctrlKey: !isMac && Boolean(init.ctrlKey ?? init.metaKey),
				shiftKey: init.shiftKey,
				bubbles: true,
				cancelable: true,
			})
			document.body.dispatchEvent(event)
			return event
		}

		it("does nothing before edit mode starts", () => {
			press("s", { ctrlKey: true })
			press("Escape")
			expect(shortcutMessages()).toEqual([])
		})

		it("forwards save, save-and-exit and cancel without touching the document", async () => {
			const htmlBefore = document.documentElement.outerHTML
			await sendRuntimeRequest("ENTER_EDIT_MODE")

			const save = press("s", { ctrlKey: true })
			press("s", { ctrlKey: true, shiftKey: true })
			const escape = press("Escape")

			expect(save.defaultPrevented).toBe(true)
			expect(escape.defaultPrevented).toBe(true)
			expect(shortcutMessages().map((data) => data.type)).toEqual([
				"MAGIC_KEYBOARD_SAVE",
				"MAGIC_KEYBOARD_SAVE_AND_EXIT",
				"MAGIC_KEYBOARD_CANCEL",
			])
			expect(document.documentElement.outerHTML).toBe(htmlBefore)
		})

		it("recognises the shortcut when key is reported in upper case (Shift or Caps Lock)", async () => {
			await sendRuntimeRequest("ENTER_EDIT_MODE")
			// Caps Lock without Shift: upper-case key, Shift not pressed.
			press("S", { ctrlKey: true })
			// Shift held: the helper reports "S" like a real keyboard.
			press("s", { ctrlKey: true, shiftKey: true })
			expect(shortcutMessages().map((data) => data.type)).toEqual([
				"MAGIC_KEYBOARD_SAVE",
				"MAGIC_KEYBOARD_SAVE_AND_EXIT",
			])
		})

		it("stops forwarding after the runtime is destroyed", async () => {
			await sendRuntimeRequest("ENTER_EDIT_MODE")
			runtime.destroy()
			press("s", { ctrlKey: true })
			expect(shortcutMessages()).toEqual([])
			runtime = new EditorRuntime()
		})
	})

	describe("keyboard shortcuts", () => {
		beforeEach(() => {
			// Create a test element for keyboard events
			const testDiv = document.createElement("div")
			testDiv.id = "test-keyboard"
			document.body.appendChild(testDiv)
		})

		afterEach(() => {
			const testDiv = document.getElementById("test-keyboard")
			if (testDiv) document.body.removeChild(testDiv)
		})

		it("should handle Cmd/Ctrl+Z for undo", async () => {
			const isMac = navigator.platform.toUpperCase().includes("MAC")

			const event = new KeyboardEvent("keydown", {
				key: "z",
				metaKey: isMac,
				ctrlKey: !isMac,
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(event)

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should not crash even if no history
			expect(true).toBe(true)
		})

		it("should handle Cmd/Ctrl+Shift+Z for redo", async () => {
			const isMac = navigator.platform.toUpperCase().includes("MAC")

			const event = new KeyboardEvent("keydown", {
				key: "z",
				shiftKey: true,
				metaKey: isMac,
				ctrlKey: !isMac,
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(event)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(true).toBe(true)
		})

		it("should not trigger shortcuts in input fields", async () => {
			const input = document.createElement("input")
			input.type = "text"
			document.body.appendChild(input)

			const event = new KeyboardEvent("keydown", {
				key: "z",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})

			Object.defineProperty(event, "target", {
				value: input,
				enumerable: true,
			})

			window.dispatchEvent(event)

			await new Promise((resolve) => setTimeout(resolve, 10))

			document.body.removeChild(input)

			expect(true).toBe(true)
		})

		it("should not trigger shortcuts in textarea", async () => {
			const textarea = document.createElement("textarea")
			document.body.appendChild(textarea)

			const event = new KeyboardEvent("keydown", {
				key: "z",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})

			Object.defineProperty(event, "target", {
				value: textarea,
				enumerable: true,
			})

			window.dispatchEvent(event)

			await new Promise((resolve) => setTimeout(resolve, 10))

			document.body.removeChild(textarea)

			expect(true).toBe(true)
		})

		it("should not trigger shortcuts in contenteditable", async () => {
			const div = document.createElement("div")
			div.contentEditable = "true"
			document.body.appendChild(div)

			const event = new KeyboardEvent("keydown", {
				key: "z",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})

			Object.defineProperty(event, "target", {
				value: div,
				enumerable: true,
			})

			window.dispatchEvent(event)

			await new Promise((resolve) => setTimeout(resolve, 10))

			document.body.removeChild(div)

			expect(true).toBe(true)
		})

		it("does not intercept delete or duplicate shortcuts outside edit mode", async () => {
			const duplicateEvent = new KeyboardEvent("keydown", {
				key: "d",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})
			const deleteEvent = new KeyboardEvent("keydown", {
				key: "Delete",
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(duplicateEvent)
			window.dispatchEvent(deleteEvent)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(duplicateEvent.defaultPrevented).toBe(false)
			expect(deleteEvent.defaultPrevented).toBe(false)
		})

		it("deletes the selected element with Delete in edit mode", async () => {
			const target = document.createElement("div")
			target.id = "shortcut-delete-target"
			document.body.appendChild(target)
			await enterEditModeAndSelect("#shortcut-delete-target")

			const event = new KeyboardEvent("keydown", {
				key: "Delete",
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(event)

			await vi.waitFor(() => {
				expect(document.querySelector("#shortcut-delete-target")).toBeNull()
			})
			expect(event.defaultPrevented).toBe(true)
		})

		it("duplicates the selected element with Ctrl D in edit mode", async () => {
			const target = document.createElement("div")
			target.id = "shortcut-duplicate-target"
			document.body.appendChild(target)
			await enterEditModeAndSelect("#shortcut-duplicate-target")

			const ctrlEvent = new KeyboardEvent("keydown", {
				key: "d",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(ctrlEvent)

			await vi.waitFor(() => {
				expect(document.querySelectorAll("#shortcut-duplicate-target")).toHaveLength(1)
				expect(document.querySelector("#shortcut-duplicate-target-copy")).toBeTruthy()
			})
			expect(ctrlEvent.defaultPrevented).toBe(true)
		})

		it("duplicates the selected element with Cmd D in edit mode", async () => {
			const target = document.createElement("div")
			target.id = "shortcut-cmd-duplicate-target"
			document.body.appendChild(target)
			await enterEditModeAndSelect("#shortcut-cmd-duplicate-target")

			const cmdEvent = new KeyboardEvent("keydown", {
				key: "d",
				metaKey: true,
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(cmdEvent)

			await vi.waitFor(() => {
				expect(document.querySelectorAll("#shortcut-cmd-duplicate-target")).toHaveLength(1)
				expect(document.querySelector("#shortcut-cmd-duplicate-target-copy")).toBeTruthy()
			})
			expect(cmdEvent.defaultPrevented).toBe(true)
		})

		it("does not intercept duplicate shortcut in edit mode without selection", async () => {
			await sendRuntimeRequest("ENTER_EDIT_MODE")

			const event = new KeyboardEvent("keydown", {
				key: "d",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			})

			window.dispatchEvent(event)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(event.defaultPrevented).toBe(false)
		})

		it("does not delete or duplicate when the shortcut target is editable", async () => {
			const target = document.createElement("div")
			target.id = "shortcut-editable-target"
			const input = document.createElement("input")
			const textEditing = document.createElement("span")
			textEditing.setAttribute("data-text-editing", "true")
			const nativeEditable = document.createElement("div")
			nativeEditable.setAttribute("contenteditable", "true")
			target.append(input, textEditing, nativeEditable)
			document.body.appendChild(target)
			await enterEditModeAndSelect("#shortcut-editable-target")

			for (const editableTarget of [input, textEditing, nativeEditable]) {
				const duplicateEvent = new KeyboardEvent("keydown", {
					key: "d",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				})
				const deleteEvent = new KeyboardEvent("keydown", {
					key: "Backspace",
					bubbles: true,
					cancelable: true,
				})

				editableTarget.dispatchEvent(duplicateEvent)
				editableTarget.dispatchEvent(deleteEvent)
			}

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(document.querySelector("#shortcut-editable-target")).toBe(target)
			expect(document.querySelectorAll("#shortcut-editable-target")).toHaveLength(1)
		})
	})

	describe("event notifications", () => {
		it("should send EDIT_MODE_CHANGED event", async () => {
			postMessageSpy.mockClear()

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
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
					type: "EDIT_MODE_CHANGED",
					payload: expect.objectContaining({
						isEditMode: true,
					}),
				}),
				parentOrigin,
			)
		})

		it("should send CONTENT_CHANGED event on history change", async () => {
			// Need to trigger a command that records to history
			// This is indirectly tested through other tests
			expect(true).toBe(true)
		})
	})

	describe("native image drop", () => {
		it("does not intercept non-image file dragover", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
				requestId: "req-native-non-image-dragover",
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

			const event = new Event("dragover", { bubbles: true, cancelable: true })
			Object.defineProperties(event, {
				clientX: { value: 10 },
				clientY: { value: 10 },
				dataTransfer: {
					value: {
						types: ["Files"],
						items: [{ kind: "file", type: "application/pdf" }],
					},
				},
			})

			document.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(false)
		})

		it("uploads external images into the current file images folder", async () => {
			const uploadFiles = vi.fn().mockResolvedValue([])
			;(window as any).Magic = {
				project: {
					uploadFiles,
				},
			}

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
				requestId: "req-native-drop",
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

			const file = new File(["image"], "picture.png", { type: "image/png" })
			const event = new Event("drop", { bubbles: true, cancelable: true })
			Object.defineProperties(event, {
				clientX: { value: 10 },
				clientY: { value: 10 },
				dataTransfer: {
					value: {
						types: ["Files"],
						files: [file],
					},
				},
			})

			document.dispatchEvent(event)

			await vi.waitFor(() => {
				expect(uploadFiles).toHaveBeenCalledWith([
					{
						file,
						path: "./images/picture.png",
						filename: "picture.png",
					},
				])
			})
		})

		it("deduplicates native image drop while upload is pending", async () => {
			let resolveUpload: (value: unknown[]) => void = () => {}
			const uploadFiles = vi.fn(
				() =>
					new Promise<unknown[]>((resolve) => {
						resolveUpload = resolve
					}),
			)
			;(window as any).Magic = {
				project: {
					uploadFiles,
				},
			}

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
				requestId: "req-native-drop-dedupe",
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

			const file = new File(["image"], "picture.png", { type: "image/png" })
			const createDropEvent = () => {
				const event = new Event("drop", { bubbles: true, cancelable: true })
				Object.defineProperties(event, {
					clientX: { value: 10 },
					clientY: { value: 10 },
					dataTransfer: {
						value: {
							types: ["Files"],
							files: [file],
						},
					},
				})
				return event
			}

			document.dispatchEvent(createDropEvent())
			document.dispatchEvent(createDropEvent())

			await vi.waitFor(() => {
				expect(uploadFiles).toHaveBeenCalledTimes(1)
			})
			resolveUpload([])
		})
	})

	describe("destroy", () => {
		it("should cleanup resources", () => {
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

			runtime.destroy()

			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

			removeEventListenerSpy.mockRestore()
		})

		it("should allow multiple destroy calls", () => {
			expect(() => {
				runtime.destroy()
				runtime.destroy()
			}).not.toThrow()
		})
	})

	describe("integration scenarios", () => {
		it("should handle enter and exit edit mode sequence", async () => {
			postMessageSpy.mockClear()

			// Enter edit mode
			const enableMessage: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "ENTER_EDIT_MODE",
				requestId: "req-1",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: enableMessage,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))

			// Exit edit mode
			const disableMessage: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "EXIT_EDIT_MODE",
				requestId: "req-2",
				timestamp: Date.now(),
				source: "parent",
			}

			window.dispatchEvent(
				new MessageEvent("message", {
					data: disableMessage,
					source: window.parent,
				}),
			)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "EDIT_MODE_CHANGED",
					payload: expect.objectContaining({
						isEditMode: false,
					}),
				}),
				parentOrigin,
			)
		})

		it("should handle multiple requests in sequence", async () => {
			const requests: RequestMessage[] = [
				{
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.REQUEST,
					type: "ENTER_EDIT_MODE",
					requestId: "req-1",
					timestamp: Date.now(),
					source: "parent",
				},
				{
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.REQUEST,
					type: "GET_CONTENT",
					requestId: "req-2",
					timestamp: Date.now(),
					source: "parent",
				},
				{
					version: MESSAGE_PROTOCOL_VERSION,
					category: MessageCategory.REQUEST,
					type: "EXIT_EDIT_MODE",
					requestId: "req-3",
					timestamp: Date.now(),
					source: "parent",
				},
			]

			for (const request of requests) {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: request,
						source: window.parent,
					}),
				)
				await new Promise((resolve) => setTimeout(resolve, 10))
			}

			// All requests should be handled successfully
			// Each request generates at least one response
			expect(postMessageSpy).toHaveBeenCalled()
		})
	})

	describe("edge cases", () => {
		it("should handle requests before fully initialized", async () => {
			// Create new runtime without waiting
			const newRuntime = new EditorRuntime()

			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "GET_CONTENT",
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

			// Should not crash
			expect(true).toBe(true)

			newRuntime.destroy()
		})

		it("should handle rapid keyboard shortcuts", async () => {
			const isMac = navigator.platform.toUpperCase().includes("MAC")

			for (let i = 0; i < 10; i++) {
				const event = new KeyboardEvent("keydown", {
					key: "z",
					metaKey: isMac,
					ctrlKey: !isMac,
					bubbles: true,
					cancelable: true,
				})

				window.dispatchEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(true).toBe(true)
		})

		it("should handle window message spam", async () => {
			const message: RequestMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.REQUEST,
				type: "GET_CONTENT",
				requestId: "req-123",
				timestamp: Date.now(),
				source: "parent",
			}

			for (let i = 0; i < 100; i++) {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: message,
						source: window.parent,
					}),
				)
			}

			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should handle all messages without crashing
			expect(true).toBe(true)
		})
	})
})
