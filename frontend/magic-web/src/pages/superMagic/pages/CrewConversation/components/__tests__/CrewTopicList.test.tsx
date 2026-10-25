import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import CrewTopicList from "../CrewTopicList"

const query = vi.hoisted(() => vi.fn())
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/pages/superMagic/hooks/usePaginatedTopics", () => ({
	default: (params: unknown) => {
		query(params)
		return { displayTopics: [], isLoading: false, error: null, hasMore: false }
	},
}))
vi.mock("@/pages/superMagicMobile/components/TopicTypeFilter", () => ({
	default: ({ onChange }: { onChange: (value: string) => void }) => (
		<button onClick={() => onChange("scheduled_task")}>Scheduled</button>
	),
}))
it("filters within the crew project without switching the conversation", () => {
	const onSelectTopic = vi.fn()
	render(
		<CrewTopicList
			projectId="crew-project"
			topics={[{ id: "topic-1", topic_name: "Ordinary" }] as never}
			selectedTopicId="topic-1"
			onCreateTopic={vi.fn()}
			onSelectTopic={onSelectTopic}
		/>,
	)
	expect(screen.getByText("Ordinary")).toBeInTheDocument()
	fireEvent.click(screen.getByRole("button", { name: "Scheduled" }))
	expect(query).toHaveBeenLastCalledWith(
		expect.objectContaining({
			projectId: "crew-project",
			enabled: true,
			topicType: "scheduled_task",
		}),
	)
	expect(screen.queryByText("Ordinary")).not.toBeInTheDocument()
	expect(onSelectTopic).not.toHaveBeenCalled()
})
