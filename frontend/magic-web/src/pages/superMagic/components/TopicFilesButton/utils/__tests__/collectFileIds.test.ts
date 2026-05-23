import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import { collectFileIds } from "../collectFileIds"
import { getAttachmentKey } from "../getAttachmentKey"

describe("collectFileIds", () => {
	it("includes empty folder file_id when selected by folder key for batch delete", () => {
		const emptyFolder: AttachmentItem = {
			file_id: "memory-dir",
			file_name: "memory",
			is_directory: true,
			children: [],
			relative_file_path: ".magic/memory",
		}

		const selectedItems = new Set([getAttachmentKey(emptyFolder)])
		const ids = collectFileIds({
			items: [emptyFolder],
			selectedItems,
			getItemId: getAttachmentKey,
			includeFolderIds: true,
		})

		expect(ids).toEqual(["memory-dir"])
	})
})
