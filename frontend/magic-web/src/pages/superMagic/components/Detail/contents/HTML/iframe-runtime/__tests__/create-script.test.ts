import { describe, expect, it, vi } from "vitest"
import { createContext, runInContext } from "node:vm"
import { createIframeRuntimeScript } from "../create-script"

describe("compiled iframe installers", () => {
	it("passes hostile HTML and Unicode as exact data without closing its script element", () => {
		const options = {
			search: '?value=</script><script>throw new Error("injected")</script>&\u2028\u2029',
			hash: '#quotes"\\newline\n',
			requestId: "<request>",
		}
		const script = createIframeRuntimeScript("navigation", options)
		const parsed = new DOMParser().parseFromString(
			`<script>${script}</script><p>after</p>`,
			"text/html",
		)
		expect(parsed.querySelectorAll("script")).toHaveLength(1)
		expect(parsed.querySelector("p")?.textContent).toBe("after")
		const target = {
			location: { pathname: "/preview" },
			history: { replaceState: vi.fn() },
			__MAGIC_HTML_NAVIGATION__: undefined,
		}
		new Function("window", parsed.querySelector("script")?.textContent || "")(target)
		expect(target.__MAGIC_HTML_NAVIGATION__).toEqual(options)
		expect(target.history.replaceState).toHaveBeenCalledWith(
			null,
			"",
			"/preview" + options.search + options.hash,
		)
	})

	it("keeps the navigation state when a srcdoc history replacement is denied", () => {
		const options = { search: "?a=1", hash: "#heading", requestId: "navigation-2" }
		const target = {
			location: { pathname: "blank" },
			history: {
				replaceState: () => {
					throw new DOMException("Denied", "SecurityError")
				},
			},
			__MAGIC_HTML_NAVIGATION__: undefined,
		}
		expect(() =>
			new Function("window", createIframeRuntimeScript("navigation", options))(target),
		).not.toThrow()
		expect(target.__MAGIC_HTML_NAVIGATION__).toEqual(options)
	})

	it("compiled fallback installers run repeatedly without namespace leakage", () => {
		const documentTarget = {}
		const target = { memoryCookies: undefined, document: documentTarget, window: {} }
		target.window = target
		const context = createContext(target)
		const script = createIframeRuntimeScript("legacy-cookie", {})
		// Execute as a global script, not a Function that would hide a leaked var itself.
		const execute = () => runInContext(script, context)
		execute()
		Reflect.set(documentTarget, "cookie", "fixture=hello")
		execute()
		expect(Reflect.get(documentTarget, "cookie")).toContain("fixture=hello")
		expect(target).not.toHaveProperty("MagicIframeInstaller")
	})
})
