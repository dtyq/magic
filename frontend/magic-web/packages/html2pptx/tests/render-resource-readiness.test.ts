// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { waitForRenderResources } from "../src/sandbox/waitSandboxReady"

afterEach(() => {
	document.body.replaceChildren()
})

function appendCompletedImage(decode: () => Promise<void>): HTMLImageElement {
	const image = document.createElement("img")
	Object.defineProperty(image, "complete", { configurable: true, value: true })
	Object.defineProperty(image, "decode", { configurable: true, value: decode })
	document.body.appendChild(image)
	return image
}

describe("render resource readiness", () => {
	it("waits for a completed image to decode", async () => {
		let resolveDecode: (() => void) | undefined
		let markDecodeStarted: (() => void) | undefined
		const decodeStarted = new Promise<void>((resolve) => {
			markDecodeStarted = resolve
		})
		const decode = vi.fn(() => {
			markDecodeStarted?.()
			return new Promise<void>((resolve) => {
				resolveDecode = resolve
			})
		})
		appendCompletedImage(decode)

		let settled = false
		const readiness = waitForRenderResources({ iframeDocument: document }).then(() => {
			settled = true
		})
		await decodeStarted

		expect(decode).toHaveBeenCalledOnce()
		expect(settled).toBe(false)
		resolveDecode?.()
		await readiness
		expect(settled).toBe(true)
	})

	it("treats image decode rejection as a non-fatal resource failure", async () => {
		appendCompletedImage(() => Promise.reject(new Error("decode failed")))

		await expect(waitForRenderResources({ iframeDocument: document })).resolves.toBeUndefined()
	})

	it("aborts while image decode is pending", async () => {
		appendCompletedImage(() => new Promise<void>(() => undefined))
		const controller = new AbortController()
		const readiness = waitForRenderResources({
			iframeDocument: document,
			signal: controller.signal,
		})
		controller.abort()

		await expect(readiness).rejects.toMatchObject({ name: "AbortError" })
	})
})
