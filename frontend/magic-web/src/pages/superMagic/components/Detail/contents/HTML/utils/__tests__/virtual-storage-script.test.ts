import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as storageHost from "../virtual-storage"
import {
	createStorageRuntime,
	requestResult,
	transactionDone,
} from "./virtual-storage-runtime-harness"

describe.each(["memory", "indexedDB"])("cached HTML script injection (%s)", (backend) => {
	const runtimes: Awaited<ReturnType<typeof createStorageRuntime>>[] = []

	beforeEach(() => {
		vi.stubGlobal("indexedDB", backend === "memory" ? undefined : new IDBFactory())
		vi.spyOn(console, "log").mockImplementation(() => undefined)
		storageHost.resetVirtualStorageForTests()
	})

	afterEach(async () => {
		for (const runtime of runtimes.splice(0)) {
			await runtime.flush()
			runtime.close()
		}
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		storageHost.resetVirtualStorageForTests()
	})

	it("refreshes persisted HTML through the HTML parser without leaking markup or changing data", async () => {
		const namespace = "cached-html-refresh"
		const cachedHtml = [
			"<!DOCTYPE html><html><head>",
			'<script>window.report = "门店巴";</script>',
			"</head><body><h1>Report & details</h1></body></html>",
			'</ScRiPt ><script>window.leaked = true</script><img id="leaked">',
			'<!-- <script> quotes: " \\ newline: \n Unicode: \u2028\u2029',
		].join("\n")
		const original = await createStorageRuntime(namespace)
		runtimes.push(original)
		original.frame.localStorage.setItem("html-copy", cachedHtml)
		const opening = original.frame.indexedDB.open("reports", 1)
		opening.onupgradeneeded = () => opening.result.createObjectStore("cache")
		const database = await requestResult(opening)
		const write = database.transaction("cache", "readwrite")
		const written = transactionDone(write)
		await requestResult(write.objectStore("cache").put(cachedHtml, "report"))
		await written
		await original.flush()
		database.close()
		original.close()
		runtimes.pop()

		// A preview refresh serializes the persisted snapshot into an inline script.
		// Parsing that script is essential: eval alone cannot catch premature </script> closure.
		const refreshed = await createStorageRuntime(namespace, {
			...storageHost,
			getVirtualStorageBridgeScript(context) {
				const script = storageHost.getVirtualStorageBridgeScript(context)
				const parsed = new DOMParser().parseFromString(
					`<!DOCTYPE html><script>${script}</script><p id="preview">Ready</p>`,
					"text/html",
				)
				expect(parsed.querySelectorAll("script")).toHaveLength(1)
				expect(parsed.body.innerHTML).toBe('<p id="preview">Ready</p>')
				return parsed.querySelector("script")?.textContent || ""
			},
		})
		runtimes.push(refreshed)
		expect(refreshed.frame.localStorage.getItem("html-copy")).toBe(cachedHtml)
		const restoredDatabase = await requestResult(refreshed.frame.indexedDB.open("reports", 1))
		const read = restoredDatabase.transaction("cache")
		const readDone = transactionDone(read)
		expect(await requestResult(read.objectStore("cache").get("report"))).toBe(cachedHtml)
		await readDone
		restoredDatabase.close()
		expect(refreshed.frame).not.toHaveProperty("leaked")
	})
})
