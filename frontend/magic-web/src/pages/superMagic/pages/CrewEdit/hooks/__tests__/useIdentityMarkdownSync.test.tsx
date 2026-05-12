import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { useIdentityMarkdownSync } from "../useIdentityMarkdownSync"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

function createIdentityMock() {
	return {
		setIdentityMarkdownFileId: vi.fn(),
		setIdentityMarkdownRawContent: vi.fn(),
		clearIdentityMarkdownSnapshot: vi.fn(),
		clearIdentityMarkdownError: vi.fn(),
		applyIdentityMarkdown: vi.fn(),
		setIdentityMarkdownMissingError: vi.fn(),
		setIdentityMarkdownLoadError: vi.fn(),
	} as any
}

describe("useIdentityMarkdownSync", () => {
	it("does not mark markdown missing during initialization", () => {
		const identity = createIdentityMock()
		const { rerender } = renderHook(
			({ isInitialAttachmentsLoaded }) =>
				useIdentityMarkdownSync({
					projectId: "project-1",
					files: [],
					identity,
					isInitialAttachmentsLoaded,
				}),
			{
				initialProps: {
					isInitialAttachmentsLoaded: false,
				},
			},
		)

		expect(identity.setIdentityMarkdownMissingError).not.toHaveBeenCalled()
		expect(identity.clearIdentityMarkdownError).toHaveBeenCalledTimes(1)
		expect(identity.applyIdentityMarkdown).not.toHaveBeenCalled()
		expect(identity.clearIdentityMarkdownSnapshot).toHaveBeenCalledTimes(1)

		rerender({ isInitialAttachmentsLoaded: true })

		expect(identity.setIdentityMarkdownMissingError).not.toHaveBeenCalled()
		expect(identity.clearIdentityMarkdownError).toHaveBeenCalledTimes(2)
		expect(identity.applyIdentityMarkdown).not.toHaveBeenCalled()
		expect(identity.clearIdentityMarkdownSnapshot).toHaveBeenCalledTimes(2)
	})

	it("keeps database-backed identity when markdown loading fails", async () => {
		vi.mocked(getFileContentById).mockRejectedValueOnce(new Error("load failed"))
		const identity = createIdentityMock()

		renderHook(() =>
			useIdentityMarkdownSync({
				projectId: "project-1",
				files: [
					{
						file_id: "file-1",
						file_name: "IDENTITY.md",
						relative_file_path: ".magic/IDENTITY.md",
						source: 0,
					},
				] as any,
				identity,
				isInitialAttachmentsLoaded: true,
			}),
		)

		await Promise.resolve()
		await Promise.resolve()

		expect(identity.applyIdentityMarkdown).not.toHaveBeenCalled()
		expect(identity.clearIdentityMarkdownSnapshot).toHaveBeenCalledTimes(1)
		expect(identity.setIdentityMarkdownLoadError).toHaveBeenCalledTimes(1)
	})
})
