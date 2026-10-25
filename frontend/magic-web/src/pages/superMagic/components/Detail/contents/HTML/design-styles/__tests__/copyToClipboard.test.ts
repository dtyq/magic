import { afterEach, describe, expect, it, vi } from "vitest"
import { copyToClipboard } from "../copyToClipboard"

describe("copyToClipboard", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("uses the async clipboard API when available", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		})

		expect(await copyToClipboard("#2563eb")).toBe(true)
		expect(writeText).toHaveBeenCalledWith("#2563eb")
	})

	it("falls back to execCommand when async clipboard is unavailable", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		})
		const execCommand = vi.fn().mockReturnValue(true)
		Object.defineProperty(document, "execCommand", {
			configurable: true,
			value: execCommand,
		})

		expect(await copyToClipboard("16px")).toBe(true)
		expect(execCommand).toHaveBeenCalledWith("copy")
		expect(document.body.querySelector("textarea")).toBeNull()
	})
})
