import { describe, expect, it } from "vitest"
import {
	buildSharedProjectActionPolicy,
	resolveProjectDetailHeaderActions,
} from "../sharedProjectActionPolicy"
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

describe("resolveProjectDetailHeaderActions", () => {
	it("他人共享且只读时隐藏头部胶囊与菜单", () => {
		const policy = resolveProjectDetailHeaderActions(
			createProject({
				tag: "collaboration",
				user_role: "viewer",
			}),
			{ canManageCollaborators: true },
		)

		expect(policy.showShareButton).toBe(false)
		expect(policy.showMoreButton).toBe(false)
		expect(policy.showCollaboratorsButton).toBe(false)
		expect(policy.showActionCapsule).toBe(false)
		expect(policy.hasMenuActions).toBe(false)
		expect(policy.visibleActionKeys).toEqual([])
		expect(policy.actionSlots).toEqual({ share: false, more: false, collaborators: false })
	})

	it("他人共享且 manage + 协作者能力时外置 UserPlus", () => {
		const policy = resolveProjectDetailHeaderActions(
			createProject({
				tag: "collaboration",
				user_role: "manage",
			}),
			{ canManageCollaborators: true },
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(false)
		expect(policy.showCollaboratorsButton).toBe(true)
		expect(policy.showActionCapsule).toBe(true)
		expect(policy.hasMenuActions).toBe(false)
		expect(policy.actionSlots).toEqual({ share: true, more: false, collaborators: true })
	})

	it("他人共享且 manage 但无协作者能力时仅 Share", () => {
		const policy = resolveProjectDetailHeaderActions(
			createProject({
				tag: "collaboration",
				user_role: "manage",
			}),
			{ canManageCollaborators: false },
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(false)
		expect(policy.showCollaboratorsButton).toBe(false)
		expect(policy.showActionCapsule).toBe(true)
		expect(policy.hasMenuActions).toBe(false)
	})

	it("他人共享且 editor 时仅 Share、不展示 More", () => {
		const policy = resolveProjectDetailHeaderActions(
			createProject({
				tag: "collaboration",
				user_role: "editor",
			}),
			{ canManageCollaborators: false },
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(false)
		expect(policy.showCollaboratorsButton).toBe(false)
		expect(policy.showActionCapsule).toBe(true)
		expect(policy.hasMenuActions).toBe(false)
		expect(policy.visibleActionKeys).toEqual([])
	})

	it("自己共享出去的项目保持正常项目详情策略", () => {
		const policy = resolveProjectDetailHeaderActions(
			createProject({
				tag: "collaboration",
				user_role: "owner",
			}),
			{ canManageCollaborators: true },
		)

		expect(policy.showShareButton).toBe(true)
		expect(policy.showMoreButton).toBe(true)
		expect(policy.showCollaboratorsButton).toBe(false)
		expect(policy.showActionCapsule).toBe(true)
		expect(policy.hasMenuActions).toBe(true)
		expect(policy.visibleActionKeys).toBeUndefined()
	})
})

describe("buildSharedProjectActionPolicy", () => {
	it("在缺少协作者能力上下文时与 resolve 的角色策略一致", () => {
		const project = createProject({
			tag: "collaboration",
			user_role: "manage",
		})

		const legacy = buildSharedProjectActionPolicy(project)
		const resolved = resolveProjectDetailHeaderActions(project, {
			canManageCollaborators: false,
		})

		expect(legacy.showShareButton).toBe(resolved.showShareButton)
		expect(legacy.showMoreButton).toBe(resolved.showMoreButton)
		expect(legacy.showCollaboratorsButton).toBe(resolved.showCollaboratorsButton)
	})
})
