import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveSingleDocumentStaticDependencies } from "@/pages/superMagic/utils/staticDependencies"
import { resolveShareDocumentDependencies } from "../resolveShareDocumentDependencies"

vi.mock("@/pages/superMagic/utils/staticDependencies", () => ({
	resolveSingleDocumentStaticDependencies: vi.fn(),
}))

describe("resolveShareDocumentDependencies", () => {
	beforeEach(() => {
		vi.mocked(resolveSingleDocumentStaticDependencies).mockReset()
	})

	it("reuses analysis results for the same attachment snapshot and file IDs", async () => {
		vi.mocked(resolveSingleDocumentStaticDependencies).mockResolvedValue({
			fileType: "markdown",
			dependencyFileIds: ["fake-asset-id"],
			dependencyTransferFileIds: [],
			missingResourcePaths: [],
		})
		const attachments = [
			{ file_id: "fake-doc-a", file_name: "note-a.md" },
			{ file_id: "fake-doc-b", file_name: "note-b.md" },
		]

		await resolveShareDocumentDependencies({
			selectedFileIds: ["fake-doc-a", "fake-doc-b"],
			attachments,
		})
		await resolveShareDocumentDependencies({
			selectedFileIds: ["fake-doc-a"],
			attachments,
		})

		expect(resolveSingleDocumentStaticDependencies).toHaveBeenCalledTimes(2)
	})

	it("removes failed analyses from the cache so they can be retried", async () => {
		vi.mocked(resolveSingleDocumentStaticDependencies)
			.mockRejectedValueOnce(new Error("temporary failure"))
			.mockResolvedValueOnce({
				fileType: "markdown",
				dependencyFileIds: [],
				dependencyTransferFileIds: [],
				missingResourcePaths: [],
			})
		const attachments = [{ file_id: "fake-doc", file_name: "note.md" }]

		await resolveShareDocumentDependencies({
			selectedFileIds: ["fake-doc"],
			attachments,
		})
		await resolveShareDocumentDependencies({
			selectedFileIds: ["fake-doc"],
			attachments,
		})

		expect(resolveSingleDocumentStaticDependencies).toHaveBeenCalledTimes(2)
	})
})
