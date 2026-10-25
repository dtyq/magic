import { describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { assignBoardSlots, type BoardArtwork } from "../components/AiCanvasHero"
import { pickCanvasCovers } from "../hooks/useCanvasCovers"

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn(),
}))
vi.mock("@/pages/superMagic/services/useFileMediaSource", () => ({
	getFileMediaMetadata: (file: AttachmentItem, projectId: string) => ({
		spaceType: "project",
		fileId: file.file_id,
		projectId,
		fileName: file.file_name,
		fileExtension: file.file_extension,
	}),
	useFileMediaSource: vi.fn(),
}))

describe("assignBoardSlots", () => {
	it("uses every artwork at most once and leaves extra slots empty", () => {
		const artworks: BoardArtwork[] = [
			{ key: "cat", kind: "poster", url: "cat.webp" },
			{ key: "dog", kind: "storyboard", url: "dog.webp" },
		]
		const slots = assignBoardSlots(artworks)

		expect(slots.poster?.key).toBe("cat")
		// The dog matches a storyboard frame, so it is not pulled into the character slot.
		expect(slots.storyboard.map((artwork) => artwork?.key)).toEqual([
			"dog",
			undefined,
			undefined,
		])
		expect(slots.character).toBeUndefined()
		expect(slots.products).toEqual([undefined, undefined, undefined])
	})

	it("fans extra products behind the front card before taking leftovers", () => {
		const slots = assignBoardSlots([
			{ key: "p1", kind: "product", url: "p1.webp" },
			{ key: "p2", kind: "product", url: "p2.webp" },
			{ key: "p3", kind: "product", url: "p3.webp" },
			{ key: "s1", kind: "storyboard", url: "s1.webp" },
		])

		expect(slots.products.map((artwork) => artwork?.key)).toEqual(["p1", "p2", "p3"])
		expect(slots.storyboard[0]?.key).toBe("s1")
	})

	it("prefers an artwork of the slot's own kind", () => {
		const slots = assignBoardSlots([
			{ key: "a", kind: "product", url: "a.webp" },
			{ key: "b", kind: "poster", url: "b.webp" },
		])

		expect(slots.poster?.key).toBe("b")
		expect(slots.products[0]?.key).toBe("a")
	})
})

describe("pickCanvasCovers", () => {
	const file = (overrides: Partial<AttachmentItem>): AttachmentItem => ({
		file_id: "id",
		file_name: "image.png",
		file_extension: "png",
		relative_file_path: "/canvas/images/image.png",
		...overrides,
	})

	it("returns null when the canvas has no visible image", () => {
		expect(
			pickCanvasCovers(
				[
					file({ file_id: "js", file_name: "magic.project.js", file_extension: "js" }),
					file({ file_id: "hidden", is_hidden: true }),
					file({ file_id: "tmp", relative_file_path: "/.tmp/image.png" }),
				],
				"p1",
			),
		).toBeNull()
	})

	it("returns at most four images, newest first", () => {
		const covers = pickCanvasCovers(
			["2026-10-17", "2026-10-21", "2026-10-19", "2026-10-20", "2026-10-18"].map((date) =>
				file({ file_id: date, updated_at: `${date} 10:00:00` }),
			),
			"p1",
		)

		expect(covers?.map((cover) => cover.fileId)).toEqual([
			"2026-10-21",
			"2026-10-20",
			"2026-10-19",
			"2026-10-18",
		])
		expect(covers?.[0]?.projectId).toBe("p1")
	})
	it("fills empty slots with leftovers in visual-weight order", () => {
		const slots = assignBoardSlots([
			{ key: "x", kind: "storyboard", url: "x.webp" },
			{ key: "y", kind: "storyboard", url: "y.webp" },
			{ key: "z", kind: "storyboard", url: "z.webp" },
			{ key: "w", kind: "storyboard", url: "w.webp" },
		])

		expect(slots.storyboard.map((artwork) => artwork?.key)).toEqual(["x", "y", "z"])
		expect(slots.poster?.key).toBe("w")
	})
})
