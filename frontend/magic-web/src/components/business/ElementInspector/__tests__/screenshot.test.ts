import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	htmlScreenshotLogger,
	HTML_SCREENSHOT_FALLBACK_EVENT,
	createCurrentTabCaptureSession,
	captureWithIframeRuntime,
	createPseudoElementsCapturePlugin,
	freezeDocumentForCapture,
	captureIframeRegion,
	getCaptureOutputSize,
	getCaptureRootRenderSize,
	getCaptureSurfaceGeometry,
	getRootCaptureSelection,
	resolveCaptureScreenSelection,
	resolveCurrentTabScreenSelection,
	resolveCaptureRoot,
	suppressCaptureCursor,
	shouldCaptureCurrentTab,
	shouldMaterializePseudoElement,
	shouldPrewarmCurrentTabCapture,
	supportsCurrentTabCapture,
	toBitmapCropSelection,
	toRenderedSelection,
	waitForCaptureVideoPlayback,
	waitForFreshCaptureVideoFrame,
	waitForStableCaptureRect,
} from "../screenshot"

function createDeferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

describe("HTML screenshot geometry", () => {
	it("suppresses cursors in host and iframe documents during capture", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeDocument = iframe.contentDocument
		if (!iframeDocument) throw new Error("Screenshot iframe document was not created")

		const hostTarget = document.createElement("div")
		hostTarget.style.cursor = "crosshair"
		document.body.appendChild(hostTarget)
		const iframeTarget = iframeDocument.createElement("div")
		iframeTarget.style.cursor = "text"
		iframeDocument.body.appendChild(iframeTarget)

		const restoreCursor = suppressCaptureCursor(iframe)

		try {
			const hostStyle = document.querySelector<HTMLStyleElement>(
				"style[data-element-inspector-capture-cursor]",
			)
			const iframeStyle = iframeDocument.querySelector<HTMLStyleElement>(
				"style[data-element-inspector-capture-cursor]",
			)

			expect(hostStyle?.textContent).toContain("cursor: none !important")
			expect(iframeStyle?.textContent).toContain("cursor: none !important")
		} finally {
			restoreCursor()
			expect(hostTarget.style.cursor).toBe("crosshair")
			expect(iframeTarget.style.cursor).toBe("text")
			iframe.remove()
			hostTarget.remove()
		}

		expect(document.querySelector("style[data-element-inspector-capture-cursor]")).toBeNull()
		expect(
			iframeDocument.querySelector("style[data-element-inspector-capture-cursor]"),
		).toBeNull()
	})

	it("detects whether rendered tab capture is available", () => {
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		try {
			Object.defineProperty(navigator, "mediaDevices", {
				configurable: true,
				value: { getDisplayMedia: vi.fn() },
			})
			expect(supportsCurrentTabCapture()).toBe(true)

			Object.defineProperty(navigator, "mediaDevices", {
				configurable: true,
				value: {},
			})
			expect(supportsCurrentTabCapture()).toBe(false)
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			}
		}
	})

	it("receives a cross-origin screenshot from the iframe runtime without display capture", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})

		const selection = { left: 12, top: 18, width: 80, height: 60 }
		const capture = captureWithIframeRuntime({
			iframe,
			selection,
			viewportSelection: {
				left: 100,
				top: 120,
				width: selection.width,
				height: selection.height,
			},
			iframeTargetOrigin: "https://husky.example.test",
		})
		const request = targetWindow.postMessage.mock.calls[0]?.[0]
		expect(request).toMatchObject({
			type: "MAGIC_INSPECTOR_SCREENSHOT_REQUEST",
			selection,
			outputSize: { width: 160, height: 120 },
			selector: undefined,
		})

		const event = new MessageEvent("message", {
			origin: "https://husky.example.test",
			data: {
				type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
				requestId: request.requestId,
				success: true,
				blob: new Blob(["png"], { type: "image/png" }),
			},
		})
		Object.defineProperty(event, "source", { configurable: true, value: targetWindow })
		window.dispatchEvent(event)

		await expect(capture).resolves.toMatch(/^data:image\/png;base64,/)
	})

	it("reports the iframe failure that causes current-tab fallback", async () => {
		const report = vi.spyOn(htmlScreenshotLogger, "report").mockImplementation(() => undefined)
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})

		const capture = captureWithIframeRuntime({
			iframe,
			selection: { left: 12, top: 18, width: 80, height: 60 },
			viewportSelection: { left: 100, top: 120, width: 80, height: 60 },
			iframeTargetOrigin: "https://husky.example.test",
		})
		const request = targetWindow.postMessage.mock.calls[0]?.[0]
		const response = new MessageEvent("message", {
			origin: "https://husky.example.test",
			data: {
				type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
				requestId: request.requestId,
				success: false,
				error: "Capture root has no size",
			},
		})
		Object.defineProperty(response, "source", { configurable: true, value: targetWindow })
		window.dispatchEvent(response)

		await expect(capture).resolves.toBeNull()
		expect(report).toHaveBeenCalledWith(
			HTML_SCREENSHOT_FALLBACK_EVENT,
			expect.objectContaining({
				reason: "Capture root has no size",
				requestId: request.requestId,
				stage: "iframe-runtime-failure",
				iframeTargetOrigin: "https://husky.example.test",
			}),
		)
		report.mockRestore()
	})

	it("does not request browser capture when authorization is cancelled", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		const getDisplayMedia = vi.fn()
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: { getDisplayMedia },
		})
		try {
			const authorization = vi.fn().mockResolvedValue(false)
			const capture = captureIframeRegion({
				iframe,
				selection: { left: 12, top: 18, width: 80, height: 60 },
				iframeTargetOrigin: "https://husky.example.test",
				requestCurrentTabCaptureAuthorization: authorization,
			})
			const request = targetWindow.postMessage.mock.calls[0]?.[0]
			const response = new MessageEvent("message", {
				origin: "https://husky.example.test",
				data: {
					type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
					requestId: request.requestId,
					success: false,
					error: "Capture root has no size",
				},
			})
			Object.defineProperty(response, "source", { configurable: true, value: targetWindow })
			window.dispatchEvent(response)

			await expect(capture).rejects.toMatchObject({ code: "cancelled" })
			expect(authorization).toHaveBeenCalledOnce()
			expect(getDisplayMedia).not.toHaveBeenCalled()
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			}
		}
	})

	it("prefers iframe runtime even when a live capture session already exists", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})
		const authorization = vi.fn()
		const currentTabSession = {
			acquire: vi.fn(() => new Promise<MediaStream>(() => undefined)),
			release: vi.fn(),
			hasLiveStream: () => true,
		}
		const selection = { left: 12, top: 18, width: 80, height: 60 }
		const capture = captureIframeRegion({
			iframe,
			selection,
			iframeTargetOrigin: "https://husky.example.test",
			currentTabSession,
			requestCurrentTabCaptureAuthorization: authorization,
			selector: "section.card",
		})
		const request = targetWindow.postMessage.mock.calls[0]?.[0]
		expect(request).toMatchObject({
			type: "MAGIC_INSPECTOR_SCREENSHOT_REQUEST",
			selection,
			selector: "section.card",
		})

		const event = new MessageEvent("message", {
			origin: "https://husky.example.test",
			data: {
				type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
				requestId: request.requestId,
				success: true,
				blob: new Blob(["png"], { type: "image/png" }),
			},
		})
		Object.defineProperty(event, "source", { configurable: true, value: targetWindow })
		window.dispatchEvent(event)

		await expect(capture).resolves.toMatch(/^data:image\/png;base64,/)
		expect(authorization).not.toHaveBeenCalled()
		expect(currentTabSession.acquire).not.toHaveBeenCalled()
	})

	it("waits for the capture chrome to hide before requesting browser capture", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})
		const beforeCapture = createDeferred<void>()
		const captureStream = createDeferred<MediaStream>()
		const currentTabSession = {
			acquire: vi.fn(() => captureStream.promise),
			release: vi.fn(),
			hasLiveStream: () => false,
		}
		const capture = captureIframeRegion({
			iframe,
			selection: { left: 12, top: 18, width: 80, height: 60 },
			iframeTargetOrigin: "https://husky.example.test",
			beforeCurrentTabCapture: () => beforeCapture.promise,
			currentTabSession,
		})
		void capture.catch(() => undefined)

		await Promise.resolve()
		expect(currentTabSession.acquire).not.toHaveBeenCalled()

		beforeCapture.resolve()
		await waitFor(() => expect(currentTabSession.acquire).toHaveBeenCalledOnce())
	})

	it("does not request browser capture when hiding the capture chrome fails", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})
		const beforeCapture = createDeferred<void>()
		const getDisplayMedia = vi.fn()
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: { getDisplayMedia },
		})

		try {
			let startCapture: (() => Promise<string>) | undefined
			const authorization = vi.fn((_context, start: () => Promise<string>) => {
				startCapture = start
				return new Promise<string | null>(() => undefined)
			})
			const capture = captureIframeRegion({
				iframe,
				selection: { left: 12, top: 18, width: 80, height: 60 },
				iframeTargetOrigin: "https://husky.example.test",
				beforeCurrentTabCapture: () => beforeCapture.promise,
				requestCurrentTabCaptureAuthorization: authorization,
			})
			const request = targetWindow.postMessage.mock.calls[0]?.[0]
			const response = new MessageEvent("message", {
				origin: "https://husky.example.test",
				data: {
					type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
					requestId: request.requestId,
					success: false,
					error: "Capture root has no size",
				},
			})
			Object.defineProperty(response, "source", { configurable: true, value: targetWindow })
			window.dispatchEvent(response)

			await vi.waitFor(() => expect(startCapture).toBeTypeOf("function"))
			const failure = new Error("capture chrome could not be hidden")
			const startPromise = startCapture?.()
			beforeCapture.reject(failure)
			await expect(startPromise).rejects.toBe(failure)
			expect(getDisplayMedia).not.toHaveBeenCalled()
			void capture
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices")
			}
		}
	})

	it("preserves the WebP format returned by the iframe runtime", async () => {
		const iframe = document.createElement("iframe")
		const targetWindow = { postMessage: vi.fn() }
		Object.defineProperty(iframe, "contentWindow", {
			configurable: true,
			value: targetWindow,
		})

		const capture = captureWithIframeRuntime({
			iframe,
			selection: { left: 12, top: 18, width: 80, height: 60 },
			iframeTargetOrigin: "https://husky.example.test",
		})
		const request = targetWindow.postMessage.mock.calls[0]?.[0]
		const event = new MessageEvent("message", {
			origin: "https://husky.example.test",
			data: {
				type: "MAGIC_INSPECTOR_SCREENSHOT_RESPONSE",
				requestId: request.requestId,
				success: true,
				blob: new Blob(["webp"], { type: "image/webp" }),
			},
		})
		Object.defineProperty(event, "source", { configurable: true, value: targetWindow })
		window.dispatchEvent(event)

		await expect(capture).resolves.toMatch(/^data:image\/webp;base64,/)
	})

	it("falls back when the iframe ACKs but never returns a screenshot", async () => {
		vi.useFakeTimers()
		try {
			const iframe = document.createElement("iframe")
			const targetWindow = { postMessage: vi.fn() }
			Object.defineProperty(iframe, "contentWindow", {
				configurable: true,
				value: targetWindow,
			})

			const capture = captureWithIframeRuntime({
				iframe,
				selection: { left: 12, top: 18, width: 80, height: 60 },
				iframeTargetOrigin: "https://husky.example.test",
			})
			const request = targetWindow.postMessage.mock.calls[0]?.[0]
			const ack = new MessageEvent("message", {
				origin: "https://husky.example.test",
				data: {
					type: "MAGIC_INSPECTOR_SCREENSHOT_ACK",
					requestId: request.requestId,
				},
			})
			Object.defineProperty(ack, "source", { configurable: true, value: targetWindow })
			window.dispatchEvent(ack)

			await vi.advanceTimersByTimeAsync(7_999)
			expect(targetWindow.postMessage).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(1)

			await expect(capture).resolves.toBeNull()
			expect(targetWindow.postMessage).toHaveBeenLastCalledWith(
				{
					type: "MAGIC_INSPECTOR_SCREENSHOT_CANCEL",
					requestId: request.requestId,
				},
				"https://husky.example.test",
			)
		} finally {
			vi.useRealTimers()
		}
	})

	it("renews the iframe screenshot wait when the runtime reports progress", async () => {
		vi.useFakeTimers()
		try {
			const iframe = document.createElement("iframe")
			const targetWindow = { postMessage: vi.fn() }
			Object.defineProperty(iframe, "contentWindow", {
				configurable: true,
				value: targetWindow,
			})

			const capture = captureWithIframeRuntime({
				iframe,
				selection: { left: 12, top: 18, width: 80, height: 60 },
				iframeTargetOrigin: "https://husky.example.test",
			})
			const request = targetWindow.postMessage.mock.calls[0]?.[0]
			const dispatchRuntimeMessage = (type: string) => {
				const event = new MessageEvent("message", {
					origin: "https://husky.example.test",
					data: { type, requestId: request.requestId },
				})
				Object.defineProperty(event, "source", { configurable: true, value: targetWindow })
				window.dispatchEvent(event)
			}

			dispatchRuntimeMessage("MAGIC_INSPECTOR_SCREENSHOT_ACK")
			await vi.advanceTimersByTimeAsync(7_000)
			dispatchRuntimeMessage("MAGIC_INSPECTOR_SCREENSHOT_PROGRESS")
			await vi.advanceTimersByTimeAsync(7_000)
			expect(targetWindow.postMessage).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(1_000)
			await expect(capture).resolves.toBeNull()
			expect(targetWindow.postMessage).toHaveBeenLastCalledWith(
				{
					type: "MAGIC_INSPECTOR_SCREENSHOT_CANCEL",
					requestId: request.requestId,
				},
				"https://husky.example.test",
			)
		} finally {
			vi.useRealTimers()
		}
	})

	it("materializes pseudo-elements in the detached clone without changing the page", async () => {
		document.body.innerHTML = '<div id="capture-root"><div id="card"></div></div>'
		const root = document.querySelector<HTMLElement>("#capture-root")
		const card = document.querySelector<HTMLElement>("#card")
		if (!root || !card) throw new Error("Screenshot fixture was not created")
		const originalGetComputedStyle = window.getComputedStyle.bind(window)
		const hiddenPseudo = {
			length: 0,
			item: () => "",
			getPropertyValue: () => "",
			getPropertyPriority: () => "",
			content: "none",
			display: "inline",
			visibility: "visible",
			opacity: "1",
			backgroundImage: "none",
			backgroundColor: "rgba(0, 0, 0, 0)",
			borderStyle: "none",
			filter: "none",
		} as unknown as CSSStyleDeclaration
		const visiblePseudo = {
			0: "position",
			1: "background-color",
			length: 2,
			item: (index: number) => ["position", "background-color"][index] ?? "",
			getPropertyValue: (property: string) =>
				property === "position" ? "absolute" : "rgb(0, 0, 0)",
			getPropertyPriority: () => "",
			content: '"Badge"',
			display: "block",
			visibility: "visible",
			opacity: "1",
			backgroundImage: "none",
			backgroundColor: "rgb(0, 0, 0)",
			borderStyle: "none",
			filter: "none",
		} as unknown as CSSStyleDeclaration
		const getComputedStyle = vi
			.spyOn(window, "getComputedStyle")
			.mockImplementation((element, pseudoElement) => {
				if (element === card && pseudoElement === "::before") return visiblePseudo
				if (pseudoElement) return hiddenPseudo
				return originalGetComputedStyle(element)
			})

		try {
			const plugin = createPseudoElementsCapturePlugin()
			await plugin.beforeClone?.({ element: root } as never)
			const clone = root.cloneNode(true) as HTMLElement
			await plugin.afterClone?.({ element: root, clone } as never)

			expect(card).not.toHaveAttribute("data-element-inspector-pseudo-before")
			expect(card.querySelector("[data-element-inspector-pseudo]")).toBeNull()
			const clonedCard = clone.querySelector<HTMLElement>("#card")
			if (!clonedCard) throw new Error("Screenshot clone fixture was not created")
			expect(clonedCard).toHaveAttribute("data-element-inspector-pseudo-before", "true")
			expect(clonedCard.firstElementChild).toHaveAttribute(
				"data-element-inspector-pseudo",
				"::before",
			)
			expect(clonedCard.firstElementChild).toHaveTextContent("Badge")
		} finally {
			getComputedStyle.mockRestore()
		}
	})

	it("pauses and restores iframe animations around capture", () => {
		const animation = {
			currentTime: 120,
			playState: "running",
			pause: vi.fn(),
			play: vi.fn(),
			finish: vi.fn(),
		} as unknown as Animation
		const previousGetAnimations = document.getAnimations
		const previousScrollBehavior = document.documentElement.style.scrollBehavior
		Object.defineProperty(document, "getAnimations", {
			configurable: true,
			value: () => [animation],
		})
		document.documentElement.style.scrollBehavior = "smooth"

		try {
			const restore = freezeDocumentForCapture(document)
			expect(animation.pause).toHaveBeenCalledOnce()
			expect(document.documentElement.style.scrollBehavior).toBe("auto")

			restore()
			expect(animation.currentTime).toBe(120)
			expect(animation.play).toHaveBeenCalledOnce()
			expect(document.documentElement.style.scrollBehavior).toBe("smooth")
		} finally {
			Object.defineProperty(document, "getAnimations", {
				configurable: true,
				value: previousGetAnimations,
			})
			document.documentElement.style.scrollBehavior = previousScrollBehavior
		}
	})

	it("keeps visible pseudo-element layers in the capture tree", () => {
		expect(
			shouldMaterializePseudoElement({
				content: '""',
				display: "block",
				visibility: "visible",
				opacity: "1",
				backgroundImage: "linear-gradient(black, transparent)",
				backgroundColor: "rgba(0, 0, 0, 0)",
				borderStyle: "none",
				filter: "none",
			}),
		).toBe(true)

		expect(
			shouldMaterializePseudoElement({
				content: "none",
				display: "inline",
				visibility: "visible",
				opacity: "1",
				backgroundImage: "none",
				backgroundColor: "rgba(0, 0, 0, 0)",
				borderStyle: "none",
				filter: "none",
			}),
		).toBe(false)
	})

	it("uses visual viewport dimensions for the screenshot output", () => {
		expect(
			getCaptureOutputSize(
				{ left: 123, top: 157, width: 780, height: 390 },
				{ left: 360, top: 320, width: 400, height: 200 },
			),
		).toEqual({ width: 800, height: 400 })
	})

	it("uses the root layout size instead of its overflow size for rendering", () => {
		expect(
			getCaptureRootRenderSize({
				offsetWidth: 964,
				offsetHeight: 841,
				clientWidth: 964,
				clientHeight: 841,
			}),
		).toEqual({ width: 964, height: 841 })

		expect(
			getCaptureRootRenderSize(
				{
					offsetWidth: 964,
					offsetHeight: 841,
					clientWidth: 964,
					clientHeight: 841,
				},
				{ width: 1200, height: 900 } as DOMRect,
			),
		).toEqual({ width: 1200, height: 900 })

		expect(
			getCaptureRootRenderSize({
				offsetWidth: 0,
				offsetHeight: 0,
				clientWidth: 320,
				clientHeight: 180,
			}),
		).toEqual({ width: 320, height: 180 })
	})

	it("keeps ordinary HTML crops anchored to the document body", () => {
		document.body.innerHTML = '<section id="page-section"><div>content</div></section>'
		const body = document.body
		const section = document.querySelector<HTMLElement>("#page-section")
		if (!section) throw new Error("Screenshot fixture was not created")

		expect(resolveCaptureRoot(body, { left: 20, top: 30, width: 120, height: 80 })).toBe(body)
		expect(shouldCaptureCurrentTab(body, { left: 20, top: 30, width: 120, height: 80 })).toBe(
			true,
		)
	})

	it("keeps PPT roots on the detached capture path", () => {
		document.body.innerHTML = '<main class="slide" id="slide"><div>content</div></main>'
		const body = document.body
		const slide = document.querySelector<HTMLElement>("#slide")
		if (!slide) throw new Error("Screenshot fixture was not created")
		vi.spyOn(slide, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 800,
			height: 600,
			right: 800,
			bottom: 600,
		} as DOMRect)

		expect(
			shouldCaptureCurrentTab(body, { left: 100, top: 100, width: 200, height: 120 }),
		).toBe(false)
	})

	it("reuses one current-tab stream until the capture session is released", async () => {
		const stop = vi.fn()
		let ended: (() => void) | undefined
		const track = {
			readyState: "live",
			stop,
			addEventListener: vi.fn((type: string, listener: EventListener) => {
				if (type === "ended") ended = listener as unknown as () => void
			}),
			getSettings: () => ({ displaySurface: "browser" }),
		} as unknown as MediaStreamTrack
		const stream = {
			getTracks: () => [track],
			getVideoTracks: () => [track],
		} as unknown as MediaStream
		const getDisplayMedia = vi.fn().mockResolvedValue(stream)
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: { getDisplayMedia },
		})

		try {
			const session = createCurrentTabCaptureSession()
			await expect(session.acquire()).resolves.toBe(stream)
			await expect(session.acquire()).resolves.toBe(stream)

			expect(getDisplayMedia).toHaveBeenCalledOnce()
			expect(session.hasLiveStream()).toBe(true)
			expect(getDisplayMedia).toHaveBeenCalledWith(
				expect.objectContaining({
					video: { displaySurface: "browser", cursor: "never" },
					audio: false,
					preferCurrentTab: true,
					selfBrowserSurface: "include",
					surfaceSwitching: "exclude",
					monitorTypeSurfaces: "exclude",
				}),
			)

			session.release()
			expect(session.hasLiveStream()).toBe(false)
			expect(stop).toHaveBeenCalledOnce()
			ended?.()
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices")
			}
		}
	})

	it("waits for the user to finish the tab capture picker", async () => {
		vi.useFakeTimers()
		const stop = vi.fn()
		const stream = {
			getTracks: () => [{ stop, readyState: "live" }],
			getVideoTracks: () => [
				{
					readyState: "live",
					stop,
					addEventListener: vi.fn(),
					getSettings: () => ({ displaySurface: "browser" }),
				},
			],
		} as unknown as MediaStream
		let grantPermission: ((nextStream: MediaStream) => void) | undefined
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		const getDisplayMedia = vi.fn(
			() =>
				new Promise<MediaStream>((resolve) => {
					grantPermission = resolve
				}),
		)
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: { getDisplayMedia },
		})

		try {
			const session = createCurrentTabCaptureSession()
			const pending = session.acquire()

			await vi.advanceTimersByTimeAsync(5_000)
			expect(getDisplayMedia).toHaveBeenCalledOnce()
			grantPermission?.(stream)
			await expect(pending).resolves.toBe(stream)
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices")
			}
			vi.useRealTimers()
		}
	})

	it("stops a late display-media stream after the session is released", async () => {
		const stop = vi.fn()
		const track = {
			readyState: "live",
			stop,
			addEventListener: vi.fn(),
			getSettings: () => ({ displaySurface: "browser" }),
		} as unknown as MediaStreamTrack
		const stream = {
			getTracks: () => [track],
			getVideoTracks: () => [track],
		} as unknown as MediaStream
		let grantPermission: ((nextStream: MediaStream) => void) | undefined
		const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
		const getDisplayMedia = vi.fn(
			() =>
				new Promise<MediaStream>((resolve) => {
					grantPermission = resolve
				}),
		)
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: { getDisplayMedia },
		})

		try {
			const session = createCurrentTabCaptureSession()
			const pending = session.acquire()
			session.release()
			grantPermission?.(stream)

			await expect(pending).rejects.toMatchObject({ name: "AbortError" })
			expect(stop).toHaveBeenCalledOnce()
		} finally {
			if (previousMediaDevices) {
				Object.defineProperty(navigator, "mediaDevices", previousMediaDevices)
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices")
			}
		}
	})

	it("waits for a fresh display-stream frame before cropping", async () => {
		let presentFrame: (() => void) | undefined
		const requestVideoFrameCallback = vi.fn((callback: () => void) => {
			presentFrame = callback
			return 1
		})
		const video = { requestVideoFrameCallback } as unknown as HTMLVideoElement
		let completed = false
		const pending = waitForFreshCaptureVideoFrame(video).then(() => {
			completed = true
		})

		await Promise.resolve()
		expect(requestVideoFrameCallback).toHaveBeenCalledOnce()
		expect(completed).toBe(false)
		presentFrame?.()
		await pending
		expect(completed).toBe(true)
	})

	it("does not block when the display-stream frame callback never fires", async () => {
		vi.useFakeTimers()
		try {
			const requestVideoFrameCallback = vi.fn(() => 1)
			const video = { requestVideoFrameCallback } as unknown as HTMLVideoElement
			const pending = waitForFreshCaptureVideoFrame(video)

			await vi.advanceTimersByTimeAsync(120)
			await expect(pending).resolves.toBeUndefined()
			expect(requestVideoFrameCallback).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not block when capture video playback never settles", async () => {
		vi.useFakeTimers()
		try {
			const video = {
				play: vi.fn(() => new Promise<void>(() => undefined)),
			} as unknown as HTMLVideoElement
			const pending = waitForCaptureVideoPlayback(video)
			const rejection = expect(pending).rejects.toThrow(
				"Timed out while starting tab capture video",
			)

			await vi.advanceTimersByTimeAsync(1_000)
			await rejection
			expect(video.play).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it("bounds stable-rect waits when animation frames are delayed", async () => {
		const element = document.createElement("div")
		document.body.appendChild(element)
		vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			width: 320,
			height: 240,
			right: 320,
			bottom: 240,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect)
		const requestAnimationFrame = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation(() => 1)

		try {
			await expect(waitForStableCaptureRect(element, 6, 20)).resolves.toMatchObject({
				width: 320,
				height: 240,
			})
		} finally {
			requestAnimationFrame.mockRestore()
			element.remove()
		}
	})

	it("prewarms current-tab capture for ordinary HTML but not PPT roots", () => {
		const iframe = document.createElement("iframe")
		Object.defineProperty(iframe, "contentDocument", {
			configurable: true,
			value: document,
		})

		document.body.innerHTML = "<section>content</section>"
		expect(shouldPrewarmCurrentTabCapture(iframe)).toBe(true)

		document.body.innerHTML = '<main class="slide">content</main>'
		expect(shouldPrewarmCurrentTabCapture(iframe)).toBe(false)
	})

	it("maps iframe CSS coordinates to visual screen coordinates", () => {
		expect(
			toRenderedSelection(
				{ clientWidth: 800, clientHeight: 600 },
				{ left: 100, top: 50, width: 400, height: 300 },
				{ left: 80, top: 60, width: 200, height: 100 },
			),
		).toEqual({ left: 140, top: 80, width: 100, height: 50 })
	})

	it("keeps coordinates stable when the iframe is not scaled", () => {
		expect(
			toRenderedSelection(
				{ clientWidth: 400, clientHeight: 300 },
				{ left: 10, top: 20, width: 400, height: 300 },
				{ left: 4, top: 8, width: 120, height: 80 },
			),
		).toEqual({ left: 14, top: 28, width: 120, height: 80 })
	})

	it("uses the host drag rectangle directly for cross-origin capture", () => {
		const hostSelection = { left: 132, top: 188, width: 358, height: 296 }

		expect(
			resolveCaptureScreenSelection(
				{ clientWidth: 1920, clientHeight: 1080 },
				{ left: -180, top: 80, width: 1100, height: 620 } as DOMRect,
				{ left: 520, top: 180, width: 474, height: 388 },
				hostSelection,
			),
		).toEqual(hostSelection)
	})

	it("recalculates same-origin tab crops after the sharing banner shifts the iframe", () => {
		const initialViewportSelection = { left: 200, top: 140, width: 240, height: 120 }
		expect(
			resolveCurrentTabScreenSelection(
				{ clientWidth: 800, clientHeight: 600 },
				{ left: 100, top: 90, width: 400, height: 300 },
				{ left: 80, top: 60, width: 200, height: 100 },
				initialViewportSelection,
				true,
			),
		).toEqual({ left: 140, top: 120, width: 100, height: 50 })
	})

	it("anchors PPT crops to the slide root rather than the full document", () => {
		expect(
			getRootCaptureSelection(
				{ left: 240, top: 180, width: 640, height: 310 },
				{ left: -120, top: -90 },
			),
		).toEqual({ left: 360, top: 270, width: 640, height: 310 })
	})

	it("keeps root-local coordinates stable while the iframe scrolls", () => {
		expect(
			getRootCaptureSelection(
				{ left: 120, top: 80, width: 240, height: 120 },
				{ left: -40, top: -60 },
			),
		).toEqual({ left: 160, top: 140, width: 240, height: 120 })
	})

	it("keeps the requested output size when the snapdom bitmap has rounding drift", () => {
		const crop = toBitmapCropSelection(
			{ left: 120, top: 80, width: 640, height: 310 },
			{ width: 644, height: 316 },
			{ width: 640, height: 310 },
		)

		expect(crop.left).toBeCloseTo(120.75)
		expect(crop.top).toBeCloseTo(81.54838709677419)
		expect(crop.width).toBeCloseTo(644)
		expect(crop.height).toBeCloseTo(316)
		expect(crop.outputWidth).toBe(640)
		expect(crop.outputHeight).toBe(310)
	})

	it("accounts for browser chrome when the selected surface is a window", () => {
		expect(
			getCaptureSurfaceGeometry("window", {
				innerWidth: 1440,
				innerHeight: 900,
				outerWidth: 1470,
				outerHeight: 1000,
			}),
		).toEqual({
			width: 1470,
			height: 1000,
			viewportOffsetX: 15,
			viewportOffsetY: 100,
		})
	})

	it("keeps a browser-tab capture anchored at the viewport origin", () => {
		expect(
			getCaptureSurfaceGeometry("browser", {
				innerWidth: 1440,
				innerHeight: 900,
				outerWidth: 1470,
				outerHeight: 1000,
			}),
		).toEqual({
			width: 1440,
			height: 900,
			viewportOffsetX: 0,
			viewportOffsetY: 0,
		})
	})
})
