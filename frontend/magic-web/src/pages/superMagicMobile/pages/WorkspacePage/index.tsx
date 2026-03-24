import { observer } from "mobx-react-lite"
import { lazy, Suspense, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { interfaceStore } from "@/stores/interface"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import ProjectList from "../../components/ProjectList"
import IconWorkspaceCase from "@/components/icons/IconWorkspaceCase"
import WorkspaceCase from "../../components/WorkspaceCase"
import MessagePanelSkeleton from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MessagePanelSkeleton"
import { isPrivateDeployment } from "@/utils/env"
import Slogan from "@/pages/superMagic/components/EmptyWorkspacePanel/components/Slogan"
import IconWorkspaceProjectStar from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectStar"
import { DEFAULT_MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import { cn } from "@/lib/utils"
import { useEmptyStateHandlers } from "@/pages/superMagic/hooks/useEmptyStateHandlers"
import { resetDocumentScrollPosition } from "@/utils/scroll"
import EditionActivityBanner from "@/components/business/EditionActivity/Banner"

const ProjectPageInputContainer = lazy(
	() => import("@/pages/superMagic/components/ProjectPageInputContainer"),
)

const WorkspacePageContent = observer(function WorkspacePageContent() {
	const { t } = useTranslation("super")

	const selectedWorkspace = workspaceStore.selectedWorkspace

	// Sending is handled by MessagePanel service now.

	const handleEditorBlur = useMemoizedFn(() => {
		resetDocumentScrollPosition()
	})

	// Use hook for empty state handlers
	const { handleSetSelectedProject, handleSetSelectedTopic } = useEmptyStateHandlers()

	return (
		<div className="relative flex h-full flex-auto flex-col items-center justify-between overflow-x-hidden bg-[rgb(247,247,247)]">
			<div
				className={cn(
					"w-full flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden",
					`pb-safe-bottom-with-tabbar`,
				)}
			>
				{!isPrivateDeployment() && <EditionActivityBanner />}
				<Slogan />
				{/* 没有项目时显示消息面板 */}
				<Suspense fallback={<MessagePanelSkeleton isMobile />}>
					<ProjectPageInputContainer
						classNames={{
							editorWrapper: "pl-2 pr-2",
							editor: "rounded-2xl p-2 border-[0.5px] !border-muted-foreground shadow-[0px_0px_1px_0px_rgba(0,0,0,0.3),0px_0px_30px_0px_rgba(0,0,0,0.06)]",
							editorInnerWrapper: "border",
							editorContent: "min-h-[88px]",
						}}
						showLoading={false}
						selectedProject={null}
						selectedTopic={null}
						setSelectedTopic={handleSetSelectedTopic}
						setSelectedProject={handleSetSelectedProject}
						onEditorBlur={handleEditorBlur}
						messages={[]}
						taskData={null}
						isEmptyStatus
						size="mobile"
						selectedWorkspace={selectedWorkspace}
						editorLayoutConfig={DEFAULT_MOBILE_LAYOUT_CONFIG}
					/>
				</Suspense>
				<div className="flex flex-col gap-2.5">
					<div className="flex w-full flex-col gap-4 pl-2.5 pr-2.5">
						<div className="mt-5 flex items-center justify-start gap-2 text-lg font-semibold leading-6 text-foreground">
							<IconWorkspaceProjectStar size={32} />
							<div>{t("project.workspaceProjects")}</div>
						</div>
						<ProjectList />
					</div>
					<div className="flex w-full flex-1 flex-col items-center gap-4 overflow-y-auto pl-2.5 pr-2.5">
						<div className="mt-5 flex w-full items-center justify-start gap-[10px] text-lg font-semibold leading-6 text-[var(--magic-color-text-1)]">
							<IconWorkspaceCase size={32} />
							<div>{t("common.caseTitle")}</div>
						</div>
						<WorkspaceCase />
					</div>
				</div>
			</div>
		</div>
	)
})

export default observer(function WorkspacePage() {
	useEffect(() => {
		return interfaceStore.setEnableGlobalSafeArea({
			// top: false,
			// bottom: false,
		})
	}, [])

	return <WorkspacePageContent />
})
