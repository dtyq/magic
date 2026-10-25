import { describe, expect, it } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	buildCanvasAttachmentLocationIndex,
	resolveCanvasDirectories,
} from "../canvasAttachmentLocationIndex"

function file(overrides: Partial<FileItem>): FileItem {
	return {
		file_id: "file-1",
		file_name: "file.png",
		relative_file_path: "Canvas/images/file.png",
		is_directory: false,
		...overrides,
	}
}

describe("canvasAttachmentLocationIndex", () => {
	it("uses display_config to locate final media under the Canvas directory", () => {
		const flatAttachments = [
			file({
				file_id: "canvas-1",
				file_name: "Canvas",
				relative_file_path: "Canvas",
				is_directory: true,
				display_config: { type: "design" },
			}),
			file({ file_id: "image-file" }),
			file({
				file_id: "video-file",
				file_name: "video.mp4",
				relative_file_path: "Canvas/videos/video.mp4",
			}),
			file({
				file_id: "audio-file",
				file_name: "audio.mp3",
				relative_file_path: "Canvas/audios/audio.mp3",
			}),
		]

		const index = buildCanvasAttachmentLocationIndex({
			attachments: flatAttachments,
			flatAttachments,
			candidateFileIds: ["image-file", "video-file", "audio-file"],
		})

		expect(index.get("image-file")).toEqual([
			{ canvasDesignId: "canvas-1", mediaFileId: "image-file" },
		])
		expect(index.get("video-file")).toEqual([
			{ canvasDesignId: "canvas-1", mediaFileId: "video-file" },
		])
		expect(index.get("audio-file")).toEqual([
			{ canvasDesignId: "canvas-1", mediaFileId: "audio-file" },
		])
	})

	it("selects the deepest Canvas directory for nested Canvas folders", () => {
		const flatAttachments = [
			file({
				file_id: "outer-canvas",
				relative_file_path: "Outer",
				is_directory: true,
				display_config: { type: "design" },
			}),
			file({
				file_id: "inner-canvas",
				relative_file_path: "Outer/Inner",
				is_directory: true,
				display_config: { type: "design" },
			}),
			file({
				file_id: "audio-file",
				relative_file_path: "Outer/Inner/audios/audio.mp3",
			}),
		]

		const index = buildCanvasAttachmentLocationIndex({
			attachments: flatAttachments,
			flatAttachments,
			candidateFileIds: ["audio-file"],
		})

		expect(index.get("audio-file")).toEqual([
			{ canvasDesignId: "inner-canvas", mediaFileId: "audio-file" },
		])
	})

	it("does not create a target for non-Canvas folders or files outside Canvas", () => {
		const flatAttachments = [
			file({
				file_id: "slides",
				relative_file_path: "Slides",
				is_directory: true,
				display_config: { type: "slide" },
			}),
			file({
				file_id: "slide-image",
				relative_file_path: "Slides/images/image.png",
			}),
			file({
				file_id: "root-audio",
				relative_file_path: "audios/audio.mp3",
			}),
		]

		const index = buildCanvasAttachmentLocationIndex({
			attachments: flatAttachments,
			flatAttachments,
			candidateFileIds: ["slide-image", "root-audio"],
		})

		expect(index.size).toBe(0)
	})

	it("falls back to the attachments tree when the flat snapshot is empty", () => {
		const tree = [
			file({
				file_id: "tree-canvas",
				relative_file_path: "TreeCanvas",
				is_directory: true,
				display_config: { type: "design" },
				children: [
					file({
						file_id: "tree-audio",
						relative_file_path: "TreeCanvas/audios/audio.mp3",
					}),
				],
			}),
		]

		const index = buildCanvasAttachmentLocationIndex({
			attachments: tree,
			flatAttachments: [],
			candidateFileIds: ["tree-audio"],
		})

		expect(index.get("tree-audio")).toEqual([
			{ canvasDesignId: "tree-canvas", mediaFileId: "tree-audio" },
		])
	})

	it("merges Canvas folders from the tree with the latest flat file rows", () => {
		const tree = [
			file({
				file_id: "tree-canvas",
				relative_file_path: "TreeCanvas",
				is_directory: true,
				display_config: { type: "design" },
			}),
		]
		const flatAttachments = [
			file({
				file_id: "tree-audio",
				relative_file_path: "TreeCanvas/audios/audio.mp3",
			}),
		]

		const index = buildCanvasAttachmentLocationIndex({
			attachments: tree,
			flatAttachments,
			candidateFileIds: ["tree-audio"],
		})

		expect(index.get("tree-audio")).toEqual([
			{ canvasDesignId: "tree-canvas", mediaFileId: "tree-audio" },
		])
	})

	it("shares Canvas directory lookup data across identical snapshots", () => {
		const flatAttachments = [
			file({
				file_id: "canvas-1",
				relative_file_path: "Canvas",
				is_directory: true,
				display_config: { type: "design" },
			}),
		]

		expect(resolveCanvasDirectories(flatAttachments)).toBe(
			resolveCanvasDirectories(flatAttachments),
		)
	})
})
