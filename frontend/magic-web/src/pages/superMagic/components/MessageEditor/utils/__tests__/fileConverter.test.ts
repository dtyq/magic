import { afterEach, describe, expect, it, vi } from "vitest"
import { arrayBufferToFile, base64ToFile } from "../fileConverter"

describe("base64ToFile", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("decodes data URLs without using fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch")

		const file = await base64ToFile("data:image/png;base64,AAE=", "screenshot.png")

		expect(fetchSpy).not.toHaveBeenCalled()
		expect(file.type).toBe("image/png")
		expect(file.name).toBe("screenshot.png")
		expect(file.size).toBe(2)
	})

	it("rejects malformed base64 payloads", async () => {
		await expect(base64ToFile("data:image/png;base64,not-valid!", "image.png")).rejects.toThrow(
			"Invalid base64 payload",
		)
		await expect(base64ToFile("A=", "image.png")).rejects.toThrow("Invalid base64 payload")
	})

	it("rejects payloads above the configured byte limit before allocation", async () => {
		await expect(base64ToFile("data:image/png;base64,AAAA", "image.png", 2)).rejects.toThrow(
			"Base64 file exceeds the 2 byte limit",
		)
	})

	it("rejects oversized encoded input before decoding", async () => {
		await expect(base64ToFile("A".repeat(5000), "image.png", 1)).rejects.toThrow(
			"Base64 input exceeds the 1 byte limit",
		)
	})

	it("creates a File from transferable ArrayBuffer data", () => {
		const file = arrayBufferToFile(new Uint8Array([1, 2]).buffer, "image.png", "image/png")

		expect(file.type).toBe("image/png")
		expect(file.size).toBe(2)
	})
})
