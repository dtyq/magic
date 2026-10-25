import { vi } from "vitest"
import { getLinkHandlingScript } from "../full-content"

export function createRuntime(withNavigation = false) {
	const postMessage = vi.fn()
	const nativeNavigate = vi.fn()
	const location = {
		origin: "https://preview.test",
		pathname: "/sandbox.html",
		search: "",
		hash: "",
		assign: nativeNavigate,
		replace: vi.fn(),
	}
	Object.defineProperty(location, "href", {
		get: () => "https://preview.test/sandbox.html",
		set: nativeNavigate,
		configurable: false,
	})
	// Match native Location: neither href nor assign/replace can be patched.
	for (const method of ["assign", "replace"] as const) {
		Object.defineProperty(location, method, {
			value: location[method],
			writable: false,
			configurable: false,
		})
	}
	const nativeNavigation = vi.fn()
	const nativeOpen = vi.fn()
	const navigation = { navigate: nativeNavigation, addEventListener: vi.fn() }
	const listeners = new Map<string, (event: Event) => void>()
	const frame = {
		location,
		navigation: withNavigation ? navigation : undefined,
		postMessage,
		open: nativeOpen,
		addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
		removeEventListener: vi.fn((name) => listeners.delete(name)),
	}
	Object.assign(frame, { parent: frame, self: frame })
	const doc = new DOMParser().parseFromString(
		"<html><head></head><body></body></html>",
		"text/html",
	)
	const documentFacade = {
		location,
		baseURI: "https://preview.test/sandbox.html",
		querySelector: doc.querySelector.bind(doc),
	}
	const run = (code: string) =>
		new Function("window", "document", "globalThis", "location", "self", code)(
			frame,
			documentFacade,
			frame,
			location,
			frame,
		)

	run(getLinkHandlingScript("pages/index.html"))
	const click = (
		markup: string,
		options: MouseEventInit = {},
		type = "click",
		targetSelector = "a, [data-magic-href]",
	) => {
		doc.body.innerHTML = markup
		const event = new MouseEvent(type, { cancelable: true, ...options })
		Object.defineProperty(event, "target", { value: doc.querySelector(targetSelector) })
		listeners.get(type)?.(event)
		return event
	}
	const submit = (markup: string, cancelled = false) => {
		doc.body.innerHTML = markup
		const event = new SubmitEvent("submit", {
			cancelable: true,
			submitter: doc.querySelector("button"),
		})
		Object.defineProperty(event, "target", { value: doc.querySelector("form") })
		if (cancelled) event.preventDefault()
		listeners.get("submit")?.(event)
		return event
	}
	return {
		run,
		postMessage,
		nativeNavigate,
		nativeOpen,
		frame,
		doc,
		click,
		navigation,
		nativeNavigation,
		submit,
	}
}
