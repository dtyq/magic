import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useProjectTopicConversationActions } from "../useProjectTopicConversationActions"

const updateCurrentActionItemMock = vi.fn()
const renameTopicMock = vi.fn()
const shareTopicMock = vi.fn()
const deleteTopicMock = vi.fn()
const toggleTopicPinMock = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks", () => ({
	useTopicListActions: () => ({
		topicActions: [
			{
				key: "rename",
				label: "rename-topic-label",
				onClick: renameTopicMock,
			},
			{
				key: "share",
				label: "share-topic-label",
				onClick: shareTopicMock,
			},
			{
				key: "delete",
				label: "delete-topic-label",
				onClick: deleteTopicMock,
				variant: "danger",
			},
		],
		toggleTopicPin: toggleTopicPinMock,
		updateCurrentActionItem: updateCurrentActionItemMock,
		topicActionComponents: <div data-testid="topic-action-components" />,
	}),
}))

describe("useProjectTopicConversationActions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("orders project-topic action groups and disables feedback when handler is missing", () => {
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic("topic-1"),
				topics: [createTopic("topic-1"), createTopic("topic-2")],
			}),
		)

		expect(
			result.current.conversationActionGroups.map((group) =>
				group.actions.map((action) => action.key),
			),
		).toEqual([
			["view-files"],
			["pin-topic", "share-topic"],
			["rename-topic", "enter-project"],
			["feedback-conversation"],
			["delete-topic"],
		])
		expect(findAction(result.current.conversationActionGroups, "pin-topic")?.disabled).toBe(
			false,
		)
		expect(
			findAction(result.current.conversationActionGroups, "feedback-conversation")?.disabled,
		).toBe(true)
	})

	it("switches pin action label by selected topic state and runs toggle handler", async () => {
		const selectedTopic = createTopic("topic-pinned", { is_pinned: true })
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic,
				topics: [selectedTopic, createTopic("topic-other")],
			}),
		)

		expect(findAction(result.current.conversationActionGroups, "pin-topic")?.label).toBe(
			"messageHeader.unpin",
		)

		await act(async () => {
			await findAction(result.current.conversationActionGroups, "pin-topic")?.onClick?.()
		})

		expect(toggleTopicPinMock).toHaveBeenCalledWith(
			expect.objectContaining({ id: "topic-pinned" }),
		)
	})

	it("hides delete-topic when the project only has one topic", () => {
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic("topic-1"),
				topics: [createTopic("topic-1")],
			}),
		)

		expect(findAction(result.current.conversationActionGroups, "delete-topic")).toBeUndefined()
	})

	it("opens files drawer and closes action sheet from view-files", () => {
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic("topic-1"),
				topics: [createTopic("topic-1")],
			}),
		)

		act(() => result.current.openConversationActionSheet())
		expect(result.current.actionSheetVisible).toBe(true)

		act(() => findAction(result.current.conversationActionGroups, "view-files")?.onClick?.())

		expect(result.current.actionSheetVisible).toBe(false)
		expect(result.current.filesDrawerOpen).toBe(true)
	})

	it("runs topic share and rename against the selected topic context", () => {
		const selectedProject = createProject()
		const selectedTopic = createTopic("topic-target")
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject,
				selectedTopic,
				topics: [selectedTopic, createTopic("topic-other")],
			}),
		)

		act(() => findAction(result.current.conversationActionGroups, "share-topic")?.onClick?.())
		act(() => findAction(result.current.conversationActionGroups, "rename-topic")?.onClick?.())

		expect(updateCurrentActionItemMock).toHaveBeenCalledWith(
			expect.objectContaining({
				topic: expect.objectContaining({ id: "topic-target" }),
				project: expect.objectContaining({ id: selectedProject.id }),
			}),
		)
		expect(shareTopicMock).toHaveBeenCalledTimes(1)
		expect(renameTopicMock).toHaveBeenCalledTimes(1)
	})

	it("enables feedback action when onOpenConversationFeedback is provided", () => {
		const onOpenConversationFeedback = vi.fn()
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic("topic-1"),
				topics: [createTopic("topic-1"), createTopic("topic-2")],
				onOpenConversationFeedback,
			}),
		)

		expect(
			findAction(result.current.conversationActionGroups, "feedback-conversation")?.disabled,
		).toBe(false)
	})

	it("opens conversation feedback and closes action sheet from feedback action", () => {
		const onOpenConversationFeedback = vi.fn()
		const { result } = renderHook(() =>
			useProjectTopicConversationActions({
				selectedProject: createProject(),
				selectedTopic: createTopic("topic-1"),
				topics: [createTopic("topic-1"), createTopic("topic-2")],
				onOpenConversationFeedback,
			}),
		)

		act(() => result.current.openConversationActionSheet())
		expect(result.current.actionSheetVisible).toBe(true)

		act(() =>
			findAction(
				result.current.conversationActionGroups,
				"feedback-conversation",
			)?.onClick?.(),
		)

		expect(result.current.actionSheetVisible).toBe(false)
		expect(onOpenConversationFeedback).toHaveBeenCalledTimes(1)
	})
})

/**
 * 在测试里只保留 hook 编排所需字段，确保断言聚焦于话题级上下文传递。
 */
function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: "project-1",
		project_name: "Project",
		workspace_id: "workspace-1",
		workspace_name: "Workspace",
		...overrides,
	} as ProjectListItem
}

/**
 * 生成最小话题实体，用稳定 id 验证 rename/share/delete 都作用在当前话题。
 */
function createTopic(id: string, overrides: Partial<Topic> = {}): Topic {
	return {
		id,
		topic_name: `Topic ${id}`,
		...overrides,
	} as Topic
}

/**
 * 从分组中按 key 查找动作，让测试表达业务顺序而非数组下标。
 */
function findAction(
	groups: ReturnType<typeof useProjectTopicConversationActions>["conversationActionGroups"],
	key: string,
) {
	return groups.flatMap((group) => group.actions).find((action) => action.key === key)
}
