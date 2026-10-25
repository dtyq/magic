import { describe, expect, test } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import {
	canSkipCanvasProjectOperationRiskForMove,
	detectCanvasProjectOperationRisk,
} from "../canvasProjectOperationRisk"
import { buildAttachmentIndex } from "../attachmentIndex"

function file(
	fileId: string,
	fileName: string,
	parentId: string,
	relativeFilePath: string,
): AttachmentItem {
	return {
		file_id: fileId,
		file_name: fileName,
		name: fileName,
		parent_id: parentId,
		relative_file_path: relativeFilePath,
		is_directory: false,
	}
}

function dir(
	fileId: string,
	fileName: string,
	relativeFilePath: string,
	children: AttachmentItem[] = [],
): AttachmentItem {
	return {
		file_id: fileId,
		file_name: fileName,
		name: fileName,
		relative_file_path: relativeFilePath,
		is_directory: true,
		children,
	}
}

function createCanvasTree() {
	const image = file("image", "image.png", "images-dir", "Workspace/Canvas/images/image.png")
	const unusedImage = file(
		"unused-image",
		"unused.png",
		"images-dir",
		"Workspace/Canvas/images/unused.png",
	)
	const imagesDir = dir("images-dir", "images", "Workspace/Canvas/images", [image, unusedImage])
	const video = file("video", "clip.mp4", "videos-dir", "Workspace/Canvas/videos/clip.mp4")
	const videosDir = dir("videos-dir", "videos", "Workspace/Canvas/videos", [video])
	const audio = file("audio", "sound.mp3", "audios-dir", "Workspace/Canvas/audios/sound.mp3")
	const audiosDir = dir("audios-dir", "audios", "Workspace/Canvas/audios", [audio])
	const pluginFile = file(
		"plugin-file",
		"index.js",
		"plugins-dir",
		"Workspace/Canvas/plugins/demo/index.js",
	)
	const pluginDir = dir("plugins-dir", "plugins", "Workspace/Canvas/plugins", [pluginFile])
	const ordinaryFile = file("ordinary", "notes.txt", "canvas-dir", "Workspace/Canvas/notes.txt")
	const mainFile = file(
		"main",
		"magic.project.js",
		"canvas-dir",
		"Workspace/Canvas/magic.project.js",
	)
	const sidecar = file(
		"user-details",
		"element-details-user.json",
		"canvas-dir",
		"Workspace/Canvas/element-details-user.json",
	)
	const agentSidecar = file(
		"agent-details",
		"element-details.json",
		"canvas-dir",
		"Workspace/Canvas/element-details.json",
	)
	const canvasDir = dir("canvas-dir", "Canvas", "Workspace/Canvas", [
		mainFile,
		sidecar,
		agentSidecar,
		imagesDir,
		videosDir,
		audiosDir,
		pluginDir,
		ordinaryFile,
	])
	canvasDir.display_config = { type: "design" }
	const parentDir = dir("workspace-dir", "Workspace", "Workspace", [canvasDir])

	return {
		attachments: [parentDir],
		parentDir,
		canvasDir,
		mainFile,
		sidecar,
		agentSidecar,
		image,
		unusedImage,
		imagesDir,
		video,
		videosDir,
		audio,
		audiosDir,
		pluginDir,
		pluginFile,
		ordinaryFile,
	}
}

describe("detectCanvasProjectOperationRisk", () => {
	test("skips the canvas guard for an ordinary folder subtree", () => {
		const attachments: AttachmentItem[] = [
			dir("ordinary-folder", "Documents", "Documents", [
				dir("ordinary-images", "images", "Documents/images", [
					file(
						"ordinary-image",
						"cover.png",
						"ordinary-images",
						"Documents/images/cover.png",
					),
				]),
				file("note", "notes.txt", "ordinary-folder", "Documents/notes.txt"),
			]),
		]

		expect(
			canSkipCanvasProjectOperationRiskForMove(
				["ordinary-folder"],
				buildAttachmentIndex(attachments),
			),
		).toBe(true)
	})

	test("keeps the canvas guard for a canvas resource directory selected on its own", () => {
		const tree = createCanvasTree()

		expect(
			canSkipCanvasProjectOperationRiskForMove(
				[tree.imagesDir.file_id as string],
				buildAttachmentIndex(tree.attachments),
			),
		).toBe(false)
	})

	test("keeps the canvas guard for a folder containing a canvas project", () => {
		const tree = createCanvasTree()

		expect(
			canSkipCanvasProjectOperationRiskForMove(
				[tree.canvasDir.file_id as string],
				buildAttachmentIndex(tree.attachments),
			),
		).toBe(false)
	})

	test("warns when operating the canvas entry file", async () => {
		const tree = createCanvasTree()

		const risk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.mainFile],
			operation: "delete",
		})

		expect(risk.shouldWarn).toBe(true)
		expect(risk.riskTypes).toContain("project-entry")
	})

	test("warns when operating v2 sidecar files", async () => {
		const tree = createCanvasTree()

		const agentRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.agentSidecar],
			operation: "move",
		})
		const userRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.sidecar],
			operation: "rename",
		})

		expect(agentRisk.shouldWarn).toBe(true)
		expect(agentRisk.riskTypes).toContain("sidecar")
		expect(userRisk.shouldWarn).toBe(true)
		expect(userRisk.riskTypes).toContain("sidecar")
	})

	test("warns for any file under images videos or audios", async () => {
		const tree = createCanvasTree()

		const imageRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.unusedImage],
			operation: "delete",
		})
		const videoRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.video],
			operation: "move",
		})
		const audioRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.audio],
			operation: "rename",
		})

		expect(imageRisk.shouldWarn).toBe(true)
		expect(imageRisk.riskTypes).toContain("canvas-resource")
		expect(videoRisk.shouldWarn).toBe(true)
		expect(videoRisk.riskTypes).toContain("canvas-resource")
		expect(audioRisk.shouldWarn).toBe(true)
		expect(audioRisk.riskTypes).toContain("canvas-resource")
	})

	test("warns for images videos or audios directories", async () => {
		const tree = createCanvasTree()

		const imagesRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.imagesDir],
			operation: "delete",
		})
		const videosRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.videosDir],
			operation: "move",
		})
		const audiosRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.audiosDir],
			operation: "rename",
		})

		expect(imagesRisk.shouldWarn).toBe(true)
		expect(videosRisk.shouldWarn).toBe(true)
		expect(audiosRisk.shouldWarn).toBe(true)
	})

	test("matches selected items by relative path when file id is unavailable", async () => {
		const tree = createCanvasTree()
		const legacyImagesDir: AttachmentItem = {
			...tree.imagesDir,
			file_id: undefined,
		}
		tree.canvasDir.children = tree.canvasDir.children?.map((item) =>
			item === tree.imagesDir ? legacyImagesDir : item,
		)

		const risk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			fileIds: ["Workspace/Canvas/images"],
			operation: "delete",
		})

		expect(risk.shouldWarn).toBe(true)
		expect(risk.riskTypes).toContain("canvas-resource")
	})

	test("does not warn when operating the whole canvas directory or its parent", async () => {
		const tree = createCanvasTree()

		const canvasRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.canvasDir],
			operation: "delete",
		})
		const parentRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.parentDir],
			operation: "delete",
		})

		expect(canvasRisk.shouldWarn).toBe(false)
		expect(parentRisk.shouldWarn).toBe(false)
	})

	test("does not warn for canvas plugin directory changes", async () => {
		const tree = createCanvasTree()

		const dirRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.pluginDir],
			operation: "delete",
		})
		const fileRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.pluginFile],
			operation: "rename",
		})

		expect(dirRisk.shouldWarn).toBe(false)
		expect(fileRisk.shouldWarn).toBe(false)
	})

	test("does not warn for ordinary files in the canvas directory", async () => {
		const tree = createCanvasTree()

		const risk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			items: [tree.ordinaryFile],
			operation: "delete",
		})

		expect(risk.shouldWarn).toBe(false)
	})

	test("uses attachmentIndex local lookups for canvas resource detection", async () => {
		const tree = createCanvasTree()
		const attachmentIndex = buildAttachmentIndex(tree.attachments)

		const imageRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			attachmentIndex,
			fileIds: [tree.unusedImage.file_id as string],
			operation: "move",
		})
		const entryRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			attachmentIndex,
			fileIds: [tree.mainFile.file_id as string],
			operation: "move",
		})
		const imagesDirRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			attachmentIndex,
			fileIds: [tree.imagesDir.file_id as string],
			operation: "move",
		})
		const wholeProjectRisk = await detectCanvasProjectOperationRisk({
			attachments: tree.attachments,
			attachmentIndex,
			fileIds: [tree.canvasDir.file_id as string],
			operation: "move",
		})

		expect(imageRisk.shouldWarn).toBe(true)
		expect(imageRisk.riskTypes).toContain("canvas-resource")
		expect(entryRisk.shouldWarn).toBe(true)
		expect(entryRisk.riskTypes).toContain("project-entry")
		expect(imagesDirRisk.shouldWarn).toBe(true)
		expect(imagesDirRisk.riskTypes).toContain("canvas-resource")
		expect(wholeProjectRisk.shouldWarn).toBe(false)
	})
})
