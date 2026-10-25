import { useTranslation } from "react-i18next"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { DetailType } from "../../types"
import ScriptExecution from "./index"
import { useScriptLessonData, type ScriptLessonScenario } from "./script-execution-lessons"

const LESSON_FILE_OPTIONS = { fullscreen: false }

export default function ScriptExecutionLessonDemo({
	scenario,
	height = 350,
}: {
	scenario: ScriptLessonScenario
	height?: number
}) {
	const { t } = useTranslation("super")
	const data = useScriptLessonData(scenario)
	return (
		<figure className="m-0 min-w-0 space-y-2">
			<figcaption className="text-xs leading-5 text-muted-foreground">
				{t("scriptExecution.help.lesson.demoCaption")}
			</figcaption>
			<div className="overflow-hidden rounded-lg border bg-background" style={{ height }}>
				<FileAccessProvider options={LESSON_FILE_OPTIONS}>
					<ScriptExecution
						key={scenario}
						data={data}
						terminalToolInfo={{ id: `lesson:${scenario}`, action: "", remark: "" }}
						type={DetailType.ScriptExecution}
						isFromNode
						allowEdit={false}
						initialCodePanelSize={0}
						showOutputHelp={false}
					/>
				</FileAccessProvider>
			</div>
		</figure>
	)
}
