import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import {
	createSkillArchiveFromFolder,
	createSkillArchiveFromSelectedFolderFiles,
	IMPORT_SKILL_DROP_ERROR,
	ImportSkillDropError,
	normalizeSkillImportFile,
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

async function createArchiveFile(name: string, entries: Array<{ path: string; content: string }>) {
	const zip = new JSZip()
	for (const entry of entries) {
		zip.file(entry.path, entry.content)
	}

	const blob = await zip.generateAsync({ type: "blob" })
	return new File([blob], name, { type: "application/zip" })
}

describe("ImportSkillDialog utils", () => {
	it("archives folder contents at zip root; folder name is only the archive file name", async () => {
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
		expect(Object.keys(zip.files).sort()).toEqual(["SKILL.md", "assets/", "assets/icon.png"])
		expect(await zip.file("SKILL.md")?.async("string")).toBe("# Skill")
		expect(await zip.file("assets/icon.png")?.async("string")).toBe("icon")
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
		expect(Object.keys(zip.files).sort()).toEqual(["SKILL.md", "config/", "config/schema.json"])
	})

	it("normalizes uploaded archives without affecting folder packing logic", async () => {
		const archiveFile = await createArchiveFile("selected-skill.zip", [
			{ path: "__MACOSX/._SKILL.md", content: "" },
			{ path: "selected-skill/selected-skill/SKILL.md", content: "# Selected Skill" },
			{ path: "selected-skill/selected-skill/config/schema.json", content: "{}" },
		])

		const normalizedArchive = await normalizeSkillImportFile(archiveFile)
		const zip = await JSZip.loadAsync(normalizedArchive)

		expect(normalizedArchive.name).toBe("selected-skill.zip")
		expect(Object.keys(zip.files).sort()).toEqual(["SKILL.md", "config/", "config/schema.json"])
	})

	it("keeps already normalized uploaded archives unchanged", async () => {
		const archiveFile = await createArchiveFile("selected-skill.zip", [
			{ path: "SKILL.md", content: "# Selected Skill" },
			{ path: "config/schema.json", content: "{}" },
		])

		const normalizedArchive = await normalizeSkillImportFile(archiveFile)
		const zip = await JSZip.loadAsync(normalizedArchive)

		expect(Object.keys(zip.files).sort()).toEqual(["SKILL.md", "config/", "config/schema.json"])
	})
})
