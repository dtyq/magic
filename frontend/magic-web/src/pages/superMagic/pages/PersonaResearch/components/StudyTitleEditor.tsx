import { PencilLine } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useStudyRename } from "../hooks/useStudyRename"

interface StudyTitleEditorProps {
	topicId: string
	/** Current study title; empty while the study has no name yet. */
	title: string
}

/**
 * Studio heading that renames the study in place: click to edit, Enter or blur saves, Escape
 * cancels. The new name is the topic name, so the home list and share page follow it.
 */
function StudyTitleEditor({ topicId, title }: StudyTitleEditorProps) {
	const { t } = useTranslation("personaResearch")
	const { draft, setDraft, isSaving, editable, start, commit, onKeyDown } = useStudyRename(
		topicId,
		title,
	)
	const displayTitle = title || t("study.untitled")

	if (draft !== null) {
		return (
			<Input
				autoFocus
				value={draft}
				disabled={isSaving}
				placeholder={t("study.untitled")}
				aria-label={t("study.rename")}
				className="h-7 min-w-0 flex-1 px-2 text-base font-bold"
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => void commit()}
				onKeyDown={onKeyDown}
				onFocus={(event) => event.target.select()}
			/>
		)
	}

	if (!editable)
		return <h1 className="truncate text-base font-bold tracking-tight">{displayTitle}</h1>

	return (
		<h1 className="min-w-0 text-base font-bold tracking-tight">
			<MagicTooltip title={t("study.rename")}>
				<button
					type="button"
					className="group flex max-w-full items-center gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={start}
				>
					<span className="truncate">{displayTitle}</span>
					{/* The pencil appears on hover or keyboard focus so the heading stays quiet. */}
					<PencilLine className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
				</button>
			</MagicTooltip>
		</h1>
	)
}

export default observer(StudyTitleEditor)
