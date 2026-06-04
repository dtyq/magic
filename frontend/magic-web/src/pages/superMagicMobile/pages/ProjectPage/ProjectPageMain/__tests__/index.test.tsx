import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import ProjectPageMain from ".."

const { mockNavigate, mockSetSelectedTopic, topicStoreMock } = vi.hoisted(() => ({
	mockNavigate: vi.fn(),
	mockSetSelectedTopic: vi.fn(),
	topicStoreMock: {
		setSelectedTopic: vi.fn(),
		topics: [] as Topic[],
		isFetchList: false,
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "mobile.emptyState.variants.topic.title") return "暂无话题"
			if (key === "mobile.emptyState.variants.topic.description") {
				return "在下方输入区创建新话题。"
			}
			return key
		},
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: (...args: unknown[]) => unknown) => fn,
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: {
		selectedProject: { id: "project-1" },
	},
	topicStore: topicStoreMock,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="scroll-edge-fade-container">{children}</div>
	),
}))

vi.mock("@/components/base-mobile/SwipeActionRow", () => ({
	SwipeActionRow: ({
		actions,
		children,
		"data-testid": dataTestId,
	}: {
		actions: Array<{ id: string; label: string; onClick?: () => void }>
		children: React.ReactNode
		"data-testid"?: string
	}) => (
		<div data-testid={dataTestId}>
			<div data-testid={`${dataTestId}-actions`}>
				{actions.map((action) => (
					<button
						key={action.id}
						type="button"
						onClick={action.onClick}
						data-testid={`${dataTestId}-action-${action.id}`}
					>
						{action.label}
					</button>
				))}
			</div>
			{children}
		</div>
	),
}))

vi.mock("@/pages/superMagicMobile/components/icons/MobilePinBadge", () => ({
	MobilePinBadge: () => <span data-testid="mobile-topic-item-pinned-badge" />,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => mockNavigate,
}))

vi.mock("@/utils/string", () => ({
	formatRelativeTime: () => (value: string) => `formatted:${value}`,
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		topic: {
			fetchTopics: vi.fn(),
		},
	},
}))

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: overrides.id ?? "topic-1",
		topic_name: overrides.topic_name ?? "Topic One",
		task_status: overrides.task_status ?? "waiting",
		updated_at: overrides.updated_at ?? "2026-05-12 10:00:00",
		is_pinned: overrides.is_pinned ?? false,
		...overrides,
	} as Topic
}

describe("ProjectPageMain", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		topicStoreMock.isFetchList = false
		topicStoreMock.topics = [createTopic()]
	})

	it("renders topics empty state when the topic list is empty", () => {
		topicStoreMock.topics = []

		render(
			<ProjectPageMain onTopicMore={vi.fn()} onTopicPin={vi.fn()} onTopicDelete={vi.fn()} />,
		)

		const emptyState = screen.getByTestId("project-topics-empty-state")
		expect(emptyState).toHaveTextContent("暂无话题")
		expect(emptyState).toHaveTextContent("在下方输入区创建新话题。")
	})

	it("renders pin swipe action and calls onTopicPin with the current topic", () => {
		const handlePin = vi.fn()
		render(
			<ProjectPageMain
				onTopicMore={vi.fn()}
				onTopicPin={handlePin}
				onTopicDelete={vi.fn()}
			/>,
		)

		const row = screen.getByTestId("topic-item-topic-1")
		expect(within(row).getByTestId("topic-item-topic-1-action-pin")).toHaveTextContent(
			"topicList.swipePin",
		)

		fireEvent.click(within(row).getByTestId("topic-item-topic-1-action-pin"))

		expect(handlePin).toHaveBeenCalledWith(expect.objectContaining({ id: "topic-1" }))
	})

	it("shows unpin label and pinned badge for pinned topics", () => {
		topicStoreMock.topics = [createTopic({ id: "topic-pinned", is_pinned: true })]

		render(
			<ProjectPageMain onTopicMore={vi.fn()} onTopicPin={vi.fn()} onTopicDelete={vi.fn()} />,
		)

		const row = screen.getByTestId("topic-item-topic-pinned")
		expect(within(row).getByTestId("topic-item-topic-pinned-action-pin")).toHaveTextContent(
			"topicList.swipeUnpin",
		)
		expect(within(row).getByTestId("mobile-topic-item-pinned-badge")).toBeInTheDocument()
	})

	it("renders pinned topics before unpinned topics as a mobile fallback", () => {
		topicStoreMock.topics = [
			createTopic({
				id: "topic-late",
				topic_name: "Late Topic",
				updated_at: "2026-05-12 10:00:00",
			}),
			createTopic({
				id: "topic-pinned",
				topic_name: "Pinned Topic",
				updated_at: "2026-05-12 08:00:00",
				is_pinned: true,
				pinned_at: "2026-05-12 11:00:00",
			}),
			createTopic({
				id: "topic-middle",
				topic_name: "Middle Topic",
				updated_at: "2026-05-12 09:00:00",
			}),
		]

		render(
			<ProjectPageMain onTopicMore={vi.fn()} onTopicPin={vi.fn()} onTopicDelete={vi.fn()} />,
		)

		const rowOrder = Array.from(document.querySelectorAll("[data-testid]"))
			.map((element) => element.getAttribute("data-testid"))
			.flatMap((testId) =>
				testId && /^topic-item-(topic-pinned|topic-late|topic-middle)$/.test(testId)
					? [testId]
					: [],
			)

		expect(rowOrder).toEqual([
			"topic-item-topic-pinned",
			"topic-item-topic-late",
			"topic-item-topic-middle",
		])
	})
})
