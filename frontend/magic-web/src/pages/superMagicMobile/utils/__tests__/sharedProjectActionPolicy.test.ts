import { describe, expect, it } from "vitest"
import { buildSharedProjectActionPolicy } from "../sharedProjectActionPolicy"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: "project-1",
		project_status: "waiting",
		project_mode: "" as ProjectListItem["project_mode"],
		workspace_id: "workspace-1",
		work_dir: "",
		workspace_name: "Workspace",
		project_name: "Project",
		current_topic_id: "topic-1",
		current_topic_status: "waiting",
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		tag: "",
		...overrides,
	}
}

describe("buildSharedProjectActionPolicy", () => {
	it("他人共享且只读时隐藏详情页头部操作并清空菜单", () => {
		const policy = buildSharedProjectActionPolicy(
			createProject({
				tag: "collaboration",
				user_role: "viewer",
			}),
		)

		expect(policy.showShareButton).toBe(false)
		expect(policy.showMoreButton).toBe(false)
		expect(policy.visibleActionKeys).toEqual([])
	})

	it("他人共享且有权限时只保留分享和协作者能力", () => {
		const policy = buildSharedProjectActionPolicy(
			createProject({
				tag: "collaboration",
				user_role: "editor",
			}),
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(true)
		expect(policy.visibleActionKeys).toEqual(["setCollaborators"])
	})

	it("自己共享出去的项目保持正常项目详情策略", () => {
		const policy = buildSharedProjectActionPolicy(
			createProject({
				tag: "collaboration",
				user_role: "owner",
			}),
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(true)
		expect(policy.visibleActionKeys).toBeUndefined()
	})
})