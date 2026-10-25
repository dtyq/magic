import { Plus, UsersRound, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import PersonaAvatar from "./PersonaAvatar"
import { PRESSABLE } from "./surface"

const CHIP =
	"ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/25"

/**
 * Right end of the composer settings: "pick from the library" while nothing is picked, then the
 * picked personas as an avatar stack whose popover lists them, each removable, with "pick more"
 * and "clear". The picks travel in the settings line, never as text in the question.
 */
function StudyPersonaPicks({
	onPickMore,
	fullWidth = false,
}: {
	onPickMore: () => void
	/** Phones: a whole-row button under the setting tiles instead of a small trailing chip. */
	fullWidth?: boolean
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const picks = store.studyPersonaPicks

	if (picks.length === 0) {
		return (
			<button
				type="button"
				className={cn(
					CHIP,
					"text-muted-foreground hover:bg-muted hover:text-foreground",
					fullWidth &&
						"h-10 w-full justify-center rounded-xl border border-dashed border-border",
				)}
				onClick={onPickMore}
			>
				<UsersRound className="size-3.5" />
				{t("options.pickFromLibrary")}
			</button>
		)
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						CHIP,
						"bg-muted text-foreground",
						fullWidth && "h-10 w-full justify-center rounded-xl",
						PRESSABLE,
					)}
				>
					<span className="flex -space-x-1.5">
						{picks.slice(0, 3).map((pick) => (
							<PersonaAvatar
								key={pick.id}
								id={pick.id}
								name={pick.name}
								demographics={pick.demographics}
								className="size-5 ring-2 ring-muted"
							/>
						))}
					</span>
					<span className="font-medium">
						{t("options.picksCount", { count: picks.length })}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 p-0">
				<div className="border-b border-border px-3 py-2.5">
					<p className="text-sm font-medium text-foreground">{t("options.picksTitle")}</p>
					<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
						{t("options.picksHint")}
					</p>
				</div>
				<ul className="max-h-64 overflow-y-auto py-1">
					{picks.map((pick) => (
						<li key={pick.id} className="group flex items-center gap-2.5 px-3 py-1.5">
							<PersonaAvatar
								id={pick.id}
								name={pick.name}
								demographics={pick.demographics}
								className="size-7"
							/>
							<span className="min-w-0 flex-1 truncate text-sm text-foreground">
								{pick.name}
							</span>
							<button
								type="button"
								className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-60 outline-none transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
								aria-label={t("options.picksRemove", { name: pick.name })}
								onClick={() => store.removeStudyPersonaPick(pick.id)}
							>
								<X className="size-3.5" />
							</button>
						</li>
					))}
				</ul>
				<div className="flex items-center justify-between border-t border-border px-2 py-1.5">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1 px-2 text-xs"
						onClick={onPickMore}
					>
						<Plus className="size-3.5" />
						{t("options.picksAddMore")}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs text-muted-foreground"
						onClick={() => store.clearStudyPersonaPicks()}
					>
						{t("options.picksClear")}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default observer(StudyPersonaPicks)
