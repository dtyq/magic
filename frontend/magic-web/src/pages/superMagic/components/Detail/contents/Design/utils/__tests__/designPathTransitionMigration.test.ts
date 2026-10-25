import { describe, expect, it } from "vitest"
import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignData } from "../../types"
import { migrateLoadedDesignDataPaths } from "../designPathTransitionMigration"
import { generateMagicProjectJsContent } from "../utils"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import { decompressCanvasData } from "../magicProjectCompression"

const DESIGN_A = "新建画布A"

function fileItem(fileId: string, relativeFilePath: string): FileItem {
	const fileName = relativeFilePath.split("/").pop() ?? ""
	return {
		file_id: fileId,
		file_name: fileName,
		file_extension: fileName.split(".").pop() ?? "",
		relative_file_path: relativeFilePath,
		is_directory: false,
	}
}

function designWithImagePath(src: string): DesignData {
	const contentId = "image-1-content-1"
	return {
		type: "design",
		name: DESIGN_A,
		version: "3.0.0",
		canvas: {
			elements: [
				{
					id: "image-1",
					type: "image",
					zIndex: 1,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId, src }],
				} as LayerElement,
			],
		},
	}
}

function getImageSrc(data: DesignData): string {
	const element = data.canvas?.elements?.[0] as { contents?: Array<{ src?: string }> }
	return element.contents?.[0]?.src ?? ""
}

describe("design path transition migration", () => {
	it("preserves opaque asset references", () => {
		const data = designWithImagePath("asset://virtual-human-asset-id")

		migrateLoadedDesignDataPaths(data, {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [],
		})

		expect(getImageSrc(data)).toBe("asset://virtual-human-asset-id")
	})

	it("repairs a legacy bare resource only when the current design owns it", () => {
		const data = designWithImagePath("images/cat.png")

		migrateLoadedDesignDataPaths(data, {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [fileItem("canvas-cat", `${DESIGN_A}/images/cat.png`)],
		})

		expect(getImageSrc(data)).toBe("./images/cat.png")
	})

	it("migrates an attachment-confirmed workspace-root resource to an absolute path", () => {
		const data = designWithImagePath("images/cat.png")

		migrateLoadedDesignDataPaths(data, {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [fileItem("workspace-cat", "images/cat.png")],
		})

		expect(getImageSrc(data)).toBe("/images/cat.png")
	})

	it("preserves ambiguous bare resources and waits for a later safe save", () => {
		const data = designWithImagePath("images/cat.png")

		migrateLoadedDesignDataPaths(data, {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [
				fileItem("canvas-cat", `${DESIGN_A}/images/cat.png`),
				fileItem("workspace-cat", "images/cat.png"),
			],
		})

		expect(getImageSrc(data)).toBe("images/cat.png")
	})

	it("repairs an explicit current-design absolute path without attachment lookup", () => {
		const data = designWithImagePath(`/${DESIGN_A}/images/cat.png`)

		migrateLoadedDesignDataPaths(data, {
			designProjectBasePath: DESIGN_A,
		})

		expect(getImageSrc(data)).toBe("./images/cat.png")
	})

	it("persists only attachment-confirmed legacy repairs during a normal save", () => {
		const currentCanvasContent = generateMagicProjectJsContent(
			designWithImagePath("images/cat.png"),
			{
				projectBasePath: DESIGN_A,
				flatAttachments: [fileItem("canvas-cat", `${DESIGN_A}/images/cat.png`)],
			},
		)
		const workspaceRootContent = generateMagicProjectJsContent(
			designWithImagePath("images/cat.png"),
			{
				projectBasePath: DESIGN_A,
				flatAttachments: [fileItem("workspace-cat", "images/cat.png")],
			},
		)

		const readSrc = (content: string) => {
			const config = parseMagicProjectConfigContent(content) as { canvas: string }
			const canvas = decompressCanvasData(config.canvas) as DesignData["canvas"]
			const element = canvas?.elements?.[0]
			return element?.type === "image" ? element.contents[0]?.src : undefined
		}
		expect(readSrc(currentCanvasContent)).toBe("./images/cat.png")
		expect(readSrc(workspaceRootContent)).toBe("/images/cat.png")
	})
})
