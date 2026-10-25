import { ArrowLeft } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import StudyListSection from "../components/StudyListSection"
import { useResearchBack } from "../hooks/useResearchBack"
import { useStudyActions } from "../hooks/useStudyActions"

/** Every study, opened from "view all" on the research home; same filters and search. */
function ResearchStudiesPage() {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	const { openStudy, requestDelete, deleteDialog } = useStudyActions()
	const goHome = () => navigate({ name: RouteName.PersonaResearch })
	const goBack = useResearchBack()

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			data-testid="persona-research-studies"
		>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
				<MagicTooltip title={t("study.backHome")}>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("study.backHome")}
						onClick={goBack}
					>
						<ArrowLeft className="size-4" />
					</Button>
				</MagicTooltip>
				<div className="flex flex-1 flex-col">
					<h1 className="text-sm font-semibold">{t("home.myStudies")}</h1>
					<p className="text-xs text-muted-foreground">
						{t("studies.subtitle", { count: store.studies.length })}
					</p>
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
				<div
					className={cn(
						"mx-auto w-full max-w-6xl",
						isMobile ? "px-4 pb-6" : "px-10 pb-16 pt-2",
					)}
				>
					<StudyListSection
						variant="page"
						onOpen={openStudy}
						onDelete={requestDelete}
						onTrySample={goHome}
					/>
				</div>
			</ScrollArea>
			{deleteDialog}
		</div>
	)
}

export default observer(ResearchStudiesPage)
