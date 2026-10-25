import { useState } from "react"
import { Hand, LoaderCircle, Search, Square } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface InterventionLesson {
	title: string
	hint: string
	cases: { title: string; signal: string; action: string; reason: string; request: string }[]
}
const INTERVENTION_ICONS = [LoaderCircle, Hand, Search, Square]

export default function ScriptExecutionLessonIntervention() {
	const { t } = useTranslation("super")
	const [selected, setSelected] = useState(0)
	const lesson = t("scriptExecution.help.lesson.intervention", {
		returnObjects: true,
	}) as InterventionLesson
	const current = lesson.cases[selected]
	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h3 className="m-0 text-base font-semibold">{lesson.title}</h3>
				<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.hint}</p>
			</div>
			<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
				{lesson.cases.map((item, index) => {
					const Icon = INTERVENTION_ICONS[index]
					return (
						<Button
							key={item.title}
							variant="outline"
							className={cn(
								"h-auto flex-col items-start gap-2 whitespace-normal p-4 text-left",
								selected === index &&
									"border-[var(--help-accent)] bg-[var(--help-soft)] hover:bg-[var(--help-soft)]",
							)}
							aria-pressed={selected === index}
							onClick={() => setSelected(index)}
						>
							<span className="flex items-center gap-2">
								<Icon size={17} aria-hidden />
								{item.title}
							</span>
							<span className="text-xs font-normal leading-5 text-muted-foreground">
								{item.signal}
							</span>
						</Button>
					)
				})}
			</div>
			<div
				className="space-y-3 rounded-xl border bg-muted/20 p-5"
				aria-live="polite"
				aria-atomic
			>
				<h4 className="m-0 text-base font-semibold">{current.action}</h4>
				<p className="m-0 text-sm leading-6">{current.reason}</p>
				{current.request && (
					<blockquote className="m-0 border-l-2 border-[var(--help-accent)] pl-3 text-sm leading-6 text-muted-foreground">
						{current.request}
					</blockquote>
				)}
			</div>
		</section>
	)
}
