import { describe, expect, it } from "vitest"
import {
	getHtmlNavigationKey,
	isHtmlPreviewShellNavigation,
	normalizeHtmlPreviewPath,
	parseHtmlNavigationRequest,
	resolveRootHtmlIndexFallback,
} from "../html-navigation"

describe("parseHtmlNavigationRequest", () => {
	it("separates a relative path, query, hash, and normalized anchor", () => {
		expect(
			parseHtmlNavigationRequest("./detail.html?reportId=123&source=home#Summary"),
		).toEqual({
			filePath: "./detail.html",
			search: "?reportId=123&source=home",
			hash: "#Summary",
			anchor: "summary",
		})
	})

	it("supports same-document query and hash navigation", () => {
		expect(parseHtmlNavigationRequest("?mode=preview#result")).toEqual({
			filePath: "",
			search: "?mode=preview",
			hash: "#result",
			anchor: "result",
		})
	})

	it("converts same-origin absolute URLs to a matchable path", () => {
		expect(
			parseHtmlNavigationRequest(
				"https://app.example.test/pages/detail.html?reportId=123#result",
				"https://app.example.test/pages/index.html",
			),
		).toEqual({
			filePath: "/pages/detail.html",
			search: "?reportId=123",
			hash: "#result",
			anchor: "result",
		})
	})

	it("rejects external and non-document URLs", () => {
		expect(
			parseHtmlNavigationRequest(
				"https://external.example.test/detail.html?reportId=123",
				"https://app.example.test/pages/index.html",
			),
		).toBeNull()
		expect(parseHtmlNavigationRequest("mailto:user@example.test")).toBeNull()
	})

	it("changes when the same file receives a new navigation state", () => {
		const first = {
			filePath: "page1.html",
			search: "?value=123",
			hash: "",
			anchor: "",
		}
		const second = { ...first, search: "?value=456" }

		expect(getHtmlNavigationKey(first)).not.toBe(getHtmlNavigationKey(second))
		expect(getHtmlNavigationKey()).toBe("")
	})
})

describe("isHtmlPreviewShellNavigation", () => {
	it("treats same-document husky shell rewrites as non-user navigation", () => {
		expect(isHtmlPreviewShellNavigation("/husky.html")).toBe(true)
		expect(isHtmlPreviewShellNavigation("husky.html")).toBe(true)
		expect(isHtmlPreviewShellNavigation("https://app.example.test/husky.html")).toBe(true)
		expect(
			isHtmlPreviewShellNavigation(
				"https://husky.example/index.html",
				"https://husky.example/index.html",
			),
		).toBe(true)
	})

	it("keeps project HTML files as user navigation", () => {
		expect(isHtmlPreviewShellNavigation("cover.html")).toBe(false)
		expect(isHtmlPreviewShellNavigation("/slides/cover.html")).toBe(false)
		expect(isHtmlPreviewShellNavigation("./2 新建幻灯片 2.html")).toBe(false)
	})

	it("does not treat project files named husky.html as the preview shell", () => {
		expect(isHtmlPreviewShellNavigation("slides/husky.html")).toBe(false)
		expect(isHtmlPreviewShellNavigation("/slides/husky.html")).toBe(false)
		expect(isHtmlPreviewShellNavigation("./husky.html")).toBe(false)
		expect(
			isHtmlPreviewShellNavigation("slides/husky.html", "https://husky.example/index.html"),
		).toBe(false)
	})

	it("does not block project index.html links when using an external index.html shell", () => {
		const shell = "https://husky.example/index.html"
		expect(isHtmlPreviewShellNavigation("index.html", shell)).toBe(false)
		expect(isHtmlPreviewShellNavigation("./index.html", shell)).toBe(false)
		expect(isHtmlPreviewShellNavigation("/index.html", shell)).toBe(false)
		expect(isHtmlPreviewShellNavigation("https://other.example/index.html", shell)).toBe(false)
	})
})

describe("html preview path matching", () => {
	it("normalizes slashes, leading dots, and repeated relative prefixes", () => {
		expect(normalizeHtmlPreviewPath("\\index.html")).toBe("index.html")
		expect(normalizeHtmlPreviewPath("././index.html")).toBe("index.html")
		expect(normalizeHtmlPreviewPath("/admin/index.html")).toBe("admin/index.html")
	})

	it("decodes UTF-8 percent-encoded preview paths for file matching", () => {
		expect(
			normalizeHtmlPreviewPath(
				"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/%E7%9B%AE%E6%A0%87%E9%A1%B5%E9%9D%A2.html",
			),
		).toBe("中文场景/目标页面.html")
		expect(
			normalizeHtmlPreviewPath(
				"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/%E5%AD%90%E6%96%87%E4%BB%B6%E5%A4%B9/%E6%B7%B1%E5%B1%82%E9%A1%B5%E9%9D%A2.html",
			),
		).toBe("中文场景/子文件夹/深层页面.html")
		expect(normalizeHtmlPreviewPath("my%20file.html")).toBe("my file.html")
	})

	it("keeps unicode paths and malformed encodings unchanged", () => {
		expect(normalizeHtmlPreviewPath("中文场景/目标页面.html")).toBe("中文场景/目标页面.html")
		expect(normalizeHtmlPreviewPath("%E7%ZZ.html")).toBe("%E7%ZZ.html")
		// decodeURI must not turn an encoded slash into a new path segment.
		expect(normalizeHtmlPreviewPath("folder/foo%2Fbar.html")).toBe("folder/foo%2Fbar.html")
	})

	it("only falls back to a unique root index.html path", () => {
		const nested = {
			file_id: "nested",
			file_name: "index.html",
			relative_file_path: "admin/index.html",
		}
		const emptyPath = {
			file_id: "empty",
			file_name: "index.html",
			relative_file_path: "",
		}
		const root = {
			file_id: "root",
			file_name: "index.html",
			relative_file_path: "index.html",
		}

		expect(resolveRootHtmlIndexFallback("index.html", [nested, emptyPath])).toBeUndefined()
		expect(resolveRootHtmlIndexFallback("index.html", [nested, emptyPath, root])).toEqual(root)
		expect(resolveRootHtmlIndexFallback("pages/home.html", [root])).toBeUndefined()
	})
})
