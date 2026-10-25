import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import type { useRecycleBinSearch } from "./useRecycleBinSearch"
import { RecycleBinTimeRangePicker } from "./RecycleBinTimeRangePicker"

interface Props {
	query: ReturnType<typeof useRecycleBinSearch>
	byLocation: boolean
	disabled: boolean
	onExit: () => void
}

export function RecycleBinSearchForm({ query, byLocation, disabled, onExit }: Props) {
	const { t } = useTranslation("super")
	if (!query.bounded || !query.limits || !query.range) return null
	const searching = query.status === "searching"
	const controlsDisabled = disabled || searching
	const { max_hours: maxHours, max_results: maxResults } = query.limits
	const { range } = query
	return (
		<form
			className="rounded-lg border border-border bg-muted/30 p-3"
			onSubmit={(event) => {
				event.preventDefault()
				void query.runSearch()
			}}
		>
			<div className="mb-3 flex items-center justify-between gap-2">
				<span className="text-sm font-medium">
					{byLocation
						? t("recycleBin.project.location")
						: t("recycleBin.project.nameSearch")}
				</span>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={disabled}
					onClick={onExit}
				>
					{t("recycleBin.project.exitSearch")}
				</Button>
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<RecycleBinTimeRangePicker
					period={query.period}
					range={range}
					maxHours={maxHours}
					disabled={controlsDisabled}
					invalid={query.invalidRange}
					onPeriodChange={query.changePeriod}
					onRangeChange={query.changeRange}
				/>
				<Button
					type="submit"
					size="sm"
					className="h-9"
					disabled={controlsDisabled || query.invalidRange}
				>
					<Search size={16} />
					{byLocation
						? t("recycleBin.project.searchAndGroup")
						: t("recycleBin.project.search")}
				</Button>
				{searching && (
					<Button type="button" size="sm" variant="outline" onClick={query.cancelSearch}>
						{t("recycleBin.project.cancelSearch")}
					</Button>
				)}
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				{t("recycleBin.project.queryLimits", { days: maxHours / 24, count: maxResults })}
			</p>
			{query.invalidRange && (
				<p className="mt-2 text-xs text-destructive" role="alert">
					{t("recycleBin.project.invalidRange", { days: maxHours / 24 })}
				</p>
			)}
			<div className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
				{searching && (
					<span className="inline-flex items-center gap-2">
						<Spinner className="size-4" />
						{t("recycleBin.project.searchProgress", { count: query.progress })}
					</span>
				)}
				{query.status === "ready" &&
					t("recycleBin.project.searchComplete", { count: query.items.length })}
				{query.status === "stale" && t("recycleBin.project.searchStale")}
			</div>
		</form>
	)
}
