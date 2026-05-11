import { describe, expect, it } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	buildAttachmentsSnapshotKeyFromFlatFiles,
	buildDesignAttachmentIndex,
	findAttachmentByNormalizedWorkspacePath,
} from "../designAttachmentIndex"

function fileItem(partial: Partial<FileItem> & Pick<FileItem, "file_id">): FileItem {
	return {
		is_directory: false,
		relative_file_path: "",
		file_name: "",
		...partial,
	}
}

describe("buildDesignAttachmentIndex", () => {
	it("indexes normalized paths and file ids", () => {
		const flat: FileItem[] = [
			fileItem({
				file_id: "a",
				relative_file_path: "/proj/images/x.png",
				file_name: "x.png",
			}),
		]
		const idx = buildDesignAttachmentIndex(flat)
		expect(idx.byFileId.get("a")).toBe(flat[0])
		expect(findAttachmentByNormalizedWorkspacePath(idx, "proj/images/x.png")).toBe(flat[0])
	})

	it("produces stable snapshot key ordering", () => {
		const f1 = fileItem({
			file_id: "1",
			relative_file_path: "a/b",
			updated_at: "2024-01-01",
		})
		const f2 = fileItem({
			file_id: "2",
			relative_file_path: "c/d",
			updated_at: "2024-01-02",
		})
		const k1 = buildAttachmentsSnapshotKeyFromFlatFiles([f1, f2])
		const k2 = buildAttachmentsSnapshotKeyFromFlatFiles([f2, f1])
		expect(k1).toBe(k2)
	})
})
