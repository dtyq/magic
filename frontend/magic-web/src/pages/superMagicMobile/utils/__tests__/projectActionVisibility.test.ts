import { describe, expect, it } from "vitest"
import {
	shouldShowHierarchicalCollaboratorAction,
	shouldShowProjectCollaboratorAction,
	shouldShowProjectTransferAction,
} from "../projectActionVisibility"

describe("projectActionVisibility", () => {
	it("在能力关闭时隐藏项目协作者入口", () => {
		expect(
			shouldShowProjectCollaboratorAction({
				mode: "default",
				isCollaborationProject: true,
				userRole: "owner",
				canManageCollaborators: false,
			}),
		).toBe(false)
	})

	it("在能力开启且权限满足时显示项目协作者入口", () => {
		expect(
			shouldShowProjectCollaboratorAction({
				mode: "default",
				isCollaborationProject: true,
				userRole: "manage",
				canManageCollaborators: true,
			}),
		).toBe(true)
	})

	it("在 chat mode 下隐藏项目协作者入口", () => {
		expect(
			shouldShowProjectCollaboratorAction({
				mode: "chat",
				isCollaborationProject: true,
				userRole: "owner",
				canManageCollaborators: true,
			}),
		).toBe(false)
	})

	it("在能力关闭时隐藏项目转让入口", () => {
		expect(
			shouldShowProjectTransferAction({
				mode: "default",
				userRole: "owner",
				isWorkspaceShortcutProject: false,
				canTransferProject: false,
			}),
		).toBe(false)
	})

	it("在能力开启且 owner 条件满足时显示项目转让入口", () => {
		expect(
			shouldShowProjectTransferAction({
				mode: "default",
				userRole: "owner",
				isWorkspaceShortcutProject: false,
				canTransferProject: true,
			}),
		).toBe(true)
	})

	it("在能力关闭时隐藏层级弹窗协作者入口", () => {
		expect(
			shouldShowHierarchicalCollaboratorAction({
				userRole: "manage",
				canManageCollaborators: false,
			}),
		).toBe(false)
	})

	it("在能力开启且权限满足时显示层级弹窗协作者入口", () => {
		expect(
			shouldShowHierarchicalCollaboratorAction({
				userRole: "manage",
				canManageCollaborators: true,
			}),
		).toBe(true)
	})
})