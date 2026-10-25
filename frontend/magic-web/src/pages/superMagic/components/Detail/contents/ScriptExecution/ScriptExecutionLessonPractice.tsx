import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import ScriptExecutionLessonDemo from "./ScriptExecutionLessonDemo"
import type { ScriptLessonScenario } from "./script-execution-lessons"

const PRACTICE_SCENARIOS = [
	"warning",
	"empty",
	"error",
] as const satisfies readonly ScriptLessonScenario[]
interface PracticeCase {
	label: string
	question: string
	answers: { label: string; explanation: string; correct: boolean }[]
	request: string
}

export default function ScriptExecutionLessonPractice() {
	const { t } = useTranslation("super")
	const [scenario, setScenario] = useState<(typeof PRACTICE_SCENARIOS)[number]>("warning")
	const [answer, setAnswer] = useState<number | null>(null)
	const cases = t("scriptExecution.help.lesson.practiceCases", { returnObjects: true }) as Record<
		(typeof PRACTICE_SCENARIOS)[number],
		PracticeCase
	>
	const current = cases[scenario]
	return (
		<section className="space-y-5">
			<div
				className="flex flex-wrap gap-2"
				aria-label={t("scriptExecution.help.lesson.chooseCase")}
			>
				{PRACTICE_SCENARIOS.map((id) => (
					<Button
						key={id}
						variant={scenario === id ? "default" : "outline"}
						size="sm"
						aria-pressed={scenario === id}
						onClick={() => {
							setScenario(id)
							setAnswer(null)
						}}
					>
						{cases[id].label}
					</Button>
				))}
			</div>
			<p className="font-medium">{current.question}</p>
			<ScriptExecutionLessonDemo scenario={scenario} />
			<div className="space-y-2" aria-label={t("scriptExecution.help.lesson.chooseAnswer")}>
				{current.answers.map(({ label }, index) => (
					<Button
						key={label}
						variant={answer === index ? "secondary" : "outline"}
						className="h-auto w-full justify-start whitespace-normal py-3 text-left leading-6"
						aria-pressed={answer === index}
						onClick={() => setAnswer(index)}
					>
						{label}
					</Button>
				))}
			</div>
			{answer !== null && (
				<div
					className="space-y-3 rounded-lg border bg-muted/20 p-4"
					role="status"
					aria-live="polite"
					aria-atomic
				>
					<p className="m-0 font-medium">
						{current.answers[answer].correct
							? t("scriptExecution.help.lesson.answerCorrect")
							: t("scriptExecution.help.lesson.answerTryAgain")}
					</p>
					<p className="m-0">{current.answers[answer].explanation}</p>
					<p className="m-0 text-sm text-muted-foreground">
						{t("scriptExecution.help.lesson.requestTitle")}
					</p>
					<blockquote className="m-0 border-l-2 border-primary/40 pl-3">
						{current.request}
					</blockquote>
				</div>
			)}
		</section>
	)
}
