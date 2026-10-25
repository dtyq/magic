// @vitest-environment jsdom

import JSZip from "jszip"
import PptxGenJS from "pptxgenjs"
import { afterEach, describe, expect, it } from "vitest"
import { drawTable } from "../src/drawer/drawTable"
import type { PPTTableNode } from "../src/ir/node"
import { extractCellTextRuns } from "../src/parsers/table/cellText"
import {
	asStreamingPptxPresentation,
	concatPptxChunks,
	createCollectingPptxDestination,
} from "./streaming-test-utils"

afterEach(() => {
	document.body.innerHTML = ""
})

describe("PowerPoint table XML", () => {
	it("writes rich header typography and symmetric cell margins", async () => {
		const pptx = new PptxGenJS()
		const slide = pptx.addSlide()
		const node: PPTTableNode = {
			type: "table",
			x: 0,
			y: 0,
			w: 4,
			h: 1,
			zOrder: 1,
			colWidths: [4],
			rowHeights: [1],
			rows: [
				{
					cells: [
						{
							text: [
								{
									text: "核心原则",
									options: { fontSize: 17, bold: true, breakLine: true },
								},
								{
									text: "PRINCIPLE",
									options: {
										fontSize: 10,
										fontFace: "SF Mono",
										bold: true,
										charSpacing: 0.975,
										color: "FBF8F1",
										transparency: 50,
										paraSpaceBefore: 3,
									},
								},
							],
							options: {
								align: "center",
								valign: "middle",
								margin: [18 / 96, 20 / 96, 18 / 96, 20 / 96],
							},
						},
					],
				},
			],
		}

		drawTable(slide, node)

		const { destination, chunks } = createCollectingPptxDestination()
		await asStreamingPptxPresentation(pptx).writeTo({ destination })
		const zip = await JSZip.loadAsync(concatPptxChunks(chunks))
		const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string")
		if (!slideXml) throw new Error("slide1.xml is required")

		expect(slideXml).toContain("<a:t>PRINCIPLE</a:t>")
		expect(slideXml).toContain('spc="98"')
		expect(slideXml).toContain('<a:alpha val="50000"/>')
		expect(slideXml).toContain('<a:latin typeface="SF Mono"')
		expect(slideXml).toContain('<a:spcPts val="300"/>')
		expect(slideXml).toMatch(/<a:tcPr[^>]*marL="190500"[^>]*marR="190500"/)
		expect(slideXml).toContain('anchor="ctr"')
		expect(slideXml).toContain('algn="ctr"')

		const paragraphs = slideXml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []
		expect(paragraphs).toHaveLength(2)
		for (const paragraph of paragraphs) {
			expect(paragraph.match(/<a:pPr/g)).toHaveLength(1)
			expect(paragraph.indexOf("<a:pPr")).toBeLessThan(paragraph.indexOf("<a:r>"))
		}
	})

	it("writes an explicit BR without duplicate paragraph properties", async () => {
		document.body.innerHTML = `<table><tbody><tr><td>Alpha<br>Beta</td></tr></tbody></table>`
		const cell = document.querySelector("td") as HTMLTableCellElement
		const runs = extractCellTextRuns(cell, window)
		const pptx = new PptxGenJS()
		const slide = pptx.addSlide()
		const node: PPTTableNode = {
			type: "table",
			x: 0,
			y: 0,
			w: 4,
			h: 1,
			zOrder: 1,
			colWidths: [4],
			rowHeights: [1],
			rows: [{ cells: [{ text: runs }] }],
		}

		drawTable(slide, node)

		const { destination, chunks } = createCollectingPptxDestination()
		await asStreamingPptxPresentation(pptx).writeTo({ destination })
		const zip = await JSZip.loadAsync(concatPptxChunks(chunks))
		const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string")
		if (!slideXml) throw new Error("slide1.xml is required")

		const paragraphs = slideXml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []
		expect(paragraphs).toHaveLength(2)
		for (const paragraph of paragraphs) {
			expect(paragraph.match(/<a:pPr/g)).toHaveLength(1)
			expect(paragraph.indexOf("<a:pPr")).toBeLessThan(paragraph.indexOf("<a:r>"))
		}
	})
})
