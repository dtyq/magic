import { useState } from "react"
import { ArrowRight, CheckCircle2, Pencil, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import ScriptExecutionLessonDemo from "./ScriptExecutionLessonDemo"

interface RetryLesson {
	title: string
	hint: string
	steps: { title: string; description: string }[]
	reason: { title: string; text: string }
	location: { title: string; text: string }
	change: string
	note: string
}

const RETRY_ICONS = [TriangleAlert, Pencil, CheckCircle2]

/** 切换的是三份教学记录，不调用工具，也不把后续成功写回第一次失败。 */
export default function ScriptExecutionLessonRetry() {
	const { t } = useTranslation("super")
	const [selected, setSelected] = useState(0)
	const lesson = t("scriptExecution.help.lesson.retry", { returnObjects: true }) as RetryLesson
	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h3 className="m-0 text-base font-semibold">{lesson.title}</h3>
				<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.hint}</p>
			</div>
			<ol className="m-0 grid list-none gap-2 p-0 [@container_help-article_(min-width:500px)]:grid-cols-3">
				{lesson.steps.map((step, index) => {
					const Icon = RETRY_ICONS[index]
					return (
						<li key={step.title} className="relative min-w-0">
							<Button
								variant="outline"
								aria-pressed={selected === index}
								onClick={() => setSelected(index)}
								className={cn(
									"h-auto w-full justify-start gap-2 whitespace-normal px-3 py-3 text-left",
									selected === index &&
										"border-[var(--help-accent)] bg-[var(--help-soft)] hover:bg-[var(--help-soft)]",
								)}
							>
								<Icon
									size={17}
									aria-hidden
									className={
										index === 0
											? "text-destructive"
											: index === 2
												? "text-emerald-600 dark:text-emerald-400"
												: "text-[var(--help-accent)]"
									}
								/>
								{step.title}
							</Button>
							{index < 2 && (
								<ArrowRight
									size={14}
									aria-hidden
									className="absolute -right-2.5 top-4 z-10 hidden rounded-full bg-background text-muted-foreground [@container_help-article_(min-width:500px)]:block"
								/>
							)}
						</li>
					)
				})}
			</ol>
			<p className="m-0 text-sm leading-6" aria-live="polite">
				{lesson.steps[selected].description}
			</p>
			{selected === 1 ? (
				<div className="space-y-4 rounded-xl border bg-muted/20 p-5">
					<div className="grid items-center gap-3 [@container_help-article_(min-width:500px)]:grid-cols-[1fr_auto_1fr]">
						<code className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-[13px]">
							print(
							<span className="underline decoration-destructive decoration-2 underline-offset-4">
								totla
							</span>
							)
						</code>
						<ArrowRight
							size={20}
							aria-hidden
							className="mx-auto rotate-90 text-muted-foreground [@container_help-article_(min-width:500px)]:rotate-0"
						/>
						<code className="rounded-lg border border-emerald-600/20 bg-emerald-500/5 p-4 text-[13px]">
							print(
							<span className="underline decoration-emerald-600 decoration-2 underline-offset-4">
								total
							</span>
							)
						</code>
					</div>
					<p className="m-0 text-sm leading-6">{lesson.change}</p>
				</div>
			) : (
				<ScriptExecutionLessonDemo
					scenario={selected === 0 ? "failure" : "corrected"}
					height={300}
				/>
			)}
			{selected === 0 && (
				<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
					{[lesson.reason, lesson.location].map(({ title, text }) => (
						<div key={title} className="space-y-1 rounded-lg border px-4 py-3">
							<h4 className="m-0 text-sm font-medium">{title}</h4>
							<p className="m-0 text-xs leading-5 text-muted-foreground">{text}</p>
						</div>
					))}
				</div>
			)}
			<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.note}</p>
		</section>
	)
}
