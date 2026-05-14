import { describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import { generateProjectTopicUrl } from "@/pages/superMagic/utils/project"
import { getMobileTopicPageCapabilities, MobileTopicPageKind } from "../topicPageCapabilities"

describe("getMobileTopicPageCapabilities", () => {
	it("hides sibling-topic creation for single-topic chat", () => {
		expect(
			getMobileTopicPageCapabilities(MobileTopicPageKind.SingleTopicChat)
				.canCreateSiblingTopic,
		).toBe(false)
	})

	it("enables sibling-topic creation for project topic pages", () => {
		expect(
			getMobileTopicPageCapabilities(MobileTopicPageKind.ProjectTopic).canCreateSiblingTopic,
		).toBe(true)
	})

	it("routes project-topic back target to project detail", () => {
		expect(
			getMobileTopicPageCapabilities(MobileTopicPageKind.ProjectTopic).resolveBackTarget(
				"project-1",
			),
		).toEqual({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: "project-1" },
		})
	})

	it("routes single-topic chat back target to chat list", () => {
		expect(
			getMobileTopicPageCapabilities(MobileTopicPageKind.SingleTopicChat).resolveBackTarget(
				"project-1",
			),
		).toEqual({
			name: RouteName.SuperChatsList,
		})
	})

	it("marks single-topic chat as save-as-project capable", () => {
		expect(
			getMobileTopicPageCapabilities(MobileTopicPageKind.SingleTopicChat).canSaveAsProject,
		).toBe(true)
	})

	it("builds project-topic URLs with both projectId and topicId", () => {
		expect(generateProjectTopicUrl("project-1", "topic-1")).toContain(
			"/super/project-1/topic-1",
		)
	})
})
