import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMagicWidgetController } from "../src/controller"
import type { MagicWidget } from "../src/types"

function setViewport(width: number, height: number) {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		writable: true,
		value: width,
	})
	Object.defineProperty(window, "innerHeight", {
		configurable: true,
		writable: true,
		value: height,
	})
}

function appendWidgetScript(src = "https://www.letsmagic.cn/sdk/magic-widget.js") {
	const script = document.createElement("script")
	script.src = src
	document.head.append(script)
	return script
}

/** Announces that a mounted iframe can receive runtime configuration snapshots. */
function dispatchConfigReady(iframe: HTMLIFrameElement, frameWindow: Window, origin: string) {
	const instanceId = new URL(iframe.src).searchParams.get("magicWidgetInstanceId")
	window.dispatchEvent(
		new MessageEvent("message", {
			origin,
			source: frameWindow,
			data: {
				protocol: "magic-widget",
				version: 1,
				instanceId,
				type: "config_ready",
			},
		}),
	)
}

/** Resolves one config request using the same mock iframe identity. */
function respondToConfig(frameWindow: Window, origin: string, message: Record<string, unknown>) {
	window.dispatchEvent(
		new MessageEvent("message", {
			origin,
			source: frameWindow,
			data: {
				protocol: message.protocol,
				version: message.version,
				instanceId: message.instanceId,
				requestId: message.requestId,
				type: "response",
				ok: true,
			},
		}),
	)
}

/** Sends a validated fictional preview state from the currently mounted iframe. */
function dispatchPreviewFullscreen(
	iframe: HTMLIFrameElement,
	frameWindow: Window,
	origin: string,
	isFullscreen: boolean,
) {
	const instanceId = new URL(iframe.src).searchParams.get("magicWidgetInstanceId")
	window.dispatchEvent(
		new MessageEvent("message", {
			origin,
			source: frameWindow,
			data: {
				protocol: "magic-widget",
				version: 1,
				instanceId,
				type: "ui_state",
				state: { previewFullscreen: isFullscreen },
			},
		}),
	)
}

/** Sends one fictional runtime result from the currently mounted iframe. */
function dispatchRuntimeEvent(
	iframe: HTMLIFrameElement,
	frameWindow: Window,
	origin: string,
	event: Record<string, unknown>,
) {
	const instanceId = new URL(iframe.src).searchParams.get("magicWidgetInstanceId")
	window.dispatchEvent(
		new MessageEvent("message", {
			origin,
			source: frameWindow,
			data: {
				protocol: "magic-widget",
				version: 1,
				instanceId,
				type: "event",
				event,
			},
		}),
	)
}

describe("createMagicWidgetController", () => {
	beforeEach(() => {
		setViewport(1024, 768)
	})

	afterEach(() => {
		document.body.innerHTML = ""
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("mounts a circular message trigger and opens the anchored panel", () => {
		vi.useFakeTimers()
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
			auth: {
				loginStrategy: "phone_password",
				deploymentCode: "private-mock",
				organizationCode: "org-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector(
			"[data-magic-widget-trigger]",
		) as HTMLElement

		expect(trigger.textContent).toBe("")
		expect(trigger.querySelector("[data-magic-widget-trigger-icon]")).not.toBeNull()

		Object.defineProperty(trigger, "getBoundingClientRect", {
			value: () => ({
				left: 120,
				top: 160,
				width: 56,
				height: 56,
				right: 176,
				bottom: 216,
				x: 120,
				y: 160,
				toJSON: () => undefined,
			}),
		})

		trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const layer = root?.shadowRoot?.querySelector("[data-magic-widget-panel-layer]")
		const panel = root?.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement
		const iframe = panel.querySelector("iframe")
		expect(layer?.getAttribute("data-state")).toBe("opening")

		vi.advanceTimersByTime(180)

		expect(layer?.getAttribute("data-state")).toBe("open")
		expect(trigger.hidden).toBe(true)
		expect(panel.style.left).not.toBe("")
		expect(panel.style.top).not.toBe("")
		expect(panel.style.transformOrigin).not.toBe("")
		expect(iframe?.getAttribute("src")).toContain("/private-mock/super/crew/crew-001")
		expect(iframe?.getAttribute("src")).toContain("login-strategy=phone_password")
		expect(iframe?.getAttribute("src")).toContain("organizationCode=org-001")
		const initialConfig = JSON.parse(
			new URL(
				iframe?.getAttribute("src") ?? "https://widget.example.invalid",
			).searchParams.get("magicWidgetConfig") ?? "null",
		)
		expect(initialConfig).toEqual({
			layout: "mobile",
			responsive: { mobileDetection: "viewport" },
		})
	})

	it("plays a closing animation before hiding the panel", () => {
		vi.useFakeTimers()
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		expect((trigger as HTMLElement).hidden).toBe(true)

		const layer = root?.shadowRoot?.querySelector(
			"[data-magic-widget-panel-layer]",
		) as HTMLElement
		const closeButton = root?.shadowRoot?.querySelector(".magic-widget-close")
		expect(closeButton?.textContent).toBe("")
		expect(closeButton?.querySelector("[data-magic-widget-close-icon]")).not.toBeNull()

		closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		expect(layer.hidden).toBe(false)
		expect(layer.getAttribute("data-state")).toBe("closing")
		expect((trigger as HTMLElement).hidden).toBe(true)

		vi.advanceTimersByTime(180)

		expect(layer.hidden).toBe(true)
		expect(layer.getAttribute("data-state")).toBe("closed")
		expect((trigger as HTMLElement).hidden).toBe(false)
	})

	it("does not render an outer inline close button", () => {
		const widget = createMagicWidgetController()
		const target = document.createElement("div")
		document.body.append(target)
		appendWidgetScript("https://widget-inline.example.invalid/sdk/magic-widget.js")

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-inline-close" },
			target,
			config: { layout: "desktop", window: { closable: true } },
		})

		const root = document.querySelector("[data-magic-widget-root]") as HTMLElement
		const layer = root.shadowRoot?.querySelector(
			"[data-magic-widget-panel-layer]",
		) as HTMLElement

		expect(layer.getAttribute("data-render-mode")).toBe("inline")
		expect(layer.hidden).toBe(false)
		expect(root.shadowRoot?.querySelector(".magic-widget-close")).toBeNull()
		widget.close()
		expect(layer.hidden).toBe(true)
		widget.destroy()
	})

	it("drags the panel on desktop", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const panel = root?.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement
		const header = root?.shadowRoot?.querySelector(".magic-widget-header") as HTMLElement
		const iframe = root?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const layer = root?.shadowRoot?.querySelector("[data-magic-widget-panel-layer]")

		expect(layer?.getAttribute("data-state")).toBe("opening")

		Object.defineProperty(panel, "getBoundingClientRect", {
			value: () => ({
				left: 200,
				top: 140,
				width: 300,
				height: 300,
				right: 500,
				bottom: 440,
				x: 200,
				y: 140,
				toJSON: () => undefined,
			}),
		})

		header.dispatchEvent(new MouseEvent("pointerdown", { clientX: 210, clientY: 150 }))

		expect(layer?.getAttribute("data-state")).toBe("open")
		expect(panel.getAttribute("data-dragging")).toBe("true")

		window.dispatchEvent(new MouseEvent("pointermove", { clientX: 260, clientY: 200 }))

		expect(panel.style.left).not.toBe("250px")
		expect(panel.style.top).not.toBe("190px")
		expect(panel.style.transform).toBe("translate3d(50px, 50px, 0)")
		expect(iframe.style.pointerEvents).toBe("none")

		window.dispatchEvent(new MouseEvent("pointerup", { clientX: 260, clientY: 200 }))

		expect(panel.style.left).toBe("250px")
		expect(panel.style.top).toBe("190px")
		expect(panel.style.transform).toBe("")
		expect(panel.hasAttribute("data-dragging")).toBe(false)
		expect(iframe.style.pointerEvents).toBe("")

		vi.advanceTimersByTime(180)
		expect(layer?.getAttribute("data-state")).toBe("open")
	})

	it("opens as a bottom popover on mobile", () => {
		setViewport(390, 844)
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const layer = root?.shadowRoot?.querySelector("[data-magic-widget-panel-layer]")
		const panel = root?.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement

		expect(layer?.getAttribute("data-mode")).toBe("mobile")
		expect(panel.style.left).toBe("")
		expect(panel.style.top).toBe("")
		expect(panel.style.transformOrigin).toBe("")

		const style = root?.shadowRoot?.querySelector("style")
		expect(style?.textContent).toContain("width: 100%;")
		expect(style?.textContent).toContain("height: 86vh;")
		expect(style?.textContent).toContain("border-bottom-left-radius: 0;")
		expect(style?.textContent).toContain("border-bottom-right-radius: 0;")
	})

	it("uses the widget script origin", () => {
		appendWidgetScript("https://magic.example.com/sdk/magic-widget.js")
		const widget = createMagicWidgetController()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const iframe = root?.shadowRoot?.querySelector("iframe")
		const iframeUrl = new URL(iframe?.getAttribute("src") ?? "")
		expect(iframeUrl.origin + iframeUrl.pathname).toBe(
			"https://magic.example.com/global/super/crew/crew-001",
		)
		expect(iframeUrl.searchParams.get("magicWidgetEmbed")).toBe("1")
		expect(iframeUrl.searchParams.get("magicWidgetProtocolVersion")).toBe("1")
	})

	it("emits agent_ready and rejects invalid text or structured input", async () => {
		appendWidgetScript("https://magic.example.invalid/sdk/magic-widget.js")
		const widget = createMagicWidgetController()
		const listener = vi.fn()
		const unsubscribe = widget.on("agent_ready", listener)

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-mock-001",
			},
		})

		await expect(widget.appendInput("   ")).rejects.toMatchObject({ code: "INVALID_INPUT" })
		await expect(widget.setInput({ blocks: [] })).rejects.toMatchObject({
			code: "INVALID_INPUT",
		})
		await expect(
			widget.sendMessage({
				blocks: [
					{
						type: "mention",
						mention: {
							type: "text",
							data: { label: "Chart Mock", text: "chart id: mock-chart" },
						},
					},
				],
			}),
		).rejects.toMatchObject({ code: "INVALID_INPUT" })
		widget.open()
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const iframeUrl = new URL(iframe.getAttribute("src") ?? "")
		const instanceId = iframeUrl.searchParams.get("magicWidgetInstanceId")

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: "https://magic.example.invalid",
				source: iframe.contentWindow,
				data: {
					protocol: "magic-widget",
					version: 1,
					instanceId,
					type: "ready",
					capabilities: ["appendInput"],
				},
			}),
		)

		expect(listener).toHaveBeenCalledTimes(1)
		unsubscribe()
	})

	it("delivers runtime result events and isolates failing host listeners", () => {
		const origin = "https://magic-runtime-events.example.invalid"
		appendWidgetScript(`${origin}/sdk/magic-widget.js`)
		const widget = createMagicWidgetController()
		const target = document.createElement("div")
		document.body.append(target)
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const streamStartedEvents: unknown[] = []
		const toolEvents: unknown[] = []
		const taskEvents: unknown[] = []
		const unsubscribeFailing = widget.on("toolCall.settled", () => {
			throw new Error("mock host listener failure")
		})
		const unsubscribeFailingStreamStarted = widget.on("message.stream.started", () => {
			throw new Error("mock stream listener failure")
		})
		const unsubscribeTool = widget.on("toolCall.settled", (event) => toolEvents.push(event))
		const unsubscribeTask = widget.on("task.completed", (event) => taskEvents.push(event))
		const unsubscribeStreamStarted = widget.on("message.stream.started", (event) =>
			streamStartedEvents.push(event),
		)

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-runtime-events" },
			target,
		})
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const frameWindow = { postMessage: vi.fn() } as unknown as Window
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: frameWindow,
		})

		const toolEvent = {
			type: "toolCall.settled",
			meta: {
				sequence: 4,
				revision: 1,
				occurredAt: 1_700_000_000_000,
				source: "im",
				topicId: "topic-mock-runtime-events",
				toolCallId: "tool-mock-runtime-events",
			},
			payload: {
				toolCall: { id: "tool-mock-runtime-events", name: "mock_tool" },
				response: { status: "finished" },
				strength: "strong",
				replaceable: false,
			},
		}
		const taskEvent = {
			type: "task.completed",
			meta: {
				sequence: 5,
				revision: 1,
				occurredAt: 1_700_000_000_100,
				source: "im",
				topicId: "topic-mock-runtime-events",
				correlationId: "correlation-mock-runtime-events",
				appMessageId: "message-mock-runtime-events",
				taskId: "task-mock-runtime-events",
			},
			payload: {
				source: "finish_task",
				result: { attachments: [] },
			},
		}
		const streamStartedEvent = {
			type: "message.stream.started",
			meta: {
				sequence: 6,
				revision: 1,
				occurredAt: 1_700_000_000_200,
				source: "stream",
				topicId: "topic-mock-runtime-events",
				correlationId: "correlation-mock-stream-started",
				streamGeneration: 1,
			},
			payload: {
				chunkIndex: 0,
				startsWith: "content",
			},
		}

		dispatchRuntimeEvent(iframe, frameWindow, origin, toolEvent)
		dispatchRuntimeEvent(iframe, frameWindow, origin, taskEvent)
		dispatchRuntimeEvent(iframe, frameWindow, origin, streamStartedEvent)

		expect(toolEvents).toEqual([toolEvent])
		expect(taskEvents).toEqual([taskEvent])
		expect(streamStartedEvents).toEqual([streamStartedEvent])
		expect(consoleError).toHaveBeenCalledWith(
			"Magic widget toolCall.settled listener failed",
			expect.any(Error),
		)
		expect(consoleError).toHaveBeenCalledWith(
			"Magic widget message.stream.started listener failed",
			expect.any(Error),
		)

		unsubscribeFailing()
		unsubscribeFailingStreamStarted()
		unsubscribeTool()
		unsubscribeTask()
		unsubscribeStreamStarted()
		dispatchRuntimeEvent(iframe, frameWindow, origin, streamStartedEvent)
		expect(streamStartedEvents).toEqual([streamStartedEvent])
		widget.destroy()
	})

	it("rejects unsupported event names from JavaScript callers", () => {
		const widget = createMagicWidgetController()
		const subscribe = widget.on as unknown as (
			event: string,
			listener: () => void,
		) => () => void

		expect(() => subscribe("task.complete", vi.fn())).toThrow(
			"Magic widget event name is not supported",
		)
	})

	it("positions the opened desktop panel over the trigger area", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
			modal: {
				width: 300,
				height: 300,
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector(
			"[data-magic-widget-trigger]",
		) as HTMLElement

		Object.defineProperty(trigger, "getBoundingClientRect", {
			value: () => ({
				left: 500,
				top: 500,
				width: 56,
				height: 56,
				right: 556,
				bottom: 556,
				x: 500,
				y: 500,
				toJSON: () => undefined,
			}),
		})

		expect(() =>
			trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
		).not.toThrow()

		const panel = root?.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement
		expect(panel.style.left).toBe("256px")
		expect(panel.style.top).toBe("256px")
	})

	it("updates the trigger position while dragging", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector(
			"[data-magic-widget-trigger]",
		) as HTMLElement

		Object.defineProperty(trigger, "getBoundingClientRect", {
			value: () => ({
				left: 100,
				top: 120,
				width: 56,
				height: 56,
				right: 156,
				bottom: 176,
				x: 100,
				y: 120,
				toJSON: () => undefined,
			}),
		})

		trigger.dispatchEvent(new MouseEvent("pointerdown", { clientX: 110, clientY: 130 }))
		window.dispatchEvent(new MouseEvent("pointermove", { clientX: 160, clientY: 180 }))
		window.dispatchEvent(new MouseEvent("pointerup", { clientX: 160, clientY: 180 }))

		expect(trigger.style.left).toBe("150px")
		expect(trigger.style.top).toBe("170px")
	})

	it("keeps the trigger visible after the viewport is resized", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector(
			"[data-magic-widget-trigger]",
		) as HTMLElement

		Object.defineProperty(trigger, "getBoundingClientRect", {
			value: () => ({
				left: 960,
				top: 720,
				width: 56,
				height: 56,
				right: 1016,
				bottom: 776,
				x: 960,
				y: 720,
				toJSON: () => undefined,
			}),
		})

		setViewport(800, 600)
		window.dispatchEvent(new Event("resize"))

		expect(trigger.style.left).toBe("744px")
		expect(trigger.style.top).toBe("544px")
		expect(trigger.style.right).toBe("auto")
		expect(trigger.style.bottom).toBe("auto")
	})

	it("keeps the opened desktop panel inside the viewport after resize", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
			modal: {
				width: 420,
				height: 220,
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const panel = root?.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement

		Object.defineProperty(panel, "getBoundingClientRect", {
			value: () => ({
				left: 700,
				top: 620,
				width: 420,
				height: 220,
				right: 1120,
				bottom: 840,
				x: 700,
				y: 620,
				toJSON: () => undefined,
			}),
		})

		setViewport(800, 600)
		window.dispatchEvent(new Event("resize"))

		expect(panel.style.left).toBe("380px")
		expect(panel.style.top).toBe("380px")
		expect(panel.style.right).toBe("auto")
		expect(panel.style.bottom).toBe("auto")
	})

	it("renders a configurable mask for the mobile sheet", () => {
		setViewport(390, 844)
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
			modal: {
				classNames: {
					mask: "custom-mask",
				},
				styles: {
					mask: {
						backgroundColor: "rgba(1, 2, 3, 0.4)",
					},
				},
			},
		})

		const root = document.querySelector("[data-magic-widget-root]")
		const trigger = root?.shadowRoot?.querySelector("[data-magic-widget-trigger]")

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

		const mask = root?.shadowRoot?.querySelector(".magic-widget-mask") as HTMLElement
		const layer = root?.shadowRoot?.querySelector(
			"[data-magic-widget-panel-layer]",
		) as HTMLElement
		const style = root?.shadowRoot?.querySelector("style")

		expect(layer.getAttribute("data-mode")).toBe("mobile")
		expect(mask.classList.contains("custom-mask")).toBe(true)
		expect(mask.style.backgroundColor).toBe("rgba(1, 2, 3, 0.4)")
		expect(style?.textContent).toContain(".magic-widget-mask")
		expect(style?.textContent).toContain("pointer-events: auto;")
	})

	it("applies modal title, classNames and styles to modal slots", () => {
		const widget = createMagicWidgetController()
		appendWidgetScript()

		widget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
			modal: {
				title: "Support Center",
				classNames: {
					root: "custom-root",
					layer: "custom-layer",
					mask: "custom-mask",
					container: "custom-container",
					header: "custom-header",
					title: "custom-title",
					close: "custom-close",
					body: "custom-body",
					iframe: "custom-iframe",
				},
				styles: {
					mask: {
						backgroundColor: "rgba(1, 2, 3, 0.4)",
					},
					container: {
						backgroundColor: "rgb(1, 2, 3)",
					},
					header: {
						borderBottomColor: "rgb(4, 5, 6)",
					},
					iframe: {
						backgroundColor: "rgb(7, 8, 9)",
					},
				},
			},
		})

		const root = document.querySelector("[data-magic-widget-root]") as HTMLElement
		const layer = root.shadowRoot?.querySelector(
			"[data-magic-widget-panel-layer]",
		) as HTMLElement
		const mask = root.shadowRoot?.querySelector(".magic-widget-mask") as HTMLElement
		const panel = root.shadowRoot?.querySelector("[data-magic-widget-panel]") as HTMLElement
		const header = root.shadowRoot?.querySelector(".magic-widget-header") as HTMLElement
		const title = root.shadowRoot?.querySelector(".magic-widget-title") as HTMLElement
		const closeButton = root.shadowRoot?.querySelector(".magic-widget-close") as HTMLElement
		const body = root.shadowRoot?.querySelector(".magic-widget-body") as HTMLElement
		const iframe = root.shadowRoot?.querySelector("iframe") as HTMLIFrameElement

		expect(root.classList.contains("custom-root")).toBe(true)
		expect(layer.classList.contains("custom-layer")).toBe(true)
		expect(mask.classList.contains("custom-mask")).toBe(true)
		expect(panel.classList.contains("custom-container")).toBe(true)
		expect(header.classList.contains("custom-header")).toBe(true)
		expect(title.classList.contains("custom-title")).toBe(true)
		expect(closeButton.classList.contains("custom-close")).toBe(true)
		expect(body.classList.contains("custom-body")).toBe(true)
		expect(iframe.classList.contains("custom-iframe")).toBe(true)
		expect(title.textContent).toBe("Support Center")
		expect(iframe.title).toBe("Support Center")
		expect(mask.style.backgroundColor).toBe("rgba(1, 2, 3, 0.4)")
		expect(panel.style.backgroundColor).toBe("rgb(1, 2, 3)")
		expect(header.style.borderBottomColor).toBe("rgb(4, 5, 6)")
		expect(iframe.style.backgroundColor).toBe("rgb(7, 8, 9)")
	})

	it("uses the latest locally updated config when the iframe first opens", async () => {
		const widget = createMagicWidgetController()
		appendWidgetScript("https://widget-app.example.invalid/sdk/magic-widget.js")

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-latest-config" },
			config: {
				layout: "desktop",
				responsive: { mobileDetection: "viewport" },
				conversation: { projectFiles: true },
			},
		})
		await widget.updateConfig({
			shell: { appSidebar: false },
			responsive: { mobileDetection: "device-and-viewport" },
			conversation: { projectFiles: false, topicHistory: true },
		})
		widget.open()

		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const config = JSON.parse(
			new URL(iframe.src).searchParams.get("magicWidgetConfig") ?? "null",
		)
		expect(config).toEqual({
			layout: "desktop",
			shell: { appSidebar: false },
			responsive: { mobileDetection: "device-and-viewport" },
			conversation: { projectFiles: false, topicHistory: true },
		})
		widget.destroy()
	})

	it("updates a loaded iframe without changing its URL", async () => {
		const widget = createMagicWidgetController()
		appendWidgetScript("https://widget-app.example.invalid/sdk/magic-widget.js")
		const target = document.createElement("div")
		document.body.append(target)

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-runtime-config" },
			target,
			config: { layout: "desktop" },
		})
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const postMessage = vi.fn()
		const frameWindow = { postMessage } as unknown as Window
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: frameWindow,
		})
		const initialSrc = iframe.src
		iframe.dispatchEvent(new Event("load"))
		dispatchConfigReady(iframe, frameWindow, "https://widget-app.example.invalid")
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalled())
		respondToConfig(
			frameWindow,
			"https://widget-app.example.invalid",
			postMessage.mock.calls[0]?.[0] as Record<string, unknown>,
		)
		await Promise.resolve()
		postMessage.mockClear()

		const updatePromise = widget.updateConfig({
			shell: { appSidebar: false },
			conversation: { projectFiles: false, topicHistory: true },
		})
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalled())
		const configMessage = postMessage.mock.calls[0]?.[0] as {
			protocol: string
			version: number
			instanceId: string
			requestId: string
			config: unknown
		}
		expect(configMessage.config).toEqual({
			layout: "desktop",
			responsive: { mobileDetection: "viewport" },
			shell: { appSidebar: false },
			conversation: { projectFiles: false, topicHistory: true },
		})

		respondToConfig(frameWindow, "https://widget-app.example.invalid", configMessage)

		await expect(updatePromise).resolves.toBeUndefined()
		expect(iframe.src).toBe(initialSrc)
		widget.destroy()
	})

	it("sends the complete custom Mention group snapshot after config_ready", async () => {
		const widget = createMagicWidgetController()
		appendWidgetScript("https://widget-app.example.invalid/sdk/magic-widget.js")
		const target = document.createElement("div")
		document.body.append(target)
		widget.mount({
			page: { type: "crew", crewId: "crew-mock-custom-groups" },
			target,
			config: {
				layout: "desktop",
				panel: {
					customGroups: [
						{
							id: "charts",
							label: "Charts",
							items: [{ id: "chart-a", type: "chart", text: "Chart A" }],
						},
					],
				},
			},
		})
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const postMessage = vi.fn()
		const frameWindow = { postMessage } as unknown as Window
		Object.defineProperty(iframe, "contentWindow", { configurable: true, value: frameWindow })
		const initialSrc = iframe.src
		const initialConfig = JSON.parse(
			new URL(initialSrc).searchParams.get("magicWidgetConfig") ?? "null",
		)
		expect(initialConfig.panel?.customGroups).toBeUndefined()
		iframe.dispatchEvent(new Event("load"))
		dispatchConfigReady(iframe, frameWindow, "https://widget-app.example.invalid")
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalled())
		respondToConfig(
			frameWindow,
			"https://widget-app.example.invalid",
			postMessage.mock.calls[0]?.[0] as Record<string, unknown>,
		)
		postMessage.mockClear()

		const updatePromise = widget.updateConfig({
			panel: {
				customGroups: [
					{
						id: "charts",
						label: "Updated charts",
						items: [{ id: "chart-b", type: "chart", text: "Chart B" }],
					},
				],
			},
		})
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalled())
		const configMessage = postMessage.mock.calls[0]?.[0] as { config: MagicWidget.WidgetConfig }
		expect(configMessage.config.panel?.customGroups).toEqual([
			{
				id: "charts",
				label: "Updated charts",
				items: [{ id: "chart-b", type: "chart", text: "Chart B" }],
			},
		])
		respondToConfig(
			frameWindow,
			"https://widget-app.example.invalid",
			postMessage.mock.calls[0]?.[0] as Record<string, unknown>,
		)
		await expect(updatePromise).resolves.toBeUndefined()
		expect(iframe.src).toBe(initialSrc)
		widget.destroy()
	})

	it("resynchronizes the latest runtime config after iframe reload without changing its URL", async () => {
		const origin = "https://widget-app.example.invalid"
		const widget = createMagicWidgetController()
		appendWidgetScript(`${origin}/sdk/magic-widget.js`)
		const target = document.createElement("div")
		document.body.append(target)

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-reload-config" },
			target,
			config: { layout: "desktop" },
		})
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const postMessage = vi.fn()
		const frameWindow = { postMessage } as unknown as Window
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: frameWindow,
		})
		const initialSrc = iframe.src

		iframe.dispatchEvent(new Event("load"))
		dispatchConfigReady(iframe, frameWindow, origin)
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1))
		respondToConfig(frameWindow, origin, postMessage.mock.calls[0]?.[0])
		postMessage.mockClear()

		const updatePromise = widget.updateConfig({ layout: "mobile" })
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1))
		const runtimeMessage = postMessage.mock.calls[0]?.[0] as Record<string, unknown>
		expect(runtimeMessage.config).toEqual({
			layout: "mobile",
			responsive: { mobileDetection: "viewport" },
		})
		respondToConfig(frameWindow, origin, runtimeMessage)
		await expect(updatePromise).resolves.toBeUndefined()
		postMessage.mockClear()

		iframe.dispatchEvent(new Event("load"))
		dispatchConfigReady(iframe, frameWindow, origin)
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1))
		const reloadMessage = postMessage.mock.calls[0]?.[0] as Record<string, unknown>
		expect(reloadMessage.config).toEqual({
			layout: "mobile",
			responsive: { mobileDetection: "viewport" },
		})
		expect(iframe.src).toBe(initialSrc)
		respondToConfig(frameWindow, origin, reloadMessage)
		widget.destroy()
	})

	it("rejects invalid runtime config without opening the iframe", async () => {
		const widget = createMagicWidgetController()
		appendWidgetScript("https://widget-app.example.invalid/sdk/magic-widget.js")
		widget.mount({ page: { type: "crew", crewId: "crew-mock-invalid-config" } })

		await expect(widget.updateConfig({ layout: "tablet" } as never)).rejects.toMatchObject({
			code: "INVALID_CONFIG",
		})
		const iframe = document
			.querySelector("[data-magic-widget-root]")
			?.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		expect(iframe.getAttribute("src")).toBeNull()
		widget.destroy()
	})

	it("filters oversized custom Mention updates and keeps the widget rendered", async () => {
		const widget = createMagicWidgetController()
		const warnings: MagicWidget.ConfigWarning[] = []
		const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		appendWidgetScript("https://widget-app.example.invalid/sdk/magic-widget.js")
		widget.mount({ page: { type: "crew", crewId: "crew-mock-filtered-config" } })
		widget.on("config.warning", (warning) => warnings.push(warning))

		await expect(
			widget.updateConfig({
				panel: {
					customGroups: [
						{
							id: "fixture-group",
							label: "Fixture group",
							items: Array.from({ length: 1_001 }, (_, index) => ({
								id: `fixture-item-${index}`,
								type: "fixture",
								text: `Fixture ${index}`,
							})),
						},
					],
				},
			}),
		).resolves.toBeUndefined()
		expect(warnings).toEqual([
			expect.objectContaining({
				code: "CUSTOM_MENTION_FILTERED",
				details: expect.objectContaining({
					droppedItems: 1,
					reasons: ["MAX_ITEMS_PER_GROUP"],
				}),
			}),
		])
		expect(document.querySelector("[data-magic-widget-root]")).not.toBeNull()
		expect(consoleWarning).toHaveBeenCalledOnce()
		widget.destroy()
	})

	it("publishes preview fullscreen state without changing host layout", async () => {
		const origin = "https://widget-preview.example.invalid"
		const widget = createMagicWidgetController()
		appendWidgetScript(`${origin}/sdk/magic-widget.js`)
		const target = document.createElement("div")
		document.body.append(target)

		widget.mount({
			page: { type: "crew", crewId: "crew-mock-fullscreen-preview" },
			target,
		})
		const root = document.querySelector("[data-magic-widget-root]") as HTMLElement
		const iframe = root.shadowRoot?.querySelector("iframe") as HTMLIFrameElement
		const postMessage = vi.fn()
		const frameWindow = { postMessage } as unknown as Window
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: frameWindow,
		})
		const previewStates: boolean[] = []
		widget.on("preview_fullscreen", (isFullscreen) => previewStates.push(isFullscreen))

		dispatchPreviewFullscreen(iframe, frameWindow, origin, true)
		dispatchPreviewFullscreen(iframe, frameWindow, origin, true)

		dispatchPreviewFullscreen(iframe, frameWindow, origin, false)

		expect(previewStates).toEqual([false, true, false])
		expect(root.shadowRoot?.querySelector("iframe")).toBe(iframe)
		expect(document.querySelectorAll("dialog")).toHaveLength(0)
		expect(document.documentElement.style.overflow).toBe("")
		expect(document.body.style.overflow).toBe("")
		widget.destroy()
	})
})
