import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import PublishPanel, {
	type PublishDraft,
	PublishPanelStore,
} from "@/pages/superMagic/components/PublishPanel"
import type { AgentVersionItem } from "@/apis/modules/crew"
import { crewService } from "@/services/crew/CrewService"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { convertSearchParams } from "@/routes/history/helpers"
import { CREW_EDIT_ERROR } from "../../../constants/errors"
import { useCrewEditStore } from "../../../context"
import { getCrewCodeRequiredMessage, resolveCrewEditError } from "../../../store/shared"
import {
	buildPublishParamsFromDraft,
	createCrewEditPublishPanelData,
	createCrewEditPublishPrefillDraft,
	createInitialCrewEditPublishPanelData,
} from "./publishPanelData"

const CREW_EDIT_PUBLISH_VIEW_QUERY_KEY = "publishView"
const CREW_EDIT_PUBLISH_VERSION_QUERY_KEY = "publishVersion"

function PublishingPanel() {
	const { i18n } = useTranslation("crew/market")
	const store = useCrewEditStore()
	const location = useLocation()
	const navigate = useNavigate()
	const {
		layout: { setActiveStep },
		crewCode,
	} = store
	const submitDraftRef = useRef<(draft: PublishDraft) => Promise<void>>(async () => undefined)
	const versionsRef = useRef<AgentVersionItem[]>([])
	const [publishPanelStore] = useState(
		() =>
			new PublishPanelStore({
				initialData: createInitialCrewEditPublishPanelData(),
				onSubmit: (draft) => submitDraftRef.current(draft),
			}),
	)

	const loadPublishPanelData = useCallback(async () => {
		if (!crewCode) {
			versionsRef.current = []
			publishPanelStore.hydrate(createInitialCrewEditPublishPanelData())
			return
		}

		try {
			const [agentDetail, versions] = await Promise.all([
				crewService.getAgentDetailRaw(crewCode),
				crewService.getAgentVersions(crewCode),
			])
			const panelData = createCrewEditPublishPanelData({
				agentDetail,
				versions: versions.list,
				locale: i18n.resolvedLanguage ?? i18n.language,
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
		i18n.language,
		i18n.resolvedLanguage,
		location.search,
		navigate,
		publishPanelStore,
	])

	const handleCreateNewVersion = useCallback(async () => {
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

		try {
			await crewService.publishAgent(crewCode, buildPublishParamsFromDraft(draft))
			store.markCrewPublished()
			await Promise.all([loadPublishPanelData(), store.refreshAgentDetail()])
		} catch (error) {
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

	return (
		<PublishPanel
			store={publishPanelStore}
			onClose={() => setActiveStep(null)}
			onCreateNewVersion={handleCreateNewVersion}
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
