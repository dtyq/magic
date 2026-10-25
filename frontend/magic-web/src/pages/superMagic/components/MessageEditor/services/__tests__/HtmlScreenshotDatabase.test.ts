import { afterEach, describe, expect, it } from "vitest"
import { htmlScreenshotDatabase, resetHtmlScreenshotDatabase } from "../HtmlScreenshotDatabase"

function readBlobText(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result))
		reader.onerror = () => reject(reader.error)
		reader.readAsText(blob)
	})
}

describe("HtmlScreenshotDatabase", () => {
	afterEach(async () => {
		await resetHtmlScreenshotDatabase()
	})

	it("stores and reads a blob by capture id", async () => {
		const blob = new Blob(["png"], { type: "image/png" })

		await htmlScreenshotDatabase.put("element:#hero:1", blob)

		const stored = await htmlScreenshotDatabase.get("element:#hero:1")
		expect(stored).toBeTruthy()
		expect(await readBlobText(stored as Blob)).toBe("png")
	})

	it("overwrites the same capture id on recapture", async () => {
		await htmlScreenshotDatabase.put(
			"element:#hero:1",
			new Blob(["old"], { type: "image/png" }),
		)
		await htmlScreenshotDatabase.put(
			"element:#hero:1",
			new Blob(["new"], { type: "image/png" }),
		)

		const stored = await htmlScreenshotDatabase.get("element:#hero:1")
		expect(await readBlobText(stored as Blob)).toBe("new")
	})

	it("returns null for an expired capture", async () => {
		await htmlScreenshotDatabase.put(
			"element:#hero:1",
			new Blob(["png"], { type: "image/png" }),
			-1,
		)

		expect(await htmlScreenshotDatabase.get("element:#hero:1")).toBeNull()
	})

	it("deletes a capture", async () => {
		await htmlScreenshotDatabase.put(
			"element:#hero:1",
			new Blob(["png"], { type: "image/png" }),
		)
		await htmlScreenshotDatabase.delete("element:#hero:1")

		expect(await htmlScreenshotDatabase.get("element:#hero:1")).toBeNull()
	})

	it("sweeps expired records without reading them", async () => {
		await htmlScreenshotDatabase.put("keep", new Blob(["keep"], { type: "image/png" }))
		await htmlScreenshotDatabase.put("gone", new Blob(["gone"], { type: "image/png" }), -1)

		const removed = await htmlScreenshotDatabase.deleteExpired()

		expect(removed).toBe(1)
		expect(await htmlScreenshotDatabase.get("keep")).toBeTruthy()
		expect(await htmlScreenshotDatabase.get("gone")).toBeNull()
	})
})
