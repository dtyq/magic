import { describe, expect, it } from "vitest"
import { rewriteHtmlCdnWithHost } from "../index"

const CDN_HOST = "https://cdn.example.com"

function getLinkHrefs(doc: Document): string[] {
	return Array.from(doc.querySelectorAll("link[rel='stylesheet']")).map(
		(el) => el.getAttribute("href") || "",
	)
}

function getOriginalHrefs(doc: Document): string[] {
	return Array.from(doc.querySelectorAll("link[data-original-href]")).map(
		(el) => el.getAttribute("data-original-href") || "",
	)
}

describe("google cdn rewrite", () => {
	describe("fonts.googleapis.com/css2 (single family)", () => {
		it("should rewrite to internal CDN static CSS path", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Noto_Sans_SC_woff2.css`)
		})

		it("should preserve data-original-href", () => {
			const originalHref =
				"https://fonts.googleapis.com/css2?family=Roboto:wght@300&display=swap"
			const html = `<html><head>
				<link href="${originalHref}" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const originals = getOriginalHrefs(doc)

			expect(originals).toContain(originalHref)
		})
	})

	describe("fonts.googleapis.com/css2 (multiple families)", () => {
		it("should split into multiple <link> tags", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Roboto:wght@300&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Noto_Sans_SC_woff2.css`)
			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Roboto_woff2.css`)
		})

		it("should set data-original-href on all split links", () => {
			const originalHref =
				"https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Poppins:wght@600&display=swap"
			const html = `<html><head>
				<link href="${originalHref}" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const originals = getOriginalHrefs(doc)

			expect(originals.filter((h) => h === originalHref).length).toBe(2)
		})
	})

	describe("fonts.googleapis.com/css (v1 API)", () => {
		it("should parse pipe-separated families", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css?family=Open+Sans:400,700|Lato:300" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Open_Sans_woff2.css`)
			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Lato_woff2.css`)
		})
	})

	describe("protocol-relative URLs", () => {
		it("should handle //fonts.googleapis.com", () => {
			const html = `<html><head>
				<link href="//fonts.googleapis.com/css2?family=Abril+Fatface&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Abril_Fatface_woff2.css`)
		})
	})

	describe("fonts.googlefonts.cn", () => {
		it("should also rewrite Chinese mirror domain", () => {
			const html = `<html><head>
				<link href="https://fonts.googlefonts.cn/css2?family=Ma+Shan+Zheng&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Ma_Shan_Zheng_woff2.css`)
		})
	})

	describe("fonts.googleapis.com/icon", () => {
		it("should rewrite to icon merged CSS", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/googleapis/icon/v145/index.css`)
		})
	})

	describe("ajax.googleapis.com (preserved existing rule)", () => {
		it("should replace with ajax.loli.net", () => {
			const html = `<html><head>
				<link href="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain("https://ajax.loli.net/ajax/libs/jquery/3.7.1/jquery.min.js")
		})
	})

	describe("non-Google links", () => {
		it("should not modify unrelated links", () => {
			const html = `<html><head>
				<link href="https://example.com/styles.css" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain("https://example.com/styles.css")
		})
	})

	describe("empty cdnHost", () => {
		it("should not rewrite anything when cdnHost is empty", () => {
			const originalHref =
				"https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap"
			const html = `<html><head>
				<link href="${originalHref}" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, "")
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(originalHref)
		})
	})

	describe("fallback to fonts.loli.net", () => {
		it("should fallback for unrecognized google font paths", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/earlyaccess/notosanssc.css" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain("https://fonts.loli.net/earlyaccess/notosanssc.css")
		})
	})

	describe("css2 URL without family parameter", () => {
		it("should fallback when family param is missing", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain("https://fonts.loli.net/css2?display=swap")
		})
	})

	describe("multiple families insertion order", () => {
		it("should preserve family order after splitting", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Alpha:wght@400&family=Beta:wght@400&family=Gamma:wght@400&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const links = Array.from(doc.querySelectorAll("link[data-original-href]"))
			const hrefs = links.map((el) => el.getAttribute("href") || "")

			expect(hrefs[0]).toBe(`${CDN_HOST}/google-fonts/css/woff2/Alpha_woff2.css`)
			expect(hrefs[1]).toBe(`${CDN_HOST}/google-fonts/css/woff2/Beta_woff2.css`)
			expect(hrefs[2]).toBe(`${CDN_HOST}/google-fonts/css/woff2/Gamma_woff2.css`)
		})
	})

	describe("multiple Google links coexisting", () => {
		it("should rewrite each link independently", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
				<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap" rel="stylesheet">
				<link href="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(`${CDN_HOST}/googleapis/icon/v145/index.css`)
			expect(hrefs).toContain(`${CDN_HOST}/google-fonts/css/woff2/Roboto_woff2.css`)
			expect(hrefs).toContain("https://ajax.loli.net/ajax/libs/webfont/1.6.26/webfont.js")
		})
	})

	describe("script tags with googleapis should not be affected", () => {
		it("should not rewrite script src by google rewrite rules", () => {
			const originalSrc = "https://fonts.googleapis.com/some-script.js"
			const html = `<html><head>
				<script src="${originalSrc}"></script>
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const scripts = Array.from(doc.querySelectorAll("script"))
			const srcs = scripts.map((el) => el.getAttribute("src") || "")

			expect(srcs).toContain(originalSrc)
		})
	})
})
