import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useLocation, useParams } from "react-router"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useDebounceFn, useDeepCompareEffect, useMemoizedFn } from "ahooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import type { SkillVersionItem } from "@/apis/modules/skills"
import { FUNCTION_PERMISSION_CODE, SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { logger } from "@/utils/log"
import { userStore } from "@/models/user"
import { SupportLocales } from "@/constants/locale"
import { skillsService } from "@/services/skills/SkillsService"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { MessageHeaderTopicHistoryPanel } from "@/pages/superMagic/components/MessageHeader"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { useCompositeDetailPanelController } from "@/pages/superMagic/hooks/useCompositeDetailPanelController"
import { useDeferUntilFileTabsCacheLoaded } from "@/pages/superMagic/hooks/useDeferUntilFileTabsCacheLoaded"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import {
	releaseAttachmentsRefreshWaitersWithoutFetch,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import PublishPanel, { PublishPanelStore } from "@/pages/superMagic/components/PublishPanel"
import {
	FileActionVisibilityProvider,
	HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"
import { SkillEditStoreProvider, useSkillEditStore } from "./context"
import QuickActionCards from "./components/QuickActionCards"
import SkillCollaboratorsQuickAction from "./components/SkillCollaboratorsQuickAction"
import ConversationPanel from "./components/ConversationPanel"
import { useSkillPublishGuard } from "./hooks/useSkillPublishGuard"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import { RoleIcon } from "../CrewEdit/components/common/RoleIcon"
import { Button } from "@/components/shadcn-ui/button"
import {
	buildPublishParamsFromDraft,
	createSkillEditPublishPanelData,
	createSkillEditPublishPrefillDraft,
} from "./publishPanelData"
import EditSkillDialog from "@/pages/superMagic/pages/MySkillsPage/components/EditSkillDialog"
import { convertSearchParams } from "@/routes/history/helpers"
import type { PublishDraft } from "@/pages/superMagic/components/PublishPanel"
import type { SkillEditSkillInfo } from "./store/types"
import { buildDefaultSlotUpdateParams } from "./utils/skill-workspace-manifest"
import { ensureSkillConfigYamlForPublish } from "./utils/ensureSkillConfigYaml"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"

const SKILL_EDIT_PANEL_QUERY_KEY = "panel"
const SKILL_EDIT_PUBLISH_VIEW_QUERY_KEY = "publishView"

type SkillEditRoutePanel = "publish" | null
type SkillEditRoutePublishView = "create" | null

interface SkillEditRouteState {
	panel: SkillEditRoutePanel
	publishView: SkillEditRoutePublishView
}

function getRouteStateFromSearch(search: string): SkillEditRouteState {
	const searchParams = new URLSearchParams(search)
	const panel = searchParams.get(SKILL_EDIT_PANEL_QUERY_KEY)
	const publishView = searchParams.get(SKILL_EDIT_PUBLISH_VIEW_QUERY_KEY)

	return {
		panel: panel === "publish" ? "publish" : null,
		publishView: publishView === "create" ? "create" : null,
	}
}

function buildSkillEditQuery({ search, panel }: { search: string; panel: SkillEditRoutePanel }) {
	const searchParams = new URLSearchParams(search)
	if (panel) {
		searchParams.set(SKILL_EDIT_PANEL_QUERY_KEY, panel)
	} else {
		searchParams.delete(SKILL_EDIT_PANEL_QUERY_KEY)
	}
	searchParams.delete(SKILL_EDIT_PUBLISH_VIEW_QUERY_KEY)
	const query = convertSearchParams(searchParams)
	return Object.keys(query).length > 0 ? query : undefined
}

function createFallbackPublishDraft({
	skill,
	fallbackDraft,
}: {
	skill: SkillEditSkillInfo | null
	fallbackDraft: PublishDraft
}): PublishDraft {
	if (!skill) return fallbackDraft

	return {
		...fallbackDraft,
		version: resolveImportPublishVersion(skill.versionCode),
		details: skill.description,
	}
}

function resolveImportPublishVersion(versionCode?: string) {
	const trimmed = versionCode?.trim()
	if (!trimmed) return "v1.0.0"
	return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
}

function SkillEditErrorFallback({ onBack }: { onBack: () => void }) {
	const { t } = useTranslation("crew/market")
	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-4"
			data-testid="skill-edit-error"
		>
			<p className="text-sm text-destructive">{t("editSkill.errors.fetchFailed")}</p>
			<button type="button" className="text-sm text-primary hover:underline" onClick={onBack}>
				{t("back")}
			</button>
		</div>
	)
}

function SkillEditWorkspace({ skillCode }: { skillCode: string }) {
	const { t } = useTranslation("crew/market")
	const { t: tSuper } = useTranslation("super")
	const store = useSkillEditStore()
	const navigate = useNavigate()
	const location = useLocation()
	const detailRef = useRef<DetailRef>(null)
	const [activeFileId, setActiveFileId] = useState<string | null>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	const [activeQuickActionPanel, setActiveQuickActionPanel] = useState<"publish" | null>(null)
	const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
	const [skillVersions, setSkillVersions] = useState<SkillVersionItem[]>([])
	const [isPublishPrepareLoading, setIsPublishPrepareLoading] = useState(false)
	const { isAllowed: canCreateSkill } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillCreate,
	)
	const { isAllowed: canPublishSkillTeam } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillPublish,
	)
	const canOpenSkillPublishPanel = canCreateSkill || canPublishSkillTeam
	const selectedProject = store.project
	const topicStore = store.conversation.topicStore
	const selectedTopic = topicStore.selectedTopic
	const isPublishPanelVisible = activeQuickActionPanel === "publish"
	const topicActions = useScopedMessageHeaderTopicActions({
		selectedProject,
		selectedTopic,
		topicStore,
	})

	const currentPublisherName = userStore.user.userInfo?.nickname ?? ""

	const refreshSkillVersions = useMemoizedFn(async () => {
		try {
			const { list } = await skillsService.getSkillVersions(skillCode)
			setSkillVersions(list)
		} catch (error) {
			console.error("Failed to fetch skill versions:", error)
			setSkillVersions([])
			magicToast.error(t("skillEditPage.publishPanel.errors.loadVersionsFailed"))
		}
	})

	const publishPanelActionRef = useRef({
		store,
		skillCode,
		refreshSkillVersions,
		t,
	})
	publishPanelActionRef.current = { store, skillCode, refreshSkillVersions, t }

	// New panel store when route skill or locale changes (submit uses ref for latest store)
	const publishPanelStore = useMemo(() => {
		void skillCode
		return new PublishPanelStore({
			initialData: createSkillEditPublishPanelData({
				skill: null,
				versions: [],
				currentPublisherName: "",
				t,
			}),
			onSubmit: async (draft) => {
				const {
					store: skillStore,
					skillCode: code,
					refreshSkillVersions: rv,
					t: translate,
				} = publishPanelActionRef.current
				try {
					const detail = skillStore.lastFetchedSkillDetail
					if (detail) {
						const patch = buildDefaultSlotUpdateParams(
							detail,
							skillStore.skillWorkspaceManifest,
						)
						if (patch) {
							try {
								await skillsService.updateSkillInfo(code, patch)
								await skillStore.refreshSkillDetail()
							} catch (error) {
								logger.report({
									namespace: "skill-edit-publish-default-slot",
									data: ["updateSkillInfo before publish failed", error],
								})
							}
						}
					}

					await skillsService.publishSkill(code, buildPublishParamsFromDraft(draft))
					magicToast.success(translate("skillEditPage.publishPanel.toast.publishSuccess"))
					await skillStore.refreshSkillDetail()
					await rv()
				} catch {
					magicToast.error(translate("skillEditPage.publishPanel.toast.publishFailed"))
				}
			},
		})
	}, [skillCode, t])

	const attachments = store.projectFilesStore.workspaceFileTree
	const attachmentList = store.projectFilesStore.workspaceFilesList
	const loadedSkillCode = store.skill?.code
	const routeState = useMemo(() => getRouteStateFromSearch(location.search), [location.search])
	const skillDisplayName = useMemo(() => {
		const defaultSkillName = store.skill?.nameI18n?.[SupportLocales.fallback]?.trim()
		if (defaultSkillName) return defaultSkillName

		const manifestDefaultName = store.skillWorkspaceManifest?.nameDefault?.trim()
		if (manifestDefaultName) return manifestDefaultName

		return store.skill?.name?.trim() || t("skillEditPage.untitledSkill")
	}, [store.skill?.name, store.skill?.nameI18n, store.skillWorkspaceManifest, t])
	const publishPanelData = useMemo(
		() =>
			createSkillEditPublishPanelData({
				skill: store.skill,
				versions: skillVersions,
				currentPublisherName,
				canPublishPrivate: canCreateSkill,
				canPublishTeam: canPublishSkillTeam,
				t,
			}),
		[store.skill, skillVersions, currentPublisherName, canCreateSkill, canPublishSkillTeam, t],
	)

	useNamedPageTitle({
		entityName: skillDisplayName,
		isReady: !store.loading && !store.error,
	})
	useDefaultModeModelListRefreshOnMount()
	useCreateTopicListener({
		selectedProject,
		topicStore,
	})

	useEffect(() => {
		publishPanelStore.hydrate(publishPanelData, {
			preserveDraft: isPublishPanelVisible,
			preserveView: isPublishPanelVisible,
		})
	}, [isPublishPanelVisible, publishPanelData, publishPanelStore])

	useEffect(() => {
		if (store.loading || !loadedSkillCode) return
		void refreshSkillVersions()
	}, [store.loading, loadedSkillCode, refreshSkillVersions])

	const updateAttachments = useDebounceFn(
		(projectId?: string, callback?: () => void) => {
			if (!projectId) {
				store.projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				callback?.()
				return
			}

			const temporaryToken =
				(window as Window & { temporary_token?: string }).temporary_token || ""

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				SuperMagicApi.getAttachmentsByProjectId({
					projectId,
					temporaryToken,
				})
					.then((res) => {
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
					})
					.catch((error) => {
						console.error("Failed to fetch attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.()
					}),
			)
		},
		{ wait: 500 },
	).run

	useEffect(() => {
		void store.initFromSkillCode(skillCode)
	}, [skillCode, store])

	useEffect(() => {
		store.projectFilesStore.setSelectedProject(store.project)
		return () => {
			store.projectFilesStore.setSelectedProject(null)
		}
	}, [store.project, store.projectFilesStore])

	useEffect(() => {
		const handleActiveFileIdUpdate = (fileId: string | null) => {
			if (fileId) {
				setActiveQuickActionPanel(null)
			}
			setActiveFileId(fileId)
		}

		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
		}
	}, [])

	useAttachmentsPolling({
		projectId: store.project?.id,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll skill attachments:", error)
		}),
	})

	useDeepCompareEffect(() => {
		const projectId = store.project?.id
		if (!projectId) return

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId)

		return () => {
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [store.project?.id])

	useEffect(() => {
		const handleUpdateAttachments = (callback?: () => void) => {
			const pid = store.project?.id
			if (!pid) {
				callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, callback)
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [store.project?.id, updateAttachments])

	const debouncedSyncWorkspaceManifest = useDebounceFn(
		() => {
			void store.syncSkillWorkspaceManifest()
		},
		{ wait: 500 },
	).run

	useDeepCompareEffect(() => {
		if (!store.project?.id) return
		if (!store.projectFilesStore.workspaceFilesList.length) return

		debouncedSyncWorkspaceManifest()
	}, [store.project?.id, store.projectFilesStore.workspaceFilesList])

	const handleFileClick = useMemoizedFn((fileItem?: unknown) => {
		setActiveQuickActionPanel(null)
		setUserSelectDetail(null)
		window.setTimeout(() => {
			detailRef.current?.openFileTab?.(fileItem)
		}, 100)
	})

	const { shouldShowDetailPanel, handleFileClickWithPanel, handleActiveDetailTabChange } =
		useCompositeDetailPanelController({
			detailRef,
			isReadOnly: false,
			activeFileId,
			setActiveFileId,
			handleFileClick,
			topicFilesProps: {},
			extraPanelVisible: isPublishPanelVisible,
			resetDeps: [store.project?.id],
			onReset: () => {
				setUserSelectDetail(undefined)
				setIsDetailPanelFullscreen(false)
				setActiveQuickActionPanel(null)
			},
		})

	const { onFileTabsCacheLoaded } = useDeferUntilFileTabsCacheLoaded(store.project?.id)

	const {
		isTopicHistoryPanelOpen,
		openTopicHistoryPanel,
		closeTopicHistoryPanel,
		toggleTopicHistoryPanel,
	} = useTopicHistoryLayoutState({
		storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.skillEdit,
		isEnabled: !isPublishPanelVisible,
	})

	const openPublishPanel = useMemoizedFn(() => {
		void refreshSkillVersions()
		setActiveQuickActionPanel("publish")
		setActiveFileId(null)
		setUserSelectDetail(undefined)
		setIsDetailPanelFullscreen(false)
	})

	const openPublishCreateView = useMemoizedFn(async () => {
		flushSync(() => setIsPublishPrepareLoading(true))
		try {
			const ensured = await ensureSkillConfigYamlForPublish({
				projectId: store.project?.id,
				getWorkspaceFilesList: () => store.projectFilesStore.workspaceFilesList,
				getWorkspaceFileTree: () => store.projectFilesStore.workspaceFileTree,
				getSkillName: () => store.skill?.name,
				t,
			})
			if (!ensured) return

			openPublishPanel()

			const fallbackDraft = createFallbackPublishDraft({
				skill: store.skill,
				fallbackDraft: publishPanelData.draft,
			})
			let latestVersions = skillVersions

			if (!latestVersions.length) {
				try {
					const { list } = await skillsService.getSkillVersions(skillCode)
					latestVersions = list
					setSkillVersions(list)
				} catch (error) {
					console.error("Failed to refresh skill versions for prefill:", error)
				}
			}

			try {
				const prefill = await skillsService.getSkillPublishPrefill(skillCode)
				publishPanelStore.openCreateViewWithDraft(
					createSkillEditPublishPrefillDraft({
						prefill,
						versions: latestVersions,
						fallbackDraft,
					}),
				)
			} catch (error) {
				console.error("Failed to fetch publish prefill:", error)
				publishPanelStore.openCreateViewWithDraft(fallbackDraft)
			}
		} finally {
			setIsPublishPrepareLoading(false)
		}
	})

	const {
		isPublishIdentityDialogOpen,
		isEnsuringSkillConfigForPublish,
		handleOpenPublishPanel,
		handlePublishIdentityDialogOpenChange,
		handlePublishIdentitySaved,
	} = useSkillPublishGuard({
		store,
		t,
		onPublishReady: openPublishPanel,
	})

	useEffect(() => {
		if (store.loading || routeState.panel !== "publish") return

		if (routeState.publishView === "create") {
			void openPublishCreateView()
		} else {
			handleOpenPublishPanel()
		}

		navigate({
			name: RouteName.SkillEdit,
			params: { code: skillCode },
			query: buildSkillEditQuery({ search: location.search, panel: null }),
			replace: true,
		})
	}, [
		handleOpenPublishPanel,
		location.search,
		navigate,
		openPublishCreateView,
		routeState,
		skillCode,
		store.loading,
		store.skill,
	])

	const handleClosePublishPanel = useMemoizedFn(() => {
		setActiveQuickActionPanel(null)
		publishPanelStore.openHistoryView()
	})

	const handleOpenSettingsDialog = useMemoizedFn(() => {
		setIsSettingsDialogOpen(true)
	})

	const handleSettingsDialogOpenChange = useMemoizedFn((open: boolean) => {
		setIsSettingsDialogOpen(open)
	})

	const isSkillIdentityDialogOpen = isSettingsDialogOpen || isPublishIdentityDialogOpen

	const handleSkillIdentityDialogOpenChange = useMemoizedFn((open: boolean) => {
		if (isPublishIdentityDialogOpen) handlePublishIdentityDialogOpenChange(open)
		if (isSettingsDialogOpen) handleSettingsDialogOpenChange(open)
	})

	const handleSkillIdentitySaved = useMemoizedFn(async () => {
		if (isPublishIdentityDialogOpen) {
			await handlePublishIdentitySaved()
			return
		}

		await store.refreshSkillDetail()
	})

	const renderMessagePanel = useMemoizedFn(
		({
			isConversationPanelCollapsed,
			onToggleConversationPanel,
			onExpandConversationPanel,
			historyTriggerMode,
			isHistoryPanelOpen,
			onToggleHistoryPanel,
		}: {
			isConversationPanelCollapsed: boolean
			isDraggingPanel: boolean
			onToggleConversationPanel: () => void
			onExpandConversationPanel: () => void
			historyTriggerMode: "dropdown" | "layout"
			isHistoryPanelOpen: boolean
			onToggleHistoryPanel?: () => void
		}) => {
			if (isPublishPanelVisible) return null

			return (
				<ConversationPanel
					selectedProject={selectedProject}
					topicStore={topicStore}
					mentionPanelStore={store.mentionPanelStore}
					projectFilesStore={store.projectFilesStore}
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					onToggleConversationPanel={onToggleConversationPanel}
					onExpandConversationPanel={onExpandConversationPanel}
					detailPanelVisible={shouldShowDetailPanel}
					historyTriggerMode={historyTriggerMode}
					isHistoryPanelOpen={isHistoryPanelOpen}
					onToggleHistoryPanel={onToggleHistoryPanel}
				/>
			)
		},
	)

	function handleBack() {
		navigate({ delta: -1 })
	}

	if (store.loading) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="skill-edit-loading"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.error) {
		return <SkillEditErrorFallback onBack={handleBack} />
	}

	return (
		<FileActionVisibilityProvider value={HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS}>
			<>
				<TopicDesktopPanels
					containerClassName="flex h-full w-full min-w-0 items-center overflow-hidden"
					detailPanelClassName="flex h-full flex-col"
					isDetailPanelFullscreen={isDetailPanelFullscreen}
					keepDetailMountedWhenHidden
					historyLayout={
						isPublishPanelVisible
							? undefined
							: {
									isOpen: isTopicHistoryPanelOpen,
									onClose: closeTopicHistoryPanel,
									onToggle: toggleTopicHistoryPanel,
									renderPanel: ({
										isConversationPanelCollapsed,
										onExpandConversationPanel,
										onClose,
										closeButtonRef,
									}) => (
										<MessageHeaderTopicHistoryPanel
											selectedProject={selectedProject}
											topicStore={topicStore}
											topicActions={topicActions}
											isConversationPanelCollapsed={
												isConversationPanelCollapsed
											}
											onExpandConversationPanel={onExpandConversationPanel}
											hideTopicListModeIcon
											onClose={onClose}
											closeButtonRef={closeButtonRef}
										/>
									),
								}
					}
					sidebar={
						<div
							className="flex h-full flex-col gap-1"
							data-testid="skill-edit-sidebar"
						>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									className="h-9 w-9 rounded-lg bg-background shadow-xs"
									onClick={handleBack}
									data-testid="crew-edit-back-button"
								>
									<ArrowLeft className="h-4 w-4" />
								</Button>
								<button
									type="button"
									className="flex h-9 flex-1 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-background px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-accent/30"
									onClick={handleOpenSettingsDialog}
									data-testid="skill-name-input"
								>
									<div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
										{store.skill?.logo ? (
											<img
												src={store.skill?.logo}
												alt=""
												className="h-full w-full object-cover"
											/>
										) : (
											<RoleIcon className="h-3.5 w-3.5" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-sidebar-foreground">
											{skillDisplayName}
										</p>
									</div>
								</button>
							</div>

							<div className="flex-1 overflow-hidden rounded-lg border border-border bg-background pt-1">
								<TopicFilesButton
									attachments={attachments}
									setUserSelectDetail={setUserSelectDetail}
									onFileClick={handleFileClickWithPanel}
									projectId={store.project?.id}
									activeFileId={activeFileId}
									title={tSuper("topicFiles.fileTitle")}
									onAttachmentsChange={
										store.projectFilesStore.setWorkspaceFileTree
									}
									selectedProject={store.project}
									isInProject
								/>
							</div>

							{store.skill && (
								<QuickActionCards
									settingsLabel={t("skillEditPage.actions.settings")}
									publishLabel={t("skillEditPage.actions.publish")}
									unpublishedChangesLabel={t(
										"skillEditPage.actions.unpublishedChanges",
									)}
									publishStatus={store.skill?.publishStatus}
									isPublishPrepareLoading={
										isPublishPrepareLoading || isEnsuringSkillConfigForPublish
									}
									canPublish={canOpenSkillPublishPanel}
									activeAction={
										isSkillIdentityDialogOpen
											? "settings"
											: activeQuickActionPanel
									}
									onSettingsClick={handleOpenSettingsDialog}
									onPublishClick={handleOpenPublishPanel}
									extraContent={
										<SkillCollaboratorsQuickAction
											skillCode={skillCode}
											userRole={store.project?.user_role}
										/>
									}
								/>
							)}
						</div>
					}
					detailPanel={
						isPublishPanelVisible ? (
							<PublishPanel
								store={publishPanelStore}
								onClose={handleClosePublishPanel}
								onCreateNewVersion={openPublishCreateView}
							/>
						) : (
							<Detail
								ref={detailRef}
								disPlayDetail={userSelectDetail}
								setUserSelectDetail={setUserSelectDetail}
								userSelectDetail={userSelectDetail}
								attachments={attachments}
								attachmentList={attachmentList}
								activeFileId={activeFileId}
								onActiveFileChange={setActiveFileId}
								onActiveTabChange={handleActiveDetailTabChange}
								onFullscreenChange={setIsDetailPanelFullscreen}
								onFileTabsCacheLoaded={onFileTabsCacheLoaded}
								allowEdit
								selectedProject={store.project}
								projectId={store.project?.id}
								showFallbackWhenEmpty
							/>
						)
					}
					isReadOnly={isPublishPanelVisible}
					showProjectResizeHandle
					shouldShowDetailPanel={shouldShowDetailPanel}
					renderMessagePanel={renderMessagePanel}
				/>
				<EditSkillDialog
					open={isSkillIdentityDialogOpen}
					onOpenChange={handleSkillIdentityDialogOpenChange}
					skillCode={skillCode}
					onSuccess={handleSkillIdentitySaved}
					isPrePublishMode={isPublishIdentityDialogOpen}
					defaultNameRequiredMessage={t("skillEditPage.publishNameDialog.required")}
				/>
			</>
		</FileActionVisibilityProvider>
	)
}

const SkillEditWorkspaceObserver = observer(SkillEditWorkspace)

function SkillEditPage() {
	const { code } = useParams<{ code: string }>()
	const navigate = useNavigate()

	useEffect(() => {
		if (!code) {
			navigate({ name: RouteName.MySkills, replace: true })
		}
	}, [code, navigate])

	if (!code) return null

	return (
		<SkillEditStoreProvider>
			<SkillEditWorkspaceObserver skillCode={code} />
		</SkillEditStoreProvider>
	)
}

export default observer(SkillEditPage)
