import IconMicRecord from "@/opensource/enhance/tabler/icons-react/icons/IconMicRecord"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { RecordingSummaryEditorMode } from "@/opensource/pages/superMagic/components/MessagePanel/const/recordSummary"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { IconKeyboard, IconMusicUp } from "@tabler/icons-react"
import { useIsCurrentRecording } from "@/opensource/components/business/RecordingSummary/hooks/useisCurrentRecording"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import { observer } from "mobx-react-lite"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import { useTranslation } from "react-i18next"
import { useEffect, useMemo } from "react"
import { SummaryGuideDOMId } from "@/opensource/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide"
import { cn } from "@/opensource/lib/utils"

const getPaddingClass = (className?: string) => {
	const matchedPadding = className?.match(/p-(\d)/)?.[1]
	return matchedPadding ? `p-${matchedPadding}` : "p-2"
}

const innerPadding: Record<string, string> = {
	"p-1": "p-0.5",
	"p-2": "p-1.5",
}

const paddingMap = new Map<string, number>([
	["p-1", 4],
	["p-2", 6],
])

export interface EditorModeSwitchProps {
	className?: string
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	selectedWorkspace: Workspace | null | undefined
	iconSize: number
	editorMode: RecordingSummaryEditorMode
	setEditorMode: (editorMode: RecordingSummaryEditorMode) => void
	disabled: boolean
}

function EditorModeSwitch({
	iconSize,
	className,
	selectedTopic,
	selectedProject,
	selectedWorkspace,
	editorMode,
	setEditorMode,
	disabled = false,
}: EditorModeSwitchProps) {
	const { t } = useTranslation("super")
	const { isRecording, isOtherTabRecording, isMediaRecorderNotSupported } = recordSummaryStore

	// Calculate dimensions based on iconSize
	const dimensions = useMemo(() => {
		const paddingClass = getPaddingClass(className)
		const padding = paddingMap.get(paddingClass) ?? 6
		const buttonSize = iconSize + padding * 2
		const gap = 0
		const translateX = buttonSize + gap

		return {
			buttonSize,
			translateX,
		}
	}, [iconSize, className])

	// Check if current tab is recording in the current workspace/project/topic
	const isCurrentRecording = useIsCurrentRecording(
		selectedTopic,
		selectedProject,
		selectedWorkspace,
	)

	useEffect(() => {
		if (
			isCurrentRecording &&
			isRecording &&
			editorMode === RecordingSummaryEditorMode.Editing
		) {
			setEditorMode(RecordingSummaryEditorMode.Recording)
		}
	}, [isCurrentRecording, isRecording, editorMode, setEditorMode])

	const Icon = (() => {
		if (isRecording && isCurrentRecording) return IconMicRecord
		if (
			(isRecording && !isCurrentRecording) ||
			isOtherTabRecording ||
			isMediaRecorderNotSupported
		)
			return IconMusicUp
		return IconMicRecord
	})()

	const handleClick = (mode: RecordingSummaryEditorMode) => {
		if (disabled) return
		setEditorMode(mode)
	}

	return (
		<div
			className={cn(
				"relative flex items-center rounded-lg p-0.5",
				"border-border bg-muted",
				disabled && "cursor-not-allowed opacity-50",
			)}
			id={SummaryGuideDOMId.SwitchActionButton}
		>
			{/* Sliding indicator */}
			<div
				className="absolute rounded-md bg-background shadow-sm transition-transform duration-200 ease-in-out"
				style={{
					height: `${dimensions.buttonSize}px`,
					width: `${dimensions.buttonSize}px`,
					transform:
						editorMode === RecordingSummaryEditorMode.Recording
							? "translateX(0px)"
							: `translateX(${dimensions.translateX}px)`,
				}}
			/>

			{/* Recording mode button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className={cn(
							"relative z-10 flex shrink-0 items-center justify-center rounded-md",
							innerPadding[getPaddingClass(className)],
							!disabled && "cursor-pointer",
						)}
						style={{
							height: `${dimensions.buttonSize}px`,
							width: `${dimensions.buttonSize}px`,
						}}
						id={SummaryGuideDOMId.SwitchRecordingActionButton}
						data-isChecked={editorMode === RecordingSummaryEditorMode.Recording}
						onClick={() => handleClick(RecordingSummaryEditorMode.Recording)}
						disabled={disabled}
					>
						<MagicIcon component={Icon} size={iconSize} />
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{t("recordingSummary.editorModeSwitch.switchToRecording")}</p>
				</TooltipContent>
			</Tooltip>

			{/* Editing mode button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className={cn(
							"relative z-10 flex shrink-0 items-center justify-center rounded-md",
							!disabled && "cursor-pointer",
							innerPadding[getPaddingClass(className)],
						)}
						style={{
							height: `${dimensions.buttonSize}px`,
							width: `${dimensions.buttonSize}px`,
						}}
						id={SummaryGuideDOMId.SwitchEditingActionButton}
						data-isChecked={editorMode === RecordingSummaryEditorMode.Editing}
						onClick={() => handleClick(RecordingSummaryEditorMode.Editing)}
						disabled={disabled}
					>
						<MagicIcon component={IconKeyboard} size={iconSize} />
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{t("recordingSummary.editorModeSwitch.switchToTextInput")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	)
}

export default observer(EditorModeSwitch)
