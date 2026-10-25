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
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { logger } from "@/infrastructure/logger"
import { userStore } from "@/models/user"
import { SupportLocales } from "@/constants/locale"
import { skillsService } from "@/services/skills/SkillsService"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { MessageHeaderTopicHistoryPanel } from "@/pages/superMagic/components/MessageHeader"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { useCompositeDetailPanelController } from "@/pages/superMagic/hooks/useCompositeDetailPanelController"
import { useDeferUntilFileTabsCacheLoaded } from "@/pages/superMagic/hooks/useDeferUntilFileTabsCacheLoaded"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import SuperMagicService, { loadProjectAttachments } from "@/pages/superMagic/services"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import PublishPanel, { PublishPanelStore } from "@/pages/superMagic/components/PublishPanel"
import {
	AsyncPublishError,
	loadPendingPublishTask,
	resolveAsyncPublishErrorMessage,
	resumePendingPublish,
	runAsyncPublish,
} from "@/pages/superMagic/utils/asyncPublish"
import {
	FileAccessProvider,
	EDITOR_FILE_CONFIG,
	VIEWER_FILE_CONFIG,
} from "@/pages/superMagic/providers/FileAccessProvider"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { SkillEditStoreProvider, useSkillEditStore } from "./context"
import QuickActionCards from "./components/QuickActionCards"
import SkillFilesPanel from "./components/SkillFilesPanel"
import { MY_SKILLS_WORKSPACE_DATA } from "@/pages/superMagic/constants"
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
import {
	buildDefaultSlotUpdateParams,
	findAttachmentByRelativePath,
	SKILL_CONFIG_RELATIVE_PATH,
} from "./utils/skill-workspace-manifest"
import { ensureSkillConfigYamlForPublish } from "./utils/ensureSkillConfigYaml"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { usePublishScopeNotice } from "@/pages/superMagic/hooks/usePublishScopeNotice"

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
			<button
				type="button"
				className="text-sm text-primary hover:underline"
				onClick={onBack}
				data-testid="on-back"
			>
				{t("back")}
			</button>
		</div>
	)
}

function SkillEditWorkspace({ skillCode }: { skillCode: string }) {
	const { t } = useTranslation("crew/market")
	const { t: tSuper } = useTranslation("super")
	const skillsWorkspace = useMemo(() => MY_SKILLS_WORKSPACE_DATA(tSuper), [tSuper])
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
	const [isInitialAttachmentsLoaded, setIsInitialAttachmentsLoaded] = useState(false)
	const [isInitialAttachmentsLoadFailed, setIsInitialAttachmentsLoadFailed] = useState(false)
	const { isAllowed: canCreateSkill } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillCreate,
	)
	const { isAllowed: canPublishSkillTeam } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillPublish,
	)
	const selectedProject = store.project
	const isViewer = isReadOnlyProject(selectedProject?.user_role)
	const canOpenSkillPublishPanel = !isViewer && (canCreateSkill || canPublishSkillTeam)
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
		publishPanelStore: null as PublishPanelStore | null,
	})
	const publishAbortRef = useRef<AbortController | null>(null)

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
					publishPanelStore: panelStore,
				} = publishPanelActionRef.current

				publishAbortRef.current?.abort()
				const abortController = new AbortController()
				publishAbortRef.current = abortController

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

					await runAsyncPublish({
						resourceType: "skill",
						code,
						draft,
						create: () =>
							skillsService.publishSkillAsync(
								code,
								buildPublishParamsFromDraft(draft),
							),
						check: (publishTaskId) =>
							skillsService.checkSkillPublish(code, publishTaskId),
						onProgress: (progress) => panelStore?.setPublishProgress(progress),
						signal: abortController.signal,
					})
					magicToast.success(translate("skillEditPage.publishPanel.toast.publishSuccess"))
					await skillStore.refreshSkillDetail()
					await rv()
				} catch (error) {
					if (error instanceof AsyncPublishError && error.reason === "aborted") {
						throw error
					}
					if (error instanceof AsyncPublishError) {
						magicToast.error(resolveAsyncPublishErrorMessage(error, translate))
						throw error
					}
					magicToast.error(translate("skillEditPage.publishPanel.toast.publishFailed"))
					throw error
				}
			},
		})
	}, [skillCode, t])

	publishPanelActionRef.current = {
		store,
		skillCode,
		refreshSkillVersions,
		t,
		publishPanelStore,
	}

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
		(projectId?: string, callback?: (didLoad: boolean) => void) => {
			if (!projectId) {
				store.projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				setIsInitialAttachmentsLoaded(false)
				callback?.(false)
				return
			}

			let didLoad = false
			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				loadProjectAttachments({
					projectId,
				})
					.then((res) => {
						store.projectFilesStore.setWorkspaceFileTree(res.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
						didLoad = true
						if (store.project?.id === projectId) {
							setIsInitialAttachmentsLoadFailed(false)
						}
					})
					.catch((error) => {
						console.error("Failed to fetch attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
						if (store.project?.id === projectId) {
							setIsInitialAttachmentsLoadFailed(true)
						}
					})
					.finally(() => {
						resolveAttachmentsRefreshWaitersForProject(projectId, didLoad)
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.(didLoad)
					}),
			)
		},
		{ wait: 500 },
	).run

	useEffect(() => {
		setIsInitialAttachmentsLoaded(false)
		void store.initFromSkillCode(skillCode)
	}, [skillCode, store])

	const visitScope = useRef({})
	useEffect(() => {
		if (!store.project || store.loading || store.error || store.currentSkillCode !== skillCode)
			return
		SuperMagicService.project.recordProjectVisit(store.project, visitScope.current)
	}, [skillCode, store, store.project, store.loading, store.error, store.currentSkillCode])

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

	const { checkNowDebounced: checkAttachmentsNowDebounced } = useAttachmentsPolling({
		projectId: store.project?.id,
		store: store.projectFilesStore,
		autoStart: false,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
				setIsInitialAttachmentsLoadFailed(false)
				setIsInitialAttachmentsLoaded(true)
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll skill attachments:", error)
		}),
	})

	useProjectAttachmentsChangeRealtime({
		projectId: store.project?.id,
		store: store.projectFilesStore,
		onAttachmentsChange: undefined,
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime skill attachments:", error)
			setIsInitialAttachmentsLoadFailed(true)
		}),
	})

	useDeepCompareEffect(() => {
		const projectId = store.project?.id
		if (!projectId) {
			setIsInitialAttachmentsLoaded(false)
			setIsInitialAttachmentsLoadFailed(false)
			return
		}

		let isActive = true
		setIsInitialAttachmentsLoaded(false)
		setIsInitialAttachmentsLoadFailed(false)

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId, (didLoad) => {
			if (!isActive) return
			if (didLoad) {
				setIsInitialAttachmentsLoadFailed(false)
				setIsInitialAttachmentsLoaded(true)
			}
		})

		return () => {
			isActive = false
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [store.project?.id])

	useEffect(() => {
		const handleUpdateAttachments = (
			payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
		) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)
			const pid = store.project?.id
			if (!pid) {
				payload?.callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, payload?.callback)
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
		if (isViewer || !store.project?.id) return
		if (!store.projectFilesStore.workspaceFilesList.length) return

		debouncedSyncWorkspaceManifest()
	}, [isViewer, store.project?.id, store.projectFilesStore.workspaceFilesList])

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
			isReadOnly: isViewer,
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

	const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
		useTopicHistoryLayoutState({
			storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.skillEdit,
			isEnabled: !isViewer && !isPublishPanelVisible,
		})

	const openPublishPanel = useMemoizedFn(() => {
		void refreshSkillVersions()
		setActiveQuickActionPanel("publish")
		setActiveFileId(null)
		setUserSelectDetail(undefined)
		setIsDetailPanelFullscreen(false)
	})

	// Resume async publish polling when the user re-opens the publish panel mid-task.
	// Already-ready tasks settle silently (no loading button / success toast).
	useEffect(() => {
		if (!isPublishPanelVisible || !skillCode) return
		const pending = loadPendingPublishTask<PublishDraft>("skill", skillCode)
		if (!pending?.publish_task_id) return

		publishAbortRef.current?.abort()
		const abortController = new AbortController()
		publishAbortRef.current = abortController
		let active = true
		let waitingUiStarted = false

		void (async () => {
			try {
				const result = await resumePendingPublish({
					resourceType: "skill",
					code: skillCode,
					publishTaskId: pending.publish_task_id,
					draft: pending.draft,
					check: (publishTaskId) =>
						skillsService.checkSkillPublish(skillCode, publishTaskId),
					onProgress: (progress) => {
						if (active && waitingUiStarted) {
							publishPanelStore.setPublishProgress(progress)
						}
					},
					signal: abortController.signal,
					onStartWaiting: (draft) => {
						if (!active) return
						waitingUiStarted = true
						publishPanelStore.beginPublishing(0)
						if (draft) {
							publishPanelStore.openCreateViewWithDraft(draft)
						} else {
							publishPanelStore.openCreateView()
						}
					},
				})
				if (!active) return

				await store.refreshSkillDetail()
				await refreshSkillVersions()
				if (!active) return

				if (result.alreadyReady) {
					publishPanelStore.openHistoryView()
					return
				}

				magicToast.success(t("skillEditPage.publishPanel.toast.publishSuccess"))
				publishPanelStore.openHistoryView()
			} catch (error) {
				if (!active) return
				if (error instanceof AsyncPublishError && error.reason === "aborted") return
				if (error instanceof AsyncPublishError) {
					magicToast.error(resolveAsyncPublishErrorMessage(error, t))
					return
				}
				magicToast.error(t("skillEditPage.publishPanel.toast.publishFailed"))
			} finally {
				if (active && waitingUiStarted) publishPanelStore.clearPublishingState()
			}
		})()

		return () => {
			active = false
			abortController.abort()
			if (waitingUiStarted) publishPanelStore.clearPublishingState()
		}
	}, [isPublishPanelVisible, publishPanelStore, refreshSkillVersions, skillCode, store, t])

	useEffect(() => {
		return () => {
			publishAbortRef.current?.abort()
		}
	}, [])

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

	const skillPublishPath = useMemo(
		() =>
			store.skillWorkspaceDir
				? `.magic/skills/${store.skillWorkspaceDir}`
				: ".magic/skills/<skill.dir>",
		[store.skillWorkspaceDir],
	)
	const prepareSkillPublishScope = useMemoizedFn(async () => {
		const configItem = findAttachmentByRelativePath(
			store.projectFilesStore.workspaceFilesList,
			SKILL_CONFIG_RELATIVE_PATH,
		)
		if (!configItem?.file_id) return true

		await store.syncSkillWorkspaceManifest({ syncDefaultSlot: false })
		if (store.skillWorkspaceDir) return true
		magicToast.error(t("skillEditPage.publishPanel.toast.noValidSkillForPublish"))
		return false
	})
	const { checkBeforeContinue, noticeDialog } = usePublishScopeNotice({
		projectId: store.project?.id,
		getAttachmentsStatus: () => ({
			isLoaded: isInitialAttachmentsLoaded,
			hasError: isInitialAttachmentsLoadFailed,
		}),
		getAttachments: () => store.projectFilesStore.workspaceFilesList,
		publishPath: () =>
			store.skillWorkspaceDir ? `.magic/skills/${store.skillWorkspaceDir}` : skillPublishPath,
		excludedPaths: [SKILL_CONFIG_RELATIVE_PATH],
		prepareBeforeCheck: prepareSkillPublishScope,
	})
	const openPublishPanelWithNotice = useMemoizedFn(async () => {
		await checkBeforeContinue(openPublishPanel)
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
		onPublishReady: openPublishPanelWithNotice,
	})

	useEffect(() => {
		if (store.loading || routeState.panel !== "publish") return
		if (isViewer) {
			navigate({
				name: RouteName.SkillEdit,
				params: { code: skillCode },
				query: buildSkillEditQuery({ search: location.search, panel: null }),
				replace: true,
			})
			return
		}

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
		isViewer,
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
		if (isViewer) return
		setIsSettingsDialogOpen(true)
	})

	useEffect(() => {
		if (!isViewer) return
		setIsSettingsDialogOpen(false)
		handlePublishIdentityDialogOpenChange(false)
		setActiveQuickActionPanel(null)
	}, [handlePublishIdentityDialogOpenChange, isViewer])

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
			if (isViewer || isPublishPanelVisible) return null

			return (
				<ConversationPanel
					selectedProject={selectedProject}
					topicStore={topicStore}
					mentionPanelStore={store.mentionPanelStore}
					projectFilesStore={store.projectFilesStore}
					onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
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
		<HostConversationProvider selectedProject={selectedProject} topicStore={topicStore}>
			<FileAccessProvider {...(isViewer ? VIEWER_FILE_CONFIG : EDITOR_FILE_CONFIG)}>
				<>
					<TopicDesktopPanels
						containerClassName="flex h-full w-full min-w-0 items-center overflow-hidden"
						detailPanelClassName="flex h-full flex-col"
						isDetailPanelFullscreen={isDetailPanelFullscreen}
						keepDetailMountedWhenHidden
						historyLayout={
							isViewer || isPublishPanelVisible
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
												onExpandConversationPanel={
													onExpandConversationPanel
												}
												hideTopicListModeIcon
												hideTopicTypeFilter
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
										disabled={isViewer}
										data-testid="skill-name-input"
									>
										<div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
											{store.skill?.logo ? (
												<img
													src={store.skill?.logo}
													alt=""
													className="h-full w-full object-cover"
													data-testid="index-desktop-image"
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
									<SkillFilesPanel
										readOnly={isViewer}
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
										selectedWorkspace={skillsWorkspace}
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
											isPublishPrepareLoading ||
											isEnsuringSkillConfigForPublish
										}
										canPublish={canOpenSkillPublishPanel}
										hideSettings={isViewer}
										hidePublish={isViewer}
										activeAction={
											isSkillIdentityDialogOpen
												? "settings"
												: activeQuickActionPanel
										}
										onSettingsClick={handleOpenSettingsDialog}
										onPublishClick={handleOpenPublishPanel}
										extraContent={
											isViewer ? null : (
												<SkillCollaboratorsQuickAction
													skillCode={skillCode}
													userRole={store.project?.user_role}
												/>
											)
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
									allowEdit={!isViewer}
									selectedProject={store.project}
									projectId={store.project?.id}
									showFallbackWhenEmpty
								/>
							)
						}
						isReadOnly={isViewer || isPublishPanelVisible}
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
					{noticeDialog}
				</>
			</FileAccessProvider>
		</HostConversationProvider>
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
