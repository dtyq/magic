import { describe, expect, it, vi } from "vitest"
import { ProjectActionMenuKey } from "../types"

const appEnv = vi.hoisted(() => ({
	isMagicApp: false,
}))

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return appEnv.isMagicApp
	},
}))

vi.mock("@/utils/env", () => ({
	env: () => "",
	isCommercial: () => false,
}))

import { buildProjectActionMenuItems } from "../buildProjectActionMenuItems"

const mockProject = {
	id: "project-mock",
	project_name: "Mock Project",
	user_role: "owner",
	is_pinned: false,
	is_bind_workspace: false,
	bind_workspace_id: "0",
} as never

const translate = ((key: string) => key) as never

describe("buildProjectActionMenuItems", () => {
	it("keeps project new-window action visible in browser desktop mode", () => {
		appEnv.isMagicApp = false

		const items = buildProjectActionMenuItems({
			item: mockProject,
			t: translate,
			inCollaborationPanel: false,
			onOpenInNewWindow: vi.fn(),
		})

		expect(items.some((item) => item?.key === ProjectActionMenuKey.OpenInNewWindow)).toBe(true)
	})

	it("hides project new-window action in Magic App desktop mode", () => {
		appEnv.isMagicApp = true

		const items = buildProjectActionMenuItems({
			item: mockProject,
			t: translate,
			inCollaborationPanel: false,
			onOpenInNewWindow: vi.fn(),
		})

		expect(items.some((item) => item?.key === ProjectActionMenuKey.OpenInNewWindow)).toBe(false)
	})

	it("shows rename for a manager viewing a workspace-bound collaboration project", () => {
		const items = buildProjectActionMenuItems({
			item: {
				...mockProject,
				tag: "collaboration",
				user_role: "manage",
				is_bind_workspace: true,
				bind_workspace_id: "workspace-1",
			},
			t: translate,
			inCollaborationPanel: false,
			onRenameStart: vi.fn(),
			onRenameProject: vi.fn(),
		})

		expect(items.some((item) => item?.key === ProjectActionMenuKey.Rename)).toBe(true)
	})

	it("keeps rename hidden for an editor viewing a workspace-bound collaboration project", () => {
		const items = buildProjectActionMenuItems({
			item: {
				...mockProject,
				tag: "collaboration",
				user_role: "editor",
				is_bind_workspace: true,
				bind_workspace_id: "workspace-1",
			},
			t: translate,
			inCollaborationPanel: false,
			onRenameStart: vi.fn(),
			onRenameProject: vi.fn(),
		})

		expect(items.some((item) => item?.key === ProjectActionMenuKey.Rename)).toBe(false)
	})

	it("shows cancel-workspace-shortcut for a bound collaboration project", () => {
		const items = buildProjectActionMenuItems({
			item: {
				...mockProject,
				tag: "collaboration",
				user_role: "editor",
				is_bind_workspace: true,
				bind_workspace_id: "workspace-1",
			},
			t: translate,
			inCollaborationPanel: false,
			onCancelWorkspaceShortcut: vi.fn(),
		})

		expect(
			items.some((item) => item?.key === ProjectActionMenuKey.CancelWorkspaceShortcut),
		).toBe(true)
	})

	it("hides cancel-workspace-shortcut once the bound workspace is cleared", () => {
		const items = buildProjectActionMenuItems({
			item: {
				...mockProject,
				tag: "collaboration",
				user_role: "editor",
				is_bind_workspace: false,
				bind_workspace_id: "",
			},
			t: translate,
			inCollaborationPanel: false,
			onCancelWorkspaceShortcut: vi.fn(),
		})

		expect(
			items.some((item) => item?.key === ProjectActionMenuKey.CancelWorkspaceShortcut),
		).toBe(false)
	})
})
