import { beforeEach, describe, expect, it, vi } from "vitest"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import {
	mergeStaticDependencyFileIds,
	resolveSingleDocumentStaticDependencies,
	supportsStaticDependencies,
} from ".."

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

describe("resolveSingleDocumentStaticDependencies", () => {
	beforeEach(() => {
		vi.mocked(getFileContentById).mockReset()
	})

	it("loads content and delegates a supported document to its parser", async () => {
		vi.mocked(getFileContentById).mockResolvedValue("# README")

		await expect(
			resolveSingleDocumentStaticDependencies({
				fileIds: ["readme-md"],
				attachments: [
					{
						file_id: "readme-md",
						file_name: "README.md",
						file_extension: "md",
					},
				],
			}),
		).resolves.toEqual({
			fileType: "markdown",
			dependencyFileIds: [],
			dependencyTransferFileIds: [],
			missingResourcePaths: [],
		})
		expect(getFileContentById).toHaveBeenCalledWith("readme-md", {
			responseType: "text",
		})
	})

	it("does not read content for unsupported or batch selections", async () => {
		const attachments = [
			{ file_id: "image", file_name: "cover.png", relative_file_path: "cover.png" },
			{ file_id: "html", file_name: "index.html", relative_file_path: "index.html" },
		]

		await expect(
			resolveSingleDocumentStaticDependencies({ fileIds: ["image"], attachments }),
		).resolves.toMatchObject({ fileType: null, dependencyFileIds: [] })
		await expect(
			resolveSingleDocumentStaticDependencies({
				fileIds: ["html", "image"],
				attachments,
			}),
		).resolves.toMatchObject({ fileType: null, dependencyFileIds: [] })
		expect(getFileContentById).not.toHaveBeenCalled()
	})

	it("uses the scoped reader and cancels analysis after its pending read", async () => {
		const controller = new AbortController()
		let finishRead!: (content: string) => void
		const scopedRead = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					finishRead = resolve
				}),
		)
		const pending = resolveSingleDocumentStaticDependencies({
			fileIds: ["readme-md"],
			attachments: [{ file_id: "readme-md", file_name: "README.md", file_extension: "md" }],
			fileApi: { getFileContentById: scopedRead },
			signal: controller.signal,
		})
		expect(scopedRead).toHaveBeenCalledWith("readme-md", {
			responseType: "text",
			signal: controller.signal,
		})
		expect(getFileContentById).not.toHaveBeenCalled()
		controller.abort()
		finishRead("# README")
		await expect(pending).rejects.toMatchObject({ name: "AbortError" })
	})
})

describe("mergeStaticDependencyFileIds", () => {
	it("merges dependency IDs only when requested", () => {
		expect(mergeStaticDependencyFileIds(["doc", "image"], ["image", "script"], true)).toEqual([
			"doc",
			"image",
			"script",
		])
		expect(mergeStaticDependencyFileIds(["doc"], ["image"], false)).toEqual(["doc"])
	})
})

describe("supportsStaticDependencies", () => {
	it("uses the registered parsers as the source of truth", () => {
		expect(supportsStaticDependencies({ file_name: "index.html" })).toBe(true)
		expect(supportsStaticDependencies({ file_name: "README.md" })).toBe(true)
		expect(supportsStaticDependencies({ file_name: "cover.png" })).toBe(false)
	})
})
