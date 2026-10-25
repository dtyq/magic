import { memo } from "react"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { StepDot } from "@/pages/superMagic/pages/PersonaResearch/components/StudyStepper"
import type { StudyPhaseKey } from "@/pages/superMagic/pages/PersonaResearch/types"
import { cn } from "@/utils/cn"
import DefaultTool from "../Default"
import type { ToolCallViewModel } from "../../types"
import ResearchToolCard, { resolveTone } from "./ResearchToolCard"
import { getStudyProgress } from "./parse"
import type { StudyProgressData } from "./parse"

interface StudyProgressToolProps {
	toolData: ToolCallViewModel
	loading?: boolean
	classNames?: string
	onClick?: () => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

function usePhaseLabel() {
	const { t } = useTranslation("personaResearch")
	return (key: StudyPhaseKey | "done") => {
		switch (key) {
			case "clarify":
				return t("phase.clarify")
			case "plan":
				return t("phase.plan")
			case "desk_research":
				return t("phase.deskResearch")
			case "interview":
				return t("phase.interview")
			case "report":
				return t("phase.report")
			case "validation":
				return t("phase.validation")
			default:
				return t("phase.done")
		}
	}
}

/**
 * 研究页 StudyStepper 的迷你版：6 个阶段点，不带文字。
 * 卡片是事件发生那一刻的快照，所以当前阶段静态高亮，不转圈（StepDot still）。
 */
function MiniStepper({ data }: { data: StudyProgressData }) {
	const phaseLabel = usePhaseLabel()
	return (
		<ol
			className="m-0 flex shrink-0 list-none items-center p-0"
			aria-label={phaseLabel(data.phase)}
		>
			{data.phases.map((step, index) => (
				<li key={step.key} className="flex items-center">
					{/* 阶段点在研究页是 20px；缩到 16px 并用负外边距收回占位，头部保持 28px 高 */}
					<span className="-m-0.5 flex scale-[0.8]">
						<StepDot status={step.status} waiting={false} index={index} still />
					</span>
					{index < data.phases.length - 1 ? (
						<span
							className={cn(
								"h-px w-2",
								step.status === "done" || step.status === "skipped"
									? "bg-primary"
									: "bg-border",
							)}
						/>
					) : null}
				</li>
			))}
		</ol>
	)
}

/**
 * update_study 卡片：「研究进度 ●●③○○○ 进入市场洞察」。
 * 执行中、失败时没有阶段快照，只显示后端 remark；老消息（Markdown detail）退回默认卡片。
 */
function StudyProgressTool({
	toolData,
	loading = false,
	classNames,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: StudyProgressToolProps) {
	const data = getStudyProgress(toolData.detail)
	const tone = resolveTone(loading, toolData.status)

	if (!data && tone === "success") {
		return (
			<DefaultTool
				toolData={toolData}
				loading={loading}
				classNames={classNames}
				onClick={onClick}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	return (
		<ResearchToolCard
			toolData={toolData}
			tone={tone}
			classNames={classNames}
			summary={data ? <MiniStepper data={data} /> : undefined}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		/>
	)
}

export default memo(StudyProgressTool)
