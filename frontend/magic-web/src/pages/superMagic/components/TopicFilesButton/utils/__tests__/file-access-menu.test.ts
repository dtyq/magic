import { describe, expect, it } from "vitest"
import { DEFAULT_FILE_ACCESS } from "@/pages/superMagic/providers/FileAccessProvider"
import { filterFileAccessMenuItems } from "../file-access-menu"

const items = [
	{ key: "download", children: [{ key: "downloadOriginal" }, { key: "downloadPdf" }] },
	{ key: "share" },
	{ key: "openFile" },
	{ key: "rename" },
]

describe("file operation menu access", () => {
	it("keeps exports when original download is denied", () => {
		const filtered = filterFileAccessMenuItems(items, {
			...DEFAULT_FILE_ACCESS,
			download: false,
		})
		expect(filtered[0].children).toEqual([{ key: "downloadPdf" }])
		expect(items[0].children).toHaveLength(2)
	})
	it("keeps original download when exports are denied", () => {
		expect(
			filterFileAccessMenuItems(items, { ...DEFAULT_FILE_ACCESS, export: false })[0].children,
		).toEqual([{ key: "downloadOriginal" }])
	})
	it("removes empty groups and denied actions without changing unrelated file operations", () => {
		expect(
			filterFileAccessMenuItems(items, {
				download: false,
				export: false,
				share: false,
				preview: false,
				view: true,
			}),
		).toEqual([{ key: "rename" }])
	})
	it("requires view permission to open a preview", () => {
		expect(
			filterFileAccessMenuItems([{ key: "openFile" }], {
				...DEFAULT_FILE_ACCESS,
				view: false,
			}),
		).toEqual([])
	})
})
