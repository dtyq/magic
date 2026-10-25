import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { useScriptLessonData } from "./script-execution-lessons"

interface CodeLessonStep {
	label: string
	meaning: string
	concept: string
	result: string
}

export default function ScriptExecutionLessonCode() {
	const { t } = useTranslation("super")
	const [selected, setSelected] = useState(0)
	const steps = t("scriptExecution.help.lesson.codeSteps", {
		returnObjects: true,
	}) as CodeLessonStep[]
	const lines = useScriptLessonData("basic").code.split("\n")
	const step = steps[selected]
	return (
		<section
			className="space-y-4"
			aria-label={t("scriptExecution.help.lesson.codeWalkthrough")}
		>
			<h3 className="text-base font-semibold">
				{t("scriptExecution.help.lesson.codeWalkthrough")}
			</h3>
			<p className="m-0 text-xs leading-5 text-muted-foreground">
				{t("scriptExecution.help.lesson.codeScope")}
			</p>
			<div className="overflow-hidden rounded-xl border bg-muted/20">
				{steps.map(({ label }, index) => (
					<Button
						key={label}
						variant="ghost"
						className={cn(
							"h-auto w-full justify-start gap-3 whitespace-normal rounded-none px-3 py-3 text-left",
							selected === index &&
								"bg-[var(--help-soft)] hover:bg-[var(--help-soft)]",
						)}
						aria-pressed={selected === index}
						onClick={() => setSelected(index)}
					>
						<span
							className="w-4 shrink-0 text-xs font-normal text-muted-foreground"
							aria-hidden
						>
							{index + 1}
						</span>
						<code className="min-w-0 flex-1 break-all text-[13px] font-normal leading-6">
							{lines[index]}
						</code>
						<span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
							{label}
						</span>
					</Button>
				))}
			</div>
			<div
				className="space-y-3 rounded-lg border bg-muted/20 p-4"
				aria-live="polite"
				aria-atomic
			>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{t("scriptExecution.help.lesson.codeResult")}
					</span>
					<code className="rounded-md bg-background px-2 py-1 text-sm">
						{step.result}
					</code>
				</div>
				<p className="m-0 text-sm leading-6">{step.meaning}</p>
				<p className="m-0 text-xs leading-5 text-muted-foreground">{step.concept}</p>
			</div>
		</section>
	)
}
