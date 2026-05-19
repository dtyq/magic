import { describe, expect, it } from "vitest"
import { filterInjectedTags } from "../index"

describe("filterInjectedTags", () => {
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
})
