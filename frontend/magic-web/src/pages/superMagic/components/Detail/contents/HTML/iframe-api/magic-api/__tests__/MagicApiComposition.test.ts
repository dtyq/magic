import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { magicApiPlugins } from "../index"
import {
	completionOnlyMethods,
	magicRequestCases,
	magicSuccessCases,
} from "./magic-api-request-cases"
import {
	callMagic,
	createMagicApiHarness,
	dispatchHostMessage,
	getMagicMember,
} from "./magic-api-test-helpers"

const namespaces = {
	fs: [
		"readFile",
		"writeFile",
		"listFiles",
		"listDir",
		"getFileUrl",
		"deleteFile",
		"deleteDir",
		"moveFile",
		"renameFile",
		"watchFile",
		"watchDir",
	],
	llm: ["getModels", "chat", "stream"],
	i18n: ["lang", "subscribe", "unsubscribe"],
	agent: ["getAgents"],
	project: [
		"uploadFiles",
		"addFilesToMessage",
		"downloadFiles",
		"createTopicAndSend",
		"sendMessage",
	],
	user: ["getInfo"],
	context: ["getContext"],
	db: [
		"getTables",
		"getProjectAdminAccess",
		"getTable",
		"createRow",
		"queryRows",
		"getRow",
		"updateRow",
		"deleteRow",
		"getRelations",
	],
}
const topLevel = [
	"getAppBasePath",
	"reload",
	"setInputMessage",
	"getAgents",
	"createTopicAndSend",
	"sendMessage",
	"uploadFiles",
	"addFilesToMessage",
	"downloadFiles",
	"getContext",
]

describe("Magic API plugin composition", () => {
	let host: ReturnType<typeof createMagicApiHarness>
	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
	})
	afterEach(() => host.cleanup())

	it.each(["declared", "reversed"])(
		"installs the complete public surface in %s order through the runtime registry",
		async (order) => {
			// Reset only the module registry to exercise both startup orders with real plugins.
			vi.resetModules()
			const { magicApiPlugins: plugins } = await import("../index")
			const { registerRuntimePlugins, installRegisteredRuntimePlugins } =
				await import("@dtyq/html-sandbox")
			const ordered = order === "declared" ? plugins : [...plugins].reverse()
			registerRuntimePlugins(ordered)
			installRegisteredRuntimePlugins()
			expect(Object.keys(window.Magic).sort()).toEqual(
				[...Object.keys(namespaces), ...topLevel].sort(),
			)
			for (const [name, members] of Object.entries(namespaces)) {
				expect(Object.keys(getMagicMember(name) as object).sort()).toEqual(
					[...members].sort(),
				)
				for (const member of members.filter((key) => key !== "lang")) {
					expect(getMagicMember(`${name}.${member}`)).toBeTypeOf("function")
				}
			}
			for (const method of topLevel) expect(getMagicMember(method)).toBeTypeOf("function")
			for (const alias of ["getAgents", "getContext", ...namespaces.project]) {
				const namespace =
					alias === "getAgents" ? "agent" : alias === "getContext" ? "context" : "project"
				expect(getMagicMember(alias)).toBe(getMagicMember(`${namespace}.${alias}`))
			}
			expect(Reflect.get(window, "reload")).toBe(window.Magic.reload)
			const methods = Object.entries(namespaces)
				.flatMap(([name, members]) =>
					members.filter((key) => key !== "lang").map((key) => `${name}.${key}`),
				)
				.concat(topLevel)
			const installed = methods.map(getMagicMember)
			registerRuntimePlugins(ordered)
			expect(methods.map(getMagicMember)).toEqual(installed)
			expect(host.pendingListeners()).toHaveLength(1) // i18n has one document-wide listener.
			expect(host.postMessage).not.toHaveBeenCalled()
		},
	)
})

describe("Magic API request lifecycle with all plugins installed", () => {
	let host: ReturnType<typeof createMagicApiHarness>
	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
		for (const Plugin of magicApiPlugins) new Plugin().install()
	})
	afterEach(() => host.cleanup())

	it.each(magicRequestCases)(
		"$method ($requestType) decodes success and releases resources",
		async ({ method, args, requestType }) => {
			const baseline = host.pendingListeners().length
			const pending = callMagic(method, ...args())
			expect(host.latestRequest().type).toBe(requestType)
			const success = magicSuccessCases[method]
			if (completionOnlyMethods.has(method)) {
				host.respond()
				await pending
			} else {
				if (!success) throw new Error(`Missing success fixture for ${method}`)
				host.respond(success.response)
				await expect(pending).resolves.toEqual(success.expected)
			}
			expect(host.pendingListeners()).toHaveLength(baseline)
			expect(vi.getTimerCount()).toBe(0)
		},
	)

	it.each(magicRequestCases)(
		"$method ($requestType) rejects host failure and releases resources",
		async ({ method, args, requestType }) => {
			const baseline = host.pendingListeners().length
			const pending = callMagic(method, ...args())
			expect(host.latestRequest().type).toBe(requestType)
			const rejected = expect(pending).rejects.toThrow("Host denied operation")
			host.respond({ success: false, error: "Host denied operation" })
			await rejected
			expect(host.pendingListeners()).toHaveLength(baseline)
			expect(vi.getTimerCount()).toBe(0)
		},
	)

	it.each(magicRequestCases)(
		"$method ($requestType) times out at its own deadline and releases resources",
		async ({ method, args, timeout }) => {
			const baseline = host.pendingListeners().length
			const pending = callMagic(method, ...args())
			const rejected = expect(pending).rejects.toThrow("timed out")
			await vi.advanceTimersByTimeAsync(timeout - 1)
			expect(host.pendingListeners()).toHaveLength(baseline + 1)
			expect(vi.getTimerCount()).toBe(1)
			await vi.advanceTimersByTimeAsync(1)
			await rejected
			expect(host.pendingListeners()).toHaveLength(baseline)
			expect(vi.getTimerCount()).toBe(0)
			// A late response must not recreate listeners or timers after rejection.
			host.respond()
			expect(host.pendingListeners()).toHaveLength(baseline)
			expect(vi.getTimerCount()).toBe(0)
		},
	)

	it("correlates concurrent calls across every API and ignores mismatched IDs/types", async () => {
		const baseline = host.pendingListeners().length
		const calls = magicRequestCases.map((testCase) => {
			const resolved = vi.fn()
			const pending = callMagic(testCase.method, ...testCase.args()).then(resolved)
			return { ...testCase, pending, resolved, request: host.latestRequest() }
		})
		expect(new Set(calls.map(({ request }) => request.requestId)).size).toBe(calls.length)
		expect(host.pendingListeners()).toHaveLength(baseline + calls.length)
		for (const { request } of calls) {
			dispatchHostMessage({
				type: "WRONG_RESPONSE",
				requestId: request.requestId,
				success: true,
			})
			dispatchHostMessage({
				type: request.type.replace(/_REQUEST$/, "_RESPONSE"),
				requestId: "wrong-id",
				success: true,
			})
		}
		await Promise.resolve()
		for (const { resolved } of calls) expect(resolved).not.toHaveBeenCalled()
		// Host responses may arrive in any order; only the matching promise may settle.
		for (const [index, call] of [...calls].reverse().entries()) {
			const message = {
				type: call.requestType.replace(/_REQUEST$/, "_RESPONSE"),
				requestId: call.request.requestId,
				success: true,
				...call.response,
			}
			dispatchHostMessage(message)
			await call.pending
			expect(call.resolved).toHaveBeenCalledOnce()
			expect(calls.filter(({ resolved }) => resolved.mock.calls.length)).toHaveLength(
				index + 1,
			)
			expect(host.pendingListeners()).toHaveLength(baseline + calls.length - index - 1)
			dispatchHostMessage(message)
			expect(call.resolved).toHaveBeenCalledOnce()
		}
		await Promise.all(calls.map(({ pending }) => pending))
		expect(vi.getTimerCount()).toBe(0)
	})

	it.each([
		["context.getContext", "invalid context response"],
		["db.getProjectAdminAccess", "Invalid project admin access response"],
	])("%s cleans up even when successful host data cannot be decoded", async (method, error) => {
		const baseline = host.pendingListeners().length
		const pending = callMagic(method)
		host.respond({ content: null })
		await expect(pending).rejects.toThrow(error)
		expect(host.pendingListeners()).toHaveLength(baseline)
		expect(vi.getTimerCount()).toBe(0)
	})
})
