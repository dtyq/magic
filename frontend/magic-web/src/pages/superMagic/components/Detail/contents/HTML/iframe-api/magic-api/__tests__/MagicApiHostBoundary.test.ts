import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { magicApiPlugins } from "../index"
import { magicRequestCases, magicSuccessCases } from "./magic-api-request-cases"
import { callMagic, createMagicApiHarness, dispatchHostMessage } from "./magic-api-test-helpers"

describe("Magic API trusted host boundary", () => {
	let harness: ReturnType<typeof createMagicApiHarness>
	let peer: HTMLIFrameElement
	beforeEach(() => {
		vi.useFakeTimers()
		harness = createMagicApiHarness()
		peer = document.createElement("iframe")
		document.body.append(peer)
		for (const Plugin of magicApiPlugins) new Plugin().install()
	})
	afterEach(() => {
		peer.remove()
		harness.cleanup()
	})

	it.each(magicRequestCases)(
		"$method ignores matching responses from other windows and origins",
		async (testCase) => {
			const settle = vi.fn()
			const promise = callMagic(testCase.method, ...testCase.args())
			void promise.then(settle, settle)
			const request = harness.latestRequest()
			const data = {
				type: request.type.replace(/_REQUEST$/, "_RESPONSE"),
				requestId: request.requestId,
				success: true,
				...(magicSuccessCases[testCase.method]?.response ?? testCase.response),
			}
			for (const sender of [
				{ source: null, origin: window.location.origin },
				{ source: peer.contentWindow, origin: window.location.origin },
				{ source: window.parent, origin: "https://other.example" },
			])
				window.dispatchEvent(new MessageEvent("message", { ...sender, data }))
			await Promise.resolve()
			expect(settle).not.toHaveBeenCalled()
			dispatchHostMessage(data)
			await promise
			expect(settle).toHaveBeenCalledOnce()
		},
	)

	it("ignores stream chunks from a peer and still accepts the real host", () => {
		const chunk = vi.fn()
		const abort = window.Magic.llm?.stream([{ role: "user", content: "hello" }], chunk)
		const request = harness.latestRequest()
		const data = {
			type: "MAGIC_LLM_STREAM_CHUNK",
			requestId: request.requestId,
			delta: "host",
			done: false,
		}
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: peer.contentWindow,
				origin: window.location.origin,
			}),
		)
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
				origin: "https://other.example",
			}),
		)
		expect(chunk).not.toHaveBeenCalled()
		dispatchHostMessage(data)
		expect(chunk).toHaveBeenCalledWith("host", false)
		abort?.()
	})

	it("does not deliver forged language or file-watch events", () => {
		const language = vi.fn()
		const file = vi.fn()
		const directory = vi.fn()
		window.Magic.i18n?.subscribe(language)
		const unwatchFile = window.Magic.fs?.watchFile("a.txt", file)
		const unwatchDir = window.Magic.fs?.watchDir("app", directory)
		const events = [
			{ type: "MAGIC_I18N_LANG_SUBSCRIBE", success: true, results: { lang: "en_US" } },
			{ type: "MAGIC_FS_FILE_CHANGED", path: "a.txt", timestamp: 1 },
			{ type: "MAGIC_FS_DIR_CHANGED", dir: "app", timestamp: 1 },
		]
		for (const data of events)
			window.dispatchEvent(
				new MessageEvent("message", { data, source: null, origin: window.location.origin }),
			)
		expect(language).not.toHaveBeenCalled()
		expect(file).not.toHaveBeenCalled()
		expect(directory).not.toHaveBeenCalled()
		for (const data of events) dispatchHostMessage(data)
		expect(language).toHaveBeenCalledOnce()
		expect(file).toHaveBeenCalledOnce()
		expect(directory).toHaveBeenCalledOnce()
		unwatchFile?.()
		unwatchDir?.()
	})
})
