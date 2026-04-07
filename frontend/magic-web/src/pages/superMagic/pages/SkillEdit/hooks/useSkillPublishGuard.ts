import { useState } from "react"
import type { TFunction } from "i18next"
import { useMemoizedFn } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import { skillsService } from "@/services/skills/SkillsService"
import type { SkillEditRootStore } from "../store/root-store"

interface UseSkillPublishGuardParams {
	store: SkillEditRootStore
	t: TFunction<"crew/market">
	onPublishReady: () => void
}

export function useSkillPublishGuard({ store, t, onPublishReady }: UseSkillPublishGuardParams) {
	const [isSavingSkillName, setIsSavingSkillName] = useState(false)
	const [isPublishNameDialogOpen, setIsPublishNameDialogOpen] = useState(false)

	const saveSkillName = useMemoizedFn(async (name: string) => {
		const skill = store.skill
		if (!skill) return false

		const nextName = name.trim()
		if (nextName === skill.name) return true

		const previousName = skill.name
		const previousNameI18n = skill.nameI18n
		const nextNameI18n = store.setSkillName(nextName)
		if (!nextNameI18n) return false

		setIsSavingSkillName(true)

		try {
			await skillsService.updateSkillInfo(skill.code, {
				name_i18n: nextNameI18n,
			})
			await store.refreshSkillDetail()
			return true
		} catch {
			store.setSkillName(previousName, previousNameI18n)
			magicToast.error(t("editSkill.errors.saveFailed"))
			return false
		} finally {
			setIsSavingSkillName(false)
		}
	})

	const handleSaveSkillName = useMemoizedFn(async (name: string) => {
		await saveSkillName(name)
	})

	const handleOpenPublishPanel = useMemoizedFn(() => {
		if (!store.skill?.name?.trim()) {
			setIsPublishNameDialogOpen(true)
			return
		}

		onPublishReady()
	})

	const handlePublishNameDialogOpenChange = useMemoizedFn((open: boolean) => {
		setIsPublishNameDialogOpen(open)
	})

	const handleConfirmPublishName = useMemoizedFn(async (name: string) => {
		const isSaved = await saveSkillName(name)
		if (!isSaved) return false

		setIsPublishNameDialogOpen(false)
		onPublishReady()
		return true
	})

	return {
		isPublishNameDialogOpen,
		isSavingSkillName,
		handleConfirmPublishName,
		handleOpenPublishPanel,
		handlePublishNameDialogOpenChange,
		handleSaveSkillName,
	}
}
