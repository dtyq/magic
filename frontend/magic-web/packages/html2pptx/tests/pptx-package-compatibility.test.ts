import JSZip from "jszip"
import PptxGenJS from "pptxgenjs"
import { describe, expect, it } from "vitest"
import { concatPptxChunks, createCollectingPptxDestination } from "./streaming-test-utils"

describe("installed PptxGenJS patch compatibility", () => {
	it.each(["writeTo", "beginStreaming"] as const)(
		"%s gives notes their own theme without dropping slide content or notes",
		async (mode) => {
			const pptx = new PptxGenJS()
			pptx.theme = { headFontFace: "Custom Head", bodyFontFace: "Custom Body" }
			const { destination, chunks } = createCollectingPptxDestination()
			if (mode === "writeTo") {
				const slide = pptx.addSlide()
				slide.addText("Slide content", { x: 1, y: 1, w: 4, h: 1 })
				slide.addNotes("Keep these notes")
				await pptx.writeTo({ destination })
			} else {
				// Match html2pptx's direct-path capacity contract; stale patches reject
				// this unknown-length/classic combination before emitting any slides.
				const session = await pptx.beginStreaming({
					destination,
					plan: {
						finalSlideCount: 1,
						capacityPlan: {
							confidence: "streaming-unknown",
							zipMode: "classic",
							hasUnknownLengthSource: true,
							unknownLengthSourceMayReachZip32Limit: false,
							maxEntryBytesMayReachZip32Limit: false,
							archiveBytesMayReachZip32Limit: false,
							entryCountMayReachZip32Limit: false,
							knownInputBytes: BigInt(0),
							estimatedEntryCount: BigInt(32),
						},
					},
				})
				const slide = session.addSlide()
				slide.addText("Slide content", { x: 1, y: 1, w: 4, h: 1 })
				slide.addNotes("Keep these notes")
				await session.commitSlide(slide)
				await session.finalize()
			}
			const bytes = concatPptxChunks(chunks)
			const zip = await JSZip.loadAsync(bytes)
			const xml = async (path: string) => {
				const part = zip.file(path)
				if (!part) throw new Error(`Missing package part: ${path}`)
				return part.async("string")
			}
			// Exercise the installed patch, not a local source checkout: PowerPoint
			// repairs packages whose notes and slide masters share one theme part.
			expect(await xml("ppt/slideMasters/_rels/slideMaster1.xml.rels")).toContain(
				'Target="../theme/theme1.xml"',
			)
			const notesRels = await xml("ppt/notesMasters/_rels/notesMaster1.xml.rels")
			expect(notesRels).toContain('Target="../theme/theme2.xml"')
			expect(notesRels).not.toContain('Target="../theme/theme1.xml"')
			expect(await xml("ppt/theme/theme2.xml")).toBe(await xml("ppt/theme/theme1.xml"))
			expect(await xml("[Content_Types].xml")).toContain(
				'<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
			)
			expect(await xml("ppt/slides/slide1.xml")).toContain("Slide content")
			expect(await xml("ppt/notesSlides/notesSlide1.xml")).toContain("Keep these notes")
			// This tiny package must not acquire ZIP64 EOCD/locator records.
			const end = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
			expect(end.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
			expect(end.getUint16(bytes.length - 12, true)).toBeLessThan(0xffff)
			expect(end.getUint32(bytes.length - 42, true)).not.toBe(0x07064b50)
		},
	)
})
