import { describe, expect, it } from "vitest"
import { canReplaySlideInPlace } from "../slideReplayPolicy"
import { injectAtPolyfillScript } from "../../../../contents/HTML/utils/polyfill"

describe("slide replay policy", () => {
	it("recognizes the actual host polyfill when a loader supplies only processed HTML", () => {
		expect(
			canReplaySlideInPlace(injectAtPolyfillScript("<html><body>Slide</body></html>")),
		).toBe(true)
	})
	it("reuses static, CSS, SVG and media pages with standard deck dependencies", () => {
		expect(
			canReplaySlideInPlace(`<style>@keyframes enter {to {opacity:1}}</style>
			<svg><animate attributeName="opacity" /></svg><video autoplay></video>
			<script src="https://cdn.tailwindcss.com/3.4.17"></script>
			<script src="slide-bridge.js"></script><script type="application/json">{}</script>`),
		).toBe(true)
	})
	it.each([
		"<script>requestAnimationFrame(animate)</script>",
		'<script type="module" src="./animation.js"></script>',
		'<script src="https://example.test/gsap.js"></script>',
		'<div onclick="changeState()">Button</div>',
		'<svg onload="animate()"></svg>',
		'<iframe src="chart.html"></iframe>',
		'<script src="https://example.test/slide-bridge.js"></script>',
		'<input type="checkbox" checked>',
		"<style>.card {animation: enter 1s !important}</style>",
		"<style>.card {animation/**/: enter 1s ! important}</style>",
		'<link rel="STYLESHEET" href="./animations.css">',
		"<style>@import/**/ './animations.css';</style>",
		'<div class="hover:!animate-bounce"></div>',
		'<div style="animation-name: enter !important"></div>',
		'<script data-injected="true">requestAnimationFrame(animate)</script>',
	])("keeps full document replay for custom runtime: %s", (content) => {
		expect(canReplaySlideInPlace(content)).toBe(false)
	})
})
