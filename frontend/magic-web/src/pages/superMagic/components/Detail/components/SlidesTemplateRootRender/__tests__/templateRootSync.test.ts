import { describe, expect, it } from "vitest"
import { getSlidesTemplateSyncKey } from "../templateRootSync"

function createTemplateRoot(
	id: string,
	options?: { manifestUpdatedAt?: string; extraSlide?: boolean },
) {
	return {
		file_id: id,
		file_name: id,
		is_directory: true,
		relative_file_path: id,
		updated_at: "root-1",
		children: [
			{
				file_id: `${id}-manifest`,
				file_name: "template.json",
				updated_at: options?.manifestUpdatedAt || "manifest-1",
			},
			{ file_id: `${id}-theme`, file_name: "theme.css", updated_at: "theme-1" },
			{
				file_id: `${id}-slides`,
				file_name: "slides",
				is_directory: true,
				children: [
					{
						file_id: `${id}-slide-1`,
						file_name: "1.html",
						relative_file_path: `${id}/slides/1.html`,
						updated_at: "slide-1",
					},
					...(options?.extraSlide
						? [
								{
									file_id: `${id}-slide-2`,
									file_name: "2.html",
									relative_file_path: `${id}/slides/2.html`,
									updated_at: "slide-2",
								},
							]
						: []),
				],
			},
		],
	}
}

describe("getSlidesTemplateSyncKey", () => {
	it("ignores sibling template object identity and timestamps", () => {
		const templateA = createTemplateRoot("SLIDE-a")
		const sameTemplateNewObjects = JSON.parse(JSON.stringify(templateA))
		sameTemplateNewObjects.updated_at = "root-2"
		sameTemplateNewObjects.children[1].updated_at = "theme-2"
		sameTemplateNewObjects.children[2].children[0].updated_at = "slide-rewritten"

		expect(getSlidesTemplateSyncKey(sameTemplateNewObjects)).toBe(
			getSlidesTemplateSyncKey(templateA),
		)
	})

	it("changes when this template gains a slide or a new manifest", () => {
		const templateA = createTemplateRoot("SLIDE-a")
		const withNewSlide = createTemplateRoot("SLIDE-a", { extraSlide: true })
		const withNewManifest = createTemplateRoot("SLIDE-a", {
			manifestUpdatedAt: "manifest-2",
		})

		expect(getSlidesTemplateSyncKey(withNewSlide)).not.toBe(getSlidesTemplateSyncKey(templateA))
		expect(getSlidesTemplateSyncKey(withNewManifest)).not.toBe(
			getSlidesTemplateSyncKey(templateA),
		)
	})
})
