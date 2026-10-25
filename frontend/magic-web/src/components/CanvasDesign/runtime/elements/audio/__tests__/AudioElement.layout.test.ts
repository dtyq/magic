import { describe, expect, it } from "vitest"
import {
	resolveAudioPlayerLayout,
	resolveAudioStatusPlaceholderLayout,
} from "../AudioElement.layout"

describe("resolveAudioPlayerLayout", () => {
	it("uses enlarged default visuals and balanced regions at 1280 by 720", () => {
		const layout = resolveAudioPlayerLayout(1280, 720)

		expect(layout.rootScale).toBe(1)
		expect(layout.waveform).toEqual({ x: 64, y: 149, width: 1152, height: 224 })
		expect(layout.progress).toEqual({ x: 48, y: 502, width: 1184, height: 14 })
		expect(layout.progressThumbRadius).toBe(11)
		expect(layout.time).toEqual({ x: 48, y: 526, width: 1184, fontSize: 40 })
		expect(layout.operations).toMatchObject({
			x: 488,
			y: 576,
			width: 304,
			height: 80,
			buttonSize: 80,
			gap: 32,
		})
	})

	it("fits controls uniformly in a narrow element without horizontal deformation", () => {
		const layout = resolveAudioPlayerLayout(240, 720)

		expect(layout.operations.x).toBeGreaterThanOrEqual(0)
		expect(layout.operations.x + layout.operations.width).toBeLessThanOrEqual(240)
		expect(layout.operations.buttonSize / layout.operations.gap).toBeCloseTo(80 / 32)
		expect(layout.waveform.x).toBeGreaterThan(0)
		expect(layout.waveform.x + layout.waveform.width).toBeLessThan(240)
	})

	it("constrains the centered waveform above bottom controls in a short element", () => {
		const layout = resolveAudioPlayerLayout(640, 240)

		expect(layout.waveform.y).toBeGreaterThanOrEqual(0)
		expect(layout.waveform.y + layout.waveform.height).toBeLessThanOrEqual(layout.progress.y)
		expect(layout.operations.y + layout.operations.height).toBeLessThanOrEqual(240)
		expect(layout.progress.y).toBeGreaterThanOrEqual(0)
	})
	it("keeps time typography readable when control stack is crushed", () => {
		const layout = resolveAudioPlayerLayout(240, 240)

		expect(layout.time.fontSize).toBeGreaterThanOrEqual(16 * layout.rootScale)
		expect(layout.time.fontSize).toBeGreaterThanOrEqual(layout.operations.buttonSize * 0.2)
	})
})

describe("resolveAudioStatusPlaceholderLayout", () => {
	it("centers the status indicator at the default audio size", () => {
		const layout = resolveAudioStatusPlaceholderLayout(1280, 720)

		expect(layout.group.x).toBe(0)
		expect(layout.group.width).toBe(1280)
		expect(layout.group.y + layout.group.height / 2).toBeCloseTo(360)
		expect(layout.spinner).toMatchObject({ x: 640, y: 20, radius: 20, strokeWidth: 4 })
		expect(layout.text).toMatchObject({ x: 0, width: 1280, fontSize: 48, lineHeight: 1.3 })
	})

	it("keeps the status indicator within a minimum-width audio element", () => {
		const layout = resolveAudioStatusPlaceholderLayout(240, 720)

		expect(layout.group.x).toBeGreaterThanOrEqual(0)
		expect(layout.group.y).toBeGreaterThanOrEqual(0)
		expect(layout.group.x + layout.group.width).toBeLessThanOrEqual(240)
		expect(layout.group.y + layout.group.height).toBeLessThanOrEqual(720)
		expect(layout.spinner.x).toBe(120)
		expect(layout.text.x + layout.text.width).toBeLessThanOrEqual(240)
	})

	it("centers error text without reserving spinner space", () => {
		const layout = resolveAudioStatusPlaceholderLayout(1280, 720, {
			showSpinner: false,
		})

		expect(layout.group.y + layout.group.height / 2).toBeCloseTo(360)
		expect(layout.text.y).toBe(0)
	})
})
