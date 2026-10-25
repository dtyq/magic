import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CalendarMonthPanel } from "../../src/components/time-filter-panel/components/time-filter-panel-ui"
import { TimeFilterPanel } from "../../src/components/time-filter-panel/time-filter-panel"
import {
	historyMode,
	relativeUnit,
	timeFilterTab,
	type TimeRangeValue,
} from "../../src/components/time-filter-panel/types"
import { timeFilterHistoryStorageKey } from "../../src/components/time-filter-panel/utils"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@magic-admin-v2/i18n/use-i18n", () => ({
	useI18n: () => ({ language: "en_US" }),
}))

function activateTab(name: string) {
	fireEvent.mouseDown(screen.getByRole("tab", { name }), {
		button: 0,
		ctrlKey: false,
	})
}

const latestCompleteDate = new Date(2026, 8, 13, 23, 59, 59, 999)

function renderRestrictedPanel(onChange = vi.fn<(value: TimeRangeValue | null) => void>()) {
	render(
		<TimeFilterPanel
			maxDate={latestCompleteDate}
			onChange={onChange}
			presentation="inline"
			supportedRelativeUnits={[relativeUnit.day]}
			timePrecision="day"
		/>,
	)
	fireEvent.click(screen.getByRole("button", { name: "timeFilter.placeholder" }))
	return onChange
}

describe("time filter maximum date", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 8, 14, 12, 0, 0, 0))
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		window.localStorage.clear()
	})

	it("disables today and future calendar dates while keeping yesterday selectable", () => {
		const onSelect = vi.fn()

		render(
			<CalendarMonthPanel
				endDate={null}
				intlLocale="en-US"
				maxDate={latestCompleteDate}
				month={new Date(2026, 8, 1)}
				onSelect={onSelect}
				startDate={null}
			/>,
		)

		const yesterday = screen.getByRole("button", { name: "2026-09-13" })
		const today = screen.getByRole("button", { name: "2026-09-14" })
		const futureDate = screen.getByRole("button", { name: "2026-09-30" })

		expect(yesterday).toBeEnabled()
		expect(today).toBeDisabled()
		expect(futureDate).toBeDisabled()
		fireEvent.click(yesterday)
		expect(onSelect).toHaveBeenCalledWith(new Date(2026, 8, 13))
	})

	it("keeps disabled styling authoritative for an externally selected future date", () => {
		render(
			<CalendarMonthPanel
				endDate={new Date(2026, 8, 14)}
				intlLocale="en-US"
				maxDate={latestCompleteDate}
				month={new Date(2026, 8, 1)}
				onSelect={vi.fn()}
				startDate={new Date(2026, 8, 14)}
			/>,
		)

		const today = screen.getByRole("button", { name: "2026-09-14" })
		expect(today).toBeDisabled()
		expect(today).toHaveClass("cursor-not-allowed", "bg-transparent")
		expect(today).not.toHaveClass("bg-primary", "text-primary-foreground")
	})

	it("hides the today preset when yesterday is the latest allowed date", () => {
		renderRestrictedPanel()

		expect(
			screen.queryByRole("button", { name: "timeFilter.preset.today" }),
		).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "timeFilter.preset.yesterday" })).toBeEnabled()
	})

	it("keeps quick presets visible when the range is limited to hours", () => {
		render(
			<TimeFilterPanel
				onChange={vi.fn()}
				presentation="inline"
				supportedRelativeUnits={[relativeUnit.hour, relativeUnit.day]}
				timePrecision="hour"
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "timeFilter.placeholder" }))

		const hourPreset = screen.getByRole("button", { name: "timeFilter.preset.last1Hour" })
		const dayPreset = screen.getByRole("button", { name: "timeFilter.preset.last1Day" })

		expect(hourPreset).toBeVisible()
		expect(dayPreset).toBeVisible()
		expect(hourPreset.parentElement?.parentElement).not.toHaveClass("sm:grid-cols-[56px_1fr]")
	})

	it("hides the alignment switch when relative ranges only support days", () => {
		renderRestrictedPanel()

		expect(screen.queryByText("timeFilter.alignToUnit")).not.toBeInTheDocument()
	})

	it("anchors absolute near-day shortcuts to yesterday", () => {
		const onChange = renderRestrictedPanel()

		activateTab("timeFilter.absolute")
		fireEvent.click(screen.getByRole("button", { name: "timeFilter.preset.last7Days" }))
		fireEvent.click(screen.getByRole("button", { name: "timeFilter.confirm" }))

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				endDate: "2026-09-13 23:59:59",
				startDate: "2026-09-07 00:00:00",
				tab: timeFilterTab.absolute,
			}),
		)
	})

	it("closes the inline panel without applying when cancel is clicked", () => {
		const onChange = renderRestrictedPanel()

		activateTab("timeFilter.absolute")
		fireEvent.click(screen.getByRole("button", { name: "timeFilter.cancel" }))

		expect(onChange).not.toHaveBeenCalled()
		expect(screen.queryByRole("tab", { name: "timeFilter.absolute" })).not.toBeInTheDocument()
	})

	it("clips a stored history range so it cannot output a date after yesterday", () => {
		window.localStorage.setItem(
			timeFilterHistoryStorageKey,
			JSON.stringify([
				{
					createdAt: "2026-09-14 10:00:00",
					endDate: "2026-09-14 23:59:59",
					id: "future-history",
					label: "future history",
					mode: historyMode.custom,
					startDate: "2026-09-07 00:00:00",
					tab: timeFilterTab.relative,
				},
			]),
		)
		const onChange = renderRestrictedPanel()

		activateTab("timeFilter.history")
		fireEvent.click(screen.getByText("future history").closest("button")!)

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				endDate: "2026-09-13 23:59:59",
				startDate: "2026-09-07 00:00:00",
			}),
		)
	})

	it("does not emit a range whose start date is after yesterday", () => {
		window.localStorage.setItem(
			timeFilterHistoryStorageKey,
			JSON.stringify([
				{
					createdAt: "2026-09-14 10:00:00",
					endDate: "2026-09-15 23:59:59",
					id: "invalid-future-history",
					label: "invalid future history",
					mode: historyMode.custom,
					relativeUnit: relativeUnit.day,
					startDate: "2026-09-14 00:00:00",
					tab: timeFilterTab.relative,
				},
			]),
		)
		const onChange = renderRestrictedPanel()

		activateTab("timeFilter.history")
		fireEvent.click(screen.getByText("invalid future history").closest("button")!)

		expect(onChange).not.toHaveBeenCalled()
	})
})
