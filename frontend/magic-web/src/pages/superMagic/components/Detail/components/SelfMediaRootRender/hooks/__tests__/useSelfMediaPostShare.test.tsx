import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSelfMediaPostShare } from "../useSelfMediaPostShare"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { SelfMediaPlatformPostItem } from "../../stores/SelfMediaStore"
import type { SelfMediaAttachmentNode } from "../../types"

const mockHandleShare = vi.hoisted(() => vi.fn())
const mockAccess = vi.hoisted(() => ({ share: true }))

vi.mock("../../../CommonHeader/hooks", () => ({
	useFileShare: () => ({
		shareModalVisible: false,
		showSuccessModal: false,
		existingShareInfo: null,
		shareFileId: undefined,
		showSimilarSharesDialog: false,
		similarShares: [],
		isCheckingShare: false,
		shareTarget: undefined,
		handleShare: mockHandleShare,
		handleSelectSimilarShare: vi.fn(),
		handleCreateNewShare: vi.fn(),
		handleCancelShare: vi.fn(),
		handleEditShare: vi.fn(),
		setShareModalVisible: vi.fn(),
		setShowSuccessModal: vi.fn(),
		setExistingShareInfo: vi.fn(),
		closeSimilarSharesDialog: vi.fn(),
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/pages/superMagic/providers/FileAccessProvider", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/pages/superMagic/providers/FileAccessProvider")>()
	return {
		...actual,
		useFileAccess: () => ({
			permissions: { ...actual.DEFAULT_FILE_ACCESS, ...mockAccess },
			options: actual.DEFAULT_FILE_ACTION_OPTIONS,
		}),
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

const attachments: SelfMediaAttachmentNode[] = [
	{
		file_id: "root",
		file_name: "self-media",
		relative_file_path: "",
		is_directory: true,
		children: [
			{
				file_id: "post-folder-id",
				file_name: "post-1",
				relative_file_path: "posts/post-1/",
				is_directory: true,
				children: [
					{
						file_id: "post-json-id",
						file_name: "post.json",
						relative_file_path: "posts/post-1/post.json",
					},
					{
						file_id: "card-file-id",
						file_name: "01.html",
						relative_file_path: "posts/post-1/cards/01.html",
					},
				],
			},
		],
	},
]

const target: SelfMediaPlatformPostItem = {
	platform: "rednote",
	index: 0,
	entry: {
		id: "post-1",
		name: "Post One",
		entry: "posts/post-1/post.json",
	},
	post: {
		meta: { id: "post-1", title: "Post One" },
		cards: [{ path: "cards/01.html", fileId: "card-file-id" }],
	},
}

describe("useSelfMediaPostShare", () => {
	beforeEach(() => {
		mockHandleShare.mockReset()
		mockHandleShare.mockResolvedValue(undefined)
		mockAccess.share = true
	})

	it("shares the current article directory through the common file share flow", async () => {
		const { result } = renderHook(() =>
			useSelfMediaPostShare({
				attachments,
				selectedProject: {
					id: "project-1",
					project_name: "Project One",
				} as ProjectListItem,
				enabled: true,
			}),
		)

		await act(async () => {
			await result.current.sharePost(target)
		})

		expect(mockHandleShare).toHaveBeenCalledWith({
			id: "post-folder-id",
			name: "post-1",
			type: "folder",
			projectId: "project-1",
			projectName: "Project One",
		})
	})

	it("does not expose sharing without edit permission or when file sharing is hidden", () => {
		const { result, rerender } = renderHook(
			({ enabled }) =>
				useSelfMediaPostShare({
					attachments,
					enabled,
				}),
			{ initialProps: { enabled: false } },
		)

		expect(result.current.canShare).toBe(false)

		mockAccess.share = false
		rerender({ enabled: true })
		expect(result.current.canShare).toBe(false)
	})
})
