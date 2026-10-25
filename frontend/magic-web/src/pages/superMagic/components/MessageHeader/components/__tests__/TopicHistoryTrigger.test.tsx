import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { TopicHistoryTrigger } from "../TopicHistoryTrigger"

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe("TopicHistoryTrigger", () => {
	it("toggles history before notifying the caller", async () => {
		const order: string[] = []
		const onToggle = vi.fn(() => {
			order.push("toggle")
		})
		const onTriggerAction = vi.fn(() => {
			order.push("notify")
		})

		render(
			<TopicHistoryTrigger
				mode="layout"
				isActive={false}
				tooltipTitle="History"
				onToggle={onToggle}
				onTriggerAction={onTriggerAction}
			/>,
		)

		fireEvent.click(screen.getByTestId("message-header-history-button"))

		await vi.waitFor(() => {
			expect(onTriggerAction).toHaveBeenCalledTimes(1)
		})
		expect(onToggle).toHaveBeenCalledTimes(1)
		expect(order).toEqual(["toggle", "notify"])
	})

	it("keeps the history toggle when the caller notification fails", async () => {
		const onToggle = vi.fn()
		const onTriggerAction = vi.fn().mockRejectedValue(new Error("notify failed"))

		render(
			<TopicHistoryTrigger
				mode="layout"
				isActive={false}
				tooltipTitle="History"
				onToggle={onToggle}
				onTriggerAction={onTriggerAction}
			/>,
		)

		fireEvent.click(screen.getByTestId("message-header-history-button"))

		await vi.waitFor(() => {
			expect(onTriggerAction).toHaveBeenCalledTimes(1)
		})
		expect(onToggle).toHaveBeenCalledTimes(1)
	})
})
