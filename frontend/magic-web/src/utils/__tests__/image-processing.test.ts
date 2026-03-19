import { describe, expect, it } from "vitest"
import {
	buildAverageHueParam,
	buildImageProcessQuery,
	buildResizeParam,
	buildWatermarkParam,
} from "../image-processing"

describe("image-processing utils", () => {
	it("builds resize param with mode", () => {
		const value = buildResizeParam({ w: 300, h: 200, m: "lfit" })

		expect(value).toBe("resize=w:300,h:200,m:lfit")
	})

	it("throws when percentage mixes with width or height", () => {
		expect(() => buildResizeParam({ w: 100, p: 50 })).toThrow(
			"percentage resize cannot be combined with absolute dimensions",
		)
	})

	it("builds watermark param with text content", () => {
		const value = buildWatermarkParam({
			t: "text",
			c: "Logo",
			p: "se",
			tr: 80,
			s: 24,
			co: "FFFFFF",
		})

		expect(value).toBe("watermark=t:text,c:Logo,p:se,tr:80,s:24,co:FFFFFF")
	})

	it("builds query string following option order", () => {
		const query = buildImageProcessQuery({
			resize: { w: 200, h: 200, m: "fill" },
			quality: 85,
			format: "webp",
			blur: { r: 3, s: 2 },
			autoOrient: 1,
		})

		expect(query).toBe(
			"resize=w:200,h:200,m:fill&quality=85&format=webp&blur=r:3,s:2&autoOrient=1",
		)
	})

	it("honors raw override before other parameters", () => {
		const query = buildImageProcessQuery({
			raw: "image/resize,w_300/quality,q_90",
			quality: 90,
		})

		expect(query).toBe("raw=image/resize,w_300/quality,q_90")
	})

	it("builds averageHue param from boolean", () => {
		expect(buildAverageHueParam(true)).toBe("averageHue=1")
		expect(buildAverageHueParam(false)).toBe("averageHue=0")
	})
})
