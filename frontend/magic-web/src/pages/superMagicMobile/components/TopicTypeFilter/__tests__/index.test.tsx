import { fireEvent, render, screen } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import MobileTopicTypeFilter from ".."
import type { TopicTypeFilterValue } from "@/pages/superMagic/utils/topicTypeFilter"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerTrailingAction,
	}: {
		visible: boolean
		children: ReactNode
		headerTrailingAction: { onClick: () => void }
	}) =>
		visible ? (
			<div role="dialog">
				{children}
				<button onClick={headerTrailingAction.onClick}>Close</button>
			</div>
		) : null,
}))
function Harness() {
	const [value, onChange] = useState<TopicTypeFilterValue>("all")
	return <MobileTopicTypeFilter value={value} onChange={onChange} />
}
describe("MobileTopicTypeFilter", () => {
	it("opens a multi-select sheet, keeps it open while selecting, and closes explicitly", () => {
		render(<Harness />)
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "topicTypeFilter.label" }))
		expect(screen.getByRole("dialog")).toBeInTheDocument()
		const topic = screen.getByRole("checkbox", { name: "topicTypeFilter.topic" })
		fireEvent.click(topic)
		expect(topic).toHaveAttribute("aria-checked", "false")
		expect(
			screen.getByRole("checkbox", { name: "topicTypeFilter.scheduledTask" }),
		).toHaveAttribute("aria-checked", "true")
		fireEvent.click(topic)
		expect(screen.getByRole("checkbox", { name: "topicTypeFilter.all" })).toHaveAttribute(
			"aria-checked",
			"true",
		)
		fireEvent.click(screen.getByRole("button", { name: "Close" }))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})
})
