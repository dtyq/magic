import { describe, expect, it } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import type { CanvasDocument, LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import {
	resolveDesignPathForOperation,
	resolveDesignAttachment,
	toDesignDslPathFromWorkspacePath,
	toWorkspaceRelativeCandidates,
} from "../designPath"
import {
	generateMagicProjectJsContent,
	normalizePath,
	replaceNameInMagicProjectJsContent,
} from "../utils"
import { compressCanvasData, decompressCanvasData } from "../magicProjectCompression"
import { rewriteLayerElementsPathsForMagicProjectSave } from "../internal/designPathPrimitives"

const DESIGN_A = "新建画布A"
const DESIGN_B = "新建画布B"

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

function imageElement(src: string, id = "image-1"): LayerElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "image",
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId, src }],
	} as LayerElement
}

function audioElement(src: string, id = "audio-1"): LayerElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "audio",
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId, src }],
	} as LayerElement
}

function readCanvas(content: string): CanvasDocument {
	const config = parseMagicProjectConfigContent(content) as { canvas: string }
	return decompressCanvasData(config.canvas) as CanvasDocument
}

describe("designPath contract", () => {
	it("normalizes workspace-relative segments consistently", () => {
		expect(normalizePath("/foo/bar/")).toBe("foo/bar")
		expect(normalizePath("foo/bar")).toBe("foo/bar")
	})

	it("keeps other canvas workspace paths outside the current DSL root", () => {
		const ctx = { designProjectBasePath: DESIGN_A }

		expect(toWorkspaceRelativeCandidates(`${DESIGN_B}/images/a.png`, ctx)).toEqual([
			`${DESIGN_B}/images/a.png`,
		])
	})

	it("writes known workspace paths as current-relative or workspace-absolute", () => {
		const ctx = { designProjectBasePath: DESIGN_A }

		expect(toDesignDslPathFromWorkspacePath(`/${DESIGN_A}/images/a.png`, ctx)).toBe(
			"./images/a.png",
		)
		expect(toDesignDslPathFromWorkspacePath(`${DESIGN_B}/images/a.png`, ctx)).toBe(
			`/${DESIGN_B}/images/a.png`,
		)
		expect(toDesignDslPathFromWorkspacePath("images/root.png", ctx)).toBe("/images/root.png")
		expect(toDesignDslPathFromWorkspacePath("root.png", ctx)).toBe("/root.png")
	})

	it("treats an explicit /images path as workspace-root absolute", () => {
		const ctx = { designProjectBasePath: DESIGN_A }

		expect(toWorkspaceRelativeCandidates("/images/a.png", ctx)).toEqual(["images/a.png"])
	})

	it("exposes single-segment absolute files as workspace-relative lookup paths", () => {
		const ctx = { designProjectBasePath: DESIGN_A }

		expect(toWorkspaceRelativeCandidates("/root.png", ctx)).toEqual(["root.png"])
	})

	it("treats paths with a directory prefix as project-root anchored", () => {
		const ctx = {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [
				fileItem("project-root", `${DESIGN_B}/images/a.png`),
				fileItem("nested-under-current", `${DESIGN_A}/${DESIGN_B}/images/a.png`),
			],
		}

		const resolved = resolveDesignAttachment(`${DESIGN_B}/images/a.png`, ctx)
		expect(resolved.status).toBe("found")
		if (resolved.status === "found") {
			expect(resolved.fileItem.file_id).toBe("project-root")
			expect(resolved.resolvedPath).toBe(`${DESIGN_B}/images/a.png`)
		}
	})

	it("uses strict current-canvas candidates by default", () => {
		const ctx = { designProjectBasePath: DESIGN_A }

		expect(toWorkspaceRelativeCandidates("./images/a.png", ctx)).toEqual([
			`${DESIGN_A}/images/a.png`,
		])
		expect(toWorkspaceRelativeCandidates("images/a.png", ctx)).toEqual([])
		expect(
			toWorkspaceRelativeCandidates("images/a.png", ctx, { mode: "legacy-recovery" }),
		).toEqual([`${DESIGN_A}/images/a.png`, "images/a.png"])
	})

	it("does not bind current canvas resources to same-name files in another canvas", () => {
		const ctx = {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [
				fileItem("design-a-cat", `/${DESIGN_A}/images/cat.png`),
				fileItem("design-b-cat", `/${DESIGN_B}/images/cat.png`),
			],
		}

		const resolved = resolveDesignAttachment("./images/cat.png", ctx)

		expect(resolved.status).toBe("found")
		if (resolved.status === "found") {
			expect(resolved.fileItem.file_id).toBe("design-a-cat")
			expect(resolved.normalizedPath).toBe(`${DESIGN_A}/images/cat.png`)
		}
	})

	it("returns ambiguous for legacy recovery when candidates hit different file ids", () => {
		const ctx = {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [
				fileItem("design-a-cat", `/${DESIGN_A}/images/cat.png`),
				fileItem("workspace-root-cat", "/images/cat.png"),
			],
		}

		const strictResolved = resolveDesignAttachment("images/cat.png", ctx)
		const legacyResolved = resolveDesignAttachment("images/cat.png", ctx, {
			mode: "legacy-recovery",
		})

		expect(strictResolved.status).toBe("not-found")
		expect(legacyResolved.status).toBe("ambiguous")
	})

	it("resolves a historical bare resource at operation boundaries only when attachments prove it", () => {
		const currentCanvas = resolveDesignPathForOperation("images/cat.png", {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [fileItem("design-a-cat", `${DESIGN_A}/images/cat.png`)],
		})
		expect(currentCanvas).toMatchObject({
			status: "found",
			resolvedPath: `${DESIGN_A}/images/cat.png`,
			legacyRecovered: true,
		})

		const ambiguous = resolveDesignPathForOperation("images/cat.png", {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [
				fileItem("design-a-cat", `${DESIGN_A}/images/cat.png`),
				fileItem("workspace-cat", "images/cat.png"),
			],
		})
		expect(ambiguous.status).toBe("ambiguous")
	})

	it("waits for attachment data instead of guessing a historical bare resource", () => {
		expect(
			resolveDesignPathForOperation("images/cat.png", {
				designProjectBasePath: DESIGN_A,
			}),
		).toMatchObject({ status: "attachments-pending" })
	})

	it("never reinterprets workspace path segments as file ids", () => {
		const ctx = {
			designProjectBasePath: DESIGN_A,
			flatAttachments: [fileItem("911343142164795393", `/${DESIGN_A}/images/cat.png`)],
		}

		expect(resolveDesignAttachment("911343142164795393", ctx).status).toBe("not-found")
		expect(resolveDesignAttachment("file-1", ctx).status).toBe("not-found")
	})

	it("normalizes magic.project.js saved layer paths to DSL paths", () => {
		const content = generateMagicProjectJsContent(
			{
				version: "3.0.0",
				canvas: {
					elements: [
						imageElement(`/${DESIGN_A}/images/cat.png`),
						audioElement(`/${DESIGN_A}/audios/voice.mp3`),
					],
				},
			} as never,
			{ projectBasePath: DESIGN_A },
		)
		const canvas = readCanvas(content)
		expect(canvas.elements?.[0]?.contents?.[0]).toMatchObject({
			src: "./images/cat.png",
		})
		expect(canvas.elements?.[1].contents?.[0]).toMatchObject({ src: "./audios/voice.mp3" })
		expect(JSON.stringify(canvas)).not.toContain(`/${DESIGN_A}/images/cat.png`)
		expect(JSON.stringify(canvas)).not.toContain(`/${DESIGN_A}/audios/voice.mp3`)
	})

	it("keeps the draft-task uri valid across save and canvas-directory rename", () => {
		const videoElement = {
			id: "video-1",
			type: "video",
			activeContentId: "video-1-content-1",
			mainContentId: "video-1-content-1",
			contents: [
				{
					contentId: "video-1-content-1",
					src: `/${DESIGN_A}/videos/final.mp4`,
					generateVideoRequest: {
						input_mode: "draft_task",
						inputs: {
							draft_task: {
								video_id: "draft-video-id",
								uri: `/${DESIGN_A}/videos/draft.mp4`,
							},
						},
					},
				},
			],
		} as LayerElement
		const savedElements = [JSON.parse(JSON.stringify(videoElement)) as LayerElement]
		rewriteLayerElementsPathsForMagicProjectSave(savedElements, DESIGN_A)
		const savedRequest = savedElements[0].contents?.[0] as unknown as {
			generateVideoRequest: { inputs: { draft_task: { video_id: string; uri: string } } }
		}
		expect(savedRequest.generateVideoRequest.inputs.draft_task).toEqual({
			video_id: "draft-video-id",
			uri: "./videos/draft.mp4",
		})

		const absolute = `window.magicProjectConfig = ${JSON.stringify({
			version: "3.0.0",
			name: DESIGN_A,
			canvas: compressCanvasData({ elements: [videoElement] }),
		})};`
		const renamed = replaceNameInMagicProjectJsContent(absolute, DESIGN_A, "重命名画布")
		const renamedRequest = readCanvas(renamed).elements?.[0].contents?.[0] as unknown as {
			generateVideoRequest: { inputs: { draft_task: { video_id: string; uri: string } } }
		}
		expect(renamedRequest.generateVideoRequest.inputs.draft_task).toEqual({
			video_id: "draft-video-id",
			uri: "/重命名画布/videos/draft.mp4",
		})
	})

	it("keeps external workspace resources absolute when saving magic.project.js", () => {
		const content = generateMagicProjectJsContent(
			{
				version: "3.0.0",
				canvas: {
					elements: [imageElement(`${DESIGN_B}/images/cat.png`)],
				},
			} as never,
			{ projectBasePath: DESIGN_A },
		)
		expect(readCanvas(content).elements?.[0].contents?.[0]).toMatchObject({
			src: `/${DESIGN_B}/images/cat.png`,
		})
	})

	it("keeps private-upload task paths outside workspace save and rename rewriting", () => {
		const content = generateMagicProjectJsContent(
			{
				version: "3.0.0",
				name: DESIGN_A,
				canvas: {
					elements: [
						{
							...imageElement(`/${DESIGN_A}/images/cat.png`),
							contents: [
								{
									contentId: "image-1-content-1",
									src: `/${DESIGN_A}/images/cat.png`,
									imageGenerationTaskMeta: {
										type: "expand",
										file_path: `/${DESIGN_A}/images/cat.png`,
										canvas_path: `${DESIGN_A}/design-mark/canvas.png`,
										mask_path: `${DESIGN_A}/design-mark/mask.png`,
										mark_path: `${DESIGN_A}/design-mark/mark.png`,
									},
								},
							],
						},
					],
				},
			} as never,
			{ projectBasePath: DESIGN_A },
		)

		const savedCanvas = readCanvas(content)
		const savedContent = savedCanvas.elements?.[0].contents?.[0] as unknown as Record<
			string,
			unknown
		>
		expect(savedContent).toMatchObject({
			src: "./images/cat.png",
			imageGenerationTaskMeta: {
				file_path: "./images/cat.png",
				canvas_path: `${DESIGN_A}/design-mark/canvas.png`,
				mask_path: `${DESIGN_A}/design-mark/mask.png`,
				mark_path: `${DESIGN_A}/design-mark/mark.png`,
			},
		})

		const renamed = replaceNameInMagicProjectJsContent(content, DESIGN_A, "重命名画布")
		const renamedContent = readCanvas(renamed).elements?.[0].contents?.[0] as unknown as Record<
			string,
			unknown
		>
		expect(renamedContent).toMatchObject({
			src: "./images/cat.png",
			imageGenerationTaskMeta: {
				canvas_path: `${DESIGN_A}/design-mark/canvas.png`,
				mask_path: `${DESIGN_A}/design-mark/mask.png`,
				mark_path: `${DESIGN_A}/design-mark/mark.png`,
			},
		})
	})
})
