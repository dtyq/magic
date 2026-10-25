import { beforeEach, describe, expect, it, vi } from "vitest"

const { createFile, saveFileContent } = vi.hoisted(() => ({
	createFile: vi.fn(),
	saveFileContent: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { createFile, saveFileContent },
}))

import { createDesignProjectFiles, DesignProjectCreationError } from "../designProjectCreation"

function saveResponse(successFileIds: string[]) {
	return {
		batch_id: "batch-1",
		total: 1,
		success: successFileIds.length,
		error: successFileIds.length ? 0 : 1,
		success_files: successFileIds.map((fileId, index) => ({
			index,
			file_id: fileId,
			status: "success",
			data: { file_id: fileId, size: 1, updated_at: "now" },
			duration_ms: 1,
		})),
		error_files: [],
		completed_at: "now",
	}
}

describe("createDesignProjectFiles", () => {
	beforeEach(() => {
		createFile.mockReset()
		saveFileContent.mockReset()
		createFile
			.mockResolvedValueOnce({ file_id: "folder-1" })
			.mockResolvedValueOnce({ file_id: "config-1" })
	})

	it("confirms only when the target config file appears in success_files", async () => {
		saveFileContent.mockResolvedValue(saveResponse(["config-1"]))

		const result = await createDesignProjectFiles({
			projectId: "project-1",
			parentId: "parent-1",
			folderName: "Canvas",
		})

		expect(result.outcome).toBe("confirmed")
		expect(result.folder.file_id).toBe("folder-1")
		expect(result.magicProjectFile.file_id).toBe("config-1")
		expect(result.parentId).toBe("parent-1")
	})

	it.each([[[]], [["another-file"]]])(
		"rejects a resolved save response without the target file: %j",
		async (successIds) => {
			saveFileContent.mockResolvedValue(saveResponse(successIds))

			await expect(
				createDesignProjectFiles({ projectId: "project-1", folderName: "Canvas" }),
			).rejects.toMatchObject({ outcome: "failed" })
		},
	)

	it("marks a rejected save request as ambiguous and preserves created ids", async () => {
		saveFileContent.mockRejectedValue(new Error("timeout"))

		await expect(
			createDesignProjectFiles({ projectId: "project-1", folderName: "Canvas" }),
		).rejects.toMatchObject({
			outcome: "ambiguous",
			context: {
				folder: { file_id: "folder-1" },
				magicProjectFile: { file_id: "config-1" },
			},
		})
	})

	it("marks a rejected folder create as ambiguous without inventing ids", async () => {
		createFile.mockReset()
		createFile.mockRejectedValue(new Error("timeout"))

		await expect(
			createDesignProjectFiles({ projectId: "project-1", folderName: "Canvas" }),
		).rejects.toMatchObject({
			outcome: "ambiguous",
			context: { projectId: "project-1" },
		})
	})

	it("marks a rejected config create as ambiguous and preserves the folder id", async () => {
		createFile.mockReset()
		createFile
			.mockResolvedValueOnce({ file_id: "folder-1" })
			.mockRejectedValueOnce(new Error("timeout"))

		await expect(
			createDesignProjectFiles({ projectId: "project-1", folderName: "Canvas" }),
		).rejects.toMatchObject({
			outcome: "ambiguous",
			context: { folder: { file_id: "folder-1" } },
		})
	})

	it("normalizes id-only create responses", async () => {
		createFile.mockReset()
		createFile.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce({ id: 202 })
		saveFileContent.mockResolvedValue(saveResponse(["202"]))

		const result = await createDesignProjectFiles({
			projectId: "project-1",
			folderName: "Canvas",
		})

		expect(result.folder.file_id).toBe("101")
		expect(result.magicProjectFile.file_id).toBe("202")
	})

	it("uses a typed creation error for an invalid create response", async () => {
		createFile.mockReset()
		createFile.mockResolvedValueOnce({})

		await expect(
			createDesignProjectFiles({ projectId: "project-1", folderName: "Canvas" }),
		).rejects.toBeInstanceOf(DesignProjectCreationError)
	})
})
