import { ArrowRight, ClipboardPaste, FileUp, SquareArrowOutUpRight, Target } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { PersonaFile } from "../types"
import PersonaAvatar from "./PersonaAvatar"
import ResearchChatSheet from "./ResearchChatSheet"

interface PersonaBuildSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Personas that reached the library while this sheet was open. */
	savedPersonas: PersonaFile[]
	onStartStudy: (personaIds: string[]) => void
}

/**
 * Builds personas through a conversation without leaving the persona library.
 * The agent saves personas only after the user approves its drafts, and the library grid behind
 * the sheet shows them as they arrive; the conversation stays in the study list.
 */
function PersonaBuildSheet({
	open,
	onOpenChange,
	savedPersonas,
	onStartStudy,
}: PersonaBuildSheetProps) {
	const { t } = useTranslation("personaResearch")
	const navigate = useNavigate()

	return (
		<ResearchChatSheet
			open={open}
			onOpenChange={onOpenChange}
			title={t("build.title")}
			intro={{
				title: t("build.introTitle"),
				text: t("build.introText"),
				tips: [
					{ icon: FileUp, text: t("build.tipUpload") },
					{ icon: ClipboardPaste, text: t("build.tipPaste") },
					{ icon: Target, text: t("build.tipDescribe") },
				],
				prompt: t("build.prompt"),
				disclaimer: t("build.disclaimer"),
				draftSlot: "persona-build",
			}}
			headerAction={(topic) => (
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1 px-2 text-xs text-muted-foreground"
					onClick={() =>
						navigate({
							name: RouteName.PersonaResearchStudy,
							params: { topicId: topic.id },
						})
					}
				>
					<SquareArrowOutUpRight className="size-3.5" />
					{t("build.openInStudio")}
				</Button>
			)}
			footer={
				savedPersonas.length ? (
					<SavedBar personas={savedPersonas} onStartStudy={onStartStudy} />
				) : null
			}
		/>
	)
}

/** Positive feedback once the agent has saved personas: who arrived, and the next step. */
function SavedBar({
	personas,
	onStartStudy,
}: {
	personas: PersonaFile[]
	onStartStudy: (personaIds: string[]) => void
}) {
	const { t } = useTranslation("personaResearch")
	return (
		<div className="flex shrink-0 items-center gap-3 border-t border-border bg-emerald-500/[0.05] px-4 py-2.5 animate-in fade-in-0 motion-reduce:animate-none">
			<span className="flex -space-x-1.5">
				{personas.slice(0, 5).map((persona) => (
					<PersonaAvatar
						key={persona.id}
						id={persona.id}
						name={persona.name}
						className="size-7 border-2 border-background text-[10px]"
					/>
				))}
			</span>
			<span className="min-w-0 flex-1 truncate text-xs text-foreground">
				{t("build.saved", { count: personas.length })}
			</span>
			<Button size="sm" onClick={() => onStartStudy(personas.map((persona) => persona.id))}>
				{t("build.startStudy")}
				<ArrowRight className="size-3.5" />
			</Button>
		</div>
	)
}

export default observer(PersonaBuildSheet)
