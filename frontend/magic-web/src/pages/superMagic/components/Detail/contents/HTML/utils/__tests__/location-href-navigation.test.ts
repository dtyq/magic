import { describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({ getNestedIframeInterceptorScript: () => "" }))
vi.mock("virtual:magic-api", () => ({ default: "" }))
vi.mock("@/models/config", () => ({
	configStore: { cluster: { clusterCode: "" }, i18n: { language: "en_US" } },
}))

import { getFullContent, getLinkHandlingScript } from "../full-content"
import { normalizeHtmlPreviewPath, parseHtmlNavigationRequest } from "../html-navigation"
import { filterInjectedTags } from "../index"
import { rewriteLocationHref } from "../location-href-rewrite"
import { restoreLocationHref } from "../location-href-restore"

import { createRuntime } from "./html-navigation.test-helpers"

function getUserScript(source: string): string {
	const html = getFullContent(`<html><head><script id="user">${source}</script></head></html>`)
	return (
		new DOMParser().parseFromString(html, "text/html").querySelector("#user")?.textContent ?? ""
	)
}

describe("HTML location.href navigation", () => {
	it.each([
		"window.location.href",
		"window.location",
		"location",
		"document.location",
		"self.location",
		'globalThis["location"]',
		"location.href",
		'window["location"]["href"]',
		"window . location . href",
	])(
		"forwards %s assignments without native navigation when Navigation API is absent",
		(target) => {
			const runtime = createRuntime()
			runtime.run(getUserScript(`${target} = '../detail.html?mode=preview#summary'`))
			expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					type: "linkClicked",
					href: "/detail.html?mode=preview#summary",
					originalHref: "../detail.html?mode=preview#summary",
				}),
				"*",
			)
			expect(runtime.nativeNavigate).not.toHaveBeenCalled()
		},
	)

	it.each(["location.assign", "window.location.replace", 'document["location"]["assign"]'])(
		"rewrites unforgeable %s methods",
		(method) => {
			const runtime = createRuntime()
			runtime.run(getUserScript(`${method}('detail.html')`))
			expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					href: "/pages/detail.html",
					target: "_self",
					history: method.includes("replace") ? "replace" : "push",
				}),
				"*",
			)
			expect(runtime.nativeNavigate).not.toHaveBeenCalled()
			expect(runtime.frame.location.replace).not.toHaveBeenCalled()
		},
	)

	it("preserves shadowed Location method receivers and saved author source", () => {
		const runtime = createRuntime()
		const source =
			"return (function(location) { return location.replace('local') })({ replace(value) { return value } })"
		const rewritten = rewriteLocationHref(source)
		expect(runtime.run(rewritten)).toBe("local")
		expect(restoreLocationHref(rewritten)).toBe(source)
		expect(rewriteLocationHref(rewritten)).toBe(rewritten)
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("keeps hash assign/replace in the current document and preserves replace intent", () => {
		const runtime = createRuntime()
		runtime.run(getUserScript("location.assign('#/route')"))
		expect(runtime.frame.location.hash).toBe("#/route")
		runtime.run(getUserScript("location.replace('#summary')"))
		expect(runtime.frame.location.replace).toHaveBeenCalledWith(
			"https://preview.test/sandbox.html#summary",
		)
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it.each([
		"return (function(location) { location = 'local'; return location; })({})",
		"return (function(window) { window.location = 'local'; return window.location; })({location: {}})",
		"return (function(document) { document.location = 'local'; return document.location; })({location: {}})",
	])("preserves local variables in direct Location assignments: %s", (source) => {
		const runtime = createRuntime()
		const rewritten = rewriteLocationHref(source)
		expect(runtime.run(rewritten)).toBe("local")
		expect(restoreLocationHref(rewritten)).toBe(source)
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it.each(["location", "window.location", "document.location"])(
		"restores direct %s assignments and evaluates once",
		(target) => {
			const source = `return (${target} = window.value)`
			const rewritten = rewriteLocationHref(source)
			const runtime = createRuntime()
			const value = { toString: vi.fn(() => "detail.html") }
			Object.assign(runtime.frame, { value })
			expect(runtime.run(rewritten)).toBe(value)
			expect(value.toString).toHaveBeenCalledTimes(1)
			expect(runtime.postMessage).toHaveBeenCalledOnce()
			expect(restoreLocationHref(rewritten)).toBe(source)
			expect(rewriteLocationHref(rewritten)).toBe(rewritten)
		},
	)

	it("preserves assignment values and evaluates the destination once", () => {
		const runtime = createRuntime()
		const value = { toString: vi.fn(() => "detail.html") }
		Object.assign(runtime.frame, { value })
		const result = runtime.run(getUserScript("return (location.href = window.value)"))
		expect(result).toBe(value)
		expect(value.toString).toHaveBeenCalledTimes(1)
		expect(runtime.postMessage).toHaveBeenCalledTimes(1)
	})

	it.each(["https://external.test/page", "mailto:a@example.test"])(
		"retains native behavior for %s",
		(url) => {
			const runtime = createRuntime()
			runtime.run(getUserScript(`location.href = ${JSON.stringify(url)}`))
			expect(runtime.postMessage).not.toHaveBeenCalled()
			expect(runtime.nativeNavigate).toHaveBeenCalledExactlyOnceWith(url)
		},
	)

	it.each(["#summary", "#/settings"])("updates the current document hash for %s", (hash) => {
		const runtime = createRuntime()
		runtime.run(getUserScript(`location.href = ${JSON.stringify(hash)}`))
		expect(runtime.frame.location.hash).toBe(hash)
		expect(runtime.nativeNavigate).not.toHaveBeenCalled()
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("preserves reads, strings, comments, regexes and unrelated properties", () => {
		const source = `
// location.href = 'comment.html'
var example = "window.location.href = 'text.html'";
var pattern = /location.href = 'regex.html'/;
var current = window.location.href;
obj.window.location.href = 'object.html';
previewwindow.location.href = 'other.html';`
		expect(rewriteLocationHref(source)).toBe(source)
	})

	it.each(["location", "window"])("preserves locally shadowed %s", (name) => {
		const runtime = createRuntime()
		const code =
			name === "location"
				? `(function(location) { location.href = 'local'; return location.href; })({})`
				: `(function(window) { window.location.href = 'local'; return window.location.href; })({location: {}})`
		expect(runtime.run(getUserScript(`return ${code}`))).toBe("local")
		expect(runtime.postMessage).not.toHaveBeenCalled()
		expect(runtime.nativeNavigate).not.toHaveBeenCalled()
	})

	it("resolves UTF-8 paths from a Chinese folder to project files", () => {
		const runtime = createRuntime()
		runtime.run(getLinkHandlingScript("中文场景/index.html"))

		function postedPath(source: string) {
			runtime.postMessage.mockClear()
			runtime.run(getUserScript(source))
			const href = runtime.postMessage.mock.calls[0]?.[0]?.href as string
			const parsed = parseHtmlNavigationRequest(href)
			return {
				filePath: normalizeHtmlPreviewPath(parsed?.filePath),
				search: parsed?.search,
				hash: parsed?.hash,
			}
		}

		expect(postedPath("location.href = './目标页面.html'")).toEqual({
			filePath: "中文场景/目标页面.html",
			search: "",
			hash: "",
		})
		expect(postedPath("location.href = './目标页面.html?keyword=测试#section-a'")).toEqual({
			filePath: "中文场景/目标页面.html",
			search: "?keyword=%E6%B5%8B%E8%AF%95",
			hash: "#section-a",
		})
		expect(postedPath("location.href = './子文件夹/深层页面.html'")).toEqual({
			filePath: "中文场景/子文件夹/深层页面.html",
			search: "",
			hash: "",
		})
		expect(postedPath("location.href = '../detail.html'")).toEqual({
			filePath: "detail.html",
			search: "",
			hash: "",
		})
		expect(postedPath("location.href = '?from=chinese-folder'")).toEqual({
			filePath: "中文场景/index.html",
			search: "?from=chinese-folder",
			hash: "",
		})
		expect(postedPath("window.open('./目标页面.html')")).toEqual({
			filePath: "中文场景/目标页面.html",
			search: "",
			hash: "",
		})
		expect(postedPath("location.replace('./目标页面.html')")).toEqual({
			filePath: "中文场景/目标页面.html",
			search: "",
			hash: "",
		})
		expect(postedPath("location.assign('./目标页面.html')")).toEqual({
			filePath: "中文场景/目标页面.html",
			search: "",
			hash: "",
		})

		runtime.run(getLinkHandlingScript("中文场景/子文件夹/深层页面.html"))
		expect(postedPath("location.href = '../../index.html'")).toEqual({
			filePath: "index.html",
			search: "",
			hash: "",
		})
	})

	it("uses the new file directory when the same preview window is reused", () => {
		const runtime = createRuntime()
		runtime.run(getLinkHandlingScript("other/deep/index.html"))
		runtime.run(getUserScript("location.href = 'detail.html'"))
		expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ href: "/other/deep/detail.html" }),
			"*",
		)
	})

	it.each([
		"(function(globalThis, location) { location.href = 'local'; return location.href; })({}, {})",
		"(function({globalThis}, location) { location.href = 'local'; return location.href; })({}, {})",
		"(function([globalThis], location) { location.href = 'local'; return location.href; })([], {})",
		"(function(globalThis, window, location) { location.href = 'local'; return location.href; })({}, {}, {})",
		"(function(location) { location.href = 'local'; var globalThis = {}; return location.href; })({})",
		"(function(location) { location.href = 'local'; const globalThis = {}; return location.href; })({})",
	])("preserves local assignment when global object names are shadowed: %s", (source) => {
		const runtime = createRuntime()
		expect(runtime.run(rewriteLocationHref(`return ${source}`))).toBe("local")
		expect(runtime.postMessage).not.toHaveBeenCalled()
	})

	it("still intercepts native location when globalThis is shadowed", () => {
		const runtime = createRuntime()
		runtime.run(
			rewriteLocationHref("(function(globalThis) { location.href = 'detail.html' })({})"),
		)
		expect(runtime.postMessage).toHaveBeenCalledOnce()
		expect(runtime.nativeNavigate).not.toHaveBeenCalled()
	})

	it("leaves code unchanged when no safe global name is available", () => {
		const source =
			"(function(globalThis, window, self, location) { location.href = 'local' })({}, {}, {}, {})"
		expect(rewriteLocationHref(source)).toBe(source)
		const dynamicScope = "with (state) { location.href = 'local' }"
		expect(rewriteLocationHref(dynamicScope)).toBe(dynamicScope)
	})

	it("avoids imported, catch and destructured global bindings", () => {
		for (const source of [
			"import globalThis from './helper.js'; location.href = 'detail.html'",
			"try {} catch (globalThis) { location.href = 'detail.html' }",
			"const {value: globalThis = {}} = {}; location.href = 'detail.html'",
			"const {...globalThis} = {}; location.href = 'detail.html'",
		]) {
			expect(rewriteLocationHref(source, "module")).toContain(
				"window.__MAGIC_HTML_NAVIGATION_RUNTIME__.getLocation",
			)
		}
	})

	it("rewrites inline event handlers and restores their quotes on save", () => {
		const source = `return window["location"].href = "detail.html?x=1&y=2"`
		const html = getFullContent(
			`<html><body><button onclick='${source}'>Open</button></body></html>`,
		)
		const doc = new DOMParser().parseFromString(html, "text/html")
		const runtime = createRuntime()
		runtime.run(doc.querySelector("button")?.getAttribute("onclick") ?? "")
		expect(runtime.postMessage).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ href: "/pages/detail.html?x=1&y=2" }),
			"*",
		)
		const saved = filterInjectedTags(html, new Map())
		const savedDoc = new DOMParser().parseFromString(saved, "text/html")
		expect(savedDoc.querySelector("button")?.getAttribute("onclick")).toBe(source)
		expect(saved).not.toContain("__MAGIC_LOCATION_")
	})

	it("restores author scripts when saving and is idempotent across preview processing", () => {
		const source = `window /* comment */ .location.href = 'detail.html'`
		const rewritten = rewriteLocationHref(source)
		expect(rewriteLocationHref(rewritten)).toBe(rewritten)
		expect(restoreLocationHref(rewritten)).toBe(source)
		const html = getFullContent(
			`<html><head><script id="user">${source}</script></head></html>`,
		)
		const saved = new DOMParser().parseFromString(
			filterInjectedTags(html, new Map()),
			"text/html",
		)
		expect(saved.querySelector("#user")?.textContent).toBe(source)
	})

	it("supports modules and skips inert scripts and invalid syntax", () => {
		const source = "export function go() { location.href = 'detail.html' }"
		const html = getFullContent(
			`<html><head><script type="module">${source}</script><script type="text/plain">location.href = 'example'</script></head></html>`,
		)
		const doc = new DOMParser().parseFromString(html, "text/html")
		expect(doc.querySelector('[type="module"]')?.textContent).toContain("getLocation")
		expect(doc.querySelector('[type="text/plain"]')?.textContent).toBe(
			"location.href = 'example'",
		)
		expect(rewriteLocationHref("location.href = (")).toBe("location.href = (")
	})
})
