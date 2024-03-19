import { Files, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"
import IconShareCog from "@/opensource/enhance/tabler/icons-react/icons/iconShareCog"
import ProjectCardContainer from "../../../components/ProjectCardContainer"
import ProjectSider from "../../../components/ProjectSider"
import ShareManagementPanel from "../../../components/ShareManagement/ShareManagementPanel"
import SiderTask from "../../../components/SiderTask"
import TopicFilesButton from "../../../components/TopicFilesButton"
import { ProjectListItem, Topic, Workspace } from "../../../pages/Workspace/types"

interface TopicSidebarProps {
	selectedProject: ProjectListItem | null
	selectedWorkspace: Workspace | null
	selectedTopic: Topic | null
	isReadOnly: boolean
	topicFilesProps: any
}

function TopicSidebar({
	selectedProject,
	selectedWorkspace,
	selectedTopic,
	isReadOnly,
	topicFilesProps,
}: TopicSidebarProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex h-full flex-col gap-2">
			<ProjectCardContainer
				selectedProject={selectedProject}
				selectedWorkspace={selectedWorkspace}
			/>
			<ProjectSider
				items={[
					{
						key: "topicFiles",
						title: t("topicFiles.title"),
						icon: <Files size={16} />,
						content: <TopicFilesButton {...topicFilesProps} />,
					},
					{
						key: "task",
						title: t("scheduleTask.title"),
						icon: <Timer size={16} />,
						content: (
							<SiderTask
								selectWorkspaceId={selectedWorkspace?.id}
								selectProjectId={selectedProject?.id}
								selectTopicId={selectedTopic?.id}
							/>
						),
						visible: !isReadOnly,
					},
					{
						key: "share",
						title: t("shareManagement.title"),
						icon: <IconShareCog size={16} color="currentColor" />,
						content: <ShareManagementPanel projectId={selectedProject?.id} />,
					},
				]}
				className="flex-1 overflow-hidden rounded-lg border border-border bg-background"
			/>
		</div>
	)
}

export default TopicSidebar
