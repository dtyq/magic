import { describe, expect, it } from "vitest"
import {
	MAX_TEMPLATE_BYTES,
	checkTemplateFile,
	freeTemplateFileName,
	looksLikeHtml,
} from "../services/reportTemplates"

describe("checkTemplateFile", () => {
	it("accepts HTML within the size limit", () => {
		expect(checkTemplateFile({ name: "Brand.HTM", size: 1024 })).toBeNull()
	})

	it("rejects other types and oversized files", () => {
		expect(checkTemplateFile({ name: "brand.txt", size: 10 })).toBe("type")
		expect(checkTemplateFile({ name: "brand.html", size: MAX_TEMPLATE_BYTES + 1 })).toBe("size")
	})
})

describe("looksLikeHtml", () => {
	it("needs an html or body tag", () => {
		expect(looksLikeHtml('<!DOCTYPE html><html lang="zh"></html>')).toBe(true)
		expect(looksLikeHtml("<BODY>x</BODY>")).toBe(true)
		expect(looksLikeHtml("<div>fragment</div>")).toBe(false)
	})
})

describe("freeTemplateFileName", () => {
	it("keeps the upload name and avoids taken names case-insensitively", () => {
		expect(freeTemplateFileName("Brand Report.htm", [])).toBe("Brand Report.html")
		expect(
			freeTemplateFileName("Brand.html", ["templates/brand.html", "templates/Brand-2.html"]),
		).toBe("Brand-3.html")
	})

	it("drops path characters", () => {
		expect(freeTemplateFileName("a/b:c.html", [])).toBe("a-b-c.html")
		expect(freeTemplateFileName(".html", [])).toBe("template.html")
	})
})
