import { describe, expect, it } from "vitest"
import { ResourceType, ShareType } from "@/pages/superMagic/components/Share/types"
import type { FileShareItem } from "@/pages/superMagic/components/ShareManagement/types"
import { isPartialFileShare, isWholeProjectShare } from "../shareScope"

describe("shareScope", () => {
	it("share_project 为 true 时识别为整项目分享", () => {
		const share: FileShareItem = {
			title: "项目分享",
			project_id: "p1",
			project_name: "Demo",
			workspace_id: "",
			workspace_name: "",
			resource_type: ResourceType.FileCollection,
			share_type: ShareType.PasswordProtected,
			resource_id: "share-1",
			has_password: true,
			created_at: "2026-05-05",
			share_project: true,
			file_ids: ["file-1", "file-2"],
			extend: { file_count: 259 },
		}

		expect(isWholeProjectShare(share)).toBe(true)
		expect(isPartialFileShare(share)).toBe(false)
	})

	it("resource_type 为 Project 时识别为整项目分享", () => {
		const share = {
			title: "项目分享",
			project_id: "p1",
			project_name: "Demo",
			workspace_id: "",
			workspace_name: "",
			resource_type: ResourceType.Project,
			share_type: ShareType.PasswordProtected,
			resource_id: "share-2",
			has_password: true,
			created_at: "2026-05-05",
			extend: { file_count: 10 },
		}

		expect(isWholeProjectShare(share)).toBe(true)
		expect(isPartialFileShare(share)).toBe(false)
	})

	it("指定文件分享且 share_project 为 false 时识别为部分文件分享", () => {
		const share: FileShareItem = {
			title: "文件分享",
			project_id: "p1",
			project_name: "Demo",
			workspace_id: "",
			workspace_name: "",
			resource_type: ResourceType.FileCollection,
			share_type: ShareType.PasswordProtected,
			resource_id: "share-3",
			has_password: true,
			created_at: "2026-05-05",
			share_project: false,
			file_ids: ["file-1"],
			extend: { file_count: 1 },
		}

		expect(isWholeProjectShare(share)).toBe(false)
		expect(isPartialFileShare(share)).toBe(true)
	})
})
