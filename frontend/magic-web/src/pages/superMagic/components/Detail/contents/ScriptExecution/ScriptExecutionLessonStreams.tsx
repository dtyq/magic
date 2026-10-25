import { useState } from "react"
import { AlignLeft, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import ScriptExecutionLessonDemo from "./ScriptExecutionLessonDemo"
import { useScriptLessonData, type ScriptLessonScenario } from "./script-execution-lessons"

interface StreamLesson {
	channels: { title: string; description: string }[]
	cases: { label: string; explanation: string }[]
	hint: string
}
const STREAM_SCENARIOS = [
	"channels",
	"basic",
	"failure",
] as const satisfies readonly ScriptLessonScenario[]
const CHANNEL_ICONS = [AlignLeft, TriangleAlert]

export default function ScriptExecutionLessonStreams() {
	const { t } = useTranslation("super")
	const [selected, setSelected] = useState(0)
	const data = useScriptLessonData(STREAM_SCENARIOS[selected])
	const lesson = t("scriptExecution.help.lesson.streams", { returnObjects: true }) as StreamLesson
	return (
		<section className="space-y-4">
			<div className="grid gap-3 [@container_help-article_(min-width:500px)]:grid-cols-2">
				{lesson.channels.map((channel, index) => {
					const Icon = CHANNEL_ICONS[index]
					const example = index === 0 ? data.stdout : data.stderr.split("\n").slice(-1)[0]
					return (
						<div
							key={channel.title}
							className="space-y-2 rounded-xl border bg-muted/20 p-4"
						>
							<h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
								<Icon size={17} aria-hidden />
								{channel.title}
							</h3>
							<p className="m-0 text-xs leading-5 text-muted-foreground">
								{channel.description}
							</p>
							<code className="block rounded-md bg-background px-3 py-2 text-xs leading-5">
								{example || t("scriptExecution.help.lesson.noOutput")}
							</code>
						</div>
					)
				})}
			</div>
			<div className="flex flex-wrap gap-2">
				{lesson.cases.map((item, index) => (
					<Button
						key={item.label}
						size="sm"
						variant={selected === index ? "default" : "outline"}
						aria-pressed={selected === index}
						onClick={() => setSelected(index)}
					>
						{item.label}
					</Button>
				))}
			</div>
			<p className="m-0 text-sm leading-6" aria-live="polite">
				{lesson.cases[selected].explanation}
			</p>
			<ScriptExecutionLessonDemo
				scenario={STREAM_SCENARIOS[selected]}
				height={selected === 2 ? 300 : 260}
			/>
			<p className="m-0 text-xs leading-5 text-muted-foreground">{lesson.hint}</p>
		</section>
	)
}
