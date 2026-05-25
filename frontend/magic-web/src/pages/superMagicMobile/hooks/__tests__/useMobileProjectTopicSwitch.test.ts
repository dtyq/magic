import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { RouteName } from "@/routes/constants"
import { useMobileProjectTopicSwitch } from "../useMobileProjectTopicSwitch"

const { mockNavigate, mockSetSelectedTopic } = vi.hoisted(() => ({
	mockNavigate: vi.fn(),
	mockSetSelectedTopic: vi.fn(),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: (...args: unknown[]) => unknown) => fn,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => mockNavigate,
}))

const { projectStoreMock } = vi.hoisted(() => ({
	projectStoreMock: {
		selectedProject: { id: "project-1" } as { id: string } | null,
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: projectStoreMock,
	topicStore: {
		setSelectedTopic: mockSetSelectedTopic,
	},
}))

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: overrides.id ?? "topic-new",
		topic_name: overrides.topic_name ?? "Copied Topic",
		...overrides,
	} as Topic
}

describe("useMobileProjectTopicSwitch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		projectStoreMock.selectedProject = { id: "project-1" }
	})

	it("navigates to project topic route and updates selected topic when ids are present", () => {
		const { result } = renderHook(() => useMobileProjectTopicSwitch())
		const topic = createTopic({ id: "topic-copy" })

		result.current.switchToProjectTopic(topic)

		expect(mockNavigate).toHaveBeenCalledWith({
			name: RouteName.SuperWorkspaceProjectTopicState,
			params: {
				projectId: "project-1",
				topicId: "topic-copy",
			},
		})
		expect(mockSetSelectedTopic).toHaveBeenCalledWith(topic)
	})

	it("uses explicit projectId when provided", () => {
		const { result } = renderHook(() =>
			useMobileProjectTopicSwitch({ projectId: "project-explicit" }),
		)
		const topic = createTopic({ id: "topic-2" })

		result.current.switchToProjectTopic(topic)

		expect(mockNavigate).toHaveBeenCalledWith({
			name: RouteName.SuperWorkspaceProjectTopicState,
			params: {
				projectId: "project-explicit",
				topicId: "topic-2",
			},
		})
	})

	it("only updates store when topic id is missing", () => {
		const { result } = renderHook(() => useMobileProjectTopicSwitch())

		result.current.switchToProjectTopic(createTopic({ id: "" }))

		expect(mockNavigate).not.toHaveBeenCalled()
		expect(mockSetSelectedTopic).toHaveBeenCalled()
	})

	it("only updates store when project id cannot be resolved", () => {
		projectStoreMock.selectedProject = null
		const { result } = renderHook(() => useMobileProjectTopicSwitch())
		const topic = createTopic({ id: "topic-orphan" })

		result.current.switchToProjectTopic(topic)

		expect(mockNavigate).not.toHaveBeenCalled()
		expect(mockSetSelectedTopic).toHaveBeenCalledWith(topic)
	})
})
