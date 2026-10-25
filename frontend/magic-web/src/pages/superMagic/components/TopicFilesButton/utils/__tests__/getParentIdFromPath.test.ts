import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import { getParentIdFromPath } from "../getParentIdFromPath"

function directory(fileId: string, name: string, children?: AttachmentItem[]): AttachmentItem {
	return {
		file_id: fileId,
		file_name: name,
		name,
		is_directory: true,
		type: "directory",
		children,
	}
}

describe("getParentIdFromPath", () => {
	it("resolves root paths without an attachment lookup", () => {
		expect(getParentIdFromPath(undefined, undefined)).toBe("")
		expect(getParentIdFromPath(undefined, "/")).toBe("")
	})

	it("resolves an existing empty directory by its stable id", () => {
		expect(getParentIdFromPath([directory("folder-1", "Folder")], "/Folder")).toBe("folder-1")
	})

	it("does not silently fall back to root when a nested path cannot be resolved", () => {
		expect(getParentIdFromPath(undefined, "/Missing")).toBeUndefined()
		expect(
			getParentIdFromPath([directory("folder-1", "Folder")], "/Folder/Missing"),
		).toBeUndefined()
	})
})
