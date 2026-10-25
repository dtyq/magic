import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePPTLiveRenderCache } from "../usePPTLiveRenderCache"
import type { SlideItem } from "../../PPTSidebar/types"
import type { PPTSlideTransitionOptions } from "../usePPTSlideTransition"

const makeSlides = (): SlideItem[] =>
	Array.from({ length: 6 }, (_, index) => ({
		id: String(index),
		index,
		path: `${index}.html`,
		content: `<main>${index}</main>`,
		loadingState: "loaded",
		lastLoadedAt: 1,
	}))
const options: PPTSlideTransitionOptions = {
	enabled: true,
	getTransition: () => ({ effect: "push", duration_ms: 400 }),
}

describe("resident iframe transitions", () => {
	const animations: Array<{ finish: () => void; cancel: ReturnType<typeof vi.fn> }> = []
	let reduced = false
	let notifyReduced: (() => void) | undefined
	beforeEach(() => {
		animations.length = 0
		reduced = false
		vi.stubGlobal("matchMedia", () => ({
			get matches() {
				return reduced
			},
			addEventListener: (_: string, listener: () => void) => {
				notifyReduced = listener
			},
			removeEventListener: vi.fn(),
		}))
	})
	afterEach(() => vi.unstubAllGlobals())

	function setup(transition = options) {
		const slides = makeSlides()
		const initialProps = {
			slides,
			activeIndex: 0,
			transition,
			scopeKey: "deck",
			capacity: 2,
			neighborRadius: 1,
		}
		const hook = renderHook((props) => usePPTLiveRenderCache(props), { initialProps })
		const layers = new Map<string, HTMLDivElement>()
		const register = () =>
			hook.result.current.residentSlides.forEach(({ key }) => {
				if (!layers.has(key)) {
					const layer = document.createElement("div")
					layer.appendChild(document.createElement("iframe"))
					layer.animate = vi.fn(() => {
						let finish!: () => void
						const finished = new Promise<void>((resolve) => {
							finish = resolve
						})
						const cancel = vi.fn(finish)
						animations.push({ finish, cancel })
						return { finished, cancel } as unknown as Animation
					})
					layers.set(key, layer)
				}
				hook.result.current.registerTransitionLayer(key, layers.get(key) ?? null)
			})
		const ready = (index: number) => {
			register()
			const entry = hook.result.current.residentSlides.find((item) => item.index === index)
			if (!entry) throw new Error(`Missing resident slide ${index}`)
			act(() => hook.result.current.onSlideReadyChange(entry.key, entry.revision, true))
		}
		const go = (index: number, overrides: Partial<typeof initialProps> = {}) => {
			hook.rerender({ ...initialProps, activeIndex: index, ...overrides })
			register()
		}
		register()
		ready(0)
		return { ...hook, ready, go, layers, initialProps }
	}

	it("waits for the real incoming iframe and retains both DOM identities until completion", async () => {
		const hook = setup()
		const outgoing = hook.result.current.presentedKey
		if (!outgoing) throw new Error("Missing initial slide")
		const iframe = hook.layers.get(outgoing)?.firstChild
		hook.go(4)
		expect(hook.result.current.presentedKey).toBe(outgoing)
		expect(animations).toHaveLength(0)
		hook.ready(4)
		expect(hook.result.current.transitionState?.outgoingKey).toBe(outgoing)
		expect(hook.result.current.presentedKey).toBe(outgoing)
		expect(hook.result.current.residentSlides).toHaveLength(3)
		expect(hook.layers.get(outgoing)?.firstChild).toBe(iframe)
		await act(async () => animations.forEach((animation) => animation.finish()))
		expect(hook.result.current.presentedKey).toContain("4.html")
		expect(hook.result.current.transitionState).toBeNull()
		expect(hook.result.current.residentSlides).toHaveLength(2)
	})

	it("cancels rapid navigation to incoming, ignores stale completions, and waits only for latest", async () => {
		const hook = setup()
		hook.go(1)
		hook.ready(1)
		const first = [...animations]
		hook.go(4)
		expect(first.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
		expect(hook.result.current.presentedKey).toContain("1.html")
		hook.go(5)
		hook.ready(5)
		await act(async () => first.forEach((animation) => animation.finish()))
		expect(hook.result.current.transitionState?.incomingKey).toContain("5.html")
		expect(hook.result.current.residentSlides.length).toBeLessThanOrEqual(3)
		await act(async () => animations.forEach((animation) => animation.finish()))
		expect(hook.result.current.presentedKey).toContain("5.html")
	})

	it("uses direct commits in editing mode and on initial or same-page loads", () => {
		const hook = setup({ ...options, enabled: false })
		hook.go(1, { transition: { ...options, enabled: false } })
		hook.ready(1)
		expect(hook.result.current.presentedKey).toContain("1.html")
		hook.ready(1)
		expect(animations).toHaveLength(0)
	})

	it("keeps a capacity-one cache bounded while replacing an in-flight target", () => {
		const hook = setup()
		hook.go(1, { capacity: 1 })
		hook.ready(1)
		hook.go(4, { capacity: 1 })
		expect(hook.result.current.residentSlides).toHaveLength(2)
		expect(hook.result.current.residentSlides.map((entry) => entry.index).sort()).toEqual([
			1, 4,
		])
	})

	it("ignores obsolete readiness and directly settles the refreshed incoming revision", () => {
		const hook = setup()
		hook.go(1)
		hook.ready(1)
		const old = hook.result.current.residentSlides.find((entry) => entry.index === 1)
		if (!old) throw new Error("Missing incoming slide")
		hook.go(1, {
			slides: hook.initialProps.slides.map((slide) =>
				slide.index === 1 ? { ...slide, lastLoadedAt: 2 } : slide,
			),
		})
		act(() => hook.result.current.onSlideReadyChange(old.key, old.revision, true))
		expect(hook.result.current.presentedKey).toContain("0.html")
		hook.ready(1)
		expect(hook.result.current.presentedKey).toContain("1.html")
		expect(hook.result.current.transitionState).toBeNull()
		expect(animations).toHaveLength(2)
	})

	it("responds to reduced motion changes without changing the deck settings", async () => {
		const hook = setup()
		hook.go(1)
		hook.ready(1)
		act(() => {
			reduced = true
			notifyReduced?.()
		})
		expect(hook.result.current.transitionState).toBeNull()
		expect(hook.result.current.presentedKey).toContain("1.html")
		hook.go(2)
		hook.ready(2)
		expect(animations).toHaveLength(2)
		expect(hook.result.current.presentedKey).toContain("2.html")
		await act(async () => Promise.resolve())
	})

	it.each(["scope", "revision", "exit", "delete"])(
		"invalidates a running animation on %s changes",
		async (change) => {
			const hook = setup()
			hook.go(1)
			hook.ready(1)
			const prior = [...animations]
			if (change === "scope") hook.go(1, { scopeKey: "other-deck" })
			if (change === "revision")
				hook.go(1, {
					slides: hook.initialProps.slides.map((slide) =>
						slide.index === 1 ? { ...slide, lastLoadedAt: 2 } : slide,
					),
				})
			if (change === "exit")
				hook.go(1, { transition: { ...options, lifecycleKey: "exited-fullscreen" } })
			if (change === "delete") hook.go(0, { slides: [hook.initialProps.slides[0]] })
			await act(async () => prior.forEach((animation) => animation.finish()))
			expect(prior.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
			expect(hook.result.current.transitionState).toBeNull()
			if (change === "scope") expect(hook.result.current.presentedKey).toContain("other-deck")
		},
	)

	it("does not animate error feedback and cancels handles on unmount", async () => {
		const hook = setup()
		hook.go(1, {
			slides: hook.initialProps.slides.map((slide) =>
				slide.index === 1 ? { ...slide, loadingState: "error" } : slide,
			),
		})
		hook.ready(1)
		expect(animations).toHaveLength(0)
		hook.unmount()
		const running = setup()
		running.go(1)
		running.ready(1)
		expect(animations).toHaveLength(2)
		running.unmount()
		await act(async () => animations.forEach((animation) => animation.finish()))
		expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
	})
})
