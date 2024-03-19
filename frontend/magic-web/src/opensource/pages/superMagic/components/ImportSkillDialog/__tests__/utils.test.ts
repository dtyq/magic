import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import {
	createSkillArchiveFromFolder,
	createSkillArchiveFromSelectedFolderFiles,
	IMPORT_SKILL_DROP_ERROR,
	ImportSkillDropError,
} from "../utils"

function createFolderFile(path: string, content: string) {
	const segments = path.split("/")
	const fileName = segments[segments.length - 1]
	const file = new File([content], fileName, { type: "text/plain" })

	Object.defineProperty(file, "webkitRelativePath", {
		value: path,
		configurable: true,
	})

	return file
}

describe("ImportSkillDialog utils", () => {
	it("archives folder files with their relative paths preserved", async () => {
		const archive = await createSkillArchiveFromFolder({
			type: "folder",
			name: "demo-skill",
			files: [
				createFolderFile("demo-skill/SKILL.md", "# Skill"),
				createFolderFile("demo-skill/assets/icon.png", "icon"),
			],
		})

		expect(archive.name).toBe("demo-skill.zip")

		const zip = await JSZip.loadAsync(archive)
		expect(Object.keys(zip.files).sort()).toEqual([
			"demo-skill/",
			"demo-skill/SKILL.md",
			"demo-skill/assets/",
			"demo-skill/assets/icon.png",
		])
		expect(await zip.file("demo-skill/SKILL.md")?.async("string")).toBe("# Skill")
		expect(await zip.file("demo-skill/assets/icon.png")?.async("string")).toBe("icon")
	})

	it("rejects empty folders", async () => {
		await expect(
			createSkillArchiveFromFolder({
				type: "folder",
				name: "empty",
				files: [],
			}),
		).rejects.toEqual(
			expect.objectContaining<Partial<ImportSkillDropError>>({
				code: IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER,
			}),
		)
	})

	it("creates a zip from files selected via webkitdirectory input", async () => {
		const archive = await createSkillArchiveFromSelectedFolderFiles([
			createFolderFile("selected-skill/SKILL.md", "# Selected Skill"),
			createFolderFile("selected-skill/config/schema.json", "{}"),
		])

		expect(archive.name).toBe("selected-skill.zip")

		const zip = await JSZip.loadAsync(archive)
		expect(Object.keys(zip.files).sort()).toEqual([
			"selected-skill/",
			"selected-skill/SKILL.md",
			"selected-skill/config/",
			"selected-skill/config/schema.json",
		])
	})
})
