import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ScheduledTask } from "@/types/scheduledTask"

import MobileScheduledTaskCard from "../MobileScheduledTaskCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

/** Creates deterministic synthetic task data for card interaction tests. */
function createMockTask(): ScheduledTask.Task {
	return {
		id: "mock-task-id",
		enabled: 1,
		task_name: "Mock scheduled task",
		time_config: { type: ScheduledTask.ScheduleType.Daily, time: "09:30" },
		topic_name: "Mock topic",
	} as ScheduledTask.Task
}

describe("MobileScheduledTaskCard", () => {
	it("renders the task summary and opens editing from the card body", () => {
		const onClick = vi.fn()

		render(
			<MobileScheduledTaskCard
				data={createMockTask()}
				onClick={onClick}
				onSwitchChange={vi.fn()}
			/>,
		)

		expect(screen.getByText("Mock scheduled task")).toBeInTheDocument()
		expect(screen.queryByText("Mock topic")).not.toBeInTheDocument()
		expect(screen.getByText("scheduleTask.dailyAt")).toBeInTheDocument()
		expect(screen.getByRole("switch")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mobile-scheduled-task-card"))

		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it("isolates status and menu controls from the card edit action", () => {
		const onClick = vi.fn()
		const onSwitchChange = vi.fn()
		const onDropdownActionClick = vi.fn()

		render(
			<MobileScheduledTaskCard
				data={createMockTask()}
				onClick={onClick}
				onSwitchChange={onSwitchChange}
				onDropdownActionClick={onDropdownActionClick}
			/>,
		)

		fireEvent.click(screen.getByRole("switch"))
		fireEvent.click(screen.getByRole("button", { name: "scheduleTask.moreActions" }))

		expect(onSwitchChange).toHaveBeenCalledWith(false)
		expect(onDropdownActionClick).toHaveBeenCalledTimes(1)
		expect(onClick).not.toHaveBeenCalled()
	})
})
