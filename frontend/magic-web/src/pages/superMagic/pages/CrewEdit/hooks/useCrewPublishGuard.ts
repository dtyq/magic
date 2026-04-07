import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { hasCrewPublishName } from "./publish-name-guard"
import type { CrewIdentityStore } from "../store/identity-store"
import type { CrewLayoutStore } from "../store/layout-store"
import { CREW_EDIT_STEP } from "../store"

interface UseCrewPublishGuardParams {
	identity: CrewIdentityStore
	layout: CrewLayoutStore
	isInitializing: boolean
	openPublishingStep: () => void
}

export function useCrewPublishGuard({
	identity,
	layout,
	isInitializing,
	openPublishingStep,
}: UseCrewPublishGuardParams) {
	const { i18n } = useTranslation()
	const [isPublishNameDialogOpen, setIsPublishNameDialogOpen] = useState(false)
	const hasPublishName = hasCrewPublishName(identity.name_i18n, i18n.language)

	useEffect(() => {
		if (isInitializing && !hasPublishName) return
		if (layout.activeDetailKey !== CREW_EDIT_STEP.Publishing) return
		if (hasPublishName) return

		layout.setActiveStep(null)
		setIsPublishNameDialogOpen(true)
	}, [hasPublishName, isInitializing, layout, layout.activeDetailKey])

	const handleOpenPublishing = useMemoizedFn(() => {
		if (isInitializing && !hasPublishName) return
		if (!hasPublishName) {
			setIsPublishNameDialogOpen(true)
			return
		}

		openPublishingStep()
	})

	const handlePublishNameDialogOpenChange = useMemoizedFn((open: boolean) => {
		setIsPublishNameDialogOpen(open)
	})

	const handleConfirmPublishName = useMemoizedFn(async (name: string) => {
		const nextName = name.trim()
		if (!nextName) return false

		await identity.setI18nFields({
			name_i18n: {
				...identity.name_i18n,
				default: nextName,
			},
			role_i18n: identity.role_i18n,
			description_i18n: identity.description_i18n,
		})

		const isSaved = identity.name_i18n?.default?.trim() === nextName
		if (!isSaved) return false

		setIsPublishNameDialogOpen(false)
		openPublishingStep()
		return true
	})

	return {
		isPublishNameDialogOpen,
		handleConfirmPublishName,
		handleOpenPublishing,
		handlePublishNameDialogOpenChange,
	}
}
