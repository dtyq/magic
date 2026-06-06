import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "listCount") return `Recordings · ${options?.count}`
			const labels: Record<string, string> = {
				"filters.summaryStatus": "Summary status",
				"filters.summaryAll": "All",
				"filters.summaryNotDone": "Not summarized",
				"filters.summaryDone": "Summarized",
				"filters.dateRange": "Created",
				"filters.dateAll": "All time",
				"filters.dateLast7Days": "Last 7 days",
				"filters.dateLast30Days": "Last 30 days",
				"filters.dateLast90Days": "Last 90 days",
				"filters.sort": "Sort",
				"filters.sortByUpdatedDesc": "By last updated",
				"filters.sortByCreatedDesc": "By created time",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("../../utils/audio-recordings-utils", () => ({
	toEndOfDayTimestamp: (date: Date) => Math.floor(date.getTime() / 1000),
	toStartOfDayTimestamp: (date: Date) => Math.floor(date.getTime() / 1000),
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({
		children,
		onClick,
		"data-testid": dataTestId,
	}: {
		children: ReactNode
		onClick?: () => void
		"data-testid"?: string
	}) => (
		<button type="button" data-testid={dataTestId} onClick={onClick}>
			{children}
		</button>
	),
}))

import AudioRecordingsFilters from "../AudioRecordingsFilters"

/** Default props for filter bar rendering and interaction tests */
function renderFilters(overrides: Partial<Parameters<typeof AudioRecordingsFilters>[0]> = {}) {
	const onSummaryFilterChange = vi.fn()
	const onDatePresetChange = vi.fn()
	const onSortByChange = vi.fn()
	const onSortOrderChange = vi.fn()
	const onSearchKeywordChange = vi.fn()
	const onSearchCompositionStart = vi.fn()
	const onSearchCompositionEnd = vi.fn()
	const onRefresh = vi.fn()

	render(
		<AudioRecordingsFilters
			listCount={3}
			summaryFilter="all"
			datePreset="all"
			sortBy="updated_at"
			sortOrder="desc"
			searchKeyword=""
			isRefreshing={false}
			onSummaryFilterChange={onSummaryFilterChange}
			onDatePresetChange={onDatePresetChange}
			onSortByChange={onSortByChange}
			onSortOrderChange={onSortOrderChange}
			onSearchKeywordChange={onSearchKeywordChange}
			onSearchCompositionStart={onSearchCompositionStart}
			onSearchCompositionEnd={onSearchCompositionEnd}
			onRefresh={onRefresh}
			{...overrides}
		/>,
	)

	return {
		onSummaryFilterChange,
		onDatePresetChange,
		onSortByChange,
		onSortOrderChange,
		onSearchKeywordChange,
		onRefresh,
	}
}

describe("AudioRecordingsFilters", () => {
	it("renders summary, date, sort, search, and refresh controls in one bar", () => {
		renderFilters()

		expect(screen.getByTestId("audio-recordings-filters")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-summary-filter")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-date-filter")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-sort-filter")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-search-input")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-refresh-button")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-list-count")).toHaveTextContent("3")
	})

	it("shows the active summary option label on the trigger", () => {
		renderFilters({ summaryFilter: "summarized" })

		expect(screen.getByTestId("audio-recordings-summary-filter")).toHaveTextContent(
			"Summarized",
		)
	})

	it("calls onSummaryFilterChange when a summary menu item is selected", () => {
		const { onSummaryFilterChange } = renderFilters()

		fireEvent.click(screen.getByTestId("audio-recordings-summary-filter"))
		fireEvent.click(screen.getByTestId("audio-recordings-summary-not_summarized"))

		expect(onSummaryFilterChange).toHaveBeenCalledWith("not_summarized")
	})
})
