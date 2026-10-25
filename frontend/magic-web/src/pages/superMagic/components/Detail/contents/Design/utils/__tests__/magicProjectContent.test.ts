import { describe, expect, it } from "vitest"
import { generateMagicProjectJsContent, parseMagicProjectJsContent } from "../utils"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import {
	decompressCanvasData,
	isCompressedCanvas,
	MAGIC_PROJECT_VERSION_V1,
	MAGIC_PROJECT_VERSION_V2,
	MAGIC_PROJECT_VERSION_V3,
} from "../magicProjectCompression"
import type { CanvasDocument } from "@/components/CanvasDesign/runtime/document"
import type { CanvasConnection } from "@/components/CanvasDesign/runtime/document/types"
import type { DesignData } from "../../types"

function createDesignData(version: string): DesignData {
	const canvas: CanvasDocument = {
		elements: [
			{
				id: "source",
				type: "text",
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				activeContentId: "source-content-1",
				mainContentId: "source-content-1",
				contents: [{ contentId: "source-content-1", content: [] }],
			},
			{
				id: "target",
				type: "text",
				x: 200,
				y: 0,
				width: 100,
				height: 40,
				activeContentId: "target-content-1",
				mainContentId: "target-content-1",
				contents: [{ contentId: "target-content-1", content: [] }],
			},
		],
		connections: [
			{
				id: "connection-1",
				sourceElementId: "source",
				targetElementId: "target",
			},
		],
	}

	return {
		type: "design",
		name: "Connection Test",
		version,
		canvas,
	}
}

describe("magic project content", () => {
	it("always writes a compressed v3 envelope and preserves connections", () => {
		const data = createDesignData(MAGIC_PROJECT_VERSION_V2)
		data.canvas!.connections![0] = {
			...data.canvas!.connections![0],
			unsupportedField: true,
		} as CanvasConnection & { unsupportedField: true }
		const content = generateMagicProjectJsContent(data)
		const config = parseMagicProjectConfigContent(content)
		const canvasField = (config as { canvas?: unknown }).canvas

		expect((config as { version?: string }).version).toBe(MAGIC_PROJECT_VERSION_V3)
		expect(isCompressedCanvas(canvasField)).toBe(true)
		if (!isCompressedCanvas(canvasField)) return

		const canvas = decompressCanvasData(canvasField) as CanvasDocument
		expect(canvas.elements?.every((element) => Array.isArray(element.contents))).toBe(true)
		expect(canvas.connections).toEqual([
			{
				id: "connection-1",
				sourceElementId: "source",
				targetElementId: "target",
			},
		])
	})

	it("upgrades v1 input to the same compressed v3 output", () => {
		const content = generateMagicProjectJsContent(createDesignData(MAGIC_PROJECT_VERSION_V1))
		const config = parseMagicProjectConfigContent(content)
		const canvasField = (config as { canvas?: unknown }).canvas

		expect((config as { version?: string }).version).toBe(MAGIC_PROJECT_VERSION_V3)
		expect(isCompressedCanvas(canvasField)).toBe(true)
		if (!isCompressedCanvas(canvasField)) return
		const canvas = decompressCanvasData(canvasField) as CanvasDocument
		expect(canvas.connections).toEqual([
			{
				id: "connection-1",
				sourceElementId: "source",
				targetElementId: "target",
			},
		])
	})

	it("parses legacy envelopes back as standard v3 runtime data", () => {
		const content = generateMagicProjectJsContent(createDesignData(MAGIC_PROJECT_VERSION_V2))
		const parsed = parseMagicProjectJsContent(content)

		expect(parsed?.version).toBe(MAGIC_PROJECT_VERSION_V3)
		expect(parsed?.canvas?.elements?.every((element) => Array.isArray(element.contents))).toBe(
			true,
		)
		expect(parsed?.canvas?.connections).toEqual([
			{
				id: "connection-1",
				sourceElementId: "source",
				targetElementId: "target",
			},
		])
	})
})
