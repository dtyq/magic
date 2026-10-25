import { describe, expect, it } from "vitest"
import { filterInjectedTags, preserveOriginalTrailingNewline } from "../index"

describe("filterInjectedTags", () => {
	it("does not persist source-node provenance markers", () => {
		const html =
			'<html data-magic-source-node=""><body data-magic-source-node=""><p data-magic-source-node="">Fixed</p><p>Dynamic</p></body></html>'
		const cleaned = filterInjectedTags(html, new Map())
		expect(cleaned).toContain("<p>Fixed</p>")
		expect(cleaned).not.toContain("Dynamic")
		expect(cleaned).not.toContain("data-magic-source-node")
	})
	it("should restore the backend-provided EOF newline after DOM serialization removes it", () => {
		const serializedHtml = "<!DOCTYPE html>\n<html><head></head><body></body></html>"
		const originalSourceCode = `${serializedHtml}\n`

		expect(preserveOriginalTrailingNewline(serializedHtml, originalSourceCode)).toBe(
			originalSourceCode,
		)
		expect(preserveOriginalTrailingNewline(originalSourceCode, originalSourceCode)).toBe(
			originalSourceCode,
		)
		expect(preserveOriginalTrailingNewline(serializedHtml, serializedHtml)).toBe(serializedHtml)
	})

	it("should remove only the root html XHTML namespace when saving content", () => {
		const html = `
			<!DOCTYPE html>
			<html xmlns="http://www.w3.org/1999/xhtml" lang="zh">
				<body>
					<svg xmlns="http://www.w3.org/2000/svg">
						<foreignObject width="100" height="50">
							<div xmlns="http://www.w3.org/1999/xhtml">sample</div>
						</foreignObject>
					</svg>
				</body>
			</html>
		`

		const result = filterInjectedTags(html, new Map())

		expect(result).toContain('<html lang="zh">')
		expect(result).not.toContain('<html xmlns="http://www.w3.org/1999/xhtml"')
		expect(result).toContain('<div xmlns="http://www.w3.org/1999/xhtml">sample</div>')
	})

	it("should preserve consecutive blank lines in document content", () => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Placeholder</title></head>
<body>
<section>First placeholder</section>


<section>Second placeholder</section>
</body>
</html>`

		const result = filterInjectedTags(html, new Map())

		expect(result).toContain("</section>\n\n\n<section>Second placeholder</section>")
	})

	it("should not add boundary blank lines when cleaning ordinary HTML or PPT content", () => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head><script data-injected="fetch-interceptor">window.placeholderRuntime = true;</script>
<title>Placeholder document</title>
</head>
<body class="placeholder-body">
<section>Placeholder content</section>
</body></html>`

		const result = filterInjectedTags(html, new Map())

		expect(result).toContain("<head>\n<title>Placeholder document</title>\n</head>")
		expect(result).toContain(
			'<body class="placeholder-body">\n<section>Placeholder content</section>\n</body>',
		)
		expect(result).not.toContain("<head>\n\n<title>")
		expect(result).not.toContain('<body class="placeholder-body">\n\n<section>')
	})

	it("should prevent DOMParser body boundary whitespace from growing across repeated saves", () => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Placeholder document</title></head>
<body>
<main>Placeholder content</main>
</body>
</html>
`

		const firstSave = filterInjectedTags(html, new Map())
		const secondSave = filterInjectedTags(firstSave, new Map())
		const thirdSave = filterInjectedTags(secondSave, new Map())

		expect(firstSave).toContain("<main>Placeholder content</main>\n</body>\n</html>")
		expect(secondSave).toBe(firstSave)
		expect(thirdSave).toBe(firstSave)
	})

	it("should restore slide-bridge at its placeholder without moving surrounding whitespace", () => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head></head>
<body data-has-slide-bridge="true">
<main>Placeholder content</main>
<!--magic-slide-bridge-placeholder-->
</body>
</html>`

		const result = filterInjectedTags(html, new Map())

		expect(result).toContain(
			'<main>Placeholder content</main>\n<script src="slide-bridge.js"></script>',
		)
		expect(result).not.toContain(
			'<main>Placeholder content</main>\n\n<script src="slide-bridge.js"></script>',
		)
		expect(result).not.toContain('<script src="slide-bridge.js"></script></body>')
		expect(result).not.toContain("magic-slide-bridge-placeholder")
		expect(result).not.toContain("data-has-slide-bridge")
	})

	it("should restore slide-bridge placeholders inside head", () => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
<!--magic-slide-bridge-placeholder-->
</head>
<body data-has-slide-bridge="true">
<main>Placeholder content</main>
</body>
</html>`

		const result = filterInjectedTags(html, new Map())

		expect(result).toContain('<head>\n<script src="slide-bridge.js"></script>\n</head>')
		expect(result).not.toContain("magic-slide-bridge-placeholder")
		expect(result).not.toContain("data-has-slide-bridge")
	})

	it("should restore original relative path for inline background-image", () => {
		const html = `
			<!DOCTYPE html>
			<html>
				<body>
					<div
						id="target"
						style="background-image: /*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123');"
					>
						Content
					</div>
				</body>
			</html>
		`

		const result = filterInjectedTags(html, new Map())
		const document = new DOMParser().parseFromString(result, "text/html")
		const target = document.querySelector("#target")
		const styleAttribute = target?.getAttribute("style") || ""

		expect(styleAttribute).toContain("background-image: url('images/new.png');")
		expect(styleAttribute).not.toContain("__ORIGINAL_URL__")
	})

	it("should normalize shorthand background when saving replaced image", () => {
		const html = `
			<!DOCTYPE html>
			<html>
				<body>
					<div
						id="target"
						style="background: url('old.jpg') center center / cover; padding: 30px 20px; border-radius: 8px; backdrop-filter: blur(2px); background-image: /*__ORIGINAL_URL__:images/tmp1.png__*/url('data:image/png;base64,abc123');"
					>
						Content
					</div>
				</body>
			</html>
		`

		const result = filterInjectedTags(html, new Map())
		const document = new DOMParser().parseFromString(result, "text/html")
		const target = document.querySelector("#target")
		const styleAttribute = target?.getAttribute("style") || ""

		expect(styleAttribute).toContain("background-image: url('images/tmp1.png');")
		expect(styleAttribute).toContain("background-position: center center;")
		expect(styleAttribute).toContain("background-size: cover;")
		expect(styleAttribute).toContain("padding: 30px 20px;")
		expect(styleAttribute).toContain("border-radius: 8px;")
		expect(styleAttribute).toContain("backdrop-filter: blur(2px);")
		expect(styleAttribute).not.toContain("old.jpg")
		expect(styleAttribute).not.toContain("background: url(")
	})

	it("should preserve background color and unrelated inline styles during normalization", () => {
		const html = `
			<!DOCTYPE html>
			<html>
				<body>
					<div
						id="target"
						style="background: url('old.jpg') center center / cover no-repeat; background-color: rgba(255, 255, 255, 0.6); margin: 20px 0; min-width: 300px; box-sizing: border-box; background-image: /*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123');"
					>
						Content
					</div>
				</body>
			</html>
		`

		const result = filterInjectedTags(html, new Map())
		const document = new DOMParser().parseFromString(result, "text/html")
		const target = document.querySelector("#target")
		const styleAttribute = target?.getAttribute("style") || ""

		expect(styleAttribute).toContain("background-image: url('images/new.png');")
		expect(styleAttribute).toContain("background-color: rgba(255, 255, 255, 0.6);")
		expect(styleAttribute).toContain("margin: 20px 0;")
		expect(styleAttribute).toContain("min-width: 300px;")
		expect(styleAttribute).toContain("box-sizing: border-box;")
	})

	it("should flatten multi-layer background into a single saved image", () => {
		const html = `
			<!DOCTYPE html>
			<html>
				<body>
					<div
						id="target"
						style="background: url('old.jpg'), linear-gradient(#fff, #000); background-image: /*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123');"
					>
						Content
					</div>
				</body>
			</html>
		`

		expect(() => filterInjectedTags(html, new Map())).not.toThrow()
		const result = filterInjectedTags(html, new Map())
		const document = new DOMParser().parseFromString(result, "text/html")
		const target = document.querySelector("#target")
		const styleAttribute = target?.getAttribute("style") || ""

		expect(styleAttribute).toContain("background-image: url('images/new.png');")
		expect(styleAttribute).not.toContain("__ORIGINAL_URL__")
		expect(styleAttribute).not.toContain("old.jpg")
		expect(styleAttribute).not.toContain("linear-gradient")
		expect(styleAttribute).not.toContain("background: ")
	})

	it("should restore original google fonts import url in style tags", () => {
		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<style>
						/*__ORIGINAL_GOOGLE_IMPORT_URL__:https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap__*/
						@import url('https://cdn.example.com/google-fonts/css/woff2/Noto_Sans_SC_woff2.css');
						body { font-family: 'Noto Sans SC', sans-serif; }
					</style>
				</head>
				<body></body>
			</html>
		`

		const result = filterInjectedTags(html, new Map())
		const document = new DOMParser().parseFromString(result, "text/html")
		const styleContent = document.querySelector("style")?.textContent || ""

		expect(styleContent).toContain(
			"@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');",
		)
		expect(styleContent).not.toContain("cdn.example.com/google-fonts")
		expect(styleContent).not.toContain("__ORIGINAL_GOOGLE_IMPORT_URL__")
	})
})
