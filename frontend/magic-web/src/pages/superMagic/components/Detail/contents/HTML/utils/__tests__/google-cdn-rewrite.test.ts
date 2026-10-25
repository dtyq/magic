import { describe, expect, it } from "vitest"
import { rewriteHtmlCdnWithHost, rewriteHtmlWithMagicCdn } from "../index"

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

function getStyleContents(doc: Document): string[] {
	return Array.from(doc.querySelectorAll("style")).map((el) => el.textContent || "")
}

describe("google cdn rewrite", () => {
	describe("serialized HTML output", () => {
		it("preserves entity text, attributes and raw script/style contents on repeated rewrites", () => {
			const script =
				'window.example = "<Button> &lt;"; if (1 < 2 && 3 > 2) window.ready = true;'
			const css = '.parent > .child::before { content: "< & >"; }'
			const html = `<!doctype html><html><head><style>${css}</style><script>${script}</script></head>
				<body><p title="&quot;quoted&quot; &amp;">&lt;LoginForm &amp; &#169;</p></body></html>`
			const rewritten = rewriteHtmlWithMagicCdn(rewriteHtmlWithMagicCdn(html))
			const doc = new DOMParser().parseFromString(rewritten, "text/html")
			expect(doc.querySelector("p")?.textContent).toBe("<LoginForm & ©")
			expect(doc.querySelector("p")?.getAttribute("title")).toBe('"quoted" &')
			expect(doc.querySelector("script")?.textContent).toBe(script)
			expect(doc.querySelector("style")?.textContent).toBe(css)
			expect(doc.doctype?.name).toBe("html")
		})

		it("should not add the XHTML namespace to the root html element", () => {
			const html = `<!DOCTYPE html><html lang="zh"><head></head><body><p>sample</p></body></html>`

			const result = rewriteHtmlWithMagicCdn(html)

			expect(result).toContain('<html lang="zh">')
			expect(result).not.toContain('<html xmlns="http://www.w3.org/1999/xhtml"')
		})
	})

	describe("fonts.googleapis.com/css2 (single family)", () => {
		it("keeps Noto Sans SC on a unicode-range capable CSS2 endpoint", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toContain(
				"https://fonts.googleapis.com/css2?family=Noto+Sans+SC%3Awght%40400%3B500%3B700%3B900&display=swap",
			)
			expect(hrefs).not.toContain(`${CDN_HOST}/google-fonts/css/woff2/Noto_Sans_SC_woff2.css`)
		})

		it("adds display=swap when a Noto Sans SC request omits it", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toEqual([
				"https://fonts.googleapis.com/css2?family=Noto+Sans+SC%3Awght%40400&display=swap",
			])
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
		it("keeps a mixed Noto Sans SC request together so weight and subset metadata survive", () => {
			const html = `<html><head>
				<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Roboto:wght@300&display=swap" rel="stylesheet">
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const hrefs = getLinkHrefs(doc)

			expect(hrefs).toEqual([
				"https://fonts.googleapis.com/css2?family=Noto+Sans+SC%3Awght%40400%3B700&family=Roboto%3Awght%40300&display=swap",
			])
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

	describe("style @import", () => {
		it("should rewrite google fonts import url inside style tags", () => {
			const html = `<html><head>
				<style>
					@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
					body { font-family: 'Noto Sans SC', sans-serif; }
				</style>
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const styles = getStyleContents(doc)

			expect(styles.join("\n")).toContain(
				"https://fonts.googleapis.com/css2?family=Noto+Sans+SC%3Awght%40300%3B400%3B500%3B700%3B900&display=swap",
			)
			expect(styles.join("\n")).toContain(
				"/*__ORIGINAL_GOOGLE_IMPORT_URL__:https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap__*/",
			)
			expect(styles.join("\n")).not.toContain(
				"@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');",
			)
		})
	})

	describe("inline font-face declarations", () => {
		it("adds font-display swap without overwriting an explicit strategy", () => {
			const html = `<html><head>
				<style>
					@font-face { font-family: Demo; src: url("demo.woff2"); }
					@font-face { font-family: Existing; src: url("existing.woff2"); font-display: optional; }
				</style>
			</head><body></body></html>`

			const doc = rewriteHtmlCdnWithHost(html, CDN_HOST)
			const style = getStyleContents(doc).join("\n")

			expect(style).toContain("font-display: swap;")
			expect(style).toContain("font-display: optional;")
			expect(style.match(/font-display:/g)).toHaveLength(2)
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
