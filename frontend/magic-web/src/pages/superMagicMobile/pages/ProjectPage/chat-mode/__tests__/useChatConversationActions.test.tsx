import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

const isPrivateDeploymentMock = vi.hoisted(() => vi.fn(() => false))
const updateCurrentActionItemMock = vi.hoisted(() => vi.fn())
const openShareModalMock = vi.hoisted(() => vi.fn())

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/utils/env", () => ({
	isPrivateDeployment: isPrivateDeploymentMock,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: () => ({
		projectActions: [
			{ key: "pinProject", label: "chat.pinChat", onClick: vi.fn() },
			{ key: "rename", label: "chat.renameChat", onClick: vi.fn() },
			{ key: "saveAsProject", label: "chat.saveAsProject", onClick: vi.fn() },
			{ key: "delete", label: "chat.deleteChat", onClick: vi.fn() },
		],
		projectActionComponents: null,
		updateCurrentActionItem: updateCurrentActionItemMock,
	}),
}))

vi.mock("@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks", () => ({
	useTopicListActions: () => ({
		openShareModal: openShareModalMock,
		topicActionComponents: null,
	}),
}))

import { useChatConversationActions } from "../useChatConversationActions"

describe("useChatConversationActions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		isPrivateDeploymentMock.mockReturnValue(false)
	})

	it("keeps feedback action in public deployments", () => {
		const { result } = renderHook(() =>
			useChatConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic(),
				onOpenConversationFeedback: vi.fn(),
			}),
		)

		expect(
			findAction(result.current.conversationActionGroups, "feedback-conversation"),
		).toBeDefined()
		expect(
			result.current.conversationActionGroups.flatMap((group) =>
				group.actions.map((action) => action.key),
			),
		).toEqual([
			"view-files",
			"pin-chat",
			"share-topic",
			"back-to-chat-list",
			"rename-chat",
			"save-as-project",
			"feedback-conversation",
			"delete-chat",
		])
	})

	it("omits feedback action in private deployments", () => {
		isPrivateDeploymentMock.mockReturnValue(true)
		const { result } = renderHook(() =>
			useChatConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic(),
				onOpenConversationFeedback: vi.fn(),
			}),
		)

		expect(
			findAction(result.current.conversationActionGroups, "feedback-conversation"),
		).toBeUndefined()
		expect(
			result.current.conversationActionGroups.flatMap((group) =>
				group.actions.map((action) => action.key),
			),
		).toEqual([
			"view-files",
			"pin-chat",
			"share-topic",
			"back-to-chat-list",
			"rename-chat",
			"save-as-project",
			"delete-chat",
		])
	})
})

/** Creates synthetic project data so assertions do not depend on production records. */
function createProject(): ProjectListItem {
	return {
		id: "mock-project-alpha",
		project_name: "Mock project alpha",
	} as ProjectListItem
}

/** Creates the minimum synthetic topic shape required by the conversation actions hook. */
function createTopic(): Topic {
	return {
		id: "mock-topic-alpha",
		topic_name: "Mock topic alpha",
	} as Topic
}

/** Finds an action by its stable key so tests remain independent of group indexes. */
function findAction(
	groups: ReturnType<typeof useChatConversationActions>["conversationActionGroups"],
	key: string,
) {
	return groups.flatMap((group) => group.actions).find((action) => action.key === key)
}
