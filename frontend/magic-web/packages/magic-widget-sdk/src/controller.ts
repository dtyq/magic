import { widgetStyles } from "./styles"
import type { MagicWidget } from "./types"
import { getWidgetScriptOrigin } from "./scriptOrigin"
import { buildWidgetIframeUrl, validateWidgetMountOptions } from "./url"
import { WidgetBridge, createWidgetCommandError, createWidgetId } from "./bridge"
import { mergeWidgetConfig, resolveInitialWidgetConfig } from "./config"
import { isWidgetInputContent } from "./protocol"

const ROOT_ATTRIBUTE = "data-magic-widget-root"
const TRIGGER_ATTRIBUTE = "data-magic-widget-trigger"
const PANEL_LAYER_ATTRIBUTE = "data-magic-widget-panel-layer"
const PANEL_MASK_ATTRIBUTE = "data-magic-widget-mask"
const PANEL_ATTRIBUTE = "data-magic-widget-panel"
const DEFAULT_Z_INDEX = 2147483000
const DRAG_THRESHOLD = 3
const PANEL_CLOSE_ANIMATION_MS = 180
const PANEL_MARGIN = 16
const DEFAULT_PANEL_WIDTH = 420
const DEFAULT_PANEL_HEIGHT = 680
const PANEL_OPEN_ANIMATION_MS = 180
const initialWidgetScriptOrigin =
	typeof document === "undefined" ? null : getWidgetScriptOrigin(document)

type DragKind = "trigger" | "panel"

interface DragState {
	kind: DragKind
	target: HTMLElement
	startX: number
	startY: number
	startLeft: number
	startTop: number
	currentLeft: number
	currentTop: number
	deltaX: number
	deltaY: number
	width: number
	height: number
	hasMoved: boolean
	animationFrame: number | null
}

function toCssSize(value: number | string | undefined) {
	if (value === undefined) return undefined
	return typeof value === "number" ? `${value}px` : value
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

function setHostVariables(host: HTMLElement, options: MagicWidget.MountOptions) {
	host.style.setProperty("--magic-widget-z-index", String(DEFAULT_Z_INDEX))
	host.style.setProperty(
		"--magic-widget-panel-width",
		toCssSize(options.modal?.width) ?? "min(420px, calc(100vw - 32px))",
	)
	host.style.setProperty(
		"--magic-widget-panel-height",
		toCssSize(options.modal?.height) ?? "min(680px, calc(100vh - 32px))",
	)
}

function appendClassName(element: HTMLElement, className: string | undefined) {
	if (!className) return
	element.className = `${element.className} ${className}`.trim()
}

function applyStyleMap(
	element: HTMLElement,
	styles: Record<string, string | number | null | undefined> | undefined,
) {
	if (!styles) return

	Object.entries(styles).forEach(([property, value]) => {
		if (value === null || value === undefined) return
		const normalizedValue = String(value)

		if (property.startsWith("--") || property.includes("-")) {
			element.style.setProperty(property, normalizedValue)
			return
		}

		element.style.setProperty(
			property.replace(/[A-Z]/g, (item) => `-${item.toLowerCase()}`),
			normalizedValue,
		)
	})
}

function applyModalSlotOptions(
	element: HTMLElement,
	options: MagicWidget.MountOptions,
	slot: MagicWidget.ModalSlot,
) {
	appendClassName(element, options.modal?.classNames?.[slot])
	applyStyleMap(element, options.modal?.styles?.[slot])
}

function requireDocument() {
	if (typeof document === "undefined") {
		throw new Error("Magic widget can only be mounted in a browser document")
	}
}

function isMobileViewport() {
	if (typeof window.matchMedia === "function") {
		return window.matchMedia("(max-width: 640px)").matches
	}
	return window.innerWidth <= 640
}

function getPanelSizeValue(value: number | string | undefined, fallback: number, max: number) {
	if (typeof value === "number") return Math.min(value, max)
	return Math.min(fallback, max)
}

function createMessageIcon() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	svg.setAttribute("viewBox", "0 0 24 24")
	svg.setAttribute("fill", "none")
	svg.setAttribute("aria-hidden", "true")
	svg.setAttribute("data-magic-widget-trigger-icon", "")

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
	path.setAttribute(
		"d",
		"M5.5 7.5C5.5 6.12 6.62 5 8 5h8c1.38 0 2.5 1.12 2.5 2.5v5c0 1.38-1.12 2.5-2.5 2.5h-4.4l-3.42 3.02c-.64.56-1.68.11-1.68-.74V15H8c-1.38 0-2.5-1.12-2.5-2.5v-5Z",
	)
	path.setAttribute("stroke", "currentColor")
	path.setAttribute("stroke-width", "1.8")
	path.setAttribute("stroke-linejoin", "round")

	const dotA = document.createElementNS("http://www.w3.org/2000/svg", "path")
	dotA.setAttribute("d", "M9 10h.01")
	dotA.setAttribute("stroke", "currentColor")
	dotA.setAttribute("stroke-width", "2.4")
	dotA.setAttribute("stroke-linecap", "round")

	const dotB = document.createElementNS("http://www.w3.org/2000/svg", "path")
	dotB.setAttribute("d", "M12 10h.01")
	dotB.setAttribute("stroke", "currentColor")
	dotB.setAttribute("stroke-width", "2.4")
	dotB.setAttribute("stroke-linecap", "round")

	const dotC = document.createElementNS("http://www.w3.org/2000/svg", "path")
	dotC.setAttribute("d", "M15 10h.01")
	dotC.setAttribute("stroke", "currentColor")
	dotC.setAttribute("stroke-width", "2.4")
	dotC.setAttribute("stroke-linecap", "round")

	svg.append(path, dotA, dotB, dotC)
	return svg
}

function createCloseIcon() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	svg.setAttribute("viewBox", "0 0 24 24")
	svg.setAttribute("fill", "none")
	svg.setAttribute("aria-hidden", "true")
	svg.setAttribute("data-magic-widget-close-icon", "")

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
	path.setAttribute("d", "M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5")
	path.setAttribute("stroke", "currentColor")
	path.setAttribute("stroke-width", "1.9")
	path.setAttribute("stroke-linecap", "round")
	path.setAttribute("stroke-linejoin", "round")

	svg.append(path)
	return svg
}

export function createMagicWidgetController(): MagicWidget.Controller {
	let options: MagicWidget.MountOptions | null = null
	let root: HTMLElement | null = null
	let shadowRoot: ShadowRoot | null = null
	let trigger: HTMLButtonElement | null = null
	let modal: HTMLElement | null = null
	let mask: HTMLElement | null = null
	let panel: HTMLElement | null = null
	let iframe: HTMLIFrameElement | null = null
	let dragState: DragState | null = null
	let suppressNextClick = false
	let closeTimer: number | null = null
	let openTimer: number | null = null
	let bridge: WidgetBridge | null = null
	let instanceId: string | null = null
	let appOrigin: string | null = null
	let inlineMode = false
	let currentConfig: MagicWidget.WidgetConfig = {}
	let confirmedConfig: MagicWidget.WidgetConfig = {}
	let configUpdateQueue: Promise<void> = Promise.resolve()
	let previewFullscreen = false
	let lifecycleId = 0
	const agentReadyListeners = new Set<MagicWidget.AgentReadyEventListener>()
	const previewFullscreenListeners = new Set<MagicWidget.PreviewFullscreenEventListener>()
	const messageStreamStartedListeners = new Set<
		MagicWidget.RuntimeEventListener<"message.stream.started">
	>()
	const toolCallSettledListeners = new Set<MagicWidget.RuntimeEventListener<"toolCall.settled">>()
	const taskCompletedListeners = new Set<MagicWidget.RuntimeEventListener<"task.completed">>()
	const configWarningListeners = new Set<MagicWidget.ConfigWarningEventListener>()

	/** Notifies host subscribers whenever the current iframe editor becomes usable. */
	const notifyAgentReady = () => {
		agentReadyListeners.forEach((listener) => {
			try {
				listener()
			} catch (error) {
				console.error("Magic widget agent_ready listener failed", error)
			}
		})
	}

	/** Routes one validated runtime event to host listeners registered for its exact type. */
	const notifyRuntimeEvent = (event: MagicWidget.RuntimeEvent) => {
		if (event.type === "message.stream.started") {
			messageStreamStartedListeners.forEach((listener) => {
				try {
					listener(event)
				} catch (error) {
					console.error("Magic widget message.stream.started listener failed", error)
				}
			})
			return
		}
		if (event.type === "toolCall.settled") {
			toolCallSettledListeners.forEach((listener) => {
				try {
					listener(event)
				} catch (error) {
					console.error("Magic widget toolCall.settled listener failed", error)
				}
			})
			return
		}

		taskCompletedListeners.forEach((listener) => {
			try {
				listener(event)
			} catch (error) {
				console.error("Magic widget task.completed listener failed", error)
			}
		})
	}

	/** Surfaces one non-fatal config adjustment without allowing host listeners to stop rendering. */
	const notifyConfigWarning = (warning: MagicWidget.ConfigWarning) => {
		console.warn(`Magic widget: ${warning.message}`, warning.details)
		configWarningListeners.forEach((listener) => {
			try {
				listener(warning)
			} catch (error) {
				console.error("Magic widget config.warning listener failed", error)
			}
		})
	}

	const commitPanelDragPosition = (state: DragState) => {
		state.target.style.left = `${state.currentLeft}px`
		state.target.style.top = `${state.currentTop}px`
		state.target.style.right = "auto"
		state.target.style.bottom = "auto"
		state.target.style.transform = ""
	}

	const clearOpenTimer = () => {
		if (openTimer === null) return
		window.clearTimeout(openTimer)
		openTimer = null
	}

	const releasePanelEnterAnimation = () => {
		clearOpenTimer()
		if (modal?.getAttribute("data-state") === "opening") {
			modal.setAttribute("data-state", "open")
		}
	}

	const restoreIframePointerEvents = () => {
		iframe?.style.removeProperty("pointer-events")
	}

	const restorePanelDraggingState = () => {
		panel?.removeAttribute("data-dragging")
	}

	const stopDragging = () => {
		if (dragState && dragState.animationFrame !== null) {
			window.cancelAnimationFrame(dragState.animationFrame)
		}
		restoreIframePointerEvents()
		restorePanelDraggingState()
		window.removeEventListener("pointermove", onPointerMove)
		window.removeEventListener("pointerup", onPointerUp)
		dragState = null
	}

	const schedulePanelDragFrame = () => {
		if (!dragState || dragState.kind !== "panel" || dragState.animationFrame !== null) return

		dragState.animationFrame = window.requestAnimationFrame(() => {
			if (!dragState || dragState.kind !== "panel") return
			dragState.animationFrame = null
			dragState.target.style.transform = `translate3d(${dragState.deltaX}px, ${dragState.deltaY}px, 0)`
		})
	}

	const onPointerMove = (event: Event) => {
		if (!dragState) return

		const pointerEvent = event as MouseEvent
		const rawNextLeft = dragState.startLeft + pointerEvent.clientX - dragState.startX
		const rawNextTop = dragState.startTop + pointerEvent.clientY - dragState.startY
		const movedX = Math.abs(pointerEvent.clientX - dragState.startX)
		const movedY = Math.abs(pointerEvent.clientY - dragState.startY)

		if (movedX > DRAG_THRESHOLD || movedY > DRAG_THRESHOLD) {
			dragState.hasMoved = true
		}

		if (!dragState.hasMoved) return

		const maxLeft = window.innerWidth - dragState.width
		const maxTop = window.innerHeight - dragState.height
		const nextLeft = clamp(rawNextLeft, 0, maxLeft)
		const nextTop = clamp(rawNextTop, 0, maxTop)

		dragState.currentLeft = nextLeft
		dragState.currentTop = nextTop

		if (dragState.kind === "panel") {
			dragState.deltaX = nextLeft - dragState.startLeft
			dragState.deltaY = nextTop - dragState.startTop
			schedulePanelDragFrame()
			event.preventDefault()
			return
		}

		dragState.target.style.left = `${nextLeft}px`
		dragState.target.style.top = `${nextTop}px`
		dragState.target.style.right = "auto"
		dragState.target.style.bottom = "auto"
		event.preventDefault()
	}

	const onPointerUp = () => {
		const state = dragState

		if (state?.kind === "panel" && state.hasMoved) {
			if (state.animationFrame !== null) {
				window.cancelAnimationFrame(state.animationFrame)
				state.animationFrame = null
			}
			commitPanelDragPosition(state)
		}

		if (state?.kind === "trigger" && state.hasMoved) {
			// Browsers dispatch a click after pointerup; suppress it so a drag does not open the modal.
			suppressNextClick = true
			window.setTimeout(() => {
				suppressNextClick = false
			}, 0)
		}
		stopDragging()
	}

	const startDrag = (event: Event, target: HTMLElement, kind: DragKind) => {
		const pointerEvent = event as MouseEvent
		if ("button" in pointerEvent && pointerEvent.button !== 0) return

		const rect = target.getBoundingClientRect()
		dragState = {
			kind,
			target,
			startX: pointerEvent.clientX,
			startY: pointerEvent.clientY,
			startLeft: rect.left,
			startTop: rect.top,
			currentLeft: rect.left,
			currentTop: rect.top,
			deltaX: 0,
			deltaY: 0,
			width: rect.width,
			height: rect.height,
			hasMoved: false,
			animationFrame: null,
		}

		// During panel drags, iframe hit-testing would otherwise steal pointer events from the host page.
		if (kind === "panel") {
			releasePanelEnterAnimation()
			target.setAttribute("data-dragging", "true")
			iframe?.style.setProperty("pointer-events", "none")
		}

		window.addEventListener("pointermove", onPointerMove)
		window.addEventListener("pointerup", onPointerUp)
	}

	const onPointerDown = (event: Event) => {
		if (!trigger) return
		startDrag(event, trigger, "trigger")
	}

	const onPanelPointerDown = (event: Event) => {
		if (!panel || isMobileViewport()) return
		startDrag(event, panel, "panel")
	}

	const clampTriggerToViewport = () => {
		if (!trigger) return

		const rect = trigger.getBoundingClientRect()
		if (rect.width === 0 && rect.height === 0) return

		const nextLeft = clamp(rect.left, 0, Math.max(0, window.innerWidth - rect.width))
		const nextTop = clamp(rect.top, 0, Math.max(0, window.innerHeight - rect.height))

		if (nextLeft === rect.left && nextTop === rect.top) return

		trigger.style.left = `${nextLeft}px`
		trigger.style.top = `${nextTop}px`
		trigger.style.right = "auto"
		trigger.style.bottom = "auto"
	}

	const clampPanelToViewport = () => {
		if (!modal || !panel || modal.hidden) return

		if (isMobileViewport()) {
			positionPanel()
			return
		}

		if (modal.getAttribute("data-mode") !== "desktop") {
			positionPanel()
			return
		}

		const rect = panel.getBoundingClientRect()
		if (rect.width === 0 && rect.height === 0) return

		const nextLeft = clamp(rect.left, 0, Math.max(0, window.innerWidth - rect.width))
		const nextTop = clamp(rect.top, 0, Math.max(0, window.innerHeight - rect.height))

		if (nextLeft === rect.left && nextTop === rect.top) return

		panel.style.left = `${nextLeft}px`
		panel.style.top = `${nextTop}px`
		panel.style.right = "auto"
		panel.style.bottom = "auto"
		panel.style.transform = ""
	}

	const onWindowResize = () => {
		clampTriggerToViewport()
		clampPanelToViewport()
	}

	const clearCloseTimer = () => {
		if (closeTimer === null) return
		window.clearTimeout(closeTimer)
		closeTimer = null
	}

	/** Publishes the validated iframe preview state for the embedding host to style. */
	const setPreviewFullscreen = (isFullscreen: boolean) => {
		if (previewFullscreen === isFullscreen) return
		previewFullscreen = isFullscreen
		previewFullscreenListeners.forEach((listener) => listener(isFullscreen))
	}

	/** Requests the iframe to dismiss its preview before the host shell restores. */
	const requestPreviewDismiss = () => {
		if (!previewFullscreen || !iframe?.contentWindow || !instanceId || !appOrigin) return
		iframe.contentWindow.postMessage(
			{
				protocol: "magic-widget",
				version: 1,
				instanceId,
				type: "ui_command",
				command: "dismiss_preview",
			},
			appOrigin,
		)
	}

	const close = () => {
		if (!modal) return
		requestPreviewDismiss()
		setPreviewFullscreen(false)
		if (inlineMode) {
			modal.hidden = true
			modal.setAttribute("data-state", "closed")
			return
		}
		clearOpenTimer()
		clearCloseTimer()
		modal.setAttribute("data-state", "closing")
		window.removeEventListener("keydown", onKeyDown)
		closeTimer = window.setTimeout(() => {
			if (!modal) return
			modal.hidden = true
			modal.setAttribute("data-state", "closed")
			if (trigger) {
				trigger.hidden = false
				clampTriggerToViewport()
			}
			closeTimer = null
		}, PANEL_CLOSE_ANIMATION_MS)
	}

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			close()
		}
	}

	const ensureMounted = () => {
		if (!options) throw new Error("Magic widget must be mounted before calling open")
		if (!root || !shadowRoot || !modal || !iframe) {
			throw new Error("Magic widget mount failed")
		}
	}

	const positionPanel = () => {
		if (!trigger || !panel || !modal || !options) return

		if (isMobileViewport()) {
			modal.setAttribute("data-mode", "mobile")
			panel.style.left = ""
			panel.style.top = ""
			panel.style.right = ""
			panel.style.bottom = ""
			panel.style.transform = ""
			panel.style.transformOrigin = ""
			return
		}

		modal.setAttribute("data-mode", "desktop")

		const triggerRect = trigger.getBoundingClientRect()
		const panelWidth = getPanelSizeValue(
			options.modal?.width,
			DEFAULT_PANEL_WIDTH,
			window.innerWidth - PANEL_MARGIN * 2,
		)
		const panelHeight = getPanelSizeValue(
			options.modal?.height,
			DEFAULT_PANEL_HEIGHT,
			window.innerHeight - PANEL_MARGIN * 2,
		)

		const preferredLeft = triggerRect.right - panelWidth
		const preferredTop = triggerRect.bottom - panelHeight
		const left = clamp(
			preferredLeft,
			PANEL_MARGIN,
			window.innerWidth - panelWidth - PANEL_MARGIN,
		)
		const top = clamp(
			preferredTop,
			PANEL_MARGIN,
			window.innerHeight - panelHeight - PANEL_MARGIN,
		)
		const originX = triggerRect.left + triggerRect.width / 2 - left
		const originY = triggerRect.top + triggerRect.height / 2 - top

		panel.style.left = `${left}px`
		panel.style.top = `${top}px`
		panel.style.transform = ""
		panel.style.transformOrigin = `${originX}px ${originY}px`
	}

	const open = () => {
		ensureMounted()
		if (!options || !modal || !iframe) return

		if (!iframe.src || iframe.src === "about:blank") {
			bridge?.reset()
			iframe.src = buildWidgetIframeUrl(options, {
				fallbackAppOrigin: appOrigin,
				instanceId: instanceId ?? undefined,
				hostOrigin: window.location.origin,
				renderMode: inlineMode ? "inline" : "floating",
			}).toString()
		}
		if (inlineMode) {
			modal.hidden = false
			modal.setAttribute("data-state", "open")
			return
		}
		clearOpenTimer()
		clearCloseTimer()
		positionPanel()
		modal.hidden = false
		modal.setAttribute("data-state", "opening")
		openTimer = window.setTimeout(() => {
			if (!modal) return
			modal.setAttribute("data-state", "open")
			openTimer = null
		}, PANEL_OPEN_ANIMATION_MS)
		if (trigger) {
			trigger.hidden = true
		}
		window.addEventListener("keydown", onKeyDown)
	}

	const destroy = () => {
		lifecycleId += 1
		setPreviewFullscreen(false)
		clearOpenTimer()
		clearCloseTimer()
		stopDragging()
		window.removeEventListener("keydown", onKeyDown)
		window.removeEventListener("resize", onWindowResize)
		bridge?.destroy()
		root?.remove()
		options = null
		root = null
		shadowRoot = null
		trigger = null
		modal = null
		mask = null
		panel = null
		iframe = null
		bridge = null
		instanceId = null
		appOrigin = null
		inlineMode = false
		currentConfig = {}
		confirmedConfig = {}
		configUpdateQueue = Promise.resolve()
	}

	/** Validates public command content before it crosses into the iframe. */
	const normalizeCommandContent = (content: unknown): string | MagicWidget.InputContent => {
		if (typeof content === "string") {
			if (content.trim()) return content
			throw createWidgetCommandError(
				"INVALID_INPUT",
				"Magic widget command content must be a non-empty string",
			)
		}
		if (!isWidgetInputContent(content)) {
			throw createWidgetCommandError(
				"INVALID_INPUT",
				"Magic widget command content must use valid text and mention blocks",
			)
		}

		return content
	}

	/** Opens a floating widget when necessary and forwards one public content command. */
	const sendContentCommand = async (
		command: "setInput" | "appendInput" | "sendMessage",
		content: unknown,
	): Promise<void> => {
		if (!options || !bridge || !iframe) {
			throw createWidgetCommandError("NOT_MOUNTED", "Magic widget must be mounted first")
		}
		const normalizedContent = normalizeCommandContent(content)
		if (iframe.src === "about:blank" || !iframe.src) open()
		await bridge.send(command, { content: normalizedContent })
	}

	/** Sends a command that does not carry text while preserving the shared readiness wait. */
	const sendNoPayloadCommand = async (
		command: "clearInput" | "getInput" | "sendMessage" | "newConversation",
	): Promise<{ content?: string } | undefined> => {
		if (!options || !bridge || !iframe) {
			throw createWidgetCommandError("NOT_MOUNTED", "Magic widget must be mounted first")
		}
		if (iframe.src === "about:blank" || !iframe.src) open()
		return bridge.send(command)
	}

	/** Subscribes to public lifecycle, UI state, and runtime events. */
	const on = (
		event: MagicWidget.EventName,
		listener:
			| MagicWidget.AgentReadyEventListener
			| MagicWidget.PreviewFullscreenEventListener
			| MagicWidget.ConfigWarningEventListener
			| MagicWidget.RuntimeEventListener<"message.stream.started">
			| MagicWidget.RuntimeEventListener<"toolCall.settled">
			| MagicWidget.RuntimeEventListener<"task.completed">,
	) => {
		if (typeof listener !== "function") {
			throw new TypeError("Magic widget event listener must be a function")
		}
		if (event === "agent_ready") {
			agentReadyListeners.add(listener as MagicWidget.AgentReadyEventListener)
			if (bridge?.isReady())
				window.queueMicrotask(listener as MagicWidget.AgentReadyEventListener)
			return () => agentReadyListeners.delete(listener as MagicWidget.AgentReadyEventListener)
		}
		if (event === "preview_fullscreen") {
			const previewListener = listener as MagicWidget.PreviewFullscreenEventListener
			previewFullscreenListeners.add(previewListener)
			// Replay the current preview state synchronously so hosts can apply layout before the next paint.
			previewListener(previewFullscreen)
			return () => previewFullscreenListeners.delete(previewListener)
		}
		if (event === "config.warning") {
			const warningListener = listener as MagicWidget.ConfigWarningEventListener
			configWarningListeners.add(warningListener)
			return () => configWarningListeners.delete(warningListener)
		}
		if (event === "message.stream.started") {
			const runtimeListener =
				listener as MagicWidget.RuntimeEventListener<"message.stream.started">
			messageStreamStartedListeners.add(runtimeListener)
			return () => messageStreamStartedListeners.delete(runtimeListener)
		}
		if (event === "toolCall.settled") {
			const runtimeListener = listener as MagicWidget.RuntimeEventListener<"toolCall.settled">
			toolCallSettledListeners.add(runtimeListener)
			return () => toolCallSettledListeners.delete(runtimeListener)
		}
		if (event === "task.completed") {
			const runtimeListener = listener as MagicWidget.RuntimeEventListener<"task.completed">
			taskCompletedListeners.add(runtimeListener)
			return () => taskCompletedListeners.delete(runtimeListener)
		}

		throw new TypeError("Magic widget event name is not supported")
	}

	/** Applies one serialized configuration update while preserving iframe and conversation state. */
	const updateConfig = (update: Partial<MagicWidget.WidgetConfig>): Promise<void> => {
		if (!options || !bridge || !iframe) {
			return Promise.reject(
				createWidgetCommandError("NOT_MOUNTED", "Magic widget must be mounted first"),
			)
		}

		const updateLifecycleId = lifecycleId
		const task = configUpdateQueue.then(async () => {
			if (!options || !bridge || !iframe || lifecycleId !== updateLifecycleId) {
				throw createWidgetCommandError("DESTROYED", "Magic widget was destroyed")
			}

			let configWarning: MagicWidget.ConfigWarning | undefined
			const nextConfig = mergeWidgetConfig(currentConfig, update, (warning) => {
				configWarning = warning
			})
			currentConfig = nextConfig
			options = { ...options, config: nextConfig }

			// A closed or still-loading iframe consumes the latest snapshot from its initial URL or load sync.
			if (!bridge.isIframeLoaded()) {
				confirmedConfig = nextConfig
				if (configWarning) notifyConfigWarning(configWarning)
				return
			}

			try {
				const providerWarning = await bridge.sendConfig(nextConfig)
				if (lifecycleId !== updateLifecycleId) {
					throw createWidgetCommandError("DESTROYED", "Magic widget was destroyed")
				}
				confirmedConfig = nextConfig
				if (configWarning) notifyConfigWarning(configWarning)
				if (providerWarning) notifyConfigWarning(providerWarning)
			} catch (error) {
				if (lifecycleId === updateLifecycleId && options) {
					currentConfig = confirmedConfig
					options = { ...options, config: confirmedConfig }
				}
				throw error
			}
		})

		// Keep later updates serialized even when one caller observes a rejected request.
		configUpdateQueue = task.catch(() => undefined)
		return task
	}

	const mount = (nextOptions: MagicWidget.MountOptions) => {
		requireDocument()
		validateWidgetMountOptions(nextOptions)
		let initialConfigWarning: MagicWidget.ConfigWarning | undefined
		const initialConfig = resolveInitialWidgetConfig(nextOptions.config, (warning) => {
			initialConfigWarning = warning
		})
		destroy()
		if (
			nextOptions.target &&
			(!nextOptions.target.isConnected || !document.contains(nextOptions.target))
		) {
			throw new Error("Magic widget target must be connected to the document")
		}
		options = { ...nextOptions, config: initialConfig }
		currentConfig = initialConfig
		confirmedConfig = initialConfig
		inlineMode = Boolean(nextOptions.target)
		instanceId = createWidgetId("widget")
		appOrigin = initialWidgetScriptOrigin ?? getWidgetScriptOrigin()
		if (!appOrigin) throw new Error("Magic widget script origin is required")

		root = document.createElement("div")
		root.setAttribute(ROOT_ATTRIBUTE, "")
		if (inlineMode) {
			root.style.width = "100%"
			root.style.height = "100%"
		}
		setHostVariables(root, nextOptions)
		applyModalSlotOptions(root, nextOptions, "root")
		shadowRoot = root.attachShadow({ mode: "open" })

		const style = document.createElement("style")
		style.textContent = widgetStyles

		if (!inlineMode) {
			trigger = document.createElement("button")
			trigger.type = "button"
			trigger.className = "magic-widget-trigger"
			trigger.setAttribute(TRIGGER_ATTRIBUTE, "")
			trigger.setAttribute("aria-label", "Open Magic")
			trigger.append(createMessageIcon())
			trigger.addEventListener("pointerdown", onPointerDown)
			trigger.addEventListener("click", (event) => {
				if (suppressNextClick) {
					event.preventDefault()
					suppressNextClick = false
					return
				}
				open()
			})
			window.addEventListener("resize", onWindowResize)
		}

		modal = document.createElement("div")
		modal.className = "magic-widget-layer"
		modal.setAttribute(PANEL_LAYER_ATTRIBUTE, "")
		modal.setAttribute("data-state", "closed")
		modal.setAttribute("data-render-mode", inlineMode ? "inline" : "floating")
		modal.hidden = !inlineMode
		applyModalSlotOptions(modal, nextOptions, "layer")
		modal.addEventListener("click", (event) => {
			if (event.target === modal) close()
		})

		mask = document.createElement("div")
		mask.className = "magic-widget-mask"
		mask.setAttribute(PANEL_MASK_ATTRIBUTE, "")
		applyModalSlotOptions(mask, nextOptions, "mask")
		mask.addEventListener("click", close)

		panel = document.createElement("section")
		panel.className = "magic-widget-panel"
		panel.setAttribute(PANEL_ATTRIBUTE, "")
		if (!inlineMode) {
			panel.setAttribute("role", "dialog")
			panel.setAttribute("aria-modal", "true")
		}
		applyModalSlotOptions(panel, nextOptions, "container")

		const modalTitle = nextOptions.modal?.title ?? "Magic"

		const header = document.createElement("header")
		header.className = "magic-widget-header"
		applyModalSlotOptions(header, nextOptions, "header")
		header.addEventListener("pointerdown", onPanelPointerDown)

		const title = document.createElement("div")
		title.className = "magic-widget-title"
		title.textContent = modalTitle
		applyModalSlotOptions(title, nextOptions, "title")

		const closeButton = document.createElement("button")
		closeButton.type = "button"
		// window.closable only hides the iframe header button. This shell control stays in floating mode.
		closeButton.className = "magic-widget-close"
		closeButton.setAttribute("aria-label", "Close Magic")
		closeButton.append(createCloseIcon())
		applyModalSlotOptions(closeButton, nextOptions, "close")
		closeButton.addEventListener("click", close)

		header.append(title, closeButton)

		const body = document.createElement("div")
		body.className = "magic-widget-body"
		applyModalSlotOptions(body, nextOptions, "body")

		iframe = document.createElement("iframe")
		iframe.className = "magic-widget-iframe"
		iframe.title = modalTitle
		applyModalSlotOptions(iframe, nextOptions, "iframe")

		if (nextOptions.iframe?.allow) {
			iframe.setAttribute("allow", nextOptions.iframe.allow)
		}

		if (nextOptions.iframe?.sandbox) {
			iframe.setAttribute("sandbox", nextOptions.iframe.sandbox)
		}

		body.append(iframe)
		if (inlineMode) panel.append(body)
		else panel.append(header, body)
		if (inlineMode) modal.append(panel)
		else modal.append(mask, panel)
		if (trigger) shadowRoot.append(style, trigger, modal)
		else shadowRoot.append(style, modal)
		// Mount the widget root directly into the host target; fullscreen layout is controlled by the host.
		;(nextOptions.target ?? document.body).append(root)
		const configuredHeaderActions = nextOptions.headerActions ?? {}
		const headerActions = {
			...configuredHeaderActions,
			// Dismiss first, then notify. A callback failure must not keep the widget open.
			close: async (context: MagicWidget.HeaderActionContext) => {
				close()
				await configuredHeaderActions.close?.(context)
			},
		}
		bridge = new WidgetBridge(
			iframe,
			appOrigin,
			instanceId,
			headerActions,
			nextOptions.customMentionSearch,
		)
		bridge.onAgentReady(notifyAgentReady)
		bridge.onPreviewFullscreenChange(setPreviewFullscreen)
		bridge.onRuntimeEvent(notifyRuntimeEvent)
		bridge.onConfigReady(() => {
			if (!bridge || !options) return
			const loadLifecycleId = lifecycleId
			const snapshot = currentConfig
			// The initial query covers first paint; the explicit handshake avoids racing the Provider listener.
			void bridge
				.sendConfig(snapshot)
				.then((providerWarning) => {
					if (lifecycleId === loadLifecycleId && currentConfig === snapshot) {
						confirmedConfig = snapshot
					}
					if (providerWarning) notifyConfigWarning(providerWarning)
				})
				.catch(() => undefined)
		})
		if (inlineMode) open()
		if (initialConfigWarning) notifyConfigWarning(initialConfigWarning)
	}

	return {
		mount,
		open,
		close,
		destroy,
		on,
		setInput: (content) => sendContentCommand("setInput", content),
		appendInput: (content) => sendContentCommand("appendInput", content),
		clearInput: async () => {
			await sendNoPayloadCommand("clearInput")
		},
		getInput: async () => {
			const result = await sendNoPayloadCommand("getInput")
			if (typeof result?.content !== "string") {
				throw createWidgetCommandError(
					"COMMAND_FAILED",
					"Magic widget did not return the current input content",
				)
			}
			return result.content
		},
		sendMessage: async (content) => {
			if (content === undefined) {
				await sendNoPayloadCommand("sendMessage")
				return
			}
			await sendContentCommand("sendMessage", content)
		},
		newConversation: async () => {
			await sendNoPayloadCommand("newConversation")
		},
		updateConfig,
	}
}
