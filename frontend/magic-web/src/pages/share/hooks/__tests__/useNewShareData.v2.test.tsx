import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import useNewFileShareData from "../useNewFileShareData"
import useNewTopicShareData from "../useNewTopicShareData"

const mocks = vi.hoisted(() => ({
	getShareResource: vi.fn(),
	loadProjectAttachments: vi.fn(),
	loadShareFilesV2: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getShareResource: mocks.getShareResource,
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	loadProjectAttachments: mocks.loadProjectAttachments,
}))

vi.mock("@/pages/share/services/shareFilesLoader", () => ({
	loadShareFilesV2: mocks.loadShareFilesV2,
}))

describe.each([
	["file share", useNewFileShareData],
	["topic share", useNewTopicShareData],
])("%s V2 attachments", (_label, useShareData) => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.loadShareFilesV2.mockResolvedValue({
			tree: [{ file_id: "folder-1" }],
			list: [{ file_id: "folder-1" }],
		})
	})

	it("loads every resource share through the cursor loader", async () => {
		const { result } = renderHook(() => useShareData())

		act(() => {
			result.current.updateAttachments({
				resource_id: "share-1",
				password: "secret",
			})
		})

		await waitFor(() => {
			expect(result.current.attachments.list).toEqual([{ file_id: "folder-1" }])
		})
		expect(mocks.loadShareFilesV2).toHaveBeenCalledWith({
			resourceId: "share-1",
			password: "secret",
			signal: expect.any(AbortSignal),
			onBatchSnapshot: expect.any(Function),
		})
		expect(mocks.loadProjectAttachments).not.toHaveBeenCalled()
	})
})
