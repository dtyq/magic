import { describe, expect, it, vi, beforeEach } from "vitest"
import { findWorkspaceAvatarFile, ensureWorkspaceAvatarUploaded } from "../publish-avatar"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { FileApi } from "@/apis"
import { crewService } from "@/services/crew/CrewService"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

vi.mock("@/apis", () => ({
	FileApi: {
		reportFileUploads: vi.fn(),
		getFileUrl: vi.fn(),
	},
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		updateAgentInfo: vi.fn(),
	},
}))

describe("publish-avatar utils", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("findWorkspaceAvatarFile", () => {
		it("finds file matching explicit iconPath", () => {
			const files = [
				{ file_id: "1", relative_file_path: ".magic/IDENTITY.md" },
				{ file_id: "2", relative_file_path: ".magic/avatars/logo.png" },
			]
			const found = findWorkspaceAvatarFile(files, "avatars/logo.png")
			expect(found?.file_id).toBe("2")
		})

		it("finds avatar image under .magic/avatars when iconPath is omitted or relative", () => {
			const files = [
				{ file_id: "1", relative_file_path: ".magic/IDENTITY.md" },
				{
					file_id: "3",
					relative_file_path: ".magic/avatars/custom-avatar.jpg",
					file_extension: "jpg",
				},
			]
			const found = findWorkspaceAvatarFile(files)
			expect(found?.file_id).toBe("3")
		})

		it("returns null when no avatar image exists in workspace", () => {
			const files = [
				{ file_id: "1", relative_file_path: ".magic/IDENTITY.md" },
				{ file_id: "2", relative_file_path: "src/index.ts" },
			]
			expect(findWorkspaceAvatarFile(files)).toBeNull()
		})
	})

	describe("ensureWorkspaceAvatarUploaded", () => {
		it("skips upload when icon is already a remote URL", async () => {
			const mockUpload = vi.fn()
			const res = await ensureWorkspaceAvatarUploaded({
				crewCode: "CREW_001",
				currentIcon: { type: "Image", value: "https://cdn.example.com/logo.png" },
				workspaceFiles: [{ file_id: "1", relative_file_path: ".magic/avatars/logo.png" }],
				upload: mockUpload,
			})

			expect(res).toBeNull()
			expect(mockUpload).not.toHaveBeenCalled()
		})

		it("uploads local avatar image to public bucket and updates agent info", async () => {
			const fakeBlob = new Blob(["fake-image-bytes"], { type: "image/png" })
			vi.mocked(getFileContentById).mockResolvedValue(fakeBlob)

			const mockUpload = vi.fn().mockResolvedValue({
				fullfilled: [{ value: { key: "public/avatar_12345.png" } }],
			})

			vi.mocked(FileApi.reportFileUploads).mockResolvedValue([
				{ file_key: "DT001/public/avatar_12345.png" } as never,
			])
			vi.mocked(FileApi.getFileUrl).mockResolvedValue({
				url: "https://cdn.example.com/DT001/public/avatar_12345.png",
			} as never)
			vi.mocked(crewService.updateAgentInfo).mockResolvedValue({} as never)

			const onAvatarUploaded = vi.fn()

			const res = await ensureWorkspaceAvatarUploaded({
				crewCode: "CREW_001",
				currentIcon: { value: ".magic/avatars/logo.png" },
				workspaceFiles: [
					{
						file_id: "file_avatar_1",
						file_name: "logo.png",
						relative_file_path: ".magic/avatars/logo.png",
					},
				],
				upload: mockUpload,
				onAvatarUploaded,
			})

			expect(res).toBe("DT001/public/avatar_12345.png")
			expect(mockUpload).toHaveBeenCalledTimes(1)
			expect(FileApi.reportFileUploads).toHaveBeenCalledWith([
				expect.objectContaining({
					file_key: "public/avatar_12345.png",
					file_name: "logo.png",
				}),
			])
			expect(crewService.updateAgentInfo).toHaveBeenCalledWith("CREW_001", {
				icon: {
					type: "Image",
					value: "https://cdn.example.com/DT001/public/avatar_12345.png",
				},
				icon_type: 2,
				file_key: "DT001/public/avatar_12345.png",
			})
			expect(onAvatarUploaded).toHaveBeenCalledWith(
				"https://cdn.example.com/DT001/public/avatar_12345.png",
			)
		})
	})
})
