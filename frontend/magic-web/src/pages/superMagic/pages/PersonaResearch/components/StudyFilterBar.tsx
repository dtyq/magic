import { Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import { STUDY_GROUPS, type StudyGroup, type StudyGroupFilter } from "../services/studyFilter"

interface StudyFilterBarProps {
	group: StudyGroupFilter
	onGroupChange: (group: StudyGroupFilter) => void
	counts: Record<StudyGroup, number>
	total: number
	keyword: string
	onKeywordChange: (keyword: string) => void
	className?: string
}

/**
 * Status chips and a title search for the home study list, styled like the persona library's
 * tier chips and search. Groups with no study are left out unless selected.
 */
export default function StudyFilterBar({
	group,
	onGroupChange,
	counts,
	total,
	keyword,
	onKeywordChange,
	className,
}: StudyFilterBarProps) {
	const { t } = useTranslation("personaResearch")
	const labels: Record<StudyGroupFilter, string> = {
		all: t("home.filter.all"),
		active: t("status.running"),
		done: t("status.done"),
		stopped: t("status.idle"),
		conversation: t("status.conversation"),
	}
	const chips: { value: StudyGroupFilter; count: number }[] = [
		{ value: "all", count: total },
		...STUDY_GROUPS.filter((value) => counts[value] > 0 || group === value).map((value) => ({
			value,
			count: counts[value],
		})),
	]

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<div className="flex flex-wrap gap-1">
				{chips.map(({ value, count }) => (
					<button
						key={value}
						type="button"
						aria-pressed={group === value}
						onClick={() => onGroupChange(value)}
						className={cn(
							"flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							group === value
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-muted-foreground hover:text-foreground",
						)}
					>
						{labels[value]}
						<span className="tabular-nums opacity-70">{count}</span>
					</button>
				))}
			</div>
			<div className="relative w-56 max-sm:w-full">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={keyword}
					onChange={(event) => onKeywordChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Escape" && keyword) {
							event.preventDefault()
							onKeywordChange("")
						}
					}}
					placeholder={t("home.filter.search")}
					aria-label={t("home.filter.search")}
					className="h-8 pl-8 pr-8"
				/>
				{keyword ? (
					<button
						type="button"
						className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={t("home.filter.clear")}
						onClick={() => onKeywordChange("")}
					>
						<X className="size-3.5" />
					</button>
				) : null}
			</div>
		</div>
	)
}
