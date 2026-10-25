import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import PublishPanel, {
	type PublishDraft,
	PublishPanelStore,
} from "@/pages/superMagic/components/PublishPanel"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import type { AgentVersionItem } from "@/apis/modules/crew"
import { crewService } from "@/services/crew/CrewService"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { convertSearchParams } from "@/routes/history/helpers"
import {
	AsyncPublishError,
	loadPendingPublishTask,
	resolveAsyncPublishErrorMessage,
	resumePendingPublish,
	runAsyncPublish,
} from "@/pages/superMagic/utils/asyncPublish"
import { CREW_EDIT_ERROR } from "../../../constants/errors"
import { useCrewEditStore } from "../../../context"
import { getCrewCodeRequiredMessage, resolveCrewEditError } from "../../../store/shared"
import {
	buildPublishParamsFromDraft,
	createCrewEditPublishPanelData,
	createCrewEditPublishPrefillDraft,
	createInitialCrewEditPublishPanelData,
	mapAgentPublishTargetTypeToPublishTo,
} from "./publishPanelData"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { useUpload } from "@/hooks/useUploadFiles"
import { ensureWorkspaceAvatarUploaded } from "../../../utils/publish-avatar"

const CREW_EDIT_PUBLISH_VIEW_QUERY_KEY = "publishView"
const CREW_EDIT_PUBLISH_VERSION_QUERY_KEY = "publishVersion"

function PublishingPanel() {
	const { t, i18n } = useTranslation("crew/market")
	const store = useCrewEditStore()
	const location = useLocation()
	const navigate = useNavigate()
	const {
		layout: { setActiveStep },
		crewCode,
	} = store
	const { isAllowed: canCreateAgent } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentCreate,
	)
	const { isAllowed: canPublishAgentTeam } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentPublish,
	)
	const { upload: uploadPublicAvatar } = useUpload({
		storageType: "public",
		useSnowflakeId: true,
	})
	const submitDraftRef = useRef<(draft: PublishDraft) => Promise<void>>(async () => undefined)
	const versionsRef = useRef<AgentVersionItem[]>([])
	const publishAbortRef = useRef<AbortController | null>(null)
	const [publishPanelStore] = useState(
		() =>
			new PublishPanelStore({
				initialData: createInitialCrewEditPublishPanelData({
					canPublishPrivate: canCreateAgent,
					canPublishTeam: canPublishAgentTeam,
				}),
				onSubmit: (draft) => submitDraftRef.current(draft),
			}),
	)
	const loadPublishPanelData = useCallback(async () => {
		if (!crewCode) {
			versionsRef.current = []
			publishPanelStore.hydrate(
				createInitialCrewEditPublishPanelData({
					canPublishPrivate: canCreateAgent,
					canPublishTeam: canPublishAgentTeam,
				}),
			)
			return
		}

		try {
			const [agentDetail, versions, categories] = await Promise.all([
				crewService.getAgentDetailRaw(crewCode),
				crewService.getAgentVersions(crewCode),
				crewService.getStoreCategories({ includeEmpty: true }).catch((error) => {
					console.error("Failed to fetch agent market categories:", error)
					return []
				}),
			])
			const panelData = createCrewEditPublishPanelData({
				agentDetail,
				versions: versions.list,
				categories,
				locale: i18n.resolvedLanguage ?? i18n.language,
				canPublishPrivate: canCreateAgent,
				canPublishTeam: canPublishAgentTeam,
			})
			versionsRef.current = versions.list
			publishPanelStore.hydrate(panelData, {
				preserveDraft: true,
				preserveView: true,
			})
			if (
				publishPanelStore.view === "history" &&
				!hasPublishDraftInput(publishPanelStore.draft)
			) {
				publishPanelStore.resetDraft()
			}

			const publishPrefill = getPublishPrefillFromSearch(location.search)
			if (publishPrefill.publishView === "create") {
				try {
					const prefill = await crewService.getAgentPublishPrefill(crewCode)
					const currentPublishTo = mapAgentPublishTargetTypeToPublishTo(
						prefill.publish_target_type,
					)
					if (currentPublishTo) {
						publishPanelStore.setCurrentPublishTo(currentPublishTo)
					}
					publishPanelStore.openCreateViewWithDraft(
						createCrewEditPublishPrefillDraft({
							prefill,
							versions: versions.list,
							fallbackDraft: {
								...panelData.draft,
								version: publishPrefill.publishVersion || panelData.draft.version,
							},
						}),
					)
				} catch (error) {
					console.error("Failed to fetch agent publish prefill:", error)
					publishPanelStore.openCreateViewWithDraft({
						...panelData.draft,
						version: publishPrefill.publishVersion || panelData.draft.version,
					})
				}
				clearPublishPrefillQuery({
					crewCode,
					search: location.search,
					navigate,
				})
			}
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.loadAgentFailed,
			})
			magicToast.error(message)
		}
	}, [
		crewCode,
		canCreateAgent,
		canPublishAgentTeam,
		i18n.language,
		i18n.resolvedLanguage,
		location.search,
		navigate,
		publishPanelStore,
	])

	const resumeActionRef = useRef({
		loadPublishPanelData,
		t,
		store,
	})
	resumeActionRef.current = {
		loadPublishPanelData,
		t,
		store,
	}

	const openCreateNewVersion = useCallback(async () => {
		if (!crewCode) {
			magicToast.error(getCrewCodeRequiredMessage())
			return
		}

		publishPanelStore.resetDraft()
		const fallbackDraft = {
			...publishPanelStore.draft,
			specificMembers: [...publishPanelStore.draft.specificMembers],
		}
		let versions = versionsRef.current

		if (!versions.length) {
			try {
				const response = await crewService.getAgentVersions(crewCode)
				versions = response.list
				versionsRef.current = response.list
			} catch (error) {
				console.error("Failed to refresh agent versions for prefill:", error)
			}
		}

		try {
			const prefill = await crewService.getAgentPublishPrefill(crewCode)
			const currentPublishTo = mapAgentPublishTargetTypeToPublishTo(
				prefill.publish_target_type,
			)
			if (currentPublishTo) {
				publishPanelStore.setCurrentPublishTo(currentPublishTo)
			}
			publishPanelStore.openCreateViewWithDraft(
				createCrewEditPublishPrefillDraft({
					prefill,
					versions,
					fallbackDraft,
				}),
			)
		} catch (error) {
			console.error("Failed to fetch agent publish prefill:", error)
			publishPanelStore.openCreateViewWithDraft(fallbackDraft)
		}
	}, [crewCode, publishPanelStore])

	submitDraftRef.current = async (draft) => {
		if (!crewCode) {
			magicToast.error(getCrewCodeRequiredMessage())
			return
		}

		publishAbortRef.current?.abort()
		const abortController = new AbortController()
		publishAbortRef.current = abortController

		try {
			await ensureWorkspaceAvatarUploaded({
				crewCode,
				currentIcon: store.identity.icon,
				workspaceFiles: store.projectFilesStore.workspaceFilesList,
				upload: uploadPublicAvatar,
				onAvatarUploaded: (avatarUrl) => {
					store.identity.setAvatarUrl(avatarUrl)
				},
			})

			await runAsyncPublish({
				resourceType: "agent",
				code: crewCode,
				draft,
				create: () =>
					crewService.publishAgentAsync(crewCode, buildPublishParamsFromDraft(draft)),
				check: (publishTaskId) => crewService.checkAgentPublish(crewCode, publishTaskId),
				onProgress: (progress) => publishPanelStore.setPublishProgress(progress),
				signal: abortController.signal,
			})
			magicToast.success(t("skillEditPage.publishPanel.toast.publishSuccess"))
			store.markCrewPublished()
			await Promise.all([loadPublishPanelData(), store.refreshAgentDetail()])
		} catch (error) {
			if (error instanceof AsyncPublishError && error.reason === "aborted") {
				throw error
			}

			if (error instanceof AsyncPublishError) {
				magicToast.error(resolveAsyncPublishErrorMessage(error, t))
				throw error
			}

			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
			})
			magicToast.error(message)
			throw error
		}
	}

	useEffect(() => {
		void loadPublishPanelData()
	}, [loadPublishPanelData])

	/**
	 * Resume polling when re-entering with a pending publish_task_id.
	 * If the task is already ready, settle silently (no loading UI / success toast).
	 */
	useEffect(() => {
		if (!crewCode) return
		const pending = loadPendingPublishTask<PublishDraft>("agent", crewCode)
		if (!pending?.publish_task_id) return

		publishAbortRef.current?.abort()
		const abortController = new AbortController()
		publishAbortRef.current = abortController
		let active = true
		let waitingUiStarted = false

		void (async () => {
			const {
				loadPublishPanelData: reloadPanel,
				t: translate,
				store: crewStore,
			} = resumeActionRef.current
			try {
				const result = await resumePendingPublish({
					resourceType: "agent",
					code: crewCode,
					publishTaskId: pending.publish_task_id,
					draft: pending.draft,
					check: (publishTaskId) =>
						crewService.checkAgentPublish(crewCode, publishTaskId),
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

				crewStore.markCrewPublished()
				await Promise.all([reloadPanel(), crewStore.refreshAgentDetail()])
				if (!active) return

				if (result.alreadyReady) {
					// Already finished while user was away — refresh quietly, no toast / loading.
					publishPanelStore.openHistoryView()
					return
				}

				magicToast.success(translate("skillEditPage.publishPanel.toast.publishSuccess"))
				publishPanelStore.openHistoryView()
			} catch (error) {
				if (!active) return
				if (error instanceof AsyncPublishError && error.reason === "aborted") return
				if (error instanceof AsyncPublishError) {
					magicToast.error(resolveAsyncPublishErrorMessage(error, translate))
					return
				}
				const { message } = resolveCrewEditError({
					error,
					fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
				})
				magicToast.error(message)
			} finally {
				if (active && waitingUiStarted) publishPanelStore.clearPublishingState()
			}
		})()

		return () => {
			active = false
			abortController.abort()
			if (waitingUiStarted) publishPanelStore.clearPublishingState()
		}
	}, [crewCode, publishPanelStore])

	useEffect(() => {
		return () => {
			publishAbortRef.current?.abort()
		}
	}, [])

	return (
		<PublishPanel
			store={publishPanelStore}
			onClose={() => setActiveStep(null)}
			onCreateNewVersion={openCreateNewVersion}
		/>
	)
}

export default observer(PublishingPanel)

function getPublishPrefillFromSearch(search: string) {
	const searchParams = new URLSearchParams(search)
	return {
		publishView:
			searchParams.get(CREW_EDIT_PUBLISH_VIEW_QUERY_KEY) === "create" ? "create" : null,
		publishVersion: searchParams.get(CREW_EDIT_PUBLISH_VERSION_QUERY_KEY)?.trim() ?? "",
	}
}

function clearPublishPrefillQuery({
	crewCode,
	search,
	navigate,
}: {
	crewCode: string
	search: string
	navigate: ReturnType<typeof useNavigate>
}) {
	const searchParams = new URLSearchParams(search)
	searchParams.delete(CREW_EDIT_PUBLISH_VIEW_QUERY_KEY)
	searchParams.delete(CREW_EDIT_PUBLISH_VERSION_QUERY_KEY)

	const query = convertSearchParams(searchParams)

	navigate({
		name: RouteName.CrewEdit,
		params: { id: crewCode },
		query: Object.keys(query).length > 0 ? query : undefined,
		replace: true,
		viewTransition: false,
	})
}

function hasPublishDraftInput(draft: PublishDraft) {
	if (draft.version.trim()) return true
	if (typeof draft.details === "string") return draft.details.trim().length > 0
	return Object.values(draft.details).some((value) => value?.trim())
}
