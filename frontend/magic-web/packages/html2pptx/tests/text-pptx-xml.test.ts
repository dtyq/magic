import JSZip from "jszip"
import PptxGenJS from "pptxgenjs"
import { describe, expect, it } from "vitest"
import { drawText } from "../src/drawer/drawText"
import type { PPTTextNode } from "../src/ir/node"
import {
	asStreamingPptxPresentation,
	concatPptxChunks,
	createCollectingPptxDestination,
} from "./streaming-test-utils"

describe("PowerPoint text XML", () => {
	it("writes the HTML frame exactly and locks browser lines with a soft break", async () => {
		const pptx = new PptxGenJS()
		const slide = pptx.addSlide()
		const node: PPTTextNode = {
			type: "text",
			x: 197 / 96,
			y: 465 / 96,
			w: 100 / 96,
			h: 28 / 96,
			zOrder: 1,
			text: [{ text: "first" }, { text: "second", options: { softBreakBefore: true } }],
			fontSize: 15,
			fontFace: "Arial",
			fontWeight: 400,
			color: "112233",
			bold: false,
			italic: false,
			underline: false,
			valign: "top",
			margin: [3, 4, 5, 6],
			wrap: false,
			lineSpacingPt: 21,
		}
		drawText(slide, node)

		const { destination, chunks } = createCollectingPptxDestination()
		await asStreamingPptxPresentation(pptx).writeTo({ destination })
		const zip = await JSZip.loadAsync(concatPptxChunks(chunks))
		const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string")
		if (!slideXml) throw new Error("slide1.xml is required")

		expect(slideXml).toContain('<a:off x="1876425" y="4429125"/>')
		expect(slideXml).toContain('<a:ext cx="952500" cy="266700"/>')
		// An omitted transparency is OOXML's fully-opaque default.  A previous
		// patched PptxGenJS build serialized it as alpha=0, making every text run
		// invisible even though the <a:t> nodes were present.
		expect(slideXml).toContain('<a:srgbClr val="112233"/>')
		expect(slideXml).not.toContain('<a:srgbClr val="112233"><a:alpha val="0"/>')
		expect(slideXml).toMatch(/<a:bodyPr[^>]*wrap="none"/)
		expect(slideXml).toMatch(/lIns="76200"/)
		expect(slideXml).toMatch(/tIns="38100"/)
		expect(slideXml).toMatch(/rIns="50800"/)
		expect(slideXml).toMatch(/bIns="63500"/)
		expect(slideXml).toContain("<a:br/>")
		expect(slideXml).toContain('<a:spcPts val="2100"/>')
		expect(slideXml).not.toContain("<a:spcPct")
	})
})
