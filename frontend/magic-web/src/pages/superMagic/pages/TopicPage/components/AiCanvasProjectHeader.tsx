import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import ProjectCardContainer from "../../../components/ProjectCardContainer"
import type { ProjectListItem, Workspace } from "../../Workspace/types"

interface AiCanvasProjectHeaderProps {
	selectedProject: ProjectListItem | null
	selectedWorkspace?: Workspace | null
}

/**
 * Floats over the canvas's top-left corner of an AI canvas project, which has no project
 * sidebar: a back button to the AI canvas home, then the compact project card (name, share,
 * more). Both are as tall as the card's single row, so they read as one toolbar.
 */
function AiCanvasProjectHeader({ selectedProject, selectedWorkspace }: AiCanvasProjectHeaderProps) {
	const { t } = useTranslation("aiCanvas")
	const navigate = useNavigate()
	const backLabel = t("project.backToHome")

	return (
		<div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] items-center gap-2">
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="size-[42px] shrink-0 rounded-full bg-background shadow-sm"
				onClick={() => navigate({ name: RouteName.AiCanvas })}
				aria-label={backLabel}
				title={backLabel}
				data-testid="ai-canvas-project-back"
			>
				<ArrowLeft size={16} />
			</Button>
			<ProjectCardContainer
				variant="compact"
				selectedProject={selectedProject}
				selectedWorkspace={selectedWorkspace}
				className="w-auto min-w-[220px] max-w-[360px] shadow-sm"
			/>
		</div>
	)
}

export default AiCanvasProjectHeader
