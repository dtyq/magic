import { vi } from "vitest"

export function getMagicMember(path: string): unknown {
	return path.split(".").reduce<unknown>((value, key) => {
		return (value as Record<string, unknown>)[key]
	}, window.Magic)
}

export function callMagic(path: string, ...args: unknown[]): Promise<unknown> {
	return (getMagicMember(path) as (...values: unknown[]) => Promise<unknown>)(...args)
}

export function dispatchHostMessage(data: unknown): void {
	window.dispatchEvent(
		new MessageEvent("message", {
			data,
			source: window.parent,
			origin: window.location.origin,
		}),
	)
}

/** Only the host transport is replaced; real API classes, timers and listeners run. */
export function createMagicApiHarness() {
	const previousReload = Object.getOwnPropertyDescriptor(window, "reload")
	window.Magic = {}
	const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined)
	const addListener = vi.spyOn(window, "addEventListener")
	const removeListener = vi.spyOn(window, "removeEventListener")

	function latestRequest() {
		const call = postMessage.mock.calls.at(-1)
		if (!call) throw new Error("Expected an outbound host request")
		return call[0] as { type: string; requestId: string; [key: string]: unknown }
	}

	function pendingListeners() {
		return addListener.mock.calls.filter(
			([type, listener]) =>
				type === "message" &&
				!removeListener.mock.calls.some(
					([removedType, removed]) => removedType === type && removed === listener,
				),
		)
	}

	return {
		postMessage,
		latestRequest,
		pendingListeners,
		respond(fields: Record<string, unknown> = {}) {
			const request = latestRequest()
			dispatchHostMessage({
				type: request.type.replace(/_REQUEST$/, "_RESPONSE"),
				requestId: request.requestId,
				success: true,
				...fields,
			})
		},
		cleanup() {
			// Some APIs keep document-wide subscriptions; isolate them between test cases.
			for (const [type, listener, options] of addListener.mock.calls) {
				window.removeEventListener(type, listener, options)
			}
			window.Magic = {}
			if (previousReload) Object.defineProperty(window, "reload", previousReload)
			else Reflect.deleteProperty(window, "reload")
			vi.restoreAllMocks()
			vi.useRealTimers()
		},
	}
}
