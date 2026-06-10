import { describe, expect, it } from "vitest"
import {
	getAppEntryFile,
	getChildrenForCustomMetadataIconPath,
	getCustomIcon,
	getFileTreeIconType,
	normalizeRelativePathSegments,
	resolveCustomIconPathToDirectSrc,
	resolveFileByRelativePath,
} from "../utils"

describe("normalizeRelativePathSegments", () => {
	it("returns segments for simple file", () => {
		expect(normalizeRelativePathSegments("D.mp3")).toEqual(["D.mp3"])
	})

	it("returns nested segments", () => {
		expect(normalizeRelativePathSegments("E/F.html")).toEqual(["E", "F.html"])
	})

	it("trims and normalizes backslashes", () => {
		expect(normalizeRelativePathSegments("  E\\F.html  ")).toEqual(["E", "F.html"])
	})

	it("rejects path traversal", () => {
		expect(normalizeRelativePathSegments("../x")).toBeNull()
		expect(normalizeRelativePathSegments("a/../b")).toBeNull()
	})

	it("rejects empty path", () => {
		expect(normalizeRelativePathSegments("")).toBeNull()
		expect(normalizeRelativePathSegments("   ")).toBeNull()
	})
})

describe("resolveFileByRelativePath", () => {
	const tree = [
		{ file_id: "1", name: "B.txt", is_directory: false },
		{ file_id: "2", name: "D.mp3", is_directory: false },
		{
			file_id: "3",
			name: "E",
			is_directory: true,
			children: [{ file_id: "4", name: "F.html", is_directory: false }],
		},
	]

	it("resolves root-level file by name", () => {
		const r = resolveFileByRelativePath(tree, "D.mp3")
		expect(r?.file_id).toBe("2")
	})

	it("resolves nested file", () => {
		const r = resolveFileByRelativePath(tree, "E/F.html")
		expect(r?.file_id).toBe("4")
	})

	it("only matches item.name not file_name alone", () => {
		const r = resolveFileByRelativePath(
			[{ file_id: "x", file_name: "only.mp3", is_directory: false }],
			"only.mp3",
		)
		expect(r).toBeNull()
	})

	it("returns null when segment missing", () => {
		expect(resolveFileByRelativePath(tree, "missing.mp3")).toBeNull()
	})

	it("returns null when last segment is directory", () => {
		expect(resolveFileByRelativePath(tree, "E")).toBeNull()
	})
})

describe("getCustomIcon", () => {
	it("reads metadata.icon for custom type", () => {
		expect(getCustomIcon({ type: "custom", icon: "a.png", icon_path: "b.png" })).toBe("a.png")
	})

	it("falls back to metadata.icon_path when icon missing", () => {
		expect(getCustomIcon({ type: "custom", icon_path: "legacy.png" })).toBe("legacy.png")
	})

	it("returns undefined when not custom", () => {
		expect(getCustomIcon({ type: "slide", icon: "x.png" })).toBeUndefined()
	})
})

describe("resolveCustomIconPathToDirectSrc", () => {
	it("returns http URL as-is", () => {
		expect(resolveCustomIconPathToDirectSrc("http://example.com/a.png")).toBe(
			"http://example.com/a.png",
		)
	})

	it("returns https URL as-is", () => {
		expect(resolveCustomIconPathToDirectSrc("  https://cdn/x.svg  ")).toBe("https://cdn/x.svg")
	})

	it("returns data URL as-is", () => {
		const d = "data:image/png;base64,AAAA"
		expect(resolveCustomIconPathToDirectSrc(d)).toBe(d)
	})

	it("returns undefined for relative path", () => {
		expect(resolveCustomIconPathToDirectSrc("assets/icon.png")).toBeUndefined()
	})

	it("returns undefined for empty", () => {
		expect(resolveCustomIconPathToDirectSrc("")).toBeUndefined()
		expect(resolveCustomIconPathToDirectSrc("   ")).toBeUndefined()
	})
})

describe("getFileTreeIconType", () => {
	it("prefers extension for merged custom entry file metadata", () => {
		expect(
			getFileTreeIconType({
				display_config: { type: "custom", index: "a.html" },
				file_extension: "html",
			}),
		).toBe("html")
	})

	it("maps slide for non-custom", () => {
		expect(
			getFileTreeIconType({
				display_config: { type: "slide" },
				file_extension: "html",
			}),
		).toBe("ppt")
	})
})

describe("getChildrenForCustomMetadataIconPath", () => {
	it("uses item.children for directory", () => {
		const ch = [{ n: 1 }]
		expect(
			getChildrenForCustomMetadataIconPath({ is_directory: true, children: ch }, () => null),
		).toBe(ch)
	})

	it("uses parent.children for file with parent_id", () => {
		const folderChildren = [{ file_id: "icon" }]
		const find = (id: string) =>
			id === "p" ? { is_directory: true, children: folderChildren } : null
		expect(
			getChildrenForCustomMetadataIconPath({ is_directory: false, parent_id: "p" }, find),
		).toBe(folderChildren)
	})

	it("uses custom folder children for entry file with _customFolderId", () => {
		const customFolderChildren = [{ file_id: "asset" }]
		const entryFolderChildren = [{ file_id: "entry" }]
		const find = (id: string) => {
			if (id === "custom_folder")
				return { is_directory: true, children: customFolderChildren }
			if (id === "entry_folder") return { is_directory: true, children: entryFolderChildren }
			return null
		}
		expect(
			getChildrenForCustomMetadataIconPath(
				{
					is_directory: false,
					parent_id: "entry_folder",
					metadata: { _customFolderId: "custom_folder" },
				},
				find,
			),
		).toBe(customFolderChildren)
	})
})

describe("getAppEntryFile", () => {
	it("uses index.html when not custom", () => {
		const children = [
			{ name: "index.html", file_id: "i" },
			{ name: "other.html", file_id: "o" },
		]
		expect(getAppEntryFile(children, { type: "slide" })?.file_id).toBe("i")
	})

	it("uses index for custom type", () => {
		const children = [
			{ name: "index.html", file_id: "i" },
			{ name: "app.html", file_id: "a", is_directory: false },
		]
		expect(
			getAppEntryFile(children, {
				type: "custom",
				index: "app.html",
			})?.file_id,
		).toBe("a")
	})

	it("uses app.json entry for micro-app type", () => {
		const children = [
			{ name: "index.html", file_id: "i" },
			{ name: "main.html", file_id: "m", is_directory: false },
		]
		expect(
			getAppEntryFile(children, {
				type: "micro-app",
				entry: "main.html",
			})?.file_id,
		).toBe("m")
	})

	it("falls back to root_path for legacy custom metadata", () => {
		const children = [
			{ name: "index.html", file_id: "i" },
			{ name: "legacy.html", file_id: "l", is_directory: false },
		]
		expect(
			getAppEntryFile(children, {
				type: "custom",
				root_path: "legacy.html",
			})?.file_id,
		).toBe("l")
	})
})
