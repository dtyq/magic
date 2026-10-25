import { describe, expect, it } from "vitest"
import type { UploadFile } from "@/components/CanvasDesign/public/magic-types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { prepareFilesForUpload } from "../fileNaming"
import {
	collectAllFilesInDirectory,
	collectFilesInDirectory,
	generateUniqueDesignFileName,
} from "../utils"

describe("generateUniqueDesignFileName", () => {
	it("keeps an unused file name", () => {
		expect(generateUniqueDesignFileName("a.png", new Set(["b.png"]))).toBe("a.png")
	})

	it("uses the first available numbered name after one scan", () => {
		expect(generateUniqueDesignFileName("a.png", new Set(["a.png", "a(2).png"]))).toBe(
			"a(1).png",
		)
	})

	it("matches the backend rule for an already numbered source name", () => {
		expect(generateUniqueDesignFileName("a(1).png", new Set(["a(1).png", "a(1)(2).png"]))).toBe(
			"a(1)(1).png",
		)
	})

	it("ignores numbered names belonging to another base name", () => {
		expect(generateUniqueDesignFileName("a.png", new Set(["a.png", "ab(1).png"]))).toBe(
			"a(1).png",
		)
	})

	it("collects audio files for upload naming without changing the image-only collector", () => {
		const attachments: FileItem[] = [
			{
				file_id: "audio-1",
				file_name: "same.mp3",
				file_extension: "mp3",
				file_size: 5,
				relative_file_path: "/new/audios/same.mp3",
			},
			{
				file_id: "image-1",
				file_name: "same.png",
				file_extension: "png",
				file_size: 5,
				relative_file_path: "/new/audios/same.png",
			},
		]

		expect(
			collectFilesInDirectory(attachments, "new/audios").map((item) => item.file_name),
		).toEqual(["same.png"])
		expect(
			collectAllFilesInDirectory(attachments, "new/audios").map((item) => item.file_name),
		).toEqual(["same.mp3", "same.png"])
	})

	it("keeps a same-name same-size audio upload when overwrite is allowed", () => {
		const file = new File(["audio"], "same.mp3", { type: "audio/mpeg" })
		const uploadFile: UploadFile = {
			file,
			overwrite: true,
			uploadSubDir: "audios",
			onUploadComplete: () => undefined,
			onUploadFailed: () => undefined,
		}
		const result = prepareFilesForUpload({
			uploadFiles: [uploadFile],
			suffixDir: "new/audios",
			attachments: [
				{
					file_id: "audio-1",
					file_name: "same.mp3",
					file_extension: "mp3",
					file_size: file.size,
					relative_file_path: "/new/audios/same.mp3",
				},
			],
		})

		expect(result.filesToUpload[0]?.name).toBe("same.mp3")
		expect(result.fileNameToUploadFileMap.get("same.mp3")).toBe(uploadFile)
	})

	it("renames a same-name different-size audio upload under the shared media policy", () => {
		const file = new File(["audio"], "same.mp3", { type: "audio/mpeg" })
		const uploadFile: UploadFile = {
			file,
			overwrite: true,
			uploadSubDir: "audios",
			onUploadComplete: () => undefined,
			onUploadFailed: () => undefined,
		}
		const result = prepareFilesForUpload({
			uploadFiles: [uploadFile],
			suffixDir: "new/audios",
			attachments: [
				{
					file_id: "audio-1",
					file_name: "same.mp3",
					file_extension: "mp3",
					file_size: file.size + 1,
					relative_file_path: "/new/audios/same.mp3",
				},
			],
		})

		expect(result.filesToUpload[0]?.name).toBe("same(1).mp3")
		expect(result.fileNameToUploadFileMap.get("same(1).mp3")).toBe(uploadFile)
	})
})
