import { describe, expect, it } from "vitest"
import { parseCSSDeclarations } from "./cssDeclarations"

describe("parseCSSDeclarations", () => {
	it("parses CSS declarations", () => {
		expect(parseCSSDeclarations("color: #333; padding: 12px")).toEqual({
			styles: { color: "#333", padding: "12px" },
		})
	})

	it("supports custom properties and values containing colons", () => {
		expect(parseCSSDeclarations('--brand-color: #123456; content: "a:b"')).toEqual({
			styles: { "--brand-color": "#123456", content: '"a:b"' },
		})
	})

	it("rejects selectors and style tags", () => {
		expect(parseCSSDeclarations(".card { color: red; }").error).toBeTruthy()
		expect(parseCSSDeclarations("<style>color:red</style>").error).toBeTruthy()
	})

	it("rejects malformed declarations", () => {
		expect(parseCSSDeclarations("color").error).toBeTruthy()
		expect(parseCSSDeclarations(": red").error).toBeTruthy()
		expect(parseCSSDeclarations("padding:").error).toBeTruthy()
	})
})
