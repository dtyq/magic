import { ArrowDownToLine, GripHorizontal, Search, WrapText } from "lucide-react"
import { useTranslation } from "react-i18next"
import ScriptExecutionLessonDemo from "./ScriptExecutionLessonDemo"

interface ReadingLesson {
	instruction: string
	tools: { title: string; text: string }[]
}
const READING_ICONS = [Search, WrapText, ArrowDownToLine, GripHorizontal]

export default function ScriptExecutionLessonReading() {
	const { t } = useTranslation("super")
	const lesson = t("scriptExecution.help.lesson.reading", {
		returnObjects: true,
	}) as ReadingLesson
	return (
		<section className="space-y-4">
			<p className="m-0 rounded-lg bg-[var(--help-soft)] px-4 py-3 text-sm leading-6">
				{lesson.instruction}
			</p>
			<ScriptExecutionLessonDemo scenario="reading" />
			<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
				{lesson.tools.map((tool, index) => {
					const Icon = READING_ICONS[index]
					return (
						<div
							key={tool.title}
							className="flex items-start gap-3 rounded-lg border p-3"
						>
							<Icon
								size={17}
								aria-hidden
								className="mt-0.5 shrink-0 text-muted-foreground"
							/>
							<div className="space-y-1">
								<h3 className="m-0 text-sm font-medium">{tool.title}</h3>
								<p className="m-0 text-xs leading-5 text-muted-foreground">
									{tool.text}
								</p>
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
