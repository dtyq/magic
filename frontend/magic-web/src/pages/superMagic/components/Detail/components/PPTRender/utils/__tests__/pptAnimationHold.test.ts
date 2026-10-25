import { afterEach, describe, expect, it, vi } from "vitest"
import { filterInjectedTags } from "../../../../contents/HTML/utils"
import {
	holdIframeAnimations,
	injectPPTAnimationHoldBridge,
	prepareIframeAnimations,
	releaseIframeAnimations,
	renewIframeAnimationHold,
} from "../pptAnimationHold"

const ORIGIN = "https://app.example.test"

function createAnimation(overrides: Record<string, unknown> = {}) {
	return {
		timeline: "document-timeline",
		playState: "running",
		currentTime: 240,
		pause: vi.fn(),
		play: vi.fn(),
		...overrides,
	}
}

function setup(animations: ReturnType<typeof createAnimation>[], svgs: unknown[] = []) {
	const content = injectPPTAnimationHoldBridge("<html><body><p>Slide</p></body></html>", ORIGIN)
	const doc = new DOMParser().parseFromString(content, "text/html")
	const listeners = new Map<string, (event: unknown) => void>()
	const parent = { postMessage: vi.fn() }
	const frame = {
		parent,
		addEventListener: (type: string, listener: (event: unknown) => void) =>
			listeners.set(type, listener),
		removeEventListener: (type: string) => listeners.delete(type),
		setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
		clearTimeout: (id: number) => window.clearTimeout(id),
	}
	const fakeDocument = {
		getElementById: (id: string) => doc.getElementById(id),
		createElement: (tag: string) => doc.createElement(tag),
		documentElement: doc.documentElement,
		timeline: "document-timeline",
		getAnimations: () => animations,
		querySelectorAll: () => svgs,
	}
	new Function("document", "window", doc.querySelector("script")!.textContent!)(
		fakeDocument,
		frame,
	)
	const send = (type: string, source: unknown = parent, options: Record<string, unknown> = {}) =>
		listeners.get("message")?.({ source, data: { type, ...options } })
	return { content, parent, send, doc }
}

afterEach(() => {
	vi.useRealTimers()
})

describe("PPT animation hold bridge", () => {
	it("freezes running animations at their first frame and reports back to the host", () => {
		const running = createAnimation()
		const authorPaused = createAnimation({ playState: "paused" })
		const otherTimeline = createAnimation({ timeline: "scroll-timeline" })
		const { send, parent } = setup([running, authorPaused, otherTimeline])

		send("ppt-slide-animation-hold")

		expect(running.pause).toHaveBeenCalled()
		expect(running.currentTime).toBe(0)
		expect(authorPaused.pause).not.toHaveBeenCalled()
		expect(otherTimeline.pause).not.toHaveBeenCalled()
		expect(parent.postMessage).toHaveBeenCalledWith(
			{ type: "ppt-slide-animation-held" },
			ORIGIN,
		)
	})

	it("rewinds and later resumes SVG animations", () => {
		const svg = {
			pauseAnimations: vi.fn(),
			unpauseAnimations: vi.fn(),
			setCurrentTime: vi.fn(),
		}
		const { send } = setup([], [svg])

		send("ppt-slide-animation-hold")
		expect(svg.pauseAnimations).toHaveBeenCalled()
		expect(svg.setCurrentTime).toHaveBeenCalledWith(0)

		send("ppt-slide-animation-release")
		expect(svg.unpauseAnimations).toHaveBeenCalled()
	})

	it("plays only the frozen animations on release", () => {
		const running = createAnimation()
		const { send } = setup([running])

		send("ppt-slide-animation-hold")
		send("ppt-slide-animation-release")

		expect(running.play).toHaveBeenCalledTimes(1)
	})

	it("correlates prepared frames and removes the temporary CSS reset before acknowledging", () => {
		const running = createAnimation()
		const { doc, send, parent } = setup([running])
		send("ppt-slide-animation-hold", parent, { rewindCSS: true, requestId: "prepared" })
		expect(running.currentTime).toBe(0)
		expect(doc.querySelectorAll("style")).toHaveLength(0)
		expect(parent.postMessage).toHaveBeenCalledWith(
			{ type: "ppt-slide-animation-held", requestId: "prepared" },
			ORIGIN,
		)
	})

	it("ignores commands that do not come from the host window", () => {
		const running = createAnimation()
		const { send } = setup([running])

		send("ppt-slide-animation-hold", { other: true })

		expect(running.pause).not.toHaveBeenCalled()
	})

	it("releases on its own when the host never does", () => {
		vi.useFakeTimers()
		const running = createAnimation()
		const { send } = setup([running])

		send("ppt-slide-animation-hold")
		vi.advanceTimersByTime(5000)

		expect(running.play).toHaveBeenCalledTimes(1)
	})

	it("renews a prepared entrance through a long transition without resetting it again", () => {
		vi.useFakeTimers()
		const running = createAnimation()
		const { send, parent } = setup([running])
		send("ppt-slide-animation-hold")
		vi.advanceTimersByTime(3900)
		send("ppt-slide-animation-hold", parent, { refreshHold: true })
		vi.advanceTimersByTime(2000)
		expect(running.play).not.toHaveBeenCalled()
		expect(running.pause).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(3000)
		expect(running.play).toHaveBeenCalledTimes(1)
	})

	it("removes the runtime bridge when serializing a saved slide", () => {
		const { content } = setup([])
		const saved = filterInjectedTags(content, new Map())
		expect(saved).toContain("<p>Slide</p>")
		expect(saved).not.toContain("ppt-slide-animation-hold")
		expect(saved).not.toContain("__magicPptHoldCleanup")
	})
})

describe("PPT animation hold host commands", () => {
	it("reuses only the requested frame's acknowledgement", async () => {
		const target = { postMessage: vi.fn() }
		const pending = prepareIframeAnimations({
			contentWindow: target,
		} as unknown as HTMLIFrameElement)
		const request = target.postMessage.mock.calls[0][0]
		expect(request).toMatchObject({ type: "ppt-slide-animation-hold", rewindCSS: true })
		window.dispatchEvent(
			new MessageEvent("message", {
				source: target as unknown as MessageEventSource,
				data: { type: "ppt-slide-animation-held", requestId: "obsolete" },
			}),
		)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: target as unknown as MessageEventSource,
				data: { type: "ppt-slide-animation-held", requestId: request.requestId },
			}),
		)
		await expect(pending).resolves.toBe(true)
	})
	it("rejects unsupported or missing cached frames instead of treating timeout as readiness", async () => {
		vi.useFakeTimers()
		const pending = prepareIframeAnimations({
			contentWindow: { postMessage: vi.fn() },
		} as unknown as HTMLIFrameElement)
		await vi.advanceTimersByTimeAsync(300)
		await expect(pending).resolves.toBe(false)
		await expect(prepareIframeAnimations(null)).resolves.toBe(false)
	})
	it("resolves when the frame acknowledges the hold", async () => {
		const target = { postMessage: vi.fn() }
		const iframe = { contentWindow: target } as unknown as HTMLIFrameElement

		const pending = holdIframeAnimations(iframe)
		expect(target.postMessage).toHaveBeenCalledWith({ type: "ppt-slide-animation-hold" }, "*")
		window.dispatchEvent(
			new MessageEvent("message", {
				source: target as unknown as MessageEventSource,
				data: { type: "ppt-slide-animation-held" },
			}),
		)

		await expect(pending).resolves.toBeUndefined()
	})

	it("stops waiting for a frame that never answers", async () => {
		vi.useFakeTimers()
		const target = { postMessage: vi.fn() }
		const pending = holdIframeAnimations({
			contentWindow: target,
		} as unknown as HTMLIFrameElement)

		await vi.advanceTimersByTimeAsync(300)

		await expect(pending).resolves.toBeUndefined()
	})

	it("resolves immediately without a frame", async () => {
		await expect(holdIframeAnimations(null)).resolves.toBeUndefined()
	})

	it("posts the release command", () => {
		const target = { postMessage: vi.fn() }
		releaseIframeAnimations({ contentWindow: target } as unknown as HTMLIFrameElement)
		expect(target.postMessage).toHaveBeenCalledWith(
			{ type: "ppt-slide-animation-release" },
			"*",
		)
	})

	it("renews a frozen frame without requesting another reset", () => {
		const target = { postMessage: vi.fn() }
		renewIframeAnimationHold({ contentWindow: target } as unknown as HTMLIFrameElement)
		expect(target.postMessage).toHaveBeenCalledWith(
			{ type: "ppt-slide-animation-hold", refreshHold: true },
			"*",
		)
	})
})
