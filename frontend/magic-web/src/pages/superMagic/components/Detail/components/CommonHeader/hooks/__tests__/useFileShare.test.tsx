import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFileShare } from "../useFileShare"
import type { PropsWithChildren } from "react"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"

const mockFindSimilarShares = vi.hoisted(() => vi.fn())

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		findSimilarShares: mockFindSimilarShares,
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("useFileShare", () => {
	it("blocks sharing and closes an existing entry after the scope changes", async () => {
		let share = true
		const wrapper = ({ children }: PropsWithChildren) => (
			<FileAccessProvider permissions={{ share }}>{children}</FileAccessProvider>
		)
		const { result, rerender } = renderHook(
			() =>
				useFileShare({
					currentFile: { id: "file-1", name: "one.md", type: "file" },
					attachments: [],
				}),
			{ wrapper },
		)
		act(() => result.current.setShareModalVisible(true))
		expect(result.current.shareModalVisible).toBe(true)
		share = false
		rerender()
		await act(() => result.current.handleShare())
		expect(mockFindSimilarShares).not.toHaveBeenCalled()
		expect(result.current.shareModalVisible).toBe(false)
	})
	beforeEach(() => {
		mockFindSimilarShares.mockReset()
		mockFindSimilarShares.mockResolvedValue([])
	})

	it("shares an explicitly selected folder instead of the initial file", async () => {
		const folder = {
			file_id: "post-folder-id",
			file_name: "post-1",
			is_directory: true,
		}
		const { result } = renderHook(() =>
			useFileShare({
				currentFile: { id: "initial-file-id", name: "initial.html", type: "file" },
				attachments: [folder],
			}),
		)

		await act(async () => {
			await result.current.handleShare({
				id: "post-folder-id",
				name: "post-1",
				type: "folder",
				projectId: "project-1",
			})
		})

		expect(mockFindSimilarShares).toHaveBeenCalledWith({ file_ids: ["post-folder-id"] })
		expect(result.current.shareFileId).toBe("post-folder-id")
		expect(result.current.shareTarget).toEqual({
			id: "post-folder-id",
			name: "post-1",
			type: "folder",
			projectId: "project-1",
		})
		expect(result.current.shareModalVisible).toBe(true)
	})
})
