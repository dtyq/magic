import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import {
	createSkillArchiveFromFolderFiles,
	SKILL_ARCHIVE_ERROR,
	SkillArchiveError,
} from "../skillArchive"

function createFolderFile(path: string, content: string) {
	const segments = path.split("/")
	const file = new File([content], segments[segments.length - 1] || "file", {
		type: "text/plain",
	})

	Object.defineProperty(file, "webkitRelativePath", {
		value: path,
		configurable: true,
	})

	return file
}

describe("skill archive utility", () => {
	it("packs selected folder files at the zip root", async () => {
		const archive = await createSkillArchiveFromFolderFiles([
			createFolderFile("demo-skill/SKILL.md", "# Skill"),
			createFolderFile("demo-skill/assets/icon.txt", "icon"),
		])

		expect(archive.name).toBe("demo-skill.zip")
		const zip = await JSZip.loadAsync(archive)
		expect(Object.keys(zip.files).sort()).toEqual(["SKILL.md", "assets/", "assets/icon.txt"])
		expect(await zip.file("SKILL.md")?.async("string")).toBe("# Skill")
		expect(await zip.file("assets/icon.txt")?.async("string")).toBe("icon")
	})

	it("supports an explicit archive name and root folder", async () => {
		const archive = await createSkillArchiveFromFolderFiles(
			[createFolderFile("source/SKILL.md", "# Skill")],
			{ archiveName: "official-skill", rootFolderName: "source" },
		)

		expect(archive.name).toBe("official-skill.zip")
		const zip = await JSZip.loadAsync(archive)
		expect(Object.keys(zip.files)).toEqual(["SKILL.md"])
	})

	it("rejects an empty folder selection", async () => {
		await expect(createSkillArchiveFromFolderFiles([])).rejects.toEqual(
			expect.objectContaining<Partial<SkillArchiveError>>({
				code: SKILL_ARCHIVE_ERROR.EMPTY_FOLDER,
			}),
		)
	})
})
