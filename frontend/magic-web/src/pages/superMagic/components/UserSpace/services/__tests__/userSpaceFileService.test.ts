import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSessionFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { userSpaceFileService } from "../userSpaceFileService"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

vi.mock("@/apis", () => ({
	MagicFSApi: {
		getFileInfo: vi.fn(),
	},
	SuperMagicApi: {
		saveFileContent: vi.fn(),
	},
}))

const getFileContentByIdMock = vi.mocked(getFileContentById)

describe("userSpaceFileService", () => {
	beforeEach(() => {
		getFileContentByIdMock.mockReset()
		getFileContentByIdMock.mockResolvedValue("# notes")
	})

	it("forwards session access when reading user file content", async () => {
		const access = createSessionFileAccess({ projectId: "runtime-1" })

		await userSpaceFileService.readFileContent("file-1", undefined, access)

		expect(getFileContentByIdMock).toHaveBeenCalledWith(
			"file-1",
			expect.objectContaining({
				access,
				responseType: "text",
				forceRefresh: true,
			}),
		)
	})
})
