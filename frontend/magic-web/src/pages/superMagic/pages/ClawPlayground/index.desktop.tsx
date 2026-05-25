import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import { useCompositeDetailPanelController } from "@/pages/superMagic/hooks/useCompositeDetailPanelController"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import {
	FileActionVisibilityProvider,
	HIDE_CLAW_FILE_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import useNavigate from "@/routes/hooks/useNavigate"
import { ClawConversationPanel } from "./components/ClawConversationPanel"
import { ClawPlaygroundDetailPanel } from "./components/ClawPlaygroundDetailPanel"
import { ClawPlaygroundEditDialog } from "./components/ClawPlaygroundEditDialog"
import { ClawPlaygroundSidebar } from "./components/ClawPlaygroundSidebar"
import { createClawPlaygroundFileRowDecorationResolver } from "./claw-playground-file-tree-decorations"
import { useClawPlaygroundCore } from "./hooks/useClawPlaygroundCore"
import { useClawSandboxUpgradeAction } from "./hooks/useClawSandboxUpgradeAction"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"

function ClawPlaygroundDesktop() {
	const { t } = useTranslation("sidebar")
	const { t: tSuper } = useTranslation("super")
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const { code, store, selectedProject, attachments, attachmentList } = useClawPlaygroundCore()
	const { dialog, handleConfirmUpgradeSandbox } = useClawSandboxUpgradeAction({ store })
	const detailRef = useRef<DetailRef>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	const [isSkillsPanelOpen, setIsSkillsPanelOpen] = useState(false)
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

	const selectedWorkspace = store.selectedWorkspace
	const selectedTopic = store.selectedTopic
	const magicClaw = store.magicClaw
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)
	useNamedPageTitle({
		entityName: magicClaw?.name,
		fallbackName: t("superLobster.workspace.untitledProject", clawBrandValues),
		isReady: !store.loading && !store.error && !!selectedProject,
	})
	useDefaultModeModelListRefreshOnMount()

	const resolveTopicFileRowDecoration = useMemoizedFn(
		createClawPlaygroundFileRowDecorationResolver({
			t: tSuper,
		}),
	)

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		projects: store.projectStore.projects,
		workspaces: store.workspaceStore.workspaces,
		attachments,
		setAttachments: store.projectFilesStore.setWorkspaceFileTree,
		setUserSelectDetail,
		detailRef,
		isReadOnly,
	})

	const { shouldShowDetailPanel, topicFilesPropsWithPanel, handleActiveDetailTabChange } =
		useCompositeDetailPanelController({
			detailRef,
			isReadOnly: false,
			activeFileId,
			setActiveFileId,
			handleFileClick,
			topicFilesProps,
			extraPanelVisible: isSkillsPanelOpen,
			resetDeps: [selectedProject?.id],
			attachmentList,
			onReset: () => {
				setUserSelectDetail(undefined)
				setIsDetailPanelFullscreen(false)
				setIsSkillsPanelOpen(false)
			},
		})

	function handleBack() {
		navigate({ delta: -1 })
	}

	if (store.loading) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="claw-playground-loading"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.error || !selectedProject) {
		return (
			<div
				className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background"
				data-testid="claw-playground-error"
			>
				<p className="text-sm text-muted-foreground">
					{t("superLobster.workspace.loadFailed", clawBrandValues)}
				</p>
				<Button
					type="button"
					variant="outline"
					data-testid="claw-playground-error-back-button"
					onClick={handleBack}
				>
					{t("superLobster.workspace.back", clawBrandValues)}
				</Button>
			</div>
		)
	}

	return (
		<FileActionVisibilityProvider value={HIDE_CLAW_FILE_ACTIONS}>
			{dialog}
			<TopicDesktopPanels
				containerClassName="flex h-full w-full min-w-0 items-center overflow-hidden"
				detailPanelClassName="flex h-full flex-col"
				isDetailPanelFullscreen={isDetailPanelFullscreen}
				sidebar={
					<ClawPlaygroundSidebar
						magicClaw={magicClaw}
						sandboxLatestVersion={store.sandboxLatestVersion}
						isUpdatingSandbox={store.isUpgradingSandbox}
						selectedProjectId={selectedProject?.id || null}
						isReadOnly={isReadOnly}
						topicFilesProps={topicFilesPropsWithPanel}
						resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
						onBack={handleBack}
						onOpenEditDialog={() => setIsEditDialogOpen(true)}
						onUpgradeSandbox={handleConfirmUpgradeSandbox}
						onOpenSkillsPanel={() => setIsSkillsPanelOpen(true)}
					/>
				}
				detailPanel={
					<ClawPlaygroundDetailPanel
						isSkillsPanelOpen={isSkillsPanelOpen}
						onCloseSkillsPanel={() => setIsSkillsPanelOpen(false)}
						detailRef={detailRef}
						userSelectDetail={userSelectDetail}
						setUserSelectDetail={setUserSelectDetail}
						attachments={attachments}
						attachmentList={attachmentList}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						activeFileId={activeFileId}
						setActiveFileId={setActiveFileId}
						handleActiveDetailTabChange={handleActiveDetailTabChange}
						setIsDetailPanelFullscreen={setIsDetailPanelFullscreen}
						isReadOnly={isReadOnly}
					/>
				}
				isReadOnly={false}
				showProjectResizeHandle
				shouldShowDetailPanel={shouldShowDetailPanel}
				keepDetailMountedWhenHidden
				renderMessagePanel={({
					isConversationPanelCollapsed,
					onToggleConversationPanel,
				}) => (
					<ClawConversationPanel
						isConversationPanelCollapsed={isConversationPanelCollapsed}
						onToggleConversationPanel={onToggleConversationPanel}
						detailPanelVisible={shouldShowDetailPanel}
						clawCode={code}
						onOpenSkillsPanel={() => setIsSkillsPanelOpen(true)}
					/>
				)}
			/>
			<ClawPlaygroundEditDialog
				open={isEditDialogOpen}
				claw={magicClaw}
				onOpenChange={setIsEditDialogOpen}
				onUpdated={store.setMagicClaw}
			/>
		</FileActionVisibilityProvider>
	)
}

export default observer(ClawPlaygroundDesktop)
