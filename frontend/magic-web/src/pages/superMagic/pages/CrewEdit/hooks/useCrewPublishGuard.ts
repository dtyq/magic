import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { hasCrewPublishName } from "./publish-name-guard"
import type { CrewIdentityStore } from "../store/identity-store"
import type { CrewLayoutStore } from "../store/layout-store"
import { CREW_EDIT_STEP } from "../store"

interface UseCrewPublishGuardParams {
	identity: CrewIdentityStore
	layout: CrewLayoutStore
	isInitializing: boolean
	projectId?: string
	openPublishingStep: () => void
}

export function useCrewPublishGuard({
	identity,
	layout,
	isInitializing,
	projectId,
	openPublishingStep,
}: UseCrewPublishGuardParams) {
	const { t, i18n } = useTranslation("crew/create")
	const [isPublishIdentityDialogOpen, setIsPublishIdentityDialogOpen] = useState(false)
	const [isPublishingPending, setIsPublishingPending] = useState(false)
	const hasPublishName = hasCrewPublishName(identity.name_i18n, i18n.language)

	useEffect(() => {
		if (isInitializing && !hasPublishName) return
		if (layout.activeDetailKey !== CREW_EDIT_STEP.Publishing) return
		if (hasPublishName) return

		layout.setActiveStep(null)
		setIsPublishIdentityDialogOpen(true)
	}, [hasPublishName, isInitializing, layout, layout.activeDetailKey])

	const preparePublishing = useMemoizedFn(async () => {
		setIsPublishingPending(true)
		try {
			const isIdentityFileReady = await identity.ensureIdentityMarkdownFile({ projectId })
			if (!isIdentityFileReady) magicToast.warning(t("errors.syncIdentityMarkdownFailed"))

			const isMarkdownSynced = await identity.syncI18nFieldsToIdentityMarkdown({
				name_i18n: identity.name_i18n,
				role_i18n: identity.role_i18n,
				description_i18n: identity.description_i18n,
			})
			if (!isMarkdownSynced) magicToast.warning(t("errors.syncIdentityMarkdownFailed"))

			openPublishingStep()
		} finally {
			setIsPublishingPending(false)
		}
	})

	const handleOpenPublishing = useMemoizedFn(() => {
		void (async () => {
			if (layout.activeDetailKey === CREW_EDIT_STEP.Publishing) {
				openPublishingStep()
				return
			}
			if (isPublishingPending) return
			if (isInitializing && !hasPublishName) return
			if (!hasPublishName) {
				setIsPublishIdentityDialogOpen(true)
				return
			}

			await preparePublishing()
		})()
	})

	const handlePublishIdentityDialogOpenChange = useMemoizedFn((open: boolean) => {
		setIsPublishIdentityDialogOpen(open)
	})

	const handlePublishIdentitySaved = useMemoizedFn(async () => {
		setIsPublishIdentityDialogOpen(false)
		await preparePublishing()
	})

	return {
		isPublishIdentityDialogOpen,
		isPublishingPending,
		handleOpenPublishing,
		handlePublishIdentityDialogOpenChange,
		handlePublishIdentitySaved,
	}
}
