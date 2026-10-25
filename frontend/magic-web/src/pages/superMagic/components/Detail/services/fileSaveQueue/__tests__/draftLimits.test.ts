import { describe, expect, it } from "vitest"
import { estimateSaveRecordBytes, listDraftFileIdsToDrop } from "../draftLimits"
import type { StoredFileSaveRecord } from "../types"

function record(fileId: string, updatedAt: number, content = "<p>x</p>"): StoredFileSaveRecord {
	return {
		fileId,
		content,
		enableShadow: false,
		updatedAt,
	}
}

describe("listDraftFileIdsToDrop", () => {
	it("drops expired drafts first", () => {
		const drop = listDraftFileIdsToDrop([record("old", 1), record("fresh", 100)], 100, {
			ttlMs: 10,
			maxRecords: 30,
			maxTotalBytes: 8 * 1024 * 1024,
		})
		expect(drop).toEqual(["old"])
	})

	it("keeps the newest records when over the count cap", () => {
		const drop = listDraftFileIdsToDrop([record("a", 1), record("b", 2), record("c", 3)], 10, {
			ttlMs: 100,
			maxRecords: 2,
			maxTotalBytes: 8 * 1024 * 1024,
		})
		expect(drop).toEqual(["a"])
	})

	it("drops oldest drafts when total bytes overflow", () => {
		const large = "x".repeat(100)
		const drop = listDraftFileIdsToDrop(
			[record("old", 1, large), record("new", 2, large)],
			10,
			{
				ttlMs: 100,
				maxRecords: 30,
				maxTotalBytes: estimateSaveRecordBytes(record("new", 2, large)),
			},
		)
		expect(drop).toEqual(["old"])
	})
})
