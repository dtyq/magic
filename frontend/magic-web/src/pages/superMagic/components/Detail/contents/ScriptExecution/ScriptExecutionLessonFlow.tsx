import { useState } from "react"
import { ArrowDown, ArrowRight, Bot, Code2, Cpu, MessageSquare, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface FlowLesson {
	title: string
	hint: string
	steps: { title: string; summary: string; explanation: string; example: string }[]
	note: string
}

export default function ScriptExecutionLessonFlow({ topic }: { topic: "python" | "execution" }) {
	const { t } = useTranslation("super")
	const [selected, setSelected] = useState(topic === "python" ? 1 : 0)
	const lesson = (
		topic === "python"
			? t("scriptExecution.help.lesson.roles", { returnObjects: true })
			: t("scriptExecution.help.lesson.execution", { returnObjects: true })
	) as FlowLesson
	const icons = topic === "python" ? [Bot, Code2, Cpu] : [Code2, Play, MessageSquare]
	const current = lesson.steps[selected]
	return (
		<figure className="m-0 space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
			<figcaption className="space-y-1">
				<h3 className="m-0 text-base font-semibold">{lesson.title}</h3>
				<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.hint}</p>
			</figcaption>
			<ol className="m-0 grid list-none gap-3 p-0 [@container_help-article_(min-width:500px)]:grid-cols-3">
				{lesson.steps.map((step, index) => {
					const Icon = icons[index]
					return (
						<li key={step.title} className="relative min-w-0">
							{index > 0 && (
								<>
									<ArrowDown
										size={16}
										aria-hidden
										className="mx-auto mb-3 text-muted-foreground [@container_help-article_(min-width:500px)]:hidden"
									/>
									<ArrowRight
										size={16}
										aria-hidden
										className="absolute -left-3.5 top-6 z-10 hidden rounded-full bg-background text-muted-foreground [@container_help-article_(min-width:500px)]:block"
									/>
								</>
							)}
							<Button
								variant="outline"
								aria-pressed={selected === index}
								onClick={() => setSelected(index)}
								className={cn(
									"h-full w-full flex-col items-start gap-2 whitespace-normal p-3.5 text-left",
									selected === index &&
										"border-[var(--help-accent)] bg-[var(--help-soft)] hover:bg-[var(--help-soft)]",
								)}
							>
								<span className="flex items-center gap-2 font-medium">
									<Icon size={17} aria-hidden />
									<span>{step.title}</span>
								</span>
								<span className="text-xs font-normal leading-5 text-muted-foreground">
									{step.summary}
								</span>
							</Button>
						</li>
					)
				})}
			</ol>
			<div
				className="space-y-3 rounded-lg border bg-background p-4"
				aria-live="polite"
				aria-atomic
			>
				<p className="m-0 text-sm leading-6">{current.explanation}</p>
				<pre className="m-0 whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 text-[13px] leading-6">
					<code>{current.example}</code>
				</pre>
			</div>
			<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.note}</p>
		</figure>
	)
}
