import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { buildSlidesTemplateProject, parseSlidesTemplateManifest } from "../templateProject"

function createRoot(): AttachmentItem {
	return {
		file_id: "template-root",
		file_name: "PPT-template",
		relative_file_path: "PPT-template",
		is_directory: true,
		children: [
			{ file_id: "manifest", file_name: "template.json", is_directory: false },
			{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
			{ file_id: "theme", file_name: "theme.css", is_directory: false },
			{
				file_id: "slides-dir",
				file_name: "slides",
				is_directory: true,
				children: [
					{ file_id: "slide-a", file_name: "封面.html", is_directory: false },
					{ file_id: "slide-b", file_name: "agenda.html", is_directory: false },
				],
			},
		],
	}
}

function createManifest() {
	return {
		schema_version: "1.0",
		files: { slides_dir: "slides", theme_css: "theme.css" },
		slides: [
			{ file: "slides/封面.html", title: "封面", layout: "cover", description: "封面页" },
			{
				file: "slides/agenda.html",
				title: "Agenda",
				layout: "agenda",
				description: "Agenda page",
			},
		],
		unknown_field: { keep: true },
	}
}

describe("slides template project model", () => {
	it("keeps manifest order and maps Chinese slide file names", () => {
		const manifest = parseSlidesTemplateManifest(JSON.stringify(createManifest()))
		const project = buildSlidesTemplateProject(createRoot(), manifest)

		expect(project.slidePaths).toEqual(["slides/封面.html", "slides/agenda.html"])
		expect(project.slideFiles.get("slides/封面.html")?.file_id).toBe("slide-a")
		expect(project.displayConfig).toEqual({
			type: "slide",
			slides: ["slides/封面.html", "slides/agenda.html"],
		})
	})

	it("accepts numbered Chinese slide file names", () => {
		const input = createManifest()
		input.slides[0].file = "slides/01-中文封面.html"

		expect(parseSlidesTemplateManifest(JSON.stringify(input)).slides[0].file).toBe(
			"slides/01-中文封面.html",
		)
	})

	it.each([
		["schema_version", { schema_version: "2.0" }],
		["slides directory", { files: { slides_dir: "pages" } }],
		["slide path", { slides: [{ file: "../escape.html" }] }],
		[
			"slide metadata",
			{
				slides: [
					{ file: "slides/cover.html", title: "", layout: "cover", description: "Cover" },
				],
			},
		],
	])("rejects an invalid %s", (_label, override) => {
		const input = { ...createManifest(), ...override }
		expect(() => parseSlidesTemplateManifest(JSON.stringify(input))).toThrow()
	})

	it("rejects a manifest page missing from the attachment tree", () => {
		const root = createRoot()
		root.children?.find((item) => item.file_name === "slides")?.children?.pop()
		const manifest = parseSlidesTemplateManifest(JSON.stringify(createManifest()))

		expect(() => buildSlidesTemplateProject(root, manifest)).toThrow(
			"Missing slide file: slides/agenda.html",
		)
	})

	it("requires theme.css in the standard template structure", () => {
		const root = createRoot()
		root.children = root.children?.filter((item) => item.file_name !== "theme.css")
		const manifest = parseSlidesTemplateManifest(JSON.stringify(createManifest()))

		expect(() => buildSlidesTemplateProject(root, manifest)).toThrow("Missing theme.css")
	})
})
