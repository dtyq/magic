import { afterEach, describe, expect, it, vi } from "vitest"
import { hasAudioWorkletSupport } from "../AudioWorkletSupport"

const originalAudioContext = window.AudioContext
const originalAudioWorkletNode = window.AudioWorkletNode

afterEach(() => {
	Object.defineProperty(window, "AudioContext", {
		configurable: true,
		value: originalAudioContext,
	})
	Object.defineProperty(window, "AudioWorkletNode", {
		configurable: true,
		value: originalAudioWorkletNode,
	})
})

describe("hasAudioWorkletSupport", () => {
	it("does not invoke the AudioContext prototype getter", () => {
		const audioWorkletGetter = vi.fn(() => {
			throw new TypeError("Illegal invocation")
		})
		class GetterAudioContext {}
		Object.defineProperty(GetterAudioContext.prototype, "audioWorklet", {
			configurable: true,
			get: audioWorkletGetter,
		})
		Object.defineProperty(window, "AudioContext", {
			configurable: true,
			value: GetterAudioContext,
		})
		Object.defineProperty(window, "AudioWorkletNode", {
			configurable: true,
			value: class MockAudioWorkletNode {},
		})

		expect(hasAudioWorkletSupport()).toBe(true)
		expect(audioWorkletGetter).not.toHaveBeenCalled()
	})

	it("returns false when the AudioWorklet property is absent", () => {
		Object.defineProperty(window, "AudioContext", {
			configurable: true,
			value: class MockAudioContext {},
		})

		expect(hasAudioWorkletSupport()).toBe(false)
	})
})
