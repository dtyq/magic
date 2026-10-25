import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

// Execute the shell's actual handler; the shell is deployed independently of the editor bundle.
const shell = readFileSync(resolve(__dirname, "../../../index.html"), "utf8")
const handler = shell.slice(
	shell.indexOf("function applyAnimationState()"),
	shell.indexOf("function setupClickListener()"),
)
const applyAnimationState = new Function(
	"isAnimationPaused",
	`${handler}; applyAnimationState();`,
) as (paused: boolean) => void

afterEach(() => {
	document.head.innerHTML = ""
	document.body.innerHTML = ""
})

describe("PPT animation visibility state", () => {
	it("preserves media positions and resumes only media that was playing before suspension", async () => {
		const media = [
			{ tag: "video", playing: true },
			{ tag: "audio", playing: true },
			{ tag: "video", playing: false },
			{ tag: "audio", playing: false },
		].map(({ tag, playing }) => {
			const element = document.createElement(tag) as HTMLMediaElement
			let paused = !playing
			Object.defineProperty(element, "paused", { get: () => paused })
			element.currentTime = 12
			const pause = vi.spyOn(element, "pause").mockImplementation(() => {
				paused = true
			})
			const play = vi.spyOn(element, "play").mockImplementation(async () => {
				paused = false
			})
			document.body.append(element)
			return { element, pause, play, playing }
		})
		applyAnimationState(true)
		applyAnimationState(true)
		for (const { element, pause, play } of media) {
			expect(element.paused).toBe(true)
			expect(element.currentTime).toBe(12)
			expect(pause).toHaveBeenCalledTimes(2)
			expect(play).not.toHaveBeenCalled()
		}
		applyAnimationState(false)
		applyAnimationState(false)
		for (const { element, play, playing } of media) {
			expect(play).toHaveBeenCalledTimes(playing ? 1 : 0)
			expect(element.paused).toBe(!playing)
			expect(element.currentTime).toBe(12)
			expect(element.hasAttribute("data-was-playing")).toBe(false)
		}
	})

	it("pauses animation timelines without cancelling animation definitions", () => {
		applyAnimationState(true)
		const style = document.querySelector<HTMLStyleElement>("#magic-animation-pause")!
		const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[]
		expect(rules.map((rule) => rule.selectorText).join(",")).toContain("*::before")
		expect(rules.map((rule) => rule.selectorText).join(",")).toContain("*::after")
		for (const rule of rules) {
			expect(rule.style.getPropertyValue("animation-play-state")).toBe("paused")
			expect(rule.style.getPropertyPriority("animation-play-state")).toBe("important")
			expect(rule.style.getPropertyValue("animation")).toBe("")
		}
	})

	it("removes only the pause override on resume and leaves author styles intact", () => {
		document.head.innerHTML =
			'<style id="author">.title { animation-play-state: paused }</style>'
		document.body.innerHTML =
			'<div class="title" style="animation: entrance 1s both">Title</div>'
		const originalHead = document.head.innerHTML
		const originalBody = document.body.innerHTML
		applyAnimationState(true)
		applyAnimationState(true)
		expect(document.querySelectorAll("#magic-animation-pause")).toHaveLength(1)
		applyAnimationState(false)
		applyAnimationState(false)
		expect(document.head.innerHTML).toBe(originalHead)
		expect(document.body.innerHTML).toBe(originalBody)
	})
})
